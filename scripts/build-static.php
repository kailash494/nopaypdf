<?php
declare(strict_types=1);

/**
 * NoPayPDF - Zero-Dependency Static Site Exporter
 * Generates an optimized, ready-to-deploy static site inside dist/
 * Perfect for Cloudflare Pages ($0/mo), GitHub Pages, Netlify, or Vercel.
 *
 * Usage:
 *   php scripts/build-static.php
 *   php scripts/build-static.php --base-url=https://nopaypdf.com --ad-mode=off
 */

$options = getopt('', ['base-url::', 'ad-mode::']);

$baseUrl = isset($options['base-url']) ? rtrim($options['base-url'], '/') : 'https://nopaypdf.com';
$adMode = $options['ad-mode'] ?? 'off';

$rootDir = realpath(__DIR__ . '/..');
$distDir = $rootDir . '/dist';

echo "\n======================================================\n";
echo " NoPayPDF - Static Site Exporter\n";
echo " Base URL: {$baseUrl}\n";
echo " Ad Mode:  {$adMode}\n";
echo " Target:   {$distDir}\n";
echo "======================================================\n\n";

// Helper to remove directory recursively
function removeDir(string $dir): void
{
    if (!is_dir($dir)) return;
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($files as $fileinfo) {
        $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
        $todo($fileinfo->getRealPath());
    }
    rmdir($dir);
}

// Helper to copy directory recursively
function copyDir(string $src, string $dst): void
{
    if (!is_dir($src)) return;
    @mkdir($dst, 0755, true);
    $dir = opendir($src);
    while (false !== ($file = readdir($dir))) {
        if ($file === '.' || $file === '..') continue;
        $srcPath = $src . '/' . $file;
        $dstPath = $dst . '/' . $file;
        if (is_dir($srcPath)) {
            copyDir($srcPath, $dstPath);
        } else {
            copy($srcPath, $dstPath);
        }
    }
    closedir($dir);
}

// Helper to execute PHP code in an isolated sub-process via proc_open
function runPhpIsolated(string $code): array
{
    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $process = proc_open([PHP_BINARY, '-d', 'display_errors=0', '-r', $code], $descriptors, $pipes);
    if (!is_resource($process)) {
        return ['stdout' => '', 'stderr' => 'Could not spawn PHP sub-process', 'exitCode' => 1];
    }

    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[2]);

    $exitCode = proc_close($process);
    return ['stdout' => $stdout, 'stderr' => $stderr, 'exitCode' => $exitCode];
}

// 1. Clean and initialize dist directory
if (is_dir($distDir)) {
    echo "Cleaning existing dist/ directory...\n";
    removeDir($distDir);
}
mkdir($distDir, 0755, true);

// 2. Define routes to build
require_once $rootDir . '/includes/tool-registry.php';
$tools = get_all_tools();

$routes = [
    '/' => $rootDir . '/index.php',
    '/about' => $rootDir . '/pages/about.php',
    '/contact' => $rootDir . '/pages/contact.php',
    '/licenses' => $rootDir . '/pages/licenses.php',
    '/privacy-policy' => $rootDir . '/pages/privacy-policy.php',
    '/terms' => $rootDir . '/pages/terms.php',
    '/404' => $rootDir . '/pages/404.php',
];

foreach ($tools as $slug => $tool) {
    if ($tool['status'] === 'active') {
        $routes['/' . $slug] = $rootDir . '/tools/' . $slug . '.php';
    }
}

// 3. Render HTML pages
echo "Rendering " . count($routes) . " static pages...\n";

foreach ($routes as $route => $file) {
    // Target file path
    if ($route === '/') {
        $outPath = $distDir . '/index.html';
    } elseif ($route === '/404') {
        $outPath = $distDir . '/404.html';
    } else {
        $folder = $distDir . $route;
        @mkdir($folder, 0755, true);
        $outPath = $folder . '/index.html';
    }

    $code = sprintf(
        '$_SERVER["REQUEST_URI"] = %s; $_SERVER["HTTP_HOST"] = %s; $_SERVER["HTTPS"] = %s; define("SITE_URL", %s); define("AD_MODE", %s); require %s;',
        var_export($route, true),
        var_export(parse_url($baseUrl, PHP_URL_HOST) ?? 'localhost', true),
        var_export(str_starts_with($baseUrl, 'https') ? 'on' : 'off', true),
        var_export($baseUrl, true),
        var_export($adMode, true),
        var_export($file, true)
    );

    $res = runPhpIsolated($code);

    if ($res['exitCode'] !== 0 || empty($res['stdout'])) {
        echo "  [ERROR] Failed rendering {$route} ({$file})\n";
        if (!empty($res['stderr'])) {
            echo "  STDERR: " . trim($res['stderr']) . "\n";
        }
        exit(1);
    }

    file_put_contents($outPath, $res['stdout']);
    echo "  [OK] {$route} -> " . str_replace($distDir . '/', '', $outPath) . "\n";
}

// 4. Generate sitemap.xml
echo "Generating dist/sitemap.xml...\n";
$sitemapCode = sprintf(
    'define("SITE_URL", %s); require %s;',
    var_export($baseUrl, true),
    var_export($rootDir . '/sitemap.php', true)
);
$resSitemap = runPhpIsolated($sitemapCode);
if ($resSitemap['exitCode'] !== 0 || empty($resSitemap['stdout'])) {
    echo "  [ERROR] Failed generating sitemap: " . trim($resSitemap['stderr']) . "\n";
    exit(1);
}
file_put_contents($distDir . '/sitemap.xml', $resSitemap['stdout']);
echo "  [OK] /sitemap.xml -> sitemap.xml\n";

// 5. Copy static root files
echo "Copying root static files...\n";
$rootFiles = ['robots.txt', 'ads.txt', 'site.webmanifest'];
foreach ($rootFiles as $rf) {
    if (file_exists($rootDir . '/' . $rf)) {
        copy($rootDir . '/' . $rf, $distDir . '/' . $rf);
        echo "  [OK] {$rf}\n";
    }
}

// 6. Copy assets/ directory recursively
echo "Copying assets/ directory...\n";
copyDir($rootDir . '/assets', $distDir . '/assets');
$wasmPath = $distDir . '/assets/vendor/qpdf/qpdf.wasm';
if (file_exists($wasmPath)) {
    echo "  [OK] Verified qpdf.wasm exists (" . filesize($wasmPath) . " bytes)\n";
} else {
    echo "  [WARNING] qpdf.wasm was not found in assets/vendor/qpdf/\n";
}

// 7. Generate Cloudflare Pages _headers & _redirects
echo "Generating Cloudflare Pages _headers and _redirects...\n";

$headersContent = <<<'HEADERS'
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://pagead2.googlesyndication.com https://fundingchoicesmessages.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; worker-src 'self' blob: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; connect-src 'self' data: blob: https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com https://tessdata.projectnaptha.com https://pagead2.googlesyndication.com; frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://fundingchoicesmessages.google.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self';

/*.wasm
  Content-Type: application/wasm
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.svg
  Content-Type: image/svg+xml
  Cache-Control: public, max-age=31536000, immutable

/*.ttf
  Content-Type: font/ttf
  Cache-Control: public, max-age=31536000, immutable

/site.webmanifest
  Content-Type: application/manifest+json
  Cache-Control: public, max-age=86400

/sitemap.xml
  Content-Type: application/xml
  Cache-Control: public, max-age=3600

/ads.txt
  Content-Type: text/plain
  Cache-Control: public, max-age=3600
HEADERS;

file_put_contents($distDir . '/_headers', $headersContent);
echo "  [OK] dist/_headers created\n";

$redirectsContent = <<<'REDIRECTS'
# Cloudflare Pages Redirects
/index.html / 301
REDIRECTS;

file_put_contents($distDir . '/_redirects', $redirectsContent);
echo "  [OK] dist/_redirects created\n";

echo "\n======================================================\n";
echo " Build Complete!\n";
echo " Deployable static folder: {$distDir}\n";
echo " Test locally via: php -S localhost:8080 -t dist\n";
echo "======================================================\n\n";
