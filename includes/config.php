<?php
declare(strict_types=1);

/**
 * PDFToolKit - Core Configuration
 * 100% Client-Side PDF Tools
 */

if (!defined('SITE_NAME')) {
    define('SITE_NAME', 'PDFToolKit');
}

if (!defined('SITE_TAGLINE')) {
    define('SITE_TAGLINE', 'Free, Fast & Secure In-Browser PDF Tools');
}

if (!defined('SITE_DESCRIPTION')) {
    define('SITE_DESCRIPTION', 'Free, private, and unlimited online PDF tools that run entirely in your web browser. Merge, split, compress, convert, and edit PDFs with zero server uploads.');
}

if (!defined('APP_VERSION')) {
    define('APP_VERSION', '1.0.0');
}

// Development ad placeholder mode (true to render CLS-safe container placeholders)
if (!defined('ADS_ENABLED')) {
    define('ADS_ENABLED', true);
}

if (!defined('CONTACT_EMAIL')) {
    define('CONTACT_EMAIL', 'support@pdftoolkit.local');
}

// Detect or override base URL
if (!defined('SITE_URL')) {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || 
                (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) ||
                (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
                ? 'https://' : 'http://';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
    define('SITE_URL', rtrim($protocol . $host, '/'));
}
