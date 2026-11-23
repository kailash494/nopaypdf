const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8124;
const ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wasm': 'application/wasm',
};

const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    let filePath = path.join(ROOT, parsedUrl.pathname);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, async () => {
    console.log(`Local test server running at http://localhost:${PORT}`);

    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    if (!fs.existsSync(edgePath)) {
        console.error('Edge executable not found at:', edgePath);
        process.exit(1);
    }

    const testUrl = `http://localhost:${PORT}/scripts/test-color-matching.html`;
    console.log(`Launching headless browser at ${testUrl}...`);

    const edgeProcess = spawn(edgePath, [
        '--headless=new',
        '--disable-gpu',
        '--remote-debugging-port=9222',
        '--user-data-dir=' + path.join(__dirname, '.edge-test-profile'),
        testUrl,
    ]);

    // Give browser time to run and check results via remote devtools or poll server / wait
    // Or we can let the test page fetch an endpoint on our server to report results!
});

// Add an endpoint to receive test results
const originalHandler = server.listeners('request')[0];
server.removeAllListeners('request');

server.on('request', (req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    if (parsedUrl.pathname === '/report-result' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const data = JSON.parse(body);
            console.log('\n================ TEST RESULTS ================');
            if (data.log && Array.isArray(data.log)) {
                data.log.forEach(l => console.log(l));
            }
            console.log('==============================================\n');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ received: true }));

            server.close(() => {
                if (data.status === 'PASSED') {
                    console.log('🎉 ALL ASSERTIONS PASSED SUCCESSFULLY!');
                    process.exit(0);
                } else {
                    console.error('❌ TEST FAILED:', data.error);
                    process.exit(1);
                }
            });
        });
        return;
    }

    originalHandler(req, res);
});
