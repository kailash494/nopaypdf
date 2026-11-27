/**
 * NoPayPDF - Automated Multi-Tool Headless Verification Suite (CDP)
 * Serves static dist/ with exact _headers CSP rules and runs real E2E workflows
 * across all 16 non-editor tools.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_ROOT = path.join(REPO_ROOT, 'dist');
const PORT = 8126;
const DEBUG_PORT = 9238;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.wasm': 'application/wasm',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
};

function readDistCsp() {
    const headersFile = path.join(DIST_ROOT, '_headers');
    if (!fs.existsSync(headersFile)) {
        throw new Error(`Missing ${headersFile}. Run build-static.php before running tests.`);
    }
    const txt = fs.readFileSync(headersFile, 'utf8');
    const match = txt.match(/Content-Security-Policy:\s*(.+)/);
    return match ? match[1].trim() : '';
}

function startStaticServer(cspPolicy) {
    const server = http.createServer((req, res) => {
        const reqUrl = new URL(req.url || '/', BASE_URL);
        let pathname = decodeURIComponent(reqUrl.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';

        let localPath = path.join(DIST_ROOT, pathname.replace(/^\/+/, ''));
        if (fs.existsSync(localPath) && fs.statSync(localPath).isDirectory()) {
            localPath = path.join(localPath, 'index.html');
        }

        if (!fs.existsSync(localPath) || !localPath.startsWith(DIST_ROOT)) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not Found');
            return;
        }

        const ext = path.extname(localPath).toLowerCase();
        const headers = {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Cache-Control': 'no-store',
        };
        if (ext === '.html' && cspPolicy) {
            headers['Content-Security-Policy'] = cspPolicy;
        }
        res.writeHead(200, headers);
        fs.createReadStream(localPath).pipe(res);
    });

    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(PORT, '127.0.0.1', () => resolve(server));
    });
}

async function connectCDP() {
    for (let i = 0; i < 45; i++) {
        await new Promise((r) => setTimeout(r, 150));
        try {
            const raw = await new Promise((resolve, reject) => {
                http.get(`http://127.0.0.1:${DEBUG_PORT}/json/list`, (res) => {
                    let d = '';
                    res.on('data', (c) => { d += c; });
                    res.on('end', () => resolve(d));
                }).on('error', reject);
            });
            const targets = JSON.parse(raw);
            const target = targets.find((x) => x.type === 'page' && x.webSocketDebuggerUrl);
            if (!target) continue;
            const ws = new WebSocket(target.webSocketDebuggerUrl);
            await new Promise((resolve, reject) => {
                ws.addEventListener('open', resolve, { once: true });
                ws.addEventListener('error', reject, { once: true });
            });
            return ws;
        } catch (_) {}
    }
    throw new Error('Could not connect to Chromium CDP endpoint.');
}

function makeCDP(ws) {
    let idCounter = 1;
    const pending = new Map();
    const listeners = new Map();

    ws.addEventListener('message', (evt) => {
        const msg = JSON.parse(typeof evt.data === 'string' ? evt.data : evt.data.toString());
        if (msg.id && pending.has(msg.id)) {
            const p = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) p.reject(new Error(`${msg.error.message} (${msg.error.code})`));
            else p.resolve(msg.result);
        } else if (msg.method) {
            const arr = listeners.get(msg.method) || [];
            for (const fn of arr) fn(msg.params);
        }
    });

    function send(method, params = {}, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            const id = idCounter++;
            const timer = setTimeout(() => {
                if (pending.has(id)) {
                    pending.delete(id);
                    reject(new Error(`CDP timeout on ${method}`));
                }
            }, timeoutMs);
            pending.set(id, {
                resolve: (v) => { clearTimeout(timer); resolve(v); },
                reject: (e) => { clearTimeout(timer); reject(e); },
            });
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    function on(method, fn) {
        if (!listeners.has(method)) listeners.set(method, []);
        listeners.get(method).push(fn);
    }

    return { send, on };
}

const PAGE_HELPERS = `
(() => {
    window.__testDownloads = [];
    window.__nativeDialogCalls = [];

    window.alert = (msg) => { window.__nativeDialogCalls.push({ type: 'alert', msg: String(msg) }); };
    window.confirm = (msg) => { window.__nativeDialogCalls.push({ type: 'confirm', msg: String(msg) }); return true; };
    window.prompt = (msg) => { window.__nativeDialogCalls.push({ type: 'prompt', msg: String(msg) }); return ''; };

    const origCreateObjectURL = URL.createObjectURL.bind(URL);
    window.__objectUrlBlobs = new Map();
    URL.createObjectURL = (obj) => {
        const u = origCreateObjectURL(obj);
        if (obj instanceof Blob) window.__objectUrlBlobs.set(u, obj);
        return u;
    };

    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
        if (this.hasAttribute('download')) {
            const blob = window.__objectUrlBlobs.get(this.href) || null;
            window.__testDownloads.push({
                downloadAttr: this.getAttribute('download'),
                href: this.href,
                size: blob ? blob.size : 0,
                type: blob ? blob.type : '',
                blob,
            });
            return;
        }
        return origClick.apply(this, arguments);
    };

    window.__readLastDownload = async () => {
        const last = window.__testDownloads[window.__testDownloads.length - 1];
        if (!last) return null;
        let headerHex = '';
        let ascii = '';
        let fullBytes = null;
        if (last.blob) {
            const ab = await last.blob.arrayBuffer();
            const buf = new Uint8Array(ab);
            fullBytes = buf;
            const head = buf.slice(0, 16);
            headerHex = Array.from(head).map((b) => b.toString(16).padStart(2, '0')).join(' ');
            ascii = Array.from(head).map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
        }
        return { filename: last.downloadAttr, size: last.size, mime: last.type, headerHex, ascii, bytes: fullBytes };
    };

    window.__makeSamplePdfFile = async (filename = 'sample.pdf', pageCount = 2, opts = {}) => {
        if (window.PDFLib) {
            const doc = await window.PDFLib.PDFDocument.create();
            for (let i = 0; i < pageCount; i++) {
                const p = doc.addPage([opts.width || 612, opts.height || 792]);
                if (opts.rotateDeg) p.setRotation(window.PDFLib.degrees(opts.rotateDeg));
                p.drawRectangle({ x: 40, y: 650, width: 200, height: 60, color: window.PDFLib.rgb(0.2, 0.4, 0.8) });
                p.drawText(opts.text || ('TEST PAGE ' + (i + 1)), {
                    x: 50,
                    y: 500,
                    size: opts.fontSize || 24,
                    color: window.PDFLib.rgb(0, 0, 0),
                });
            }
            const bytes = await doc.save();
            return new File([bytes], filename, { type: 'application/pdf' });
        }
        if (window.jspdf && window.jspdf.jsPDF) {
            const pdf = new window.jspdf.jsPDF();
            pdf.text(opts.text || 'TEST PAGE 1', 20, 30);
            return new File([pdf.output('arraybuffer')], filename, { type: 'application/pdf' });
        }
        // Dependency-free valid PDF generator for pages that omit PDFLib
        const enc = new TextEncoder();
        const kids = [];
        const pageObjs = [];
        const contentObjs = [];
        for (let i = 0; i < pageCount; i++) {
            const pObjNum = 3 + i * 2;
            const cObjNum = 4 + i * 2;
            kids.push(pObjNum + ' 0 R');
            const label = (opts.text || ('TEST PAGE ' + (i + 1))).replace(/[()\\\\]/g, ' ');
            const stream = 'BT /F1 24 Tf 50 700 Td (' + label + ') Tj ET\\n0.2 0.4 0.8 rg 40 600 200 60 re f';
            pageObjs.push(
                pObjNum + ' 0 obj\\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + (opts.width || 612) + ' ' + (opts.height || 792) +
                '] /Resources << /Font << /F1 ' + (3 + pageCount * 2) + ' 0 R >> >> /Contents ' + cObjNum + ' 0 R >>\\nendobj\\n'
            );
            contentObjs.push(
                cObjNum + ' 0 obj\\n<< /Length ' + stream.length + ' >>\\nstream\\n' + stream + '\\nendstream\\nendobj\\n'
            );
        }
        const fontObjNum = 3 + pageCount * 2;
        const objs = [
            '1 0 obj\\n<< /Type /Catalog /Pages 2 0 R >>\\nendobj\\n',
            '2 0 obj\\n<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pageCount + ' >>\\nendobj\\n',
        ];
        for (let i = 0; i < pageCount; i++) {
            objs.push(pageObjs[i], contentObjs[i]);
        }
        objs.push(fontObjNum + ' 0 obj\\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\\nendobj\\n');
        let body = '%PDF-1.4\\n';
        const offsets = [0];
        for (const o of objs) {
            offsets.push(body.length);
            body += o;
        }
        const xrefOffset = body.length;
        body += 'xref\\n0 ' + offsets.length + '\\n0000000000 65535 f \\n';
        for (let i = 1; i < offsets.length; i++) {
            body += String(offsets[i]).padStart(10, '0') + ' 00000 n \\n';
        }
        body += 'trailer\\n<< /Size ' + offsets.length + ' /Root 1 0 R >>\\nstartxref\\n' + xrefOffset + '\\n%%EOF\\n';
        return new File([enc.encode(body)], filename, { type: 'application/pdf' });
    };

    window.__makeSamplePngFile = async (filename = 'sample.png', w = 320, h = 160, label = 'SAMPLE PNG') => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 34px sans-serif';
        ctx.fillText(label, 20, Math.round(h / 2));
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        return new File([blob], filename, { type: 'image/png' });
    };

    // Minimal stored PKZIP builder for generating a valid .docx test fixture in-browser
    window.__makeSampleDocxFile = (filename = 'sample.docx', bodyText = 'Hello World Document Check') => {
        const enc = new TextEncoder();
        const crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            crcTable[n] = c >>> 0;
        }
        const crc32 = (u8) => {
            let c = 0xffffffff;
            for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
            return (c ^ 0xffffffff) >>> 0;
        };

        const files = [
            {
                name: '[Content_Types].xml',
                data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
            },
            {
                name: '_rels/.rels',
                data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
            },
            {
                name: 'word/document.xml',
                data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + bodyText + '</w:t></w:r></w:p></w:body></w:document>'),
            },
        ];

        const localParts = [];
        const centralParts = [];
        let offset = 0;

        for (const f of files) {
            const nameBytes = enc.encode(f.name);
            const crc = crc32(f.data);
            const lfh = new ArrayBuffer(30 + nameBytes.length);
            const lv = new DataView(lfh);
            lv.setUint32(0, 0x04034b50, true);
            lv.setUint16(4, 20, true);
            lv.setUint16(6, 0, true);
            lv.setUint16(8, 0, true);
            lv.setUint16(10, 0, true);
            lv.setUint16(12, 0x5421, true);
            lv.setUint32(14, crc, true);
            lv.setUint32(18, f.data.length, true);
            lv.setUint32(22, f.data.length, true);
            lv.setUint16(26, nameBytes.length, true);
            lv.setUint16(28, 0, true);
            new Uint8Array(lfh, 30).set(nameBytes);

            const cdh = new ArrayBuffer(46 + nameBytes.length);
            const cv = new DataView(cdh);
            cv.setUint32(0, 0x02014b50, true);
            cv.setUint16(4, 20, true);
            cv.setUint16(6, 20, true);
            cv.setUint16(8, 0, true);
            cv.setUint16(10, 0, true);
            cv.setUint16(12, 0, true);
            cv.setUint16(14, 0x5421, true);
            cv.setUint32(16, crc, true);
            cv.setUint32(20, f.data.length, true);
            cv.setUint32(24, f.data.length, true);
            cv.setUint16(28, nameBytes.length, true);
            cv.setUint16(30, 0, true);
            cv.setUint16(32, 0, true);
            cv.setUint16(34, 0, true);
            cv.setUint16(36, 0, true);
            cv.setUint32(38, 0, true);
            cv.setUint32(42, offset, true);
            new Uint8Array(cdh, 46).set(nameBytes);

            localParts.push(new Uint8Array(lfh), f.data);
            centralParts.push(new Uint8Array(cdh));
            offset += 30 + nameBytes.length + f.data.length;
        }

        const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
        const eocd = new ArrayBuffer(22);
        const ev = new DataView(eocd);
        ev.setUint32(0, 0x06054b50, true);
        ev.setUint16(4, 0, true);
        ev.setUint16(6, 0, true);
        ev.setUint16(8, files.length, true);
        ev.setUint16(10, files.length, true);
        ev.setUint32(12, centralSize, true);
        ev.setUint32(16, offset, true);
        ev.setUint16(20, 0, true);

        const blob = new Blob([...localParts, ...centralParts, new Uint8Array(eocd)], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        return new File([blob], filename, { type: blob.type });
    };

    window.__feedFiles = (inputSelector, files) => {
        const el = document.querySelector(inputSelector);
        if (!el) throw new Error('Input not found: ' + inputSelector);
        const dt = new DataTransfer();
        for (const f of files) dt.items.add(f);
        el.files = dt.files;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    window.__waitForVisible = async (sel, timeoutMs = 20000, ignoreErrorBanner = false) => {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            const el = document.querySelector(sel);
            if (el && !el.classList.contains('hidden')) {
                const st = getComputedStyle(el);
                if (st.display !== 'none' && st.visibility !== 'hidden') return el;
            }
            if (!ignoreErrorBanner) {
                const err = document.querySelector('#error-alert');
                if (err && !err.classList.contains('hidden')) {
                    const msg = document.querySelector('#error-message')?.textContent?.trim();
                    throw new Error('Unexpected error alert: ' + msg);
                }
            }
            await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error('Timed out waiting visible: ' + sel);
    };
})();
`;

const TOOL_SPECS = [
    {
        slug: 'merge-pdf',
        run: () => `
            window.__xssTriggered = false;
            const xssName = 'Alpha<img src=x onerror="window.__xssTriggered=true">.pdf';
            const f1 = await window.__makeSamplePdfFile(xssName, 1, { text: 'Alpha Page 1' });
            const f2 = await window.__makeSamplePdfFile('Beta-Doc.pdf', 2, { text: 'Beta Page' });
            window.__feedFiles('#merge-file-input', [f1, f2]);
            await window.__waitForVisible('#workspace-view');
            await new Promise((r) => setTimeout(r, 350));
            if (window.__xssTriggered) throw new Error('XSS executed in filename rendering');
            document.getElementById('sort-reverse-btn').click();
            document.getElementById('sort-az-btn').click();
            document.getElementById('merge-action-btn').click();
            await window.__waitForVisible('#result-view', 20000);
            document.getElementById('download-merged-btn').click();
            const dl = await window.__readLastDownload();
            if (!dl || !dl.filename.endsWith('.pdf') || !dl.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid merge export: ' + JSON.stringify(dl));
            }
            return { filename: dl.filename, size: dl.size };
        `,
    },
    {
        slug: 'split-pdf',
        run: () => `
            const f = await window.__makeSamplePdfFile('SplitTest.pdf', 3);
            window.__feedFiles('#split-file-input', [f]);
            await window.__waitForVisible('#workspace-view');
            await new Promise((r) => setTimeout(r, 500));
            document.querySelector('.split-mode-tab[data-mode="ranges"]').click();
            const rangeInput = document.getElementById('range-input');
            rangeInput.value = '1, 1';
            rangeInput.dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('split-action-btn').click();
            await window.__waitForVisible('#result-view', 20000);
            document.getElementById('download-split-btn').click();
            const dlDupZip = await window.__readLastDownload();
            if (!dlDupZip || !dlDupZip.filename.endsWith('.zip') || !dlDupZip.ascii.startsWith('PK')) {
                throw new Error('Invalid split ZIP export: ' + JSON.stringify(dlDupZip));
            }
            const loadedZip = await window.JSZip.loadAsync(dlDupZip.bytes);
            const zipNames = Object.keys(loadedZip.files).filter((k) => !loadedZip.files[k].dir);
            if (zipNames.length !== 2) {
                throw new Error('Duplicate range names collided in ZIP: ' + JSON.stringify(zipNames));
            }
            document.querySelector('.split-mode-tab[data-mode="all"]').click();
            document.getElementById('split-action-btn').click();
            await window.__waitForVisible('#result-view', 20000);
            document.getElementById('download-split-btn').click();
            const dlAllZip = await window.__readLastDownload();
            if (!dlAllZip || !dlAllZip.filename.endsWith('.zip') || !dlAllZip.ascii.startsWith('PK')) {
                throw new Error('Invalid split-all ZIP export: ' + JSON.stringify(dlAllZip));
            }
            return { zipNames, allZipSize: dlAllZip.size };
        `,
    },
    {
        slug: 'organize-pdf',
        run: () => `
            const f = await window.__makeSamplePdfFile('Organize<script>Test.pdf', 2);
            window.__feedFiles('#organize-file-input', [f]);
            await window.__waitForVisible('#workspace-view');
            await new Promise((r) => setTimeout(r, 600));
            if (!document.getElementById('undo-btn').disabled) {
                throw new Error('Undo button should be disabled initially');
            }
            document.querySelector('#pages-grid .btn-rotate-right').click();
            await new Promise((r) => setTimeout(r, 250));
            const thumbTransform = document.querySelector('#pages-grid .page-thumbnail-canvas')?.style?.transform || '';
            if (thumbTransform !== 'rotate(90deg)') {
                throw new Error('Expected CSS thumbnail rotation rotate(90deg), got: ' + thumbTransform);
            }
            document.getElementById('save-pdf-btn').click();
            await window.__waitForVisible('#result-view', 20000);
            document.getElementById('download-organized-btn').click();
            const dl = await window.__readLastDownload();
            if (!dl || !dl.filename.endsWith('.pdf') || !dl.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid organize export: ' + JSON.stringify(dl));
            }
            return { filename: dl.filename, size: dl.size, thumbTransform };
        `,
    },
    {
        slug: 'pdf-to-jpg',
        run: () => `
            const f = await window.__makeSamplePdfFile('PagesToImg.pdf', 2);
            window.__feedFiles('#pdf-to-jpg-file-input', [f]);
            await window.__waitForVisible('#workspace-view');
            await new Promise((r) => setTimeout(r, 500));
            document.getElementById('convert-action-btn').click();
            await window.__waitForVisible('#result-view', 25000);
            document.getElementById('download-zip-btn').click();
            await new Promise((r) => setTimeout(r, 500));
            const dlZip = await window.__readLastDownload();
            if (!dlZip || !dlZip.filename.endsWith('.zip') || !dlZip.ascii.startsWith('PK')) {
                throw new Error('Invalid pdf-to-jpg ZIP export: ' + JSON.stringify(dlZip));
            }
            document.querySelector('#converted-images-grid .btn-download-single').click();
            await new Promise((r) => setTimeout(r, 150));
            const dlJpg = await window.__readLastDownload();
            if (!dlJpg || !dlJpg.filename.endsWith('.jpg') || !dlJpg.headerHex.startsWith('ff d8 ff')) {
                throw new Error('Invalid pdf-to-jpg JPEG export: ' + JSON.stringify(dlJpg));
            }
            return { zipSize: dlZip.size, jpgFile: dlJpg.filename, jpgHeader: dlJpg.headerHex.slice(0, 11) };
        `,
    },
    {
        slug: 'jpg-to-pdf',
        run: () => `
            const badPdf = await window.__makeSamplePdfFile('WrongType.pdf', 1);
            window.__feedFiles('#jpg-file-input', [badPdf]);
            await window.__waitForVisible('#error-alert', 5000, true);
            const rejectedMsg = document.getElementById('error-message')?.textContent?.trim() || '';
            if (!rejectedMsg) throw new Error('Expected .pdf rejection error message in jpg-to-pdf');
            document.getElementById('error-dismiss-btn').click();

            const img1 = await window.__makeSamplePngFile('ImgOne.png', 400, 200, 'PAGE 1');
            const img2 = await window.__makeSamplePngFile('ImgTwo.png', 200, 320, 'PAGE 2');
            window.__feedFiles('#jpg-file-input', [img1, img2]);
            await window.__waitForVisible('#workspace-view');
            await new Promise((r) => setTimeout(r, 300));
            const pageSizeSel = document.getElementById('page-size-select');
            pageSizeSel.value = 'fit';
            pageSizeSel.dispatchEvent(new Event('change', { bubbles: true }));
            const marginSel = document.getElementById('margin-select');
            if (marginSel.value !== '0' || !marginSel.disabled) {
                throw new Error('Fit mode did not force margin=0 and disable select');
            }
            document.getElementById('create-pdf-btn').click();
            await window.__waitForVisible('#result-view', 20000);
            document.getElementById('download-pdf-btn').click();
            const dl = await window.__readLastDownload();
            if (!dl || !dl.filename.endsWith('.pdf') || !dl.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid jpg-to-pdf export: ' + JSON.stringify(dl));
            }
            const outDoc = await window.PDFLib.PDFDocument.load(dl.bytes);
            const p0Size = outDoc.getPage(0).getSize();
            if (Math.abs(p0Size.width - 300) > 1 || Math.abs(p0Size.height - 150) > 1) {
                throw new Error('Fit mode page dimensions mismatch: ' + JSON.stringify(p0Size));
            }
            return { filename: dl.filename, p0Size };
        `,
    },
    {
        slug: 'html-to-pdf',
        run: () => `
            document.getElementById('load-sample-txt-btn').click();
            await new Promise((r) => setTimeout(r, 150));
            document.getElementById('convert-submit-btn').click();
            await window.__waitForVisible('#result-view', 20000);
            document.getElementById('download-doc-btn').click();
            const dlText = await window.__readLastDownload();
            if (!dlText || !dlText.filename.endsWith('.pdf') || !dlText.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid html-to-pdf text export: ' + JSON.stringify(dlText));
            }

            document.querySelector('.converter-mode-tab[data-mode="html"]').click();
            document.getElementById('load-sample-html-btn').click();
            await new Promise((r) => setTimeout(r, 400));
            const leakedBg = getComputedStyle(document.body).backgroundColor;
            document.getElementById('convert-submit-btn').click();
            await window.__waitForVisible('#result-view', 25000);
            document.getElementById('download-doc-btn').click();
            const dlHtml = await window.__readLastDownload();
            if (!dlHtml || !dlHtml.filename.endsWith('.pdf') || !dlHtml.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid html-to-pdf HTML invoice export: ' + JSON.stringify(dlHtml));
            }
            return { textSize: dlText.size, htmlSize: dlHtml.size, leakedBg };
        `,
    },
    {
        slug: 'compress-pdf',
        run: () => `
            const f = await window.__makeSamplePdfFile('CompressMe.pdf', 1);
            window.__feedFiles('#compress-file-input', [f]);
            await window.__waitForVisible('#compress-workspace');
            await new Promise((r) => setTimeout(r, 350));
            document.getElementById('compress-submit-btn').click();
            await window.__waitForVisible('#result-view', 25000);
            document.getElementById('download-compressed-btn').click();
            const dlBalanced = await window.__readLastDownload();
            if (!dlBalanced || !dlBalanced.filename.endsWith('.pdf') || !dlBalanced.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid compress balanced export: ' + JSON.stringify(dlBalanced));
            }

            document.querySelector('input[name="compression-preset"][value="lossless"]').click();
            document.getElementById('compress-submit-btn').click();
            await window.__waitForVisible('#result-view', 30000);
            document.getElementById('download-compressed-btn').click();
            const dlLossless = await window.__readLastDownload();
            if (!dlLossless || !dlLossless.filename.endsWith('.pdf') || !dlLossless.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid compress lossless export: ' + JSON.stringify(dlLossless));
            }
            return {
                balancedSize: dlBalanced.size,
                losslessSize: dlLossless.size,
                hasOrigBtn: Boolean(document.getElementById('download-original-btn')),
            };
        `,
    },
    {
        slug: 'protect-pdf',
        run: () => `
            const f = await window.__makeSamplePdfFile('SecretDoc.pdf', 1);
            window.__feedFiles('#protect-file-input', [f]);
            await window.__waitForVisible('#protect-workspace', 25000);
            document.getElementById('user-password-input').value = 'Pass1234!';
            document.getElementById('user-password-input').dispatchEvent(new Event('input'));
            document.getElementById('confirm-password-input').value = 'Pass1234!';
            document.getElementById('confirm-password-input').dispatchEvent(new Event('input'));
            document.getElementById('protect-submit-btn').click();
            await window.__waitForVisible('#result-view', 25000);
            const ownerCard = document.getElementById('auto-owner-pw-card');
            const autoKey = document.getElementById('auto-owner-pw-value')?.textContent?.trim() || '';
            if (!ownerCard || ownerCard.classList.contains('hidden') || autoKey.length < 12) {
                throw new Error('Auto-generated owner key card did not display properly');
            }
            document.getElementById('download-protected-btn').click();
            const dl = await window.__readLastDownload();
            if (!dl || !dl.filename.endsWith('.pdf') || !dl.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid protect-pdf export: ' + JSON.stringify(dl));
            }
            return { filename: dl.filename, size: dl.size, autoKeyLen: autoKey.length };
        `,
    },
    {
        slug: 'unlock-pdf',
        run: () => `
            const f = await window.__makeSamplePdfFile('PlainSrc.pdf', 1);
            const ab = await f.arrayBuffer();

            // Verify unencrypted PDF is detected accurately as already unlocked
            window.__feedFiles('#unlock-file-input', [f]);
            await window.__waitForVisible('#status-not-encrypted', 25000);

            const enc = await window.QPDFClient.encryptPdf(ab, { userPassword: 'UnlockMe99', ownerPassword: 'Owner99' });
            const encFile = new File([enc.outputBytes], 'Locked.pdf', { type: 'application/pdf' });
            window.__feedFiles('#unlock-file-input', [encFile]);
            await window.__waitForVisible('#status-password-required', 25000);

            // Wrong password check: must show inline input error cleanly with zero console errors
            document.getElementById('unlock-password-input').value = 'WrongPw123';
            document.getElementById('unlock-submit-btn').click();
            await window.__waitForVisible('#unlock-input-error', 15000);

            document.getElementById('unlock-password-input').value = 'UnlockMe99';
            document.getElementById('unlock-submit-btn').click();
            await window.__waitForVisible('#result-view', 25000);
            document.getElementById('download-unlocked-btn').click();
            const dl = await window.__readLastDownload();
            if (!dl || !dl.filename.endsWith('.pdf') || !dl.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid unlock-pdf export: ' + JSON.stringify(dl));
            }
            return { filename: dl.filename, size: dl.size };
        `,
    },
    {
        slug: 'watermark-pdf',
        run: () => `
            const f = await window.__makeSamplePdfFile('WatermarkMe.pdf', 1, { rotateDeg: 90 });
            window.__feedFiles('#watermark-file-input', [f]);
            await window.__waitForVisible('#watermark-workspace');
            await new Promise((r) => setTimeout(r, 400));
            const rotInput = document.getElementById('wm-rotation');
            if (rotInput) {
                rotInput.value = '-45';
                rotInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            document.getElementById('watermark-submit-btn').click();
            await window.__waitForVisible('#result-view', 20000);
            document.getElementById('download-watermarked-btn').click();
            const dl = await window.__readLastDownload();
            if (!dl || !dl.filename.endsWith('.pdf') || !dl.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid watermark-pdf export: ' + JSON.stringify(dl));
            }
            return { filename: dl.filename, size: dl.size };
        `,
    },
    {
        slug: 'page-numbers',
        run: () => `
            const f = await window.__makeSamplePdfFile('NumberMe.pdf', 2, { rotateDeg: 90 });
            window.__feedFiles('#page-numbers-file-input', [f]);
            await window.__waitForVisible('#page-numbers-workspace');
            await new Promise((r) => setTimeout(r, 400));
            document.getElementById('hdr-left').value = 'Draft Copy';
            document.getElementById('hdr-left').dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('page-numbers-submit-btn').click();
            await window.__waitForVisible('#result-view', 20000);
            document.getElementById('download-numbered-btn').click();
            const dl = await window.__readLastDownload();
            if (!dl || !dl.filename.endsWith('.pdf') || !dl.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid page-numbers export: ' + JSON.stringify(dl));
            }
            return { filename: dl.filename, size: dl.size };
        `,
    },
    {
        slug: 'sign-annotate-pdf',
        run: () => `
            const f = await window.__makeSamplePdfFile('SignMe.pdf', 1, { rotateDeg: 90 });
            window.__feedFiles('#pdf-file-input', [f]);
            await window.__waitForVisible('#editor-panel');
            await new Promise((r) => setTimeout(r, 500));
            const baseCanvas = document.getElementById('pdf-base-canvas');
            if (!baseCanvas || baseCanvas.width < 100) {
                throw new Error('Base PDF canvas did not render cleanly');
            }
            // Test 1st-step Undo
            document.querySelector('.tool-btn[data-tool="highlight"]').click();
            await new Promise((r) => setTimeout(r, 150));
            const undoBtn = document.getElementById('undo-btn');
            if (undoBtn.disabled) {
                throw new Error('1st annotation should immediately enable Undo');
            }
            undoBtn.click();
            await new Promise((r) => setTimeout(r, 150));

            // Test modal input keydown safety (Backspace inside modal does not delete/throw)
            document.getElementById('open-signature-modal-btn').click();
            await window.__waitForVisible('#signature-modal');
            document.getElementById('sig-tab-type-btn').click();
            const typeInput = document.getElementById('sig-type-input');
            typeInput.value = 'Jane Doe Signed';
            typeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
            if (document.getElementById('signature-modal').classList.contains('hidden')) {
                throw new Error('Modal unexpectedly closed on Backspace');
            }
            document.getElementById('apply-signature-btn').click();
            await new Promise((r) => setTimeout(r, 300));
            document.getElementById('export-pdf-btn').click();
            await window.__waitForVisible('#result-panel', 20000);
            document.getElementById('download-signed-pdf-btn').click();
            const dl = await window.__readLastDownload();
            if (!dl || !dl.filename.endsWith('.pdf') || !dl.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid sign-annotate-pdf export: ' + JSON.stringify(dl));
            }
            return { filename: dl.filename, size: dl.size, baseW: baseCanvas.width, baseH: baseCanvas.height };
        `,
    },
    {
        slug: 'grayscale-pdf',
        run: () => `
            const f = await window.__makeSamplePdfFile('ColorMe.pdf', 1, { rotateDeg: 90 });
            window.__feedFiles('#pdf-file-input', [f]);
            await window.__waitForVisible('#config-panel');
            await new Promise((r) => setTimeout(r, 400));
            document.getElementById('convert-grayscale-btn').click();
            await window.__waitForVisible('#result-panel', 25000);
            document.getElementById('download-grayscale-pdf-btn').click();
            const dl = await window.__readLastDownload();
            if (!dl || !dl.filename.endsWith('.pdf') || !dl.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid grayscale-pdf export: ' + JSON.stringify(dl));
            }
            return { filename: dl.filename, size: dl.size };
        `,
    },
    {
        slug: 'crop-pdf',
        run: () => `
            // Test swapped 90 deg / 270 deg Top Margin coordinate mapping
            const f90 = await window.__makeSamplePdfFile('Crop90.pdf', 1, { rotateDeg: 90 });
            window.__feedFiles('#pdf-file-input', [f90]);
            await window.__waitForVisible('#crop-workspace-panel');
            await new Promise((r) => setTimeout(r, 450));
            const topInput = document.getElementById('margin-top');
            topInput.value = '50';
            topInput.dispatchEvent(new Event('change', { bubbles: true }));
            document.getElementById('apply-crop-btn').click();
            await window.__waitForVisible('#result-panel', 20000);
            document.getElementById('download-cropped-pdf-btn').click();
            const dl90 = await window.__readLastDownload();
            if (!dl90 || !dl90.filename.endsWith('.pdf') || !dl90.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid crop90 export: ' + JSON.stringify(dl90));
            }
            const doc90 = await window.PDFLib.PDFDocument.load(dl90.bytes);
            const crop90 = doc90.getPage(0).getCropBox();
            if (Math.round(crop90.x) !== 50 || Math.round(crop90.width) !== 562) {
                throw new Error('90deg Top crop mismatch: ' + JSON.stringify(crop90));
            }

            // Now test 270 deg page with Top Margin = 50 -> crop.x=0, crop.width=562
            document.getElementById('crop-reset-btn').click();
            const f270 = await window.__makeSamplePdfFile('Crop270.pdf', 1, { rotateDeg: 270 });
            window.__feedFiles('#pdf-file-input', [f270]);
            await window.__waitForVisible('#crop-workspace-panel');
            await new Promise((r) => setTimeout(r, 450));
            topInput.value = '50';
            topInput.dispatchEvent(new Event('change', { bubbles: true }));
            document.getElementById('apply-crop-btn').click();
            await window.__waitForVisible('#result-panel', 20000);
            document.getElementById('download-cropped-pdf-btn').click();
            const dl270 = await window.__readLastDownload();
            const doc270 = await window.PDFLib.PDFDocument.load(dl270.bytes);
            const crop270 = doc270.getPage(0).getCropBox();
            if (Math.round(crop270.x) !== 0 || Math.round(crop270.width) !== 562) {
                throw new Error('270deg Top crop mismatch: ' + JSON.stringify(crop270));
            }
            return { crop90, crop270 };
        `,
    },
    {
        slug: 'ocr-pdf',
        run: () => `
            const pngFile = await window.__makeSamplePngFile('ocr-src.png', 360, 140, 'HELLO 2026');
            const pngAb = await pngFile.arrayBuffer();
            const doc = await window.PDFLib.PDFDocument.create();
            const p = doc.addPage([360, 140]);
            const img = await doc.embedPng(pngAb);
            p.drawImage(img, { x: 0, y: 0, width: 360, height: 140 });
            const f = new File([await doc.save()], 'ScanMe.pdf', { type: 'application/pdf' });
            window.__feedFiles('#pdf-file-input', [f]);
            await window.__waitForVisible('#ocr-config-panel');
            document.getElementById('ocr-dpi-select').value = '180';
            document.getElementById('start-ocr-btn').click();
            await window.__waitForVisible('#ocr-result-panel', 45000);
            document.getElementById('download-searchable-pdf-btn').click();
            const dlPdf = await window.__readLastDownload();
            document.getElementById('download-text-btn').click();
            const dlTxt = await window.__readLastDownload();
            if (!dlPdf || !dlPdf.filename.endsWith('.pdf') || !dlPdf.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid ocr-pdf searchable PDF export: ' + JSON.stringify(dlPdf));
            }
            if (!dlTxt || !dlTxt.filename.endsWith('.txt') || !dlTxt.size) {
                throw new Error('Invalid ocr-pdf TXT export: ' + JSON.stringify(dlTxt));
            }
            return { pdfSize: dlPdf.size, txtFile: dlTxt.filename, txtSize: dlTxt.size };
        `,
    },
    {
        slug: 'word-to-pdf',
        run: () => `
            const docxFile = window.__makeSampleDocxFile('ContractDraft.docx', 'Client Side DOCX Export Verification');
            window.__feedFiles('#docx-file-input', [docxFile]);
            await window.__waitForVisible('#workspace-view', 15000);
            await new Promise((r) => setTimeout(r, 350));
            const leakedBg = getComputedStyle(document.body).backgroundColor;
            document.getElementById('convert-btn').click();
            await window.__waitForVisible('#result-view', 25000);
            document.getElementById('download-doc-btn').click();
            const dl = await window.__readLastDownload();
            if (!dl || !dl.filename.endsWith('.pdf') || !dl.ascii.startsWith('%PDF-')) {
                throw new Error('Invalid word-to-pdf export: ' + JSON.stringify(dl));
            }
            return { filename: dl.filename, size: dl.size, leakedBg };
        `,
    },
];

async function run() {
    const cspPolicy = readDistCsp();
    const server = await startStaticServer(cspPolicy);
    let browserProc = null;

    try {
        const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
        const useEdge = process.env.E2E_BROWSER === 'edge' || !fs.existsSync(chromePath);
        const browserExe = useEdge ? edgePath : chromePath;
        if (!fs.existsSync(browserExe)) {
            throw new Error('No Chromium executable found.');
        }

        browserProc = spawn(browserExe, [
            '--headless=new',
            '--disable-gpu',
            '--window-size=1400,900',
            `--remote-debugging-port=${DEBUG_PORT}`,
            '--remote-allow-origins=*',
            '--no-first-run',
            '--no-default-browser-check',
            '--user-data-dir=' + path.join(os.tmpdir(), 'nopaypdf-alltools-' + Date.now()),
            'about:blank',
        ]);

        const ws = await connectCDP();
        const cdp = makeCDP(ws);

        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');
        await cdp.send('Network.enable');
        await cdp.send('Log.enable');
        await cdp.send('Audits.enable');

        const docStatuses = new Map();
        const consoleErrors = [];
        const cspViolations = [];
        const failedRequests = [];
        const nativeDialogs = [];
        const auditIssues = [];

        cdp.on('Runtime.consoleAPICalled', (ev) => {
            if (ev.type === 'error') {
                const txt = (ev.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
                consoleErrors.push(txt);
            }
        });
        cdp.on('Runtime.exceptionThrown', (ev) => {
            const desc = ev.exceptionDetails?.exception?.description || ev.exceptionDetails?.text || 'Uncaught exception';
            consoleErrors.push(desc);
        });
        cdp.on('Log.entryAdded', (ev) => {
            const e = ev.entry;
            if (!e) return;
            if (e.source === 'security' || (e.text && e.text.includes('Content Security Policy'))) {
                cspViolations.push(`${e.source}: ${e.text}`);
            } else if (e.level === 'error' && (!e.url || e.url.startsWith(BASE_URL))) {
                consoleErrors.push(`[Log:${e.source}] ${e.text}`);
            }
        });
        cdp.on('Network.responseReceived', (ev) => {
            if (ev.type === 'Document') {
                docStatuses.set(ev.response.url, ev.response.status);
            }
            if (ev.response.url.startsWith(BASE_URL) && ev.response.status >= 400 && !ev.response.url.includes('favicon')) {
                failedRequests.push(`HTTP ${ev.response.status} ${ev.response.url}`);
            }
        });
        cdp.on('Page.javascriptDialogOpening', async (ev) => {
            nativeDialogs.push(`${ev.type}: ${ev.message}`);
            try { await cdp.send('Page.handleJavaScriptDialog', { accept: true }); } catch (_) {}
        });
        cdp.on('Audits.issueAdded', (ev) => {
            const code = ev.issue?.code || '';
            const srcUrl = ev.issue?.details?.genericIssueDetails?.request?.url
                || ev.issue?.details?.cookieIssueDetails?.request?.url
                || '';
            if (srcUrl && !srcUrl.startsWith(BASE_URL)) return;
            if (code === 'GenericIssue' || code === 'FormIssue') {
                auditIssues.push({ code, details: ev.issue?.details });
            }
        });

        let failures = 0;
        console.log(`Running ${TOOL_SPECS.length}-tool CDP suite against ${BASE_URL} (CSP enforced)...`);

        for (const spec of TOOL_SPECS) {
            consoleErrors.length = 0;
            cspViolations.length = 0;
            failedRequests.length = 0;
            nativeDialogs.length = 0;
            auditIssues.length = 0;

            const url = `${BASE_URL}/${spec.slug}/`;
            await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
            const loadPromise = new Promise((resolve) => {
                cdp.on('Page.loadEventFired', () => resolve());
                setTimeout(resolve, 15000);
            });
            await cdp.send('Page.navigate', { url });
            await loadPromise;
            await new Promise((r) => setTimeout(r, 350));

            const httpStatus = docStatuses.get(url) || null;
            const formsRes = await cdp.send('Audits.checkFormsIssues').catch(() => ({ formIssues: [] }));

            const desktopCheck = (await cdp.send('Runtime.evaluate', {
                expression: `({
                    overflowDesktop: document.documentElement.scrollWidth > window.innerWidth,
                    hiddenRadios: Array.from(document.querySelectorAll('input[type="radio"].hidden')).length,
                })`,
                returnByValue: true,
            }))?.result?.value || {};

            await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
            await new Promise((r) => setTimeout(r, 80));
            const mobileOverflow = (await cdp.send('Runtime.evaluate', {
                expression: 'document.documentElement.scrollWidth > window.innerWidth',
                returnByValue: true,
            }))?.result?.value;
            await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });

            await cdp.send('Runtime.evaluate', { expression: PAGE_HELPERS });
            const evalRes = await cdp.send('Runtime.evaluate', {
                expression: `(async () => {
                    try {
                        const data = await (async () => { ${spec.run()} })();
                        return { ok: true, data, dialogs: window.__nativeDialogCalls };
                    } catch (e) {
                        return { ok: false, error: e.message || String(e), dialogs: window.__nativeDialogCalls };
                    }
                })()`,
                awaitPromise: true,
                returnByValue: true,
            }, 55000);

            const outcome = evalRes?.result?.value || { ok: false, error: 'Empty CDP eval', dialogs: [] };
            const toolErrors = [];
            if (httpStatus !== 200) toolErrors.push(`HTTP=${httpStatus}`);
            if (!outcome.ok) toolErrors.push(`E2E=${outcome.error}`);
            if (consoleErrors.length) toolErrors.push(`consoleErrors=${JSON.stringify(consoleErrors)}`);
            if (cspViolations.length) toolErrors.push(`cspViolations=${JSON.stringify(cspViolations)}`);
            if (failedRequests.length) toolErrors.push(`failedRequests=${JSON.stringify(failedRequests)}`);
            if (nativeDialogs.length || (outcome.dialogs && outcome.dialogs.length)) {
                toolErrors.push(`nativeDialogs=${JSON.stringify([...nativeDialogs, ...(outcome.dialogs || [])])}`);
            }
            if (auditIssues.length) toolErrors.push(`auditIssues=${JSON.stringify(auditIssues)}`);
            if (formsRes?.formIssues?.length) toolErrors.push(`formIssues=${JSON.stringify(formsRes.formIssues)}`);
            if (desktopCheck.overflowDesktop) toolErrors.push('desktopOverflow=true');
            if (mobileOverflow) toolErrors.push('mobileOverflow=true');
            if (desktopCheck.hiddenRadios > 0) toolErrors.push(`hiddenRadios=${desktopCheck.hiddenRadios}`);

            if (toolErrors.length === 0) {
                console.log(`  PASS [${spec.slug}] ${JSON.stringify(outcome.data)}`);
            } else {
                failures++;
                console.error(`  FAIL [${spec.slug}] ${toolErrors.join(' | ')}`);
            }
        }

        if (failures > 0) {
            console.error(`\nMulti-tool CDP suite FAILED (${failures}/${TOOL_SPECS.length} tools failed).`);
            process.exitCode = 1;
        } else {
            console.log(`\nMulti-tool CDP suite PASSED (${TOOL_SPECS.length}/${TOOL_SPECS.length} tools, 0 errors/CSP/Audits/overflow).`);
        }
    } finally {
        if (browserProc) try { browserProc.kill(); } catch (_) {}
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
        server.close();
    }
}

run().catch((err) => {
    console.error('Fatal suite error:', err);
    process.exit(1);
});
