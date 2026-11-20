<?php
declare(strict_types=1);

/**
 * NoPayPDF - PDF to JPG / PNG Converter
 * 100% Client-Side High-DPI Document Rasterization
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';

$tool = get_tool_by_slug('pdf-to-jpg');
if (!$tool) {
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'title' => 'Upload Your PDF File',
        'desc' => 'Drag and drop your PDF into the converter box or select it from your computer or phone.',
    ],
    [
        'title' => 'Choose Format & Resolution',
        'desc' => 'Select JPG or PNG, set your desired resolution (72, 150, or 300 DPI), and choose which pages to convert.',
    ],
    [
        'title' => 'Instant Image Download',
        'desc' => 'Download individual page images or package all converted pages into a single ZIP archive.',
    ],
];

$faqs = [
    [
        'q' => 'Are my PDF documents uploaded to your servers during conversion?',
        'a' => 'No. NoPayPDF renders every page directly inside your browser using client-side canvas technology. Your files and converted images never leave your computer.',
    ],
    [
        'q' => 'How can I convert images back into a single PDF document?',
        'a' => 'If you have multiple JPG, PNG, or WebP pictures you want to compile into a neat document, use our matching <a href="/jpg-to-pdf/" class="text-brand-600 hover:text-brand-700 underline font-medium">JPG to PDF</a> tool to arrange pages and customize margins.',
    ],
    [
        'q' => 'Can I extract readable text from scanned PDF pages instead of just images?',
        'a' => 'Yes. If you need machine-readable text rather than pictures, use our <a href="/ocr-pdf/" class="text-brand-600 hover:text-brand-700 underline font-medium">OCR PDF</a> tool to perform optical character recognition directly in your browser.',
    ],
    [
        'q' => 'Can I edit the PDF before exporting it as images?',
        'a' => 'Absolutely. You can modify text, annotate, or fix mistakes using our in-browser <a href="/edit-pdf/" class="text-brand-600 hover:text-brand-700 underline font-medium">Edit PDF</a> tool before exporting to JPG or PNG.',
    ],
    [
        'q' => 'What is the difference between JPG and PNG export?',
        'a' => 'JPG produces significantly smaller file sizes with adjustable quality, making it ideal for sharing and web use. PNG is lossless and preserves vector clarity and transparency.',
    ],
    [
        'q' => 'Why choose 150 DPI or 300 DPI resolution?',
        'a' => 'Standard 72 DPI is best for fast web viewing. High 150 DPI provides crisp text on high-resolution Retina displays, and Print 300 DPI produces ultra-sharp images suitable for professional document printing.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/pdf-to-jpg/',
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
        <div id="pdf-to-jpg-dropzone" class="dropzone-container border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl p-10 sm:p-14 text-center bg-white cursor-pointer shadow-xs transition-all flex flex-col items-center justify-center">
            <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <i data-lucide="image" class="w-8 h-8"></i>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold text-slate-900">Choose a PDF File to Convert</h2>
            <p class="text-xs sm:text-sm text-slate-500 mt-2 max-w-md">
                Drag and drop your PDF document here, or click to browse. Converts each page to crisp JPG or PNG images.
            </p>
            <button type="button" class="mt-6 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm transition-colors pointer-events-none">
                Select PDF File
            </button>
            <input type="file" id="pdf-to-jpg-file-input" class="hidden" accept=".pdf,application/pdf">
        </div>
    </div>

    <!-- Active Workspace View -->
    <div id="workspace-view" class="hidden space-y-6">
        <!-- Document Meta Header -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="file-text" class="w-5 h-5"></i>
                </div>
                <div class="overflow-hidden">
                    <h3 id="doc-name" class="text-sm font-bold text-slate-900 truncate">document.pdf</h3>
                    <p class="text-xs text-slate-500 mt-0.5">
                        <span id="doc-size">0 KB</span> &bull; <span id="doc-page-count">0</span> pages
                    </p>
                </div>
            </div>

            <button type="button" id="change-file-btn" class="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                <span>Change File</span>
            </button>
        </div>

        <!-- Export Settings Panel -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Conversion Settings</h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <!-- Image Format -->
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-2">Image Format</label>
                    <div class="grid grid-cols-2 gap-2">
                        <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50/50 has-[:checked]:text-blue-700 text-xs font-semibold">
                            <input type="radio" name="image-format" value="jpg" checked class="hidden">
                            <span>JPG (Standard)</span>
                        </label>
                        <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50/50 has-[:checked]:text-blue-700 text-xs font-semibold">
                            <input type="radio" name="image-format" value="png" class="hidden">
                            <span>PNG (Lossless)</span>
                        </label>
                    </div>
                </div>

                <!-- Resolution Preset -->
                <div>
                    <label for="dpi-select" class="block text-xs font-semibold text-slate-700 mb-2">Resolution / Quality</label>
                    <select id="dpi-select" class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                        <option value="72">Standard (72 DPI — 1.0x scale)</option>
                        <option value="150" selected>High (150 DPI — 2.0x scale, Recommended)</option>
                        <option value="300">Print Quality (300 DPI — 4.0x scale)</option>
                    </select>
                    <p id="dpi-warning" class="hidden text-[11px] text-amber-600 mt-1">
                        High memory usage at 300 DPI on large documents.
                    </p>
                </div>

                <!-- JPEG Quality Slider (Shown only when JPG selected) -->
                <div id="quality-slider-container">
                    <div class="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                        <label for="jpg-quality">JPEG Quality</label>
                        <span id="quality-display" class="text-blue-600 font-bold">88%</span>
                    </div>
                    <input
                        type="range"
                        id="jpg-quality"
                        min="60"
                        max="98"
                        value="88"
                        class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    >
                    <div class="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                        <span>Smaller size (60%)</span>
                        <span>High quality (98%)</span>
                    </div>
                </div>
            </div>

            <!-- Page Selection Controls -->
            <div class="pt-4 border-t border-slate-100 space-y-3">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <span class="font-semibold text-slate-700">Pages to Convert:</span>
                    <div class="flex items-center gap-3">
                        <label class="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="page-scope" value="all" checked class="text-blue-600 focus:ring-blue-500">
                            <span class="text-slate-700 font-medium">All Pages</span>
                        </label>
                        <label class="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="page-scope" value="custom" class="text-blue-600 focus:ring-blue-500">
                            <span class="text-slate-700 font-medium">Custom Selection / Range</span>
                        </label>
                    </div>
                </div>

                <div id="custom-range-row" class="hidden">
                    <input
                        type="text"
                        id="page-range-input"
                        placeholder="e.g. 1-3, 5, 8-10"
                        class="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                    <p id="range-preview-feedback" class="text-xs text-slate-500 mt-1"></p>
                </div>
            </div>
        </div>

        <!-- Thumbnail Gallery for Visual Selection -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div class="flex items-center justify-between text-xs px-1">
                <span class="font-bold text-slate-800">Preview & Page Selection:</span>
                <span class="text-slate-500">
                    <span id="selected-pages-count" class="font-bold text-blue-600">0</span> pages selected
                </span>
            </div>

            <div id="pages-preview-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[360px] overflow-y-auto p-1">
                <!-- Injected progressively by JS -->
            </div>
        </div>

        <!-- Convert Action Trigger & Progress Bar -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <button
                type="button"
                id="convert-action-btn"
                class="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
                <i data-lucide="image-down" class="w-4 h-4"></i>
                <span>Convert to Images Now</span>
            </button>

            <!-- Progress Bar -->
            <div id="convert-progress-container"></div>
        </div>

        <!-- In-Tool Ad Slot with Safe Margin -->
        <?php render_ad_slot('in-tool'); ?>

        <!-- Result View: Converted Images Gallery -->
        <div id="result-view" class="hidden space-y-5">
            <!-- Header Result Card -->
            <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
                <div class="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <i data-lucide="check-circle" class="w-6 h-6"></i>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-emerald-950">Conversion Complete!</h3>
                    <p id="result-summary" class="text-xs sm:text-sm text-emerald-800 mt-1"></p>
                </div>
                <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                        type="button"
                        id="download-zip-btn"
                        class="w-full sm:w-auto px-7 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition-colors"
                    >
                        <i data-lucide="archive" class="w-4 h-4"></i>
                        <span>Download All as ZIP</span>
                    </button>
                    <button
                        type="button"
                        id="convert-reset-btn"
                        class="w-full sm:w-auto px-5 py-3 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-xs sm:text-sm transition-colors"
                    >
                        Convert Another PDF
                    </button>
                </div>
            </div>

            <!-- Exported Images Grid -->
            <div id="converted-images-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <!-- Image cards injected by JS -->
            </div>
        </div>
    </div>
</section>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'pdf-to-jpg'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
    '/assets/js/pdf-render.js?v=' . APP_VERSION,
    '/assets/js/tools/pdf-to-jpg.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
