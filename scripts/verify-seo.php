<?php
declare(strict_types=1);

/**
 * NoPayPDF - Automated Build-Time SEO & Consistency Verification
 * Validates the exported dist/ directory prior to Cloudflare Pages deployment.
 * Exit code 0 on success, 1 on failure.
 */

$distDir = realpath(__DIR__ . '/../dist');
if (!$distDir || !is_dir($distDir)) {
    fwrite(STDERR, "❌ ERROR: dist directory not found at $distDir. Run build-static.php first.\n");
    exit(1);
}

echo "========================================================\n";
echo "NoPayPDF - Build-Time SEO & Integrity Verification\n";
echo "Directory: $distDir\n";
echo "========================================================\n\n";

$errors = [];
$warnings = [];
$checkedPages = 0;
$checkedLinks = 0;
$titlesSeen = [];

// 1. Verify robots.txt
$robotsPath = $distDir . '/robots.txt';
if (!file_exists($robotsPath)) {
    $errors[] = "Missing robots.txt in dist/";
} else {
    $robotsContent = file_get_contents($robotsPath);
    if (!str_contains($robotsContent, 'https://nopaypdf.com/sitemap.xml')) {
        $errors[] = "robots.txt does not declare Sitemap: https://nopaypdf.com/sitemap.xml";
    } else {
        echo "✓ robots.txt exists and points to https://nopaypdf.com/sitemap.xml\n";
    }
}

// 2. Verify ads.txt
$adsPath = $distDir . '/ads.txt';
if (!file_exists($adsPath)) {
    $errors[] = "Missing ads.txt in dist/";
} else {
    $adsContent = file_get_contents($adsPath);
    if (!str_contains($adsContent, 'ca-pub-6082492006145986') && !str_contains($adsContent, 'pub-6082492006145986')) {
        $errors[] = "ads.txt does not contain pub-6082492006145986";
    } else {
        echo "✓ ads.txt exists with AdSense publisher verification (pub-6082492006145986)\n";
    }
}

// 3. Verify sitemap.xml
$sitemapPath = $distDir . '/sitemap.xml';
$sitemapUrls = [];
if (!file_exists($sitemapPath)) {
    $errors[] = "Missing sitemap.xml in dist/";
} else {
    $sitemapXml = file_get_contents($sitemapPath);
    preg_match_all('/<loc>(.*?)<\/loc>/', $sitemapXml, $matches);
    $sitemapUrls = $matches[1] ?? [];
    echo "✓ sitemap.xml found with " . count($sitemapUrls) . " URLs.\n";

    if (count($sitemapUrls) < 20) {
        $errors[] = "sitemap.xml has fewer than expected URLs (found " . count($sitemapUrls) . ")";
    }

    foreach ($sitemapUrls as $url) {
        if (!str_ends_with($url, '/')) {
            $errors[] = "Sitemap URL missing trailing slash: $url";
        }
        $parsed = parse_url($url);
        $path = $parsed['path'] ?? '/';
        $localRel = trim($path, '/');
        $expectedFile = $localRel === '' ? $distDir . '/index.html' : $distDir . '/' . $localRel . '/index.html';
        if (!file_exists($expectedFile)) {
            $errors[] = "Sitemap URL $url has no corresponding HTML file at $expectedFile";
        }
    }
}

// 4. Scan all HTML files in dist/
$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($distDir, RecursiveDirectoryIterator::SKIP_DOTS)
);

$htmlFiles = [];
foreach ($iterator as $file) {
    if ($file->isFile() && strtolower($file->getExtension()) === 'html') {
        $htmlFiles[] = $file->getPathname();
    }
}

sort($htmlFiles);
echo "Scanning " . count($htmlFiles) . " HTML documents in dist/...\n\n";

foreach ($htmlFiles as $filePath) {
    $relPath = str_replace([$distDir . DIRECTORY_SEPARATOR, $distDir . '/'], '', $filePath);
    $relPath = str_replace('\\', '/', $relPath);
    $content = file_get_contents($filePath);
    $checkedPages++;

    $is404 = ($relPath === '404.html' || str_starts_with($relPath, '404/'));

    // Rule A: Byte 0 DOCTYPE
    if (!preg_match('/^<!doctype html/i', ltrim($content, "\xEF\xBB\xBF"))) {
        $errors[] = "[$relPath] Missing or delayed <!DOCTYPE html> at byte 0.";
    }

    // Rule B: Title tag validation
    if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $content, $tMatch)) {
        $title = trim(html_entity_decode($tMatch[1], ENT_QUOTES, 'UTF-8'));
        $titleLen = strlen($title);
        if ($titleLen < 15 || $titleLen > 95) {
            $warnings[] = "[$relPath] Title length ($titleLen chars) out of recommended 15-90 range: '$title'";
        }
        if (isset($titlesSeen[$title]) && !$is404) {
            $warnings[] = "[$relPath] Duplicate title detected. Also used in [{$titlesSeen[$title]}]: '$title'";
        } else {
            $titlesSeen[$title] = $relPath;
        }
    } else {
        $errors[] = "[$relPath] Missing <title> tag.";
    }

    // Rule C: Meta description
    if (preg_match('/<meta\s+[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\']/i', $content, $dMatch) ||
        preg_match('/<meta\s+[^>]*content=["\']([^"\']*)["\'][^>]*name=["\']description["\']/i', $content, $dMatch)) {
        $desc = trim(html_entity_decode($dMatch[1], ENT_QUOTES, 'UTF-8'));
        $descLen = strlen($desc);
        if ($descLen < 40 || $descLen > 250) {
            $warnings[] = "[$relPath] Meta description length ($descLen chars) out of standard 50-220 range.";
        }
    } else {
        $errors[] = "[$relPath] Missing <meta name=\"description\"> tag.";
    }

    // Rule D: Canonical link
    if (preg_match('/<link\s+[^>]*rel=["\']canonical["\'][^>]*href=["\']([^"\']*)["\']/i', $content, $cMatch) ||
        preg_match('/<link\s+[^>]*href=["\']([^"\']*)["\'][^>]*rel=["\']canonical["\']/i', $content, $cMatch)) {
        $canonical = $cMatch[1];
        if (!str_ends_with($canonical, '/')) {
            $errors[] = "[$relPath] Canonical tag missing trailing slash: $canonical";
        }
        if (!str_starts_with($canonical, 'https://nopaypdf.com/')) {
            $errors[] = "[$relPath] Canonical does not use production base https://nopaypdf.com/: $canonical";
        }
    } else {
        $errors[] = "[$relPath] Missing <link rel=\"canonical\"> tag.";
    }

    // Rule E: Robots meta tag
    if (preg_match('/<meta\s+[^>]*name=["\']robots["\'][^>]*content=["\']([^"\']*)["\']/i', $content, $rMatch)) {
        $robots = strtolower(trim($rMatch[1]));
        if ($is404) {
            if (!str_contains($robots, 'noindex')) {
                $errors[] = "[$relPath] 404 page must have noindex in robots meta (found '$robots').";
            }
        } else {
            if (str_contains($robots, 'noindex')) {
                $errors[] = "[$relPath] Production indexable page has accidental 'noindex' directive!";
            }
        }
    } elseif ($is404) {
        $errors[] = "[$relPath] 404 page missing robots meta tag with noindex.";
    }

    // Rule F: JSON-LD Structured Data Syntax
    if (preg_match_all('/<script\s+type=["\']application\/ld\+json["\'][^>]*>(.*?)<\/script>/is', $content, $jsonMatches)) {
        foreach ($jsonMatches[1] as $idx => $jsonString) {
            $decoded = json_decode(trim($jsonString), true);
            if ($decoded === null) {
                $errors[] = "[$relPath] Malformed JSON-LD block #$idx: " . json_last_error_msg();
            }
        }
    }

    // Rule G: Check for unrendered unicode escape strings
    if (str_contains($content, '\u2022') || str_contains($content, '\u00a0') || str_contains($content, '\u00A0')) {
        $errors[] = "[$relPath] Found unescaped literal \\u escape sequences in HTML copy.";
    }

    // Rule H: Check internal links in this document
    if (preg_match_all('/<a\s+[^>]*href=["\']([^"\']+)["\']/i', $content, $aMatches)) {
        foreach ($aMatches[1] as $target) {
            if (str_starts_with($target, '#') || 
                str_starts_with($target, 'http://') || 
                str_starts_with($target, 'https://') || 
                str_starts_with($target, 'mailto:') || 
                str_starts_with($target, 'tel:') || 
                str_starts_with($target, 'javascript:')) {
                continue;
            }

            $checkedLinks++;
            $cleanTarget = strtok($target, '#');
            $cleanTarget = strtok($cleanTarget, '?');
            if ($cleanTarget === '' || $cleanTarget === false) {
                continue;
            }

            // Internal link must start with /
            if (!str_starts_with($cleanTarget, '/')) {
                $warnings[] = "[$relPath] Relative internal link without leading slash: '$target'";
                continue;
            }

            // Map target to file on disk
            $stripped = trim($cleanTarget, '/');
            $candidates = [
                $distDir . '/' . $stripped,
                $distDir . '/' . $stripped . '/index.html',
                $distDir . '/' . $stripped . '.html',
            ];

            if ($stripped === '') {
                $candidates = [$distDir . '/index.html'];
            }

            $found = false;
            foreach ($candidates as $cand) {
                if (file_exists($cand)) {
                    $found = true;
                    break;
                }
            }

            if (!$found) {
                $errors[] = "[$relPath] Broken internal link: '$target' does not resolve to an existing file in dist/";
            }
        }
    }
}

echo "Summary:\n";
echo "Checked $checkedPages HTML pages.\n";
echo "Checked $checkedLinks internal links.\n";
echo "Found " . count($warnings) . " warnings.\n";
echo "Found " . count($errors) . " errors.\n\n";

if (!empty($warnings)) {
    echo "⚠️  WARNINGS:\n";
    foreach ($warnings as $w) {
        echo "  - $w\n";
    }
    echo "\n";
}

if (!empty($errors)) {
    echo "❌ VERIFICATION FAILED WITH " . count($errors) . " ERROR(S):\n";
    foreach ($errors as $e) {
        echo "  - $e\n";
    }
    echo "\n";
    exit(1);
}

echo "✅ All build-time SEO, canonical, sitemap, structured data, and internal link checks PASSED!\n";
exit(0);
