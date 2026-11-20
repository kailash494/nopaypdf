<?php
declare(strict_types=1);

/**
 * PDFToolKit - Development Server Router
 * Usage: php -S localhost:8000 router.php
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$uri = rawurldecode($uri);

// Serve existing static assets under /assets/ or static files directly
$localFilePath = __DIR__ . $uri;
if ($uri !== '/' && file_exists($localFilePath) && !is_dir($localFilePath)) {
    // Ensure WebAssembly binary files are served with the required application/wasm MIME type
    if (pathinfo($localFilePath, PATHINFO_EXTENSION) === 'wasm') {
        header('Content-Type: application/wasm');
        header('Content-Length: ' . (string)filesize($localFilePath));
        header('Cache-Control: public, max-age=31536000, immutable');
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
    case '/privacy-policy':
        require __DIR__ . '/pages/privacy-policy.php';
        return true;

    case '/terms':
        require __DIR__ . '/pages/terms.php';
        return true;

    case '/sitemap.xml':
        require __DIR__ . '/sitemap.php';
        return true;

    case '/favicon.ico':
        header('Content-Type: image/svg+xml');
        echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#2563eb"/><text y="68" x="50" font-size="60" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="bold">P</text></svg>';
        return true;

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
