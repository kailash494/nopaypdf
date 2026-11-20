<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';
require_once __DIR__ . '/../includes/seo.php';
require_once __DIR__ . '/../includes/ad-slots.php';

$registry = get_tool_registry();
$tool = $registry['grayscale-pdf'] ?? null;
if (!$tool) {
    http_response_code(404);
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'step' => 1,
        'title' => 'Select Color PDF',
        'desc' => 'Upload the PDF document you want to convert to black and white or monochrome grayscale.',
    ],
    [
        'step' => 2,
        'title' => 'Choose Tone & Quality',
        'desc' => 'Select Standard Grayscale, High-Contrast Print, or Pure B&W Threshold with live Page 1 preview.',
    ],
    [
        'step' => 3,
        'title' => 'Download Grayscale PDF',
        'desc' => 'Convert locally in your browser and download ink-friendly, printer-optimized documents.',
    ],
];

$faqs = [
    [
        'q' => 'Why should I convert my PDF to grayscale?',
        'a' => 'Converting colorful PDFs to grayscale saves valuable printer ink, speeds up network printing, complies with legal document submission standards, and ensures clean photocopying.',
    ],
    [
        'q' => 'What is the difference between Grayscale and Pure Black & White?',
        'a' => 'Standard Grayscale retains smooth shades of gray across photos and charts using human perceptual luminance. Pure Black & White uses a binary threshold where pixels are either pure black or pure white, producing ultra-crisp scanned text for low-cost monochrome copiers.',
    ],
    [
        'q' => 'Can I convert only specific pages to grayscale?',
        'a' => 'Yes. Select the "Custom Page Range" option to convert only chosen pages (e.g. "1, 3-5") while leaving other pages in their original color and vector format.',
    ],
    [
        'q' => 'Are my files uploaded to a server for processing?',
        'a' => 'No. NoPayPDF transforms all pixels and rebuilds the PDF completely inside your web browser. No files are ever uploaded or transmitted.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/grayscale-pdf',
    'tool' => $tool,
    'faqs' => $faqs,
];

require_once __DIR__ . '/../includes/header.php';
?>

<!-- Tool Hero Header -->
<?php render_tool_hero($tool); ?>

<!-- Main Tool Workspace -->
<section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="space-y-6">

        <!-- Error Notification Banner -->
        <div id="error-alert" class="hidden bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3">
            <i data-lucide="alert-circle" class="w-5 h-5 text-rose-600 shrink-0 mt-0.5"></i>
            <div class="flex-1 text-xs sm:text-sm" id="error-message"></div>
            <button type="button" id="error-dismiss-btn" class="text-rose-400 hover:text-rose-700">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        </div>

        <!-- 1. Upload Dropzone -->
        <div id="upload-panel" class="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xs">
            <div
                id="pdf-dropzone"
                class="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 group"
            >
                <input type="file" id="pdf-file-input" class="hidden" accept=".pdf,application/pdf">
                
                <div class="w-16 h-16 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                    <i data-lucide="contrast" class="w-8 h-8"></i>
                </div>
                
                <h2 class="text-lg sm:text-xl font-bold text-slate-900 mb-1">
                    Choose a PDF to Convert to Grayscale
                </h2>
                <p class="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-5">
                    Drag and drop your PDF here, or click to browse. Convert color pages to monochrome black and white instantly.
                </p>

                <div class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors">
                    <i data-lucide="upload" class="w-4 h-4"></i>
                    <span>Select PDF Document</span>
                </div>
            </div>
        </div>

        <!-- 2. Configuration & Live Before/After Preview Panel -->
        <div id="config-panel" class="hidden space-y-6">

            <!-- File Header Summary -->
            <div class="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <i data-lucide="file-text" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h3 id="doc-filename" class="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">document.pdf</h3>
                        <p id="doc-meta" class="text-xs text-slate-500">1 Page &bull; 0 KB</p>
                    </div>
                </div>

                <button
                    type="button"
                    id="change-file-btn"
                    class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                >
                    Change File
                </button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                <!-- Settings Column (5 cols) -->
                <div class="lg:col-span-5 space-y-5">
                    
                    <div class="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-5">
                        <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <i data-lucide="sliders" class="w-4 h-4 text-blue-600"></i>
                            <span>Conversion Settings</span>
                        </h3>

                        <!-- Tone Mode Selector -->
                        <div class="space-y-2">
                            <label class="block text-xs font-semibold text-slate-700">Tone Mode:</label>
                            <div class="space-y-2">
                                <label class="flex items-start gap-3 p-3 rounded-xl border-2 border-blue-600 bg-blue-50/40 cursor-pointer transition-all tone-option-label" data-mode="standard">
                                    <input type="radio" name="tone-mode" value="standard" checked class="mt-0.5 accent-blue-600">
                                    <div>
                                        <span class="block text-xs font-bold text-slate-900">Standard Grayscale</span>
                                        <span class="block text-[11px] text-slate-500">Perceptual luminance preserving smooth photo and chart gradients.</span>
                                    </div>
                                </label>

                                <label class="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white cursor-pointer transition-all tone-option-label" data-mode="contrast">
                                    <input type="radio" name="tone-mode" value="contrast" class="mt-0.5 accent-blue-600">
                                    <div>
                                        <span class="block text-xs font-bold text-slate-900">High-Contrast Print</span>
                                        <span class="block text-[11px] text-slate-500">Boosts contrast to keep text pitch black and backgrounds clean white.</span>
                                    </div>
                                </label>

                                <label class="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white cursor-pointer transition-all tone-option-label" data-mode="threshold">
                                    <input type="radio" name="tone-mode" value="threshold" class="mt-0.5 accent-blue-600">
                                    <div>
                                        <span class="block text-xs font-bold text-slate-900">Pure Black & White (Binary)</span>
                                        <span class="block text-[11px] text-slate-500">Zero gray shades. Maximizes monochrome ink savings and OCR contrast.</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <!-- Threshold Slider (Visible only for threshold mode) -->
                        <div id="threshold-slider-group" class="hidden space-y-2 pt-2 border-t border-slate-100">
                            <div class="flex items-center justify-between text-xs font-semibold">
                                <span class="text-slate-700">B&W Threshold:</span>
                                <span id="threshold-val-label" class="text-blue-600 font-bold">160</span>
                            </div>
                            <input
                                type="range"
                                id="threshold-slider"
                                min="80"
                                max="220"
                                value="160"
                                class="w-full accent-blue-600 cursor-pointer"
                            >
                            <div class="flex justify-between text-[10px] text-slate-400">
                                <span>Darker (80)</span>
                                <span>Default (160)</span>
                                <span>Lighter (220)</span>
                            </div>
                        </div>

                        <!-- Output Resolution -->
                        <div class="space-y-1.5 pt-2 border-t border-slate-100">
                            <label for="resolution-select" class="block text-xs font-semibold text-slate-700">Resolution / Quality:</label>
                            <select id="resolution-select" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:ring-2 focus:ring-blue-500">
                                <option value="150" selected>Standard (150 DPI) &bull; Balanced speed & size</option>
                                <option value="220">High (220 DPI) &bull; Sharper text & photos</option>
                                <option value="300">Print Quality (300 DPI) &bull; Professional archival</option>
                            </select>
                        </div>

                        <!-- Page Scope -->
                        <div class="space-y-2 pt-2 border-t border-slate-100">
                            <label class="block text-xs font-semibold text-slate-700">Page Range:</label>
                            <div class="flex items-center gap-4 text-xs font-medium text-slate-700">
                                <label class="flex items-center gap-1.5 cursor-pointer">
                                    <input type="radio" name="page-scope" value="all" checked class="accent-blue-600">
                                    <span>All Pages</span>
                                </label>
                                <label class="flex items-center gap-1.5 cursor-pointer">
                                    <input type="radio" name="page-scope" value="custom" class="accent-blue-600">
                                    <span>Custom Range</span>
                                </label>
                            </div>
                            <input
                                type="text"
                                id="custom-range-input"
                                placeholder="e.g. 1-3, 5"
                                class="hidden w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                            >
                        </div>

                        <!-- Transparency Info Badge -->
                        <div class="p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-[11px] text-amber-900">
                            <i data-lucide="info" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"></i>
                            <p class="leading-relaxed">
                                Client-side grayscale conversion renders targeted pages into optimized high-resolution monochrome images for 100% universal printer compatibility.
                            </p>
                        </div>

                        <!-- Primary Action Button -->
                        <button
                            type="button"
                            id="convert-grayscale-btn"
                            class="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <i data-lucide="contrast" class="w-4 h-4"></i>
                            <span>Convert to Grayscale PDF</span>
                        </button>
                    </div>

                </div>

                <!-- Live Before / After Preview Column (7 cols) -->
                <div class="lg:col-span-7 space-y-4">
                    <div class="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
                        <div class="flex items-center justify-between">
                            <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <i data-lucide="eye" class="w-4 h-4 text-blue-600"></i>
                                <span>Page 1 Live Preview</span>
                            </h3>

                            <!-- Preview View Mode Toggle (Side-by-Side vs Grayscale Only) -->
                            <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 text-xs">
                                <button type="button" id="toggle-split-view-btn" class="px-2.5 py-1 rounded-md font-semibold bg-white text-blue-600 shadow-2xs">Split View</button>
                                <button type="button" id="toggle-mono-only-btn" class="px-2.5 py-1 rounded-md font-semibold text-slate-600 hover:text-slate-900">Grayscale Only</button>
                            </div>
                        </div>

                        <div id="preview-stage" class="bg-slate-100 rounded-2xl p-4 min-h-[420px] flex items-center justify-center overflow-auto border border-slate-200/60">
                            
                            <!-- Split View Container -->
                            <div id="split-preview-wrap" class="grid grid-cols-2 gap-4 w-full max-w-xl">
                                <div class="space-y-1.5 text-center">
                                    <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Original Color</span>
                                    <div class="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex items-center justify-center">
                                        <canvas id="original-preview-canvas" class="max-w-full max-h-[360px] block object-contain"></canvas>
                                    </div>
                                </div>

                                <div class="space-y-1.5 text-center">
                                    <span class="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Grayscale Preview</span>
                                    <div class="bg-white rounded-lg shadow-sm border border-blue-300 overflow-hidden flex items-center justify-center ring-2 ring-blue-500/10">
                                        <canvas id="grayscale-preview-canvas" class="max-w-full max-h-[360px] block object-contain"></canvas>
                                    </div>
                                </div>
                            </div>

                            <!-- Single Mono View Container -->
                            <div id="mono-preview-wrap" class="hidden text-center space-y-1.5">
                                <span class="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Grayscale Output Preview</span>
                                <div class="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden inline-flex items-center justify-center">
                                    <canvas id="mono-single-canvas" class="max-w-full max-h-[380px] block object-contain"></canvas>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

            </div>

            <!-- Conversion Progress Indicator -->
            <div id="progress-panel" class="hidden bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-3">
                <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto animate-spin">
                    <i data-lucide="loader-2" class="w-5 h-5"></i>
                </div>
                <div>
                    <h4 class="text-sm font-bold text-slate-900" id="progress-title">Converting Document...</h4>
                    <p class="text-xs text-slate-500 mt-0.5" id="progress-desc">Processing page pixels...</p>
                </div>
                <div class="w-full max-w-md mx-auto bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div id="progress-bar" class="bg-blue-600 h-2.5 rounded-full transition-all duration-200" style="width: 10%"></div>
                </div>
            </div>

            <!-- In-Tool Ad Slot -->
            <?php render_ad_slot('in-tool'); ?>

            <!-- Result Card -->
            <div id="result-panel" class="hidden bg-white rounded-3xl border border-emerald-200/80 p-6 sm:p-10 shadow-xs">
                <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
                    <div class="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                        <i data-lucide="check-circle" class="w-8 h-8"></i>
                    </div>

                    <div>
                        <h3 class="text-xl font-bold text-emerald-950">PDF Converted to Grayscale!</h3>
                        <p id="result-summary" class="text-xs sm:text-sm text-emerald-800 mt-1">Your printer-ready monochrome document is ready.</p>
                    </div>

                    <!-- Size Comparison Card -->
                    <div class="inline-flex items-center gap-4 px-4 py-2 bg-white rounded-xl border border-emerald-200 text-xs text-slate-700 shadow-2xs">
                        <div>Original: <strong id="res-orig-size" class="text-slate-900">0 KB</strong></div>
                        <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-slate-400"></i>
                        <div>Grayscale: <strong id="res-mono-size" class="text-emerald-700">0 KB</strong></div>
                    </div>

                    <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            id="download-grayscale-pdf-btn"
                            class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>Download Grayscale PDF</span>
                        </button>
                        <button
                            type="button"
                            id="grayscale-reset-btn"
                            class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-sm transition-colors cursor-pointer"
                        >
                            Convert Another PDF
                        </button>
                    </div>
                </div>
            </div>

        </div>

    </div>
</section>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'grayscale-pdf'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    '/assets/js/pdf-render.js?v=' . APP_VERSION,
    '/assets/js/tools/grayscale-pdf.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
