<?php
declare(strict_types=1);

/**
 * PDFToolKit - SEO & Structured Data Engine
 * Renders complete metadata, Open Graph, Twitter Cards, and Schema.org JSON-LD.
 */

require_once __DIR__ . '/config.php';

function render_seo_head(array $meta = [], array $faqsFallback = []): void
{
    // If $meta is a tool array from get_tool_registry() passed directly:
    if (isset($meta['slug']) && !isset($meta['tool'])) {
        $tool = $meta;
        $meta = [
            'title' => $tool['meta_title'] ?? ($tool['name'] . ' - ' . SITE_NAME),
            'description' => $tool['meta_desc'] ?? ($tool['short_desc'] ?? SITE_DESCRIPTION),
            'canonical' => SITE_URL . '/' . $tool['slug'],
            'tool' => $tool,
            'faqs' => !empty($faqsFallback) ? $faqsFallback : ($tool['faqs'] ?? []),
        ];
    }

    $title = $meta['title'] ?? (SITE_NAME . ' - ' . SITE_TAGLINE);
    $description = $meta['description'] ?? SITE_DESCRIPTION;
    $canonical = $meta['canonical'] ?? (SITE_URL . ($_SERVER['REQUEST_URI'] ?? '/'));
    // Strip query string for canonical
    $canonicalUrl = strtok($canonical, '?');
    
    $type = $meta['type'] ?? 'website';
    $ogImage = $meta['image'] ?? (SITE_URL . '/assets/img/og-preview.png');
    $isTool = isset($meta['tool']) && is_array($meta['tool']);
    $isHomepage = ($meta['is_homepage'] ?? false) || ($_SERVER['REQUEST_URI'] ?? '/') === '/';

    ?>
    <title><?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?></title>
    <meta name="description" content="<?= htmlspecialchars($description, ENT_QUOTES, 'UTF-8') ?>">
    <link rel="canonical" href="<?= htmlspecialchars($canonicalUrl, ENT_QUOTES, 'UTF-8') ?>">
    <meta name="robots" content="index, follow">

    <!-- Open Graph Metadata -->
    <meta property="og:site_name" content="<?= htmlspecialchars(SITE_NAME, ENT_QUOTES, 'UTF-8') ?>">
    <meta property="og:type" content="<?= htmlspecialchars($type, ENT_QUOTES, 'UTF-8') ?>">
    <meta property="og:title" content="<?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?>">
    <meta property="og:description" content="<?= htmlspecialchars($description, ENT_QUOTES, 'UTF-8') ?>">
    <meta property="og:url" content="<?= htmlspecialchars($canonicalUrl, ENT_QUOTES, 'UTF-8') ?>">
    <meta property="og:image" content="<?= htmlspecialchars($ogImage, ENT_QUOTES, 'UTF-8') ?>">

    <!-- Twitter Card Metadata -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?>">
    <meta name="twitter:description" content="<?= htmlspecialchars($description, ENT_QUOTES, 'UTF-8') ?>">
    <meta name="twitter:image" content="<?= htmlspecialchars($ogImage, ENT_QUOTES, 'UTF-8') ?>">

    <!-- JSON-LD Structured Data -->
    <?php if ($isHomepage): ?>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "<?= htmlspecialchars(SITE_NAME, ENT_QUOTES, 'UTF-8') ?>",
      "url": "<?= htmlspecialchars(SITE_URL, ENT_QUOTES, 'UTF-8') ?>",
      "description": "<?= htmlspecialchars(SITE_DESCRIPTION, ENT_QUOTES, 'UTF-8') ?>",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "<?= htmlspecialchars(SITE_URL, ENT_QUOTES, 'UTF-8') ?>/?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
    </script>
    <?php elseif ($isTool): 
        $tool = $meta['tool'];
    ?>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "<?= htmlspecialchars($tool['name'] . ' - ' . SITE_NAME, ENT_QUOTES, 'UTF-8') ?>",
      "operatingSystem": "Web Browser",
      "applicationCategory": "UtilitiesApplication",
      "url": "<?= htmlspecialchars($canonicalUrl, ENT_QUOTES, 'UTF-8') ?>",
      "description": "<?= htmlspecialchars($tool['short_desc'], ENT_QUOTES, 'UTF-8') ?>",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    }
    </script>
    <?php if (!empty($meta['faqs']) && is_array($meta['faqs'])): ?>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        <?php 
        $faqEntities = [];
        foreach ($meta['faqs'] as $faq) {
            $faqEntities[] = json_encode([
                '@type' => 'Question',
                'name' => $faq['q'],
                'acceptedAnswer' => [
                    '@type' => 'Answer',
                    'text' => $faq['a']
                ]
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }
        echo implode(",\n        ", $faqEntities);
        ?>
      ]
    }
    </script>
    <?php endif; ?>
    <?php else: ?>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "<?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?>",
      "url": "<?= htmlspecialchars($canonicalUrl, ENT_QUOTES, 'UTF-8') ?>",
      "description": "<?= htmlspecialchars($description, ENT_QUOTES, 'UTF-8') ?>"
    }
    </script>
    <?php endif; ?>
    <?php
}
