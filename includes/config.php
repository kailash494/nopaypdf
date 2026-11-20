<?php
declare(strict_types=1);

/**
 * PDFToolKit - Core Configuration
 * 100% Client-Side PDF Tools
 */

// Load host/local override configuration if present (gitignored)
if (file_exists(__DIR__ . '/config.local.php')) {
    require_once __DIR__ . '/config.local.php';
}

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

/**
 * Ad Configuration & Google AdSense Mode:
 * 'off'         -> Zero ad scripts or empty containers rendered (Default for AdSense approval review)
 * 'placeholder' -> Renders lightweight dev boxes to verify CLS container stability
 * 'adsense'     -> Renders real Google AdSense units using ADSENSE_PUBLISHER_ID
 */
if (!defined('AD_MODE')) {
    $envAdMode = getenv('AD_MODE');
    define('AD_MODE', $envAdMode !== false ? $envAdMode : 'off');
}

// Backward compatibility with legacy ADS_ENABLED
if (!defined('ADS_ENABLED')) {
    define('ADS_ENABLED', AD_MODE !== 'off');
}

if (!defined('ADSENSE_PUBLISHER_ID')) {
    $envPubId = getenv('ADSENSE_PUBLISHER_ID');
    define('ADSENSE_PUBLISHER_ID', $envPubId !== false ? $envPubId : '');
}

if (!defined('ADSENSE_SLOTS')) {
    define('ADSENSE_SLOTS', []);
}

if (!defined('CONTACT_EMAIL')) {
    $envEmail = getenv('CONTACT_EMAIL');
    define('CONTACT_EMAIL', $envEmail !== false ? $envEmail : 'support@pdftoolkit.local');
}

// Base URL detection
if (!defined('SITE_URL')) {
    $envSiteUrl = getenv('SITE_URL');
    if ($envSiteUrl !== false && !empty($envSiteUrl)) {
        define('SITE_URL', rtrim($envSiteUrl, '/'));
    } else {
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || 
                    (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) ||
                    (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
                    ? 'https://' : 'http://';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
        define('SITE_URL', rtrim($protocol . $host, '/'));
    }
}

// Security: Suppress direct PHP error display in production to prevent path leakage
$isLocalhost = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true) ||
               str_contains($_SERVER['HTTP_HOST'] ?? '', 'localhost');

if (!$isLocalhost) {
    ini_set('display_errors', '0');
    ini_set('display_startup_errors', '0');
    error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);
}
