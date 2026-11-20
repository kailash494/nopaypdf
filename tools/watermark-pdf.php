<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';
require_once __DIR__ . '/../includes/seo.php';
require_once __DIR__ . '/../includes/ad-slots.php';

$registry = get_tool_registry();
$tool = $registry['watermark-pdf'] ?? null;
if (!$tool) {
    http_response_code(404);
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'step' => 1,
        'title' => 'Select PDF Document',
        'desc' => 'Upload the PDF you want to protect or brand with a custom stamp.',
    ],
    [
        'step' => 2,
        'title' => 'Customize Watermark & Live Preview',
        'desc' => 'Type your text or upload a logo. Adjust rotation, opacity, position, and see updates instantly on Page 1.',
    ],
    [
        'step' => 3,
        'title' => 'Apply & Download PDF',
        'desc' => 'Stamp all or selected pages locally in your browser and download your secured document.',
    ],
];

$faqs = [
    [
        'q' => 'Can I add an image logo as a watermark?',
        'a' => 'Yes. NoPayPDF supports both custom text watermarks and transparent PNG or JPG image logos with configurable scaling, rotation, and opacity.',
    ],
    [
        'q' => 'Can I stamp only specific pages of my PDF?',
        'a' => 'Yes. Choose the "Custom Page Range" option and enter page numbers or ranges (e.g., "1, 3-5") to stamp only selected pages while leaving other pages untouched.',
    ],
    [
        'q' => 'What is the Tiled Watermark mode?',
        'a' => 'Tiled mode repeats your text or logo watermark diagonally across the entire surface of each page in an organized grid, making it virtually impossible for unauthorized parties to crop out your copyright or confidentiality notice.',
    ],
    [
        'q' => 'Are my files or custom logos uploaded to a server?',
        'a' => 'No. All rendering, image embedding, and PDF document generation takes place strictly in your web browser memory. No data is ever transmitted or stored on external servers.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/watermark-pdf',
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

        <!-- Dropzone Container -->
        <div
            id="watermark-dropzone"
            class="relative border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer shadow-xs hover:shadow-md group"
        >
            <input type="file" id="watermark-file-input" class="hidden" accept=".pdf,application/pdf">

            <div class="flex flex-col items-center justify-center space-y-4">
                <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                    <i data-lucide="stamp" class="w-8 h-8"></i>
                </div>
                <div>
                    <h2 class="text-base sm:text-lg font-bold text-slate-900">
                        Choose a PDF to Watermark
                    </h2>
                    <p class="text-xs sm:text-sm text-slate-500 mt-1">
                        Drag and drop your file here, or <span class="text-blue-600 font-semibold underline">browse files</span>
                    </p>
                </div>
                <div class="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                    <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-600"></i>
                    <span>100% In-Browser Stamping &bull; Zero Server Uploads</span>
                </div>
            </div>
        </div>

        <!-- File Loaded Workspace -->
        <div id="watermark-workspace" class="hidden space-y-6">

            <!-- File Header Info Card -->
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-center gap-3.5 min-w-0">
                    <div class="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <i data-lucide="file-text" class="w-6 h-6"></i>
                    </div>
                    <div class="min-w-0">
                        <h3 id="file-name-label" class="text-sm font-bold text-slate-900 truncate">document.pdf</h3>
                        <p id="file-meta-label" class="text-xs text-slate-500 mt-0.5">0 KB &bull; 0 pages</p>
                    </div>
                </div>

                <div class="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                        type="button"
                        id="change-file-btn"
                        class="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                        Change File
                    </button>
                </div>
            </div>

            <!-- Two-Column Configurator & Live Preview -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                <!-- Left Column: Controls (7 cols) -->
                <div class="lg:col-span-7 space-y-5">

                    <!-- Watermark Type Selector Tabs -->
                    <div class="bg-slate-100 p-1 rounded-2xl flex items-center">
                        <button
                            type="button"
                            class="watermark-type-tab flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer bg-blue-600 text-white shadow-xs"
                            data-type="text"
                        >
                            Text Stamp
                        </button>
                        <button
                            type="button"
                            class="watermark-type-tab flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer bg-transparent text-slate-600 hover:text-slate-900"
                            data-type="image"
                        >
                            Image / Logo
                        </button>
                    </div>

                    <!-- Panel 1: Text Watermark Controls -->
                    <div id="panel-text-watermark" class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Text Watermark Content</h3>

                        <div>
                            <label for="wm-text-input" class="block text-xs font-semibold text-slate-700 mb-1">Watermark Text</label>
                            <input
                                type="text"
                                id="wm-text-input"
                                value="CONFIDENTIAL"
                                class="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                            >
                        </div>

                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                                <label for="wm-font-family" class="block text-xs font-semibold text-slate-700 mb-1">Font</label>
                                <select id="wm-font-family" class="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                                    <option value="HelveticaBold" selected>Helvetica Bold</option>
                                    <option value="Helvetica">Helvetica</option>
                                    <option value="TimesRoman">Times Roman</option>
                                    <option value="CourierBold">Courier Bold</option>
                                </select>
                            </div>

                            <div>
                                <label for="wm-font-size" class="block text-xs font-semibold text-slate-700 mb-1">
                                    Size: <span id="wm-font-size-label" class="font-normal text-slate-500">48 pt</span>
                                </label>
                                <input type="range" id="wm-font-size" min="16" max="120" value="48" class="w-full accent-blue-600">
                            </div>

                            <div class="col-span-2 sm:col-span-1">
                                <label for="wm-text-color" class="block text-xs font-semibold text-slate-700 mb-1">Color</label>
                                <div class="flex items-center gap-2">
                                    <input type="color" id="wm-text-color" value="#ef4444" class="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-white">
                                    <input type="text" id="wm-text-color-hex" value="#ef4444" class="w-20 px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Panel 2: Image Watermark Controls -->
                    <div id="panel-image-watermark" class="hidden bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Upload Logo / Image</h3>

                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-1.5">Select Image (.png, .jpg, .webp)</label>
                            <input type="file" id="wm-image-input" accept="image/png,image/jpeg,image/webp" class="text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-slate-50 hover:file:bg-slate-100 cursor-pointer">
                        </div>

                        <div>
                            <label for="wm-image-scale" class="block text-xs font-semibold text-slate-700 mb-1">
                                Logo Width: <span id="wm-image-scale-label" class="font-normal text-slate-500">35% of page</span>
                            </label>
                            <input type="range" id="wm-image-scale" min="10" max="90" value="35" class="w-full accent-blue-600">
                        </div>
                    </div>

                    <!-- Shared Position & Angle Controls -->
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                        <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Placement & Transparency</h3>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <!-- Opacity Slider -->
                            <div>
                                <label for="wm-opacity" class="block text-xs font-semibold text-slate-700 mb-1">
                                    Opacity: <span id="wm-opacity-label" class="font-normal text-slate-500">35%</span>
                                </label>
                                <input type="range" id="wm-opacity" min="10" max="100" value="35" class="w-full accent-blue-600">
                            </div>

                            <!-- Rotation Slider & Shortcuts -->
                            <div>
                                <label for="wm-rotation" class="block text-xs font-semibold text-slate-700 mb-1">
                                    Rotation: <span id="wm-rotation-label" class="font-normal text-slate-500">-45&deg;</span>
                                </label>
                                <input type="range" id="wm-rotation" min="-90" max="90" value="-45" class="w-full accent-blue-600">
                                <div class="flex items-center gap-1.5 mt-1.5">
                                    <button type="button" class="btn-rot-preset px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700" data-deg="-45">-45&deg;</button>
                                    <button type="button" class="btn-rot-preset px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700" data-deg="0">0&deg; (Horizontal)</button>
                                    <button type="button" class="btn-rot-preset px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700" data-deg="45">45&deg;</button>
                                </div>
                            </div>
                        </div>

                        <!-- Placement Mode: Single Anchor vs Tiled Grid -->
                        <div class="pt-2 border-t border-slate-100 space-y-3">
                            <span class="block text-xs font-semibold text-slate-700">Placement Pattern</span>

                            <div class="grid grid-cols-2 gap-3">
                                <label class="p-3 rounded-xl border border-blue-600 bg-blue-50/30 cursor-pointer flex items-center gap-2.5 has-checked:border-blue-600 has-checked:bg-blue-50/30">
                                    <input type="radio" name="wm-placement-mode" value="single" checked class="accent-blue-600">
                                    <span class="text-xs font-bold text-slate-800">Single Anchor</span>
                                </label>
                                <label class="p-3 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer flex items-center gap-2.5 has-checked:border-blue-600 has-checked:bg-blue-50/30">
                                    <input type="radio" name="wm-placement-mode" value="tiled" class="accent-blue-600">
                                    <span class="text-xs font-bold text-slate-800">Tiled Grid</span>
                                </label>
                            </div>

                            <!-- 3x3 Anchor Grid (Shown when Single Anchor is selected) -->
                            <div id="anchor-grid-container" class="space-y-1.5 pt-1">
                                <span class="block text-[11px] font-medium text-slate-500">Anchor Position:</span>
                                <div class="grid grid-cols-3 gap-1.5 w-36 bg-slate-100 p-1.5 rounded-xl">
                                    <button type="button" class="btn-anchor h-8 rounded-lg bg-white text-slate-700 text-xs font-bold hover:bg-blue-50 transition-colors" data-pos="top-left">&nwarr;</button>
                                    <button type="button" class="btn-anchor h-8 rounded-lg bg-white text-slate-700 text-xs font-bold hover:bg-blue-50 transition-colors" data-pos="top-center">&uarr;</button>
                                    <button type="button" class="btn-anchor h-8 rounded-lg bg-white text-slate-700 text-xs font-bold hover:bg-blue-50 transition-colors" data-pos="top-right">&nearr;</button>
                                    <button type="button" class="btn-anchor h-8 rounded-lg bg-white text-slate-700 text-xs font-bold hover:bg-blue-50 transition-colors" data-pos="middle-left">&larr;</button>
                                    <button type="button" class="btn-anchor h-8 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors" data-pos="center">&bull;</button>
                                    <button type="button" class="btn-anchor h-8 rounded-lg bg-white text-slate-700 text-xs font-bold hover:bg-blue-50 transition-colors" data-pos="middle-right">&rarr;</button>
                                    <button type="button" class="btn-anchor h-8 rounded-lg bg-white text-slate-700 text-xs font-bold hover:bg-blue-50 transition-colors" data-pos="bottom-left">&swarr;</button>
                                    <button type="button" class="btn-anchor h-8 rounded-lg bg-white text-slate-700 text-xs font-bold hover:bg-blue-50 transition-colors" data-pos="bottom-center">&darr;</button>
                                    <button type="button" class="btn-anchor h-8 rounded-lg bg-white text-slate-700 text-xs font-bold hover:bg-blue-50 transition-colors" data-pos="bottom-right">&searr;</button>
                                </div>
                            </div>
                        </div>

                        <!-- Target Page Selection -->
                        <div class="pt-2 border-t border-slate-100 space-y-2">
                            <span class="block text-xs font-semibold text-slate-700">Apply Watermark To:</span>
                            <div class="flex items-center gap-4">
                                <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                                    <input type="radio" name="wm-page-target" value="all" checked class="accent-blue-600">
                                    <span>All Pages</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                                    <input type="radio" name="wm-page-target" value="custom" class="accent-blue-600">
                                    <span>Custom Range</span>
                                </label>
                            </div>
                            <div id="custom-range-container" class="hidden max-w-xs">
                                <input
                                    type="text"
                                    id="wm-page-ranges-input"
                                    placeholder="e.g. 1, 3-5, 8"
                                    class="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                                >
                            </div>
                        </div>

                    </div>

                    <!-- Action & Progress Bar -->
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <button
                            type="button"
                            id="watermark-submit-btn"
                            class="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            <i data-lucide="stamp" class="w-4 h-4"></i>
                            <span>Apply Watermark to PDF</span>
                        </button>

                        <div id="watermark-progress-container"></div>
                    </div>
                </div>

                <!-- Right Column: Live Synchronized Preview (5 cols) -->
                <div class="lg:col-span-5 space-y-4">
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-bold text-slate-900 uppercase tracking-wider">Page 1 Live Preview</span>
                            <span class="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold border border-blue-200">
                                Interactive
                            </span>
                        </div>

                        <!-- Preview Canvas Stack -->
                        <div class="relative w-full bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center p-3 border border-slate-200 min-h-[380px]">
                            <div class="relative shadow-md rounded overflow-hidden" id="preview-wrapper">
                                <canvas id="preview-page-canvas" class="block w-full h-auto bg-white"></canvas>
                                <canvas id="preview-watermark-canvas" class="absolute inset-0 pointer-events-none w-full h-full"></canvas>
                            </div>
                        </div>

                        <p class="text-[11px] text-slate-400 text-center">
                            The watermark updates in real-time as you adjust settings.
                        </p>
                    </div>
                </div>

            </div>

            <!-- In-Tool Ad Slot with Generous Margin -->
            <?php render_ad_slot('in-tool'); ?>

            <!-- Result Download Card -->
            <div id="result-view" class="hidden space-y-5">
                <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
                    <div class="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                        <i data-lucide="check-circle" class="w-8 h-8"></i>
                    </div>

                    <div>
                        <h3 class="text-xl font-bold text-emerald-950">Watermark Applied Successfully!</h3>
                        <p id="result-summary" class="text-xs sm:text-sm text-emerald-800 mt-1"></p>
                    </div>

                    <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            id="download-watermarked-btn"
                            class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>Download Watermarked PDF</span>
                        </button>
                        <button
                            type="button"
                            id="watermark-reset-btn"
                            class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-sm transition-colors cursor-pointer"
                        >
                            Watermark Another PDF
                        </button>
                    </div>
                </div>
            </div>

        </div>

    </div>
</section>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'watermark-pdf'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    '/assets/js/pdf-render.js?v=' . APP_VERSION,
    '/assets/js/tools/watermark-pdf.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
