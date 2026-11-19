<?php
declare(strict_types=1);

/**
 * PDFToolKit - JPG / PNG / WebP to PDF Converter
 * 100% Client-Side Image to PDF Compilation
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';

$tool = get_tool_by_slug('jpg-to-pdf');
if (!$tool) {
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'title' => 'Select Your Images',
        'desc' => 'Drag and drop JPG, PNG, or WebP images into the box or browse from your device.',
    ],
    [
        'title' => 'Reorder & Customize Layout',
        'desc' => 'Drag to reorder pictures, rotate orientations, and choose page size (A4, Letter, or Fit to Image).',
    ],
    [
        'title' => 'Download Your PDF Document',
        'desc' => 'Click "Create PDF" to bundle your images into a single clean PDF file and download instantly.',
    ],
];

$faqs = [
    [
        'q' => 'What image formats can I convert to PDF?',
        'a' => 'PDFToolKit supports JPG/JPEG, PNG, and modern WebP images. You can even combine different image formats into a single PDF.',
    ],
    [
        'q' => 'Are my private photos uploaded to a server?',
        'a' => 'No. All image decoding, orientation correction, and PDF compilation take place directly inside your web browser. Your photos never leave your device.',
    ],
    [
        'q' => 'What does the "Fit to Image" page size setting do?',
        'a' => 'With "Fit to Image" selected, each PDF page is dynamically sized to exactly match the dimensions and aspect ratio of that specific image without margins or borders.',
    ],
    [
        'q' => 'Will my smartphone photos be rotated correctly?',
        'a' => 'Yes. PDFToolKit uses modern browser image decoding that automatically respects and applies camera EXIF orientation metadata, plus manual 90° rotation buttons.',
    ],
    [
        'q' => 'Is there any limit on the number of images I can combine?',
        'a' => 'No artificial limits exist. You can convert dozens of photos at once depending on your device’s memory capacity.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/jpg-to-pdf',
    'tool' => $tool,
    'faqs' => $faqs,
];

require_once __DIR__ . '/../includes/header.php';
?>

<!-- Tool Hero Header -->
<?php render_tool_hero($tool); ?>

<!-- Interactive Tool Workspace -->
<section class="py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
    <!-- Error Alert Banner -->
    <div id="error-alert" class="hidden mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
        <i data-lucide="alert-circle" class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"></i>
        <div class="flex-grow" id="error-message"></div>
        <button type="button" id="error-dismiss-btn" class="p-1 text-red-400 hover:text-red-700">
            <i data-lucide="x" class="w-4 h-4"></i>
        </button>
    </div>

    <!-- Dropzone View -->
    <div id="dropzone-view" class="w-full">
        <div id="jpg-dropzone" class="dropzone-container border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl p-10 sm:p-14 text-center bg-white cursor-pointer shadow-xs transition-all flex flex-col items-center justify-center">
            <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <i data-lucide="file-image" class="w-8 h-8"></i>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold text-slate-900">Choose Images to Convert to PDF</h2>
            <p class="text-xs sm:text-sm text-slate-500 mt-2 max-w-md">
                Drag and drop JPG, PNG, or WebP images here, or click to browse. Combine multiple photos into one document.
            </p>
            <button type="button" class="mt-6 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm transition-colors pointer-events-none">
                Select Images
            </button>
            <input type="file" id="jpg-file-input" class="hidden" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp">
        </div>
    </div>

    <!-- Active Workspace View -->
    <div id="workspace-view" class="hidden space-y-6">
        <!-- Queue Header Toolbar -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="images" class="w-5 h-5"></i>
                </div>
                <div>
                    <h2 class="text-base font-bold text-slate-900">Image Queue (<span id="queue-count">0</span> images)</h2>
                    <p class="text-xs text-slate-500">Drag cards or use buttons to rearrange page sequence.</p>
                </div>
            </div>

            <!-- Toolbar Buttons -->
            <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                <button type="button" id="add-more-img-btn" class="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    <span>Add More Images</span>
                </button>
                <input type="file" id="add-more-img-input" class="hidden" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp">

                <button type="button" id="sort-az-btn" class="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors" title="Sort by filename">
                    <i data-lucide="arrow-down-a-z" class="w-3.5 h-3.5"></i>
                    <span>Sort A-Z</span>
                </button>

                <button type="button" id="sort-reverse-btn" class="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors" title="Reverse order">
                    <i data-lucide="arrow-up-down" class="w-3.5 h-3.5"></i>
                    <span>Reverse</span>
                </button>

                <button type="button" id="clear-all-btn" class="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs font-medium transition-colors" title="Clear all images">
                    Clear All
                </button>
            </div>
        </div>

        <!-- Reorderable Image Cards Grid -->
        <div id="image-queue-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-2 bg-slate-100/60 rounded-2xl border border-slate-200 min-h-[180px]">
            <!-- Injected dynamically by JS -->
        </div>

        <!-- PDF Layout Options Card -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">PDF Page Setup</h3>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <!-- Page Size -->
                <div>
                    <label for="page-size-select" class="block text-xs font-semibold text-slate-700 mb-1.5">Page Size</label>
                    <select id="page-size-select" class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                        <option value="a4" selected>A4 (210 × 297 mm)</option>
                        <option value="letter">US Letter (8.5 × 11 in)</option>
                        <option value="fit">Fit to Image (No extra borders)</option>
                    </select>
                </div>

                <!-- Page Orientation -->
                <div id="orientation-container">
                    <label for="orientation-select" class="block text-xs font-semibold text-slate-700 mb-1.5">Page Orientation</label>
                    <select id="orientation-select" class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                        <option value="auto" selected>Auto (Based on image shape)</option>
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                    </select>
                </div>

                <!-- Margin Size -->
                <div>
                    <label for="margin-select" class="block text-xs font-semibold text-slate-700 mb-1.5">Page Margins</label>
                    <select id="margin-select" class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                        <option value="0">No Margins (Edge-to-Edge)</option>
                        <option value="20" selected>Small Margins (20 pt)</option>
                        <option value="40">Medium Margins (40 pt)</option>
                    </select>
                </div>
            </div>

            <!-- Output File Name & Action -->
            <div class="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div class="sm:col-span-2">
                    <label for="output-filename" class="block text-xs font-semibold text-slate-700 mb-1">Output File Name</label>
                    <input
                        type="text"
                        id="output-filename"
                        value="images-to-pdf.pdf"
                        class="w-full px-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                </div>

                <div class="sm:col-span-1 flex flex-col justify-end">
                    <button
                        type="button"
                        id="create-pdf-btn"
                        class="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all"
                    >
                        <i data-lucide="file-check-2" class="w-4 h-4"></i>
                        <span>Create PDF Now</span>
                    </button>
                </div>
            </div>

            <!-- Progress Bar -->
            <div id="jpg-progress-container"></div>
        </div>

        <!-- In-Tool Ad Slot with Safe Margin -->
        <?php render_ad_slot('in-tool'); ?>

        <!-- Result Download Card -->
        <div id="result-view" class="hidden bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
            <div class="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <i data-lucide="check-circle" class="w-8 h-8"></i>
            </div>
            <div>
                <h3 class="text-xl font-bold text-emerald-950">PDF Successfully Created!</h3>
                <p id="result-summary" class="text-xs sm:text-sm text-emerald-800 mt-1"></p>
            </div>
            <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                    type="button"
                    id="download-pdf-btn"
                    class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                    <i data-lucide="download" class="w-4 h-4"></i>
                    <span>Download PDF File</span>
                </button>
                <button
                    type="button"
                    id="jpg-reset-btn"
                    class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-sm transition-colors"
                >
                    Convert Another Batch
                </button>
            </div>
        </div>
    </div>
</section>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'jpg-to-pdf'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    '/assets/js/tools/jpg-to-pdf.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
