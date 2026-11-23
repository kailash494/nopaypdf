<?php
declare(strict_types=1);

/**
 * NoPayPDF - Development Server Router
 * Usage: php -S localhost:8000 router.php
 */

// Global Security & CSP Headers (WASM & Web Worker friendly)
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()');
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://*.googlesyndication.com https://pagead2.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google https://www.google.com https://fundingchoicesmessages.google.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; worker-src 'self' blob: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; connect-src 'self' data: blob: https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com https://tessdata.projectnaptha.com https://*.googlesyndication.com https://pagead2.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google https://fundingchoicesmessages.google.com https://csi.gstatic.com https://www.google.com https://cloudflareinsights.com; frame-src 'self' blob: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self';");

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$uri = rawurldecode($uri);

// Serve existing static assets under /assets/ or static files directly
$localFilePath = __DIR__ . $uri;
if ($uri !== '/' && file_exists($localFilePath) && !is_dir($localFilePath)) {
    $ext = pathinfo($localFilePath, PATHINFO_EXTENSION);
    // Ensure WebAssembly binary files are served with the required application/wasm MIME type
    if ($ext === 'wasm') {
        header('Content-Type: application/wasm');
        header('Content-Length: ' . (string)filesize($localFilePath));
        header('Cache-Control: public, max-age=31536000, immutable');
        readfile($localFilePath);
        return true;
    }
    if ($ext === 'ttf') {
        header('Content-Type: font/ttf');
        header('Content-Length: ' . (string)filesize($localFilePath));
        header('Cache-Control: public, max-age=31536000, immutable');
        readfile($localFilePath);
        return true;
    }
    if ($ext === 'svg') {
        header('Content-Type: image/svg+xml');
        readfile($localFilePath);
        return true;
    }
    if ($ext === 'webmanifest') {
        header('Content-Type: application/manifest+json');
        readfile($localFilePath);
        return true;
    }
    // For other static assets, return false so the PHP built-in server handles them
    return false;
}

// Normalize URI path
$path = rtrim($uri, '/');
if ($path === '' || $path === '/index.php') {
    require __DIR__ . '/index.php';
    return true;
}

// Static clean SEO pages
switch ($path) {
    case '/about':
        require __DIR__ . '/pages/about.php';
        return true;

    case '/contact':
        require __DIR__ . '/pages/contact.php';
        return true;

    case '/licenses':
        require __DIR__ . '/pages/licenses.php';
        return true;

    case '/privacy-policy':
        require __DIR__ . '/pages/privacy-policy.php';
        return true;

    case '/terms':
        require __DIR__ . '/pages/terms.php';
        return true;

    case '/sitemap.xml':
        require __DIR__ . '/sitemap.php';
        return true;

    case '/ads.txt':
        if (file_exists(__DIR__ . '/ads.txt')) {
            header('Content-Type: text/plain; charset=utf-8');
            readfile(__DIR__ . '/ads.txt');
            return true;
        }
        break;

    case '/site.webmanifest':
        if (file_exists(__DIR__ . '/site.webmanifest')) {
            header('Content-Type: application/manifest+json; charset=utf-8');
            readfile(__DIR__ . '/site.webmanifest');
            return true;
        }
        break;

    case '/favicon.ico':
        if (file_exists(__DIR__ . '/assets/img/favicon.svg')) {
            header('Content-Type: image/svg+xml');
            readfile(__DIR__ . '/assets/img/favicon.svg');
            return true;
        }
        break;

    case '/robots.txt':
        if (file_exists(__DIR__ . '/robots.txt')) {
            header('Content-Type: text/plain; charset=utf-8');
            readfile(__DIR__ . '/robots.txt');
            return true;
        }
        break;
}

// Dynamic tool routing: /{slug}
if (preg_match('#^/([a-z0-9-]+)$#i', $path, $matches)) {
    $slug = strtolower($matches[1]);
    $toolScript = __DIR__ . '/tools/' . $slug . '.php';
    if (file_exists($toolScript)) {
        require $toolScript;
        return true;
    }
}

// Fallback to 404 Not Found
require __DIR__ . '/pages/404.php';
return true;
