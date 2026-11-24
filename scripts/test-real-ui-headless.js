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

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ received: true }));

            if (edgeProcess) {
                edgeProcess.kill();
            }

            server.close(() => {
                if (data.status === 'PASSED') {
                    console.log('🎉 REAL-UI HEADLESS BROWSER VERIFICATION PASSED!');
                    process.exit(0);
                } else {
                    console.error('❌ REAL-UI VERIFICATION FAILED:', data.error);
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
        '--user-data-dir=' + path.join(require('os').tmpdir(), 'nopaypdf-edge-test-' + Date.now()),
        testUrl,
    ]);

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
