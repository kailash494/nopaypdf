const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8125;
const DIST_ROOT = path.resolve(__dirname, '..', 'dist');
const REPO_ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.wasm': 'application/wasm',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
};

let edgeProcess = null;

const DEBUG_PORT = 9235;
const cdpLogs = [];
const cdpIssues = [];
let cdpConnected = false;
let cdpWs = null;
let cdpMsgId = 10;
const pendingCdp = new Map();
let nextDialogPromptText = 'https://nopaypdf.com';

async function sendCDP(method, params = {}) {
    for (let i = 0; i < 40 && !cdpConnected; i++) {
        await new Promise(r => setTimeout(r, 100));
    }
    if (!cdpWs || !cdpConnected) {
        throw new Error(`CDP WebSocket not connected when calling ${method}`);
    }
    return new Promise((resolve, reject) => {
        const id = ++cdpMsgId;
        const sentAt = Date.now();
        const timer = setTimeout(() => {
            if (pendingCdp.has(id)) {
                pendingCdp.delete(id);
                reject(new Error(`CDP timeout waiting for response to ${method} (${JSON.stringify(params)})`));
            }
        }, 8000);
        pendingCdp.set(id, {
            resolve: (v) => {
                clearTimeout(timer);
                const dt = Date.now() - sentAt;
                if (dt > 1000) console.log(`  [CDP-WAIT] id=${id} ${method} ${params.type || ''} took ${dt}ms`);
                resolve(v);
            },
            reject: (e) => { clearTimeout(timer); reject(e); },
        });
        cdpWs.send(JSON.stringify({ id, method, params }));
    });
}

async function connectCDP() {
    let connecting = false;
    for (let i = 0; i < 40; i++) {
        if (connecting || cdpConnected) return;
        await new Promise(r => setTimeout(r, 150));
        try {
            const listData = await new Promise((resolve, reject) => {
                http.get(`http://127.0.0.1:${DEBUG_PORT}/json/list`, (res) => {
                    let d = '';
                    res.on('data', chunk => d += chunk);
                    res.on('end', () => resolve(d));
                }).on('error', reject);
            });
            const targets = JSON.parse(listData);
            const pageTarget = targets.find(t => t.type === 'page' && t.url && t.url.includes('edit-pdf') && t.webSocketDebuggerUrl) ||
                               targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
            if (pageTarget && pageTarget.webSocketDebuggerUrl && !connecting) {
                connecting = true;
                console.log(`Connecting CDP to tab: ${pageTarget.title || pageTarget.url}`);
                const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
                cdpWs = ws;
                ws.addEventListener('error', (err) => {
                    console.error('[CDP-WS-ERR]', err.message || err.type || err);
                });
                ws.addEventListener('close', (ev) => {
                    console.error(`[CDP-WS-CLOSE] code=${ev.code} reason=${ev.reason || ''}`);
                    cdpConnected = false;
                });
                ws.addEventListener('open', () => {
                    cdpConnected = true;
                    console.log('✓ CDP WebSocket opened successfully');
                    ws.send(JSON.stringify({ id: 1, method: 'Log.enable' }));
                    ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
                    ws.send(JSON.stringify({ id: 3, method: 'Page.enable' }));
                    ws.send(JSON.stringify({ id: 4, method: 'Log.startViolationsReport', params: { config: [{ name: 'handler', threshold: 250 }] } }));
                    ws.send(JSON.stringify({ id: 5, method: 'DOM.enable' }));
                    ws.send(JSON.stringify({ id: 6, method: 'Audits.enable' }));
                });
                ws.addEventListener('message', (event) => {
                    try {
                        const raw = typeof event.data === 'string' ? event.data : event.data.toString();
                        const msg = JSON.parse(raw);
                        if (msg.id && pendingCdp.has(msg.id)) {
                            const { resolve, reject } = pendingCdp.get(msg.id);
                            pendingCdp.delete(msg.id);
                            if (msg.error) reject(new Error(msg.error.message || 'CDP error'));
                            else resolve(msg.result);
                            return;
                        }
                        if (msg.method === 'Page.javascriptDialogOpening') {
                            cdpLogs.push({
                                level: 'error',
                                text: `Unexpected native blocking dialog opened (${msg.params?.type}): ${msg.params?.message || ''}`,
                                source: 'Page.javascriptDialogOpening',
                            });
                            const dialogParams = { accept: true };
                            if (msg.params && msg.params.type === 'prompt') {
                                dialogParams.promptText = nextDialogPromptText || 'https://nopaypdf.com';
                            }
                            ws.send(JSON.stringify({
                                id: ++cdpMsgId,
                                method: 'Page.handleJavaScriptDialog',
                                params: dialogParams,
                            }));
                        } else if (msg.method === 'Log.entryAdded') {
                            const entry = msg.params.entry;
                            if (entry.level === 'warning' || entry.level === 'error') {
                                cdpLogs.push({ level: entry.level, text: entry.text, source: `Log.entryAdded:${entry.source || ''}` });
                            }
                        } else if (msg.method === 'Runtime.consoleAPICalled') {
                            const params = msg.params;
                            const text = params.args.map(a => a.value || a.description || '').join(' ');
                            if (params.type === 'log' && text.includes('[E2E-TEST]')) {
                                console.log('  [LIVE]', text);
                            } else if (params.type === 'warning' || params.type === 'error') {
                                cdpLogs.push({ level: params.type, text, source: 'Runtime.consoleAPICalled' });
                            }
                        } else if (msg.method === 'Runtime.exceptionThrown') {
                            const text = msg.params.exceptionDetails?.text || 'Uncaught exception';
                            cdpLogs.push({ level: 'error', text, source: 'Runtime.exceptionThrown' });
                        } else if (msg.method === 'Audits.issueAdded') {
                            if (msg.params && msg.params.issue) {
                                cdpIssues.push(msg.params.issue);
                            }
                        }
                    } catch (e) {
                        console.warn('[CDP-MSG-PARSE-ERR]', e.message);
                    }
                });
                return;
            }
        } catch (e) {
            if (e && e.code !== 'ECONNREFUSED') {
                console.warn('[CDP-CONNECT-ERR]', e.message || e);
            }
        }
    }
    console.warn('[CDP] Could not attach CDP session within timeout');
}

const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

    // Real Chromium CDP Input dispatch bridge
    if (pathname === '/cdp-action' && req.method === 'POST') {
        const reqStart = Date.now();
        let finished = false;
        const slowTimer = setTimeout(() => {
            if (!finished) console.error(`  [CDP-HTTP-STALL] POST /cdp-action stalled > 5s!`);
        }, 5000);
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            let actionName = 'unknown';
            try {
                const payload = JSON.parse(body);
                actionName = payload.action;
                if (payload.action === 'move') {
                    await sendCDP('Input.dispatchMouseEvent', { type: 'mouseMoved', x: payload.x, y: payload.y });
                } else if (payload.action === 'click') {
                    await sendCDP('Input.dispatchMouseEvent', { type: 'mouseMoved', x: payload.x, y: payload.y });
                    await sendCDP('Input.dispatchMouseEvent', { type: 'mousePressed', x: payload.x, y: payload.y, button: 'left', clickCount: 1 });
                    await sendCDP('Input.dispatchMouseEvent', { type: 'mouseReleased', x: payload.x, y: payload.y, button: 'left', clickCount: 1 });
                } else if (payload.action === 'dblclick') {
                    await sendCDP('Input.dispatchMouseEvent', { type: 'mouseMoved', x: payload.x, y: payload.y });
                    await sendCDP('Input.dispatchMouseEvent', { type: 'mousePressed', x: payload.x, y: payload.y, button: 'left', clickCount: 1 });
                    await sendCDP('Input.dispatchMouseEvent', { type: 'mouseReleased', x: payload.x, y: payload.y, button: 'left', clickCount: 1 });
                    await sendCDP('Input.dispatchMouseEvent', { type: 'mousePressed', x: payload.x, y: payload.y, button: 'left', clickCount: 2 });
                    await sendCDP('Input.dispatchMouseEvent', { type: 'mouseReleased', x: payload.x, y: payload.y, button: 'left', clickCount: 2 });
                } else if (payload.action === 'drag') {
                    const t0 = Date.now();
                    const steps = Math.min(payload.steps || 5, 6);
                    await sendCDP('Input.dispatchMouseEvent', { type: 'mouseMoved', x: payload.x1, y: payload.y1 });
                    await sendCDP('Input.dispatchMouseEvent', { type: 'mousePressed', x: payload.x1, y: payload.y1, button: 'left', clickCount: 1 });
                    for (let i = 1; i <= steps; i++) {
                        const t = i / steps;
                        const mx = payload.x1 + (payload.x2 - payload.x1) * t;
                        const my = payload.y1 + (payload.y2 - payload.y1) * t;
                        await sendCDP('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mx, y: my, buttons: 1 });
                    }
                    await sendCDP('Input.dispatchMouseEvent', { type: 'mouseReleased', x: payload.x2, y: payload.y2, button: 'left', clickCount: 1 });
                    const dt = Date.now() - t0;
                    if (dt > 2000) console.log(`  [CDP-SLOW] drag took ${dt}ms`);
                } else if (payload.action === 'type') {
                    const text = payload.text || '';
                    for (const ch of text) {
                        const code = ch.toUpperCase().charCodeAt(0);
                        await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, unmodifiedText: ch, key: ch, windowsVirtualKeyCode: code });
                        await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, windowsVirtualKeyCode: code });
                    }
                } else if (payload.action === 'key') {
                    const modifiers = payload.modifiers || 0;
                    await sendCDP('Input.dispatchKeyEvent', {
                        type: modifiers ? 'rawKeyDown' : 'keyDown',
                        key: payload.key,
                        code: payload.code || payload.key,
                        windowsVirtualKeyCode: payload.windowsVirtualKeyCode || 0,
                        modifiers,
                    });
                    await sendCDP('Input.dispatchKeyEvent', {
                        type: 'keyUp',
                        key: payload.key,
                        code: payload.code || payload.key,
                        windowsVirtualKeyCode: payload.windowsVirtualKeyCode || 0,
                        modifiers,
                    });
                } else if (payload.action === 'setNextDialog') {
                    nextDialogPromptText = payload.acceptText || 'https://nopaypdf.com';
                } else if (payload.action === 'checkFormsIssues') {
                    const auditRes = await sendCDP('Audits.checkFormsIssues');
                    finished = true;
                    clearTimeout(slowTimer);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, formIssues: auditRes?.formIssues || [] }));
                    return;
                }
                finished = true;
                clearTimeout(slowTimer);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (err) {
                finished = true;
                clearTimeout(slowTimer);
                console.error(`  [CDP-FAIL] ${actionName} (${Date.now() - reqStart}ms): ${err.message}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: err.message }));
            }
        });
        return;
    }

    // Report endpoint
    if (pathname === '/report-e2e-result' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const data = JSON.parse(body);
            console.log('\n================ REAL-UI E2E TEST RESULTS ================');
            if (data.logs && Array.isArray(data.logs)) {
                data.logs.forEach(l => console.log(l));
            }

            if (data.featureResults && Object.keys(data.featureResults).length > 0) {
                console.log('\n| # | Feature | Status | Details |');
                console.log('|---|---|---|---|');
                for (let i = 1; i <= 13; i++) {
                    const feat = data.featureResults[i] || data.featureResults[String(i)];
                    if (feat) {
                        const statusBadge = feat.passed ? '✅ PASS' : '❌ FAIL';
                        console.log(`| ${i} | **${feat.name}** | ${statusBadge} | ${feat.details} |`);
                    }
                }
            }
            console.log('==========================================================\n');

            // CDP Verification Check: Fail on ANY browser engine error, console warning, manifest error, violation, or native dialog
            const canvasWarnings = cdpLogs.filter(l => l.text.includes('CanvasTextBaseline') || l.text.includes('alphabetical'));
            const cdpErrors = cdpLogs.filter(l => l.level === 'error');
            const trackingNotices = cdpLogs.filter(l => l.level === 'warning' && l.text.includes('Tracking Prevention blocked access to storage'));
            const appWarnings = cdpLogs.filter(l => l.level === 'warning' && !l.text.includes('Tracking Prevention blocked access to storage'));
            const ownAuditIssues = cdpIssues.filter(iss => {
                const serialized = JSON.stringify(iss);
                return !serialized.includes('googlesyndication') && !serialized.includes('doubleclick') && !serialized.includes('adtrafficquality');
            });

            console.log(`CDP Engine Telemetry: ${cdpErrors.length} errors, ${appWarnings.length} app/engine warnings, ${canvasWarnings.length} CanvasTextBaseline warnings, ${ownAuditIssues.length} own-origin Audits issues (${trackingNotices.length} Edge Tracking Prevention storage notices)`);
            if (cdpErrors.length > 0 || appWarnings.length > 0) {
                [...cdpErrors, ...appWarnings].forEach(l => console.log(`  [CDP-${l.level.toUpperCase()}] (${l.source}) ${l.text}`));
            }
            if (ownAuditIssues.length > 0) {
                ownAuditIssues.forEach(iss => console.log(`  [CDP-AUDIT-ISSUE] ${JSON.stringify(iss)}`));
            }

            let cdpPassed = true;
            if (appWarnings.length > 0 || canvasWarnings.length > 0) {
                console.error(`❌ FAIL: CDP detected ${appWarnings.length} engine/app warning(s) (${canvasWarnings.length} CanvasTextBaseline)!`);
                cdpPassed = false;
            }
            if (cdpErrors.length > 0) {
                console.error(`❌ FAIL: CDP detected ${cdpErrors.length} browser engine error(s)!`);
                cdpPassed = false;
            }
            if (ownAuditIssues.length > 0) {
                console.error(`❌ FAIL: CDP detected ${ownAuditIssues.length} own-origin DevTools Audits issue(s)!`);
                cdpPassed = false;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ received: true }));

            if (edgeProcess) {
                edgeProcess.kill();
            }

            server.close(() => {
                if (data.status === 'PASSED' && cdpPassed) {
                    console.log('🎉 REAL-UI HEADLESS BROWSER & CDP VERIFICATION PASSED!');
                    process.exit(0);
                } else {
                    console.error('❌ REAL-UI VERIFICATION FAILED:', data.error || 'CDP engine warnings/errors detected');
                    process.exit(1);
                }
            });
        });
        return;
    }

    // Serve real-ui test driver script from scripts/
    if (pathname === '/scripts/real-ui-test-driver.js') {
        const scriptPath = path.join(REPO_ROOT, 'scripts', 'real-ui-test-driver.js');
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        fs.createReadStream(scriptPath).pipe(res);
        return;
    }

    // Serve dist files
    let localPath = path.join(DIST_ROOT, pathname);
    if (fs.existsSync(localPath) && fs.statSync(localPath).isDirectory()) {
        localPath = path.join(localPath, 'index.html');
    }

    if (!fs.existsSync(localPath)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    const ext = path.extname(localPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // If serving edit-pdf/index.html with ?test_mode=1, inject test driver and skip third-party ad network scripts in local test mode
    if (pathname.includes('/edit-pdf') && ext === '.html' && parsedUrl.searchParams.has('test_mode')) {
        let html = fs.readFileSync(localPath, 'utf8');
        html = html.replace(/<script[^>]*pagead2\.googlesyndication\.com[^>]*>\s*<\/script>/gi, '');
        html = html.replace('</body>', '<script src="/scripts/real-ui-test-driver.js"></script></body>');
        res.writeHead(200, {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store',
        });
        res.end(html);
        return;
    }

    res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(localPath).pipe(res);
});

server.keepAliveTimeout = 60000;
server.headersTimeout = 65000;

server.listen(PORT, '127.0.0.1', async () => {
    console.log(`Real-UI test server running at http://127.0.0.1:${PORT}`);

    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const useEdge = process.env.E2E_BROWSER === 'edge' || !fs.existsSync(chromePath);
    const browserPath = useEdge ? edgePath : chromePath;
    if (!fs.existsSync(browserPath)) {
        console.error('No Chromium browser executable found at Chrome or Edge paths.');
        process.exit(1);
    }

    const testUrl = `http://127.0.0.1:${PORT}/edit-pdf/?test_mode=1`;
    console.log(`Launching headless ${useEdge ? 'Edge' : 'Chrome'} opening REAL UI at: ${testUrl}...`);

    edgeProcess = spawn(browserPath, [
        '--headless=new',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--window-size=1400,1000',
        `--remote-debugging-port=${DEBUG_PORT}`,
        '--remote-allow-origins=*',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + path.join(require('os').tmpdir(), 'nopaypdf-browser-test-' + Date.now()),
        testUrl,
    ]);

    connectCDP();

    edgeProcess.stdout?.on('data', d => console.log('[EDGE-OUT]', d.toString().trim()));
    edgeProcess.stderr?.on('data', d => console.log('[EDGE-ERR]', d.toString().trim()));

    edgeProcess.on('error', (err) => {
        console.error('Edge process error:', err);
    });

    edgeProcess.on('exit', (code, sig) => {
        console.log(`[EDGE-EXIT] code: ${code}, signal: ${sig}`);
    });

    // Timeout safety net (90s)
    setTimeout(() => {
        console.error('❌ E2E Test timed out after 90 seconds');
        if (edgeProcess) {
            try { edgeProcess.kill('SIGKILL'); } catch (e) {}
        }
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
        server.close(() => process.exit(1));
        setTimeout(() => process.exit(1), 500);
    }, 90000);
});
