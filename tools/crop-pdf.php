<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';
require_once __DIR__ . '/../includes/seo.php';
require_once __DIR__ . '/../includes/ad-slots.php';

$registry = get_tool_registry();
$tool = $registry['crop-pdf'] ?? null;
if (!$tool) {
    http_response_code(404);
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'step' => 1,
        'title' => 'Select PDF Document',
        'desc' => 'Upload the PDF document you want to trim or adjust margins for.',
    ],
    [
        'step' => 2,
        'title' => 'Adjust Crop Box Visually',
        'desc' => 'Drag the corner and edge handles or type exact margin dimensions (pt, mm, in).',
    ],
    [
        'step' => 3,
        'title' => 'Apply & Download',
        'desc' => 'Crop all or selected pages instantly without losing vector sharpness or selectable text.',
    ],
];

$faqs = [
    [
        'q' => 'Is PDF cropping permanent and non-destructive?',
        'a' => 'Yes. NoPayPDF adjusts the PDF CropBox and MediaBox viewport parameters. All underlying vector elements, sharp fonts, and images are preserved without lossy rasterization or compression artifacts.',
    ],
    [
        'q' => 'Can I crop all pages at once or just specific pages?',
        'a' => 'You can apply your chosen crop box to all pages, only the current page, odd pages, even pages, or specify a custom page range (e.g. "1, 3-5").',
    ],
    [
        'q' => 'What measurement units can I use?',
        'a' => 'You can enter and view margins in typographic points (pt), millimeters (mm), or inches (in), with live two-way synchronization between visual dragging and numeric inputs.',
    ],
    [
        'q' => 'Are my files uploaded to any server?',
        'a' => 'No. All rendering, vector calculations, and PDF boundary updates take place strictly in your web browser memory. No files are ever sent to external servers.',
    ],
];

render_seo_head($tool, $faqs);
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
                
                <div class="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                    <i data-lucide="crop" class="w-8 h-8"></i>
                </div>
                
                <h2 class="text-lg sm:text-xl font-bold text-slate-900 mb-1">
                    Choose a PDF file to Crop
                </h2>
                <p class="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-5">
                    Trim unwanted page margins, white space, or headers/footers with interactive visual controls.
                </p>

                <div class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors">
                    <i data-lucide="upload" class="w-4 h-4"></i>
                    <span>Select PDF Document</span>
                </div>
            </div>
        </div>

        <!-- 2. Interactive Crop Workspace -->
        <div id="crop-workspace-panel" class="hidden space-y-6">

            <!-- File Header Summary -->
            <div class="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <i data-lucide="file-text" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h3 id="doc-filename" class="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">document.pdf</h3>
                        <p id="doc-meta" class="text-xs text-slate-500">1 Page &bull; 0 KB</p>
                    </div>
                </div>

                <!-- Page Switcher -->
                <div class="flex items-center gap-2">
                    <div class="flex items-center gap-1 bg-slate-100 rounded-xl p-1 text-xs">
                        <button
                            type="button"
                            id="crop-prev-page-btn"
                            class="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                            <i data-lucide="chevron-left" class="w-4 h-4"></i>
                        </button>
                        <span class="px-2 font-bold text-slate-700 select-none">
                            Page <span id="crop-current-page-num">1</span> of <span id="crop-total-page-num">1</span>
                        </span>
                        <button
                            type="button"
                            id="crop-next-page-btn"
                            class="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                            <i data-lucide="chevron-right" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <button
                        type="button"
                        id="crop-change-file-btn"
                        class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                    >
                        Change File
                    </button>
                </div>
            </div>

            <!-- Main Layout: Controls (Left) & Visual Canvas Stage (Right) -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                <!-- Controls Column (5 cols) -->
                <div class="lg:col-span-5 space-y-5">
                    
                    <div class="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-5">
                        
                        <!-- Unit Selector & Dimension Comparison -->
                        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                            <span class="text-xs font-bold text-slate-700">Margin Units:</span>
                            <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                                <button type="button" class="unit-btn px-2.5 py-0.5 rounded-lg bg-white text-blue-600 shadow-2xs" data-unit="pt">pt</button>
                                <button type="button" class="unit-btn px-2.5 py-0.5 rounded-lg text-slate-600 hover:text-slate-900" data-unit="mm">mm</button>
                                <button type="button" class="unit-btn px-2.5 py-0.5 rounded-lg text-slate-600 hover:text-slate-900" data-unit="in">in</button>
                            </div>
                        </div>

                        <!-- Numeric Margin Inputs Grid -->
                        <div class="space-y-3">
                            <span class="block text-xs font-bold text-slate-900">Crop Margins:</span>
                            
                            <div class="grid grid-cols-2 gap-3 text-xs">
                                <!-- Top Margin -->
                                <div>
                                    <label for="margin-top" class="block text-slate-500 font-medium mb-1">Top:</label>
                                    <div class="relative">
                                        <input type="number" id="margin-top" min="0" step="1" value="0" class="w-full px-3 py-2 pr-8 rounded-xl border border-slate-200 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500">
                                        <span class="unit-label absolute right-3 top-2 text-slate-400 font-medium text-[11px]">pt</span>
                                    </div>
                                </div>

                                <!-- Bottom Margin -->
                                <div>
                                    <label for="margin-bottom" class="block text-slate-500 font-medium mb-1">Bottom:</label>
                                    <div class="relative">
                                        <input type="number" id="margin-bottom" min="0" step="1" value="0" class="w-full px-3 py-2 pr-8 rounded-xl border border-slate-200 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500">
                                        <span class="unit-label absolute right-3 top-2 text-slate-400 font-medium text-[11px]">pt</span>
                                    </div>
                                </div>

                                <!-- Left Margin -->
                                <div>
                                    <label for="margin-left" class="block text-slate-500 font-medium mb-1">Left:</label>
                                    <div class="relative">
                                        <input type="number" id="margin-left" min="0" step="1" value="0" class="w-full px-3 py-2 pr-8 rounded-xl border border-slate-200 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500">
                                        <span class="unit-label absolute right-3 top-2 text-slate-400 font-medium text-[11px]">pt</span>
                                    </div>
                                </div>

                                <!-- Right Margin -->
                                <div>
                                    <label for="margin-right" class="block text-slate-500 font-medium mb-1">Right:</label>
                                    <div class="relative">
                                        <input type="number" id="margin-right" min="0" step="1" value="0" class="w-full px-3 py-2 pr-8 rounded-xl border border-slate-200 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500">
                                        <span class="unit-label absolute right-3 top-2 text-slate-400 font-medium text-[11px]">pt</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Quick Presets -->
                        <div class="space-y-1.5 pt-2 border-t border-slate-100">
                            <span class="block text-xs font-semibold text-slate-600">Quick Presets:</span>
                            <div class="flex flex-wrap gap-1.5">
                                <button type="button" class="preset-btn px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-blue-500 hover:text-blue-600 text-xs font-medium transition-colors cursor-pointer" data-preset="reset">
                                    Reset (0)
                                </button>
                                <button type="button" class="preset-btn px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-blue-500 hover:text-blue-600 text-xs font-medium transition-colors cursor-pointer" data-preset="trim-half-inch">
                                    Trim 0.5 in
                                </button>
                                <button type="button" class="preset-btn px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-blue-500 hover:text-blue-600 text-xs font-medium transition-colors cursor-pointer" data-preset="trim-10mm">
                                    Trim 10 mm
                                </button>
                                <button type="button" class="preset-btn px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-blue-500 hover:text-blue-600 text-xs font-medium transition-colors cursor-pointer" data-preset="center-80">
                                    Center 80%
                                </button>
                            </div>
                        </div>

                        <!-- Size Readout Card -->
                        <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                            <div class="flex items-center justify-between text-slate-600">
                                <span>Original Size:</span>
                                <strong id="orig-size-label" class="text-slate-900 font-semibold">612 &times; 792 pt</strong>
                            </div>
                            <div class="flex items-center justify-between text-blue-700">
                                <span>Cropped Size:</span>
                                <strong id="cropped-size-label" class="text-blue-700 font-bold">612 &times; 792 pt</strong>
                            </div>
                        </div>

                        <!-- Page Scope -->
                        <div class="space-y-2 pt-2 border-t border-slate-100">
                            <label class="block text-xs font-semibold text-slate-700">Apply Crop To:</label>
                            <select id="crop-scope-select" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:ring-2 focus:ring-blue-500">
                                <option value="all" selected>All Pages</option>
                                <option value="current">Current Page Only</option>
                                <option value="odd">Odd Pages Only</option>
                                <option value="even">Even Pages Only</option>
                                <option value="custom">Custom Page Range</option>
                            </select>

                            <input
                                type="text"
                                id="crop-custom-range-input"
                                placeholder="e.g. 1-3, 5"
                                class="hidden w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                            >
                        </div>

                        <!-- Apply Button -->
                        <button
                            type="button"
                            id="apply-crop-btn"
                            class="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <i data-lucide="crop" class="w-4 h-4"></i>
                            <span>Crop PDF Document</span>
                        </button>
                    </div>

                </div>

                <!-- Visual Crop Canvas Stage (7 cols) -->
                <div class="lg:col-span-7 space-y-4">
                    <div class="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-3">
                        <div class="flex items-center justify-between">
                            <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <i data-lucide="eye" class="w-4 h-4 text-blue-600"></i>
                                <span>Visual Crop Box</span>
                            </h3>
                            <span class="text-[11px] text-slate-400">Drag handles or box interior</span>
                        </div>

                        <!-- Crop Stage with Overlay -->
                        <div id="crop-stage" class="bg-slate-100 rounded-2xl p-4 sm:p-8 min-h-[460px] flex items-center justify-center overflow-auto border border-slate-200/60 select-none">
                            <div id="crop-viewport-wrap" class="relative shadow-xl rounded-md bg-white overflow-hidden transition-all">
                                <!-- Base Canvas -->
                                <canvas id="crop-base-canvas" class="block pointer-events-none"></canvas>

                                <!-- Interactive Darkened Mask & Crop Overlay Container -->
                                <div id="crop-mask-overlay" class="absolute inset-0 pointer-events-auto cursor-crosshair">
                                    <!-- 4 Darkened Outside Mask Panels -->
                                    <div id="mask-top" class="absolute top-0 left-0 right-0 bg-slate-900/50 pointer-events-none"></div>
                                    <div id="mask-bottom" class="absolute bottom-0 left-0 right-0 bg-slate-900/50 pointer-events-none"></div>
                                    <div id="mask-left" class="absolute left-0 bg-slate-900/50 pointer-events-none"></div>
                                    <div id="mask-right" class="absolute right-0 bg-slate-900/50 pointer-events-none"></div>

                                    <!-- Active Draggable & Resizable Crop Box -->
                                    <div id="active-crop-box" class="absolute border-2 border-blue-500 cursor-move bg-transparent shadow-xs">
                                        <!-- Corner Handles -->
                                        <div class="crop-handle absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-blue-600 border border-white rounded-xs cursor-nwse-resize shadow-xs" data-handle="nw"></div>
                                        <div class="crop-handle absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-600 border border-white rounded-xs cursor-nesw-resize shadow-xs" data-handle="ne"></div>
                                        <div class="crop-handle absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-blue-600 border border-white rounded-xs cursor-nesw-resize shadow-xs" data-handle="sw"></div>
                                        <div class="crop-handle absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-600 border border-white rounded-xs cursor-nwse-resize shadow-xs" data-handle="se"></div>

                                        <!-- Edge Midpoint Handles -->
                                        <div class="crop-handle absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-3 bg-blue-600 border border-white rounded-xs cursor-ns-resize shadow-xs" data-handle="n"></div>
                                        <div class="crop-handle absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-3 bg-blue-600 border border-white rounded-xs cursor-ns-resize shadow-xs" data-handle="s"></div>
                                        <div class="crop-handle absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-4 bg-blue-600 border border-white rounded-xs cursor-ew-resize shadow-xs" data-handle="w"></div>
                                        <div class="crop-handle absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-4 bg-blue-600 border border-white rounded-xs cursor-ew-resize shadow-xs" data-handle="e"></div>

                                        <!-- Rule-of-Thirds Grid Lines -->
                                        <div class="absolute inset-0 pointer-events-none opacity-40">
                                            <div class="absolute left-1/3 top-0 bottom-0 border-r border-dashed border-white"></div>
                                            <div class="absolute left-2/3 top-0 bottom-0 border-r border-dashed border-white"></div>
                                            <div class="absolute top-1/3 left-0 right-0 border-b border-dashed border-white"></div>
                                            <div class="absolute top-2/3 left-0 right-0 border-b border-dashed border-white"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
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
                        <h3 class="text-xl font-bold text-emerald-950">PDF Cropped Successfully!</h3>
                        <p id="result-summary" class="text-xs sm:text-sm text-emerald-800 mt-1">Your trimmed PDF document is ready with full vector quality preserved.</p>
                    </div>

                    <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            id="download-cropped-pdf-btn"
                            class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>Download Cropped PDF</span>
                        </button>
                        <button
                            type="button"
                            id="crop-reset-btn"
                            class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-sm transition-colors cursor-pointer"
                        >
                            Crop Another PDF
                        </button>
                    </div>
                </div>
            </div>

        </div>

    </div>
</section>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'crop-pdf'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    '/assets/js/pdf-render.js?v=' . APP_VERSION,
    '/assets/js/tools/crop-pdf.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
