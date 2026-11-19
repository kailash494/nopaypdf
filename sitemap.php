<?php
declare(strict_types=1);

/**
 * PDFToolKit - Dynamic XML Sitemap Generator
 */

require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/tool-registry.php';

header('Content-Type: application/xml; charset=utf-8');
header('X-Robots-Tag: noindex, follow', true);

$today = date('Y-m-d');
$allTools = get_all_tools();

// Core static pages
$urls = [
    [
        'loc' => SITE_URL . '/',
        'lastmod' => $today,
        'changefreq' => 'weekly',
        'priority' => '1.0',
    ],
    [
        'loc' => SITE_URL . '/privacy-policy',
        'lastmod' => $today,
        'changefreq' => 'monthly',
        'priority' => '0.5',
    ],
    [
        'loc' => SITE_URL . '/terms',
        'lastmod' => $today,
        'changefreq' => 'monthly',
        'priority' => '0.5',
    ],
];

// Add only active tools dynamically
foreach ($allTools as $slug => $tool) {
    if ($tool['status'] === 'active') {
        $urls[] = [
            'loc' => SITE_URL . '/' . $slug,
            'lastmod' => $today,
            'changefreq' => 'weekly',
            'priority' => '0.8',
        ];
    }
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . PHP_EOL;
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<?php foreach ($urls as $u): ?>
    <url>
        <loc><?= htmlspecialchars($u['loc'], ENT_XML1, 'UTF-8') ?></loc>
        <lastmod><?= htmlspecialchars($u['lastmod'], ENT_XML1, 'UTF-8') ?></lastmod>
        <changefreq><?= htmlspecialchars($u['changefreq'], ENT_XML1, 'UTF-8') ?></changefreq>
        <priority><?= htmlspecialchars($u['priority'], ENT_XML1, 'UTF-8') ?></priority>
    </url>
<?php endforeach; ?>
</urlset>
