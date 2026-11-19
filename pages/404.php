<?php
declare(strict_types=1);

/**
 * PDFToolKit - 404 Not Found Handler
 */

http_response_code(404);

require_once __DIR__ . '/../includes/config.php';

$pageMeta = [
    'title' => 'Page Not Found (404) | ' . SITE_NAME,
    'description' => 'The requested PDF tool or page could not be found. Explore our complete directory of free, client-side PDF utilities.',
    'canonical' => SITE_URL . '/404',
];

require_once __DIR__ . '/../includes/header.php';
?>

<div class="py-20 sm:py-28 bg-white text-center px-4">
    <div class="max-w-md mx-auto">
        <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-6">
            <i data-lucide="file-question" class="w-8 h-8"></i>
        </div>
        <span class="text-xs font-bold uppercase tracking-wider text-blue-600">Error 404</span>
        <h1 class="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">Page Not Found</h1>
        <p class="text-sm text-slate-600 mt-3 leading-relaxed">
            The page or tool you are looking for does not exist or may have been relocated.
        </p>
        <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="/" class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm">
                <i data-lucide="arrow-left" class="w-4 h-4"></i>
                <span>Back to All Tools</span>
            </a>
            <a href="/privacy-policy" class="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition-colors">
                Privacy Guarantee
            </a>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
