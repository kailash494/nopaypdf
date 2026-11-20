<?php
declare(strict_types=1);

/**
 * NoPayPDF - Local Configuration Override Template
 * Copy this file to includes/config.local.php to customize local or production settings.
 * DO NOT commit includes/config.local.php to version control.
 */

// Override Site URL (e.g., https://nopaypdf.com or https://example.pages.dev)
// define('SITE_URL', 'https://nopaypdf.com');

// Support / Inquiries Contact Email
// define('CONTACT_EMAIL', 'support@nopaypdf.com');

// Ad Mode:
// 'off'         -> Zero ad code or empty boxes rendered (Required when submitting domain for AdSense review)
// 'placeholder' -> Renders lightweight dev boxes to verify CLS layout stability
// 'adsense'     -> Renders real Google AdSense units using ADSENSE_PUBLISHER_ID
define('AD_MODE', 'off');

// Your Google AdSense Publisher ID (Required when AD_MODE is 'adsense')
define('ADSENSE_PUBLISHER_ID', 'ca-pub-0000000000000000');

// Optional: Per-slot AdSense Slot IDs
define('ADSENSE_SLOTS', [
    'top-banner' => '1234567890',
    'in-tool' => '2345678901',
    'bottom-banner' => '3456789012',
]);
