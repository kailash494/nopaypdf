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
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wasm': 'application/wasm',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
};

let edgeProcess = null;

const DEBUG_PORT = 9235;
const cdpLogs = [];
let cdpConnected = false;

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
            const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl) || targets[0];
            if (pageTarget && pageTarget.webSocketDebuggerUrl && !connecting) {
                connecting = true;
                console.log(`Connected CDP to tab: ${pageTarget.title || pageTarget.url}`);
                const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
                ws.on('open', () => {
                    cdpConnected = true;
                    ws.send(JSON.stringify({ id: 1, method: 'Log.enable' }));
                    ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
                });
                ws.on('message', (raw) => {
                    try {
                        const msg = JSON.parse(raw);
                        if (msg.method === 'Log.entryAdded') {
                            const entry = msg.params.entry;
                            if (entry.level === 'warning' || entry.level === 'error') {
                                cdpLogs.push({ level: entry.level, text: entry.text, source: 'Log.entryAdded' });
                            }
                        } else if (msg.method === 'Runtime.consoleAPICalled') {
                            const params = msg.params;
                            if (params.type === 'warning' || params.type === 'error') {
                                const text = params.args.map(a => a.value || a.description || '').join(' ');
                                cdpLogs.push({ level: params.type, text, source: 'Runtime.consoleAPICalled' });
                            }
                        } else if (msg.method === 'Runtime.exceptionThrown') {
                            const text = msg.params.exceptionDetails?.text || 'Uncaught exception';
                            cdpLogs.push({ level: 'error', text, source: 'Runtime.exceptionThrown' });
                        }
                    } catch (e) {}
                });
                return;
            }
        } catch (e) {
            // Wait for Edge to bind port
        }
    }
    console.warn('[CDP] Could not attach CDP session within timeout');
}

const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

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

            // CDP Verification Check
            const canvasWarnings = cdpLogs.filter(l => l.text.includes('CanvasTextBaseline') || l.text.includes('alphabetical'));
            const cdpErrors = cdpLogs.filter(l => l.level === 'error');

            console.log(`CDP Engine Telemetry: ${cdpLogs.length} total entries captured (${cdpErrors.length} errors, ${canvasWarnings.length} CanvasTextBaseline warnings)`);
            if (cdpLogs.length > 0) {
                cdpLogs.forEach(l => console.log(`  [CDP-${l.level.toUpperCase()}] (${l.source}) ${l.text}`));
            }

            let cdpPassed = true;
            if (canvasWarnings.length > 0) {
                console.error(`❌ FAIL: CDP detected ${canvasWarnings.length} CanvasTextBaseline engine warning(s)!`);
                cdpPassed = false;
            }
            if (cdpErrors.length > 0) {
                console.error(`❌ FAIL: CDP detected ${cdpErrors.length} browser engine error(s)!`);
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

    // If serving edit-pdf/index.html with ?test_mode=1, inject test driver
    if (pathname.includes('/edit-pdf') && ext === '.html' && parsedUrl.searchParams.has('test_mode')) {
        let html = fs.readFileSync(localPath, 'utf8');
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

server.listen(PORT, async () => {
    console.log(`Real-UI test server running at http://localhost:${PORT}`);

    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    if (!fs.existsSync(edgePath)) {
        console.error('Edge executable not found at:', edgePath);
        process.exit(1);
    }

    const testUrl = `http://localhost:${PORT}/edit-pdf/?test_mode=1`;
    console.log(`Launching headless Edge opening REAL UI at: ${testUrl}...`);

    edgeProcess = spawn(edgePath, [
        '--headless=new',
        '--disable-gpu',
        '--window-size=1400,1000',
        `--remote-debugging-port=${DEBUG_PORT}`,
        '--user-data-dir=' + path.join(require('os').tmpdir(), 'nopaypdf-edge-test-' + Date.now()),
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

    // Timeout safety net (60s)
    setTimeout(() => {
        console.error('❌ E2E Test timed out after 60 seconds');
        if (edgeProcess) edgeProcess.kill();
        server.close(() => process.exit(1));
    }, 60000);
});
