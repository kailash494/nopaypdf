<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';
require_once __DIR__ . '/../includes/seo.php';
require_once __DIR__ . '/../includes/ad-slots.php';

$registry = get_tool_registry();
$tool = $registry['sign-annotate-pdf'] ?? null;
if (!$tool) {
    http_response_code(404);
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'step' => 1,
        'title' => 'Open PDF Document',
        'desc' => 'Select or drag-and-drop the PDF contract, invoice, or form you want to fill and sign.',
    ],
    [
        'step' => 2,
        'title' => 'Annotate, Type & Sign',
        'desc' => 'Add text notes, draw signatures, place checkmarks, or highlight sections across any page.',
    ],
    [
        'step' => 3,
        'title' => 'Download Signed Document',
        'desc' => 'Export a pristine, high-resolution signed PDF locally in your browser with zero server uploads.',
    ],
];

$faqs = [
    [
        'q' => 'Is my signature legally binding?',
        'a' => 'In most jurisdictions, electronic signatures created on documents (such as under the US ESIGN Act or EU eIDAS regulations) are recognized for business agreements. For high-security notarized filings, verify your specific legal guidelines.',
    ],
    [
        'q' => 'Are my signature or sensitive documents uploaded anywhere?',
        'a' => 'No. All drawing, text stamping, and PDF compilation take place 100% inside your web browser memory. Your files and signatures never touch any external server.',
    ],
    [
        'q' => 'Can I sign multiple pages in the same PDF?',
        'a' => 'Yes. Use the page navigation bar or thumbnail strip to switch between pages. All annotations and signatures are saved in memory and merged into the final downloaded document.',
    ],
    [
        'q' => 'Can I save my signature for quick re-use on other pages?',
        'a' => 'Yes. Once you draw, type, or upload a signature in the Signature Studio, it appears in your "My Signatures" tray so you can stamp it onto any page with a single click.',
    ],
    [
        'q' => 'Does signing or annotating reduce the quality of the original PDF?',
        'a' => 'No. Your original document vectors and selectable text are preserved intact. Annotations are embedded as a high-DPI transparent vector layer directly over the original pages.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/sign-annotate-pdf/',
    'tool' => $tool,
    'faqs' => $faqs,
];

require_once __DIR__ . '/../includes/header.php';
?>

<!-- Tool Hero Header -->
<?php render_tool_hero($tool); ?>

<!-- Main Tool Workspace -->
<section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="space-y-6">

        <!-- Error Notification Banner -->
        <div id="error-alert" class="hidden bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3">
            <i data-lucide="alert-circle" class="w-5 h-5 text-rose-600 shrink-0 mt-0.5"></i>
            <div class="flex-1 text-xs sm:text-sm" id="error-message"></div>
            <button type="button" id="error-dismiss-btn" class="text-rose-400 hover:text-rose-700">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        </div>

        <!-- Cross-Link Banner to Full PDF Editor -->
        <div class="bg-blue-50/70 border border-blue-200 text-blue-900 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
                <i data-lucide="sparkles" class="w-4 h-4 text-blue-600 shrink-0"></i>
                <p class="text-xs sm:text-sm text-blue-800">
                    <span class="font-bold">Need to directly edit existing text, add links, or create form fields?</span> Try our full in-browser PDF Editor.
                </p>
            </div>
            <a href="/edit-pdf" class="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0 shadow-xs transition-colors">
                Open Full Editor
            </a>
        </div>

        <!-- 1. Upload Dropzone -->
        <div id="upload-panel" class="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xs">
            <div
                id="pdf-dropzone"
                class="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 group"
            >
                <input type="file" id="pdf-file-input" class="hidden" accept=".pdf,application/pdf">
                
                <div class="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                    <i data-lucide="pen-tool" class="w-8 h-8"></i>
                </div>
                
                <h2 class="text-lg sm:text-xl font-bold text-slate-900 mb-1">
                    Choose a PDF file to Sign or Annotate
                </h2>
                <p class="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-5">
                    Drag and drop your PDF here, or click to browse. Instant in-browser editing with zero uploads.
                </p>

                <div class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors">
                    <i data-lucide="upload" class="w-4 h-4"></i>
                    <span>Select PDF Document</span>
                </div>
            </div>
        </div>

        <!-- 2. Dual Canvas Editor Stage -->
        <div id="editor-panel" class="hidden space-y-4">
            
            <!-- File Info & Global Actions Bar -->
            <div class="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <i data-lucide="file-text" class="w-5 h-5"></i>
                    </div>
                    <div class="min-w-0">
                        <h3 id="doc-filename" class="text-sm font-bold text-slate-900 truncate max-w-[220px] sm:max-w-md">document.pdf</h3>
                        <p id="doc-meta" class="text-xs text-slate-500">Page 1 of 1 &bull; 0 KB</p>
                    </div>
                </div>

                <div class="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        id="open-signature-modal-btn"
                        class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                        <i data-lucide="pen" class="w-4 h-4"></i>
                        <span>Signature Studio</span>
                    </button>

                    <button
                        type="button"
                        id="export-pdf-btn"
                        class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                        <i data-lucide="download" class="w-4 h-4"></i>
                        <span>Apply & Export PDF</span>
                    </button>

                    <button
                        type="button"
                        id="reset-editor-btn"
                        class="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 text-xs transition-colors cursor-pointer"
                        title="Upload another PDF"
                    >
                        <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>

            <!-- "My Signatures" Shelf (Visible when signatures exist) -->
            <div id="signatures-shelf" class="hidden bg-slate-50 rounded-2xl border border-slate-200/80 p-3.5 flex items-center gap-3 overflow-x-auto">
                <span class="text-xs font-semibold text-slate-500 shrink-0 flex items-center gap-1.5">
                    <i data-lucide="bookmark" class="w-3.5 h-3.5"></i>
                    <span>Stamp Signature:</span>
                </span>
                <div id="signatures-shelf-list" class="flex items-center gap-2"></div>
            </div>

            <!-- Main Interactive Toolbar -->
            <div class="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-xs space-y-3">
                
                <!-- Primary Tool Buttons & Navigation -->
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    
                    <!-- Tool Selection Group -->
                    <div class="flex items-center gap-1 flex-wrap" role="toolbar" aria-label="Annotation tools">
                        <button
                            type="button"
                            data-tool="select"
                            class="tool-btn px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors bg-blue-100 text-blue-700"
                            title="Select & Move Objects"
                        >
                            <i data-lucide="mouse-pointer" class="w-3.5 h-3.5"></i>
                            <span>Select</span>
                        </button>

                        <button
                            type="button"
                            data-tool="text"
                            class="tool-btn px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors text-slate-600 hover:bg-slate-100"
                            title="Add Text Field"
                        >
                            <i data-lucide="type" class="w-3.5 h-3.5"></i>
                            <span>Text</span>
                        </button>

                        <button
                            type="button"
                            data-tool="draw"
                            class="tool-btn px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors text-slate-600 hover:bg-slate-100"
                            title="Freehand Ink Drawing"
                        >
                            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                            <span>Draw</span>
                        </button>

                        <button
                            type="button"
                            data-tool="highlight"
                            class="tool-btn px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors text-slate-600 hover:bg-slate-100"
                            title="Highlight Text or Areas"
                        >
                            <i data-lucide="highlighter" class="w-3.5 h-3.5"></i>
                            <span>Highlight</span>
                        </button>

                        <button
                            type="button"
                            data-tool="whiteout"
                            class="tool-btn px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors text-slate-600 hover:bg-slate-100"
                            title="Whiteout / Mask Confidential Text"
                        >
                            <i data-lucide="eraser" class="w-3.5 h-3.5"></i>
                            <span>Whiteout</span>
                        </button>

                        <div class="h-5 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                        <!-- Quick Form Stamps Dropdown / Buttons -->
                        <button
                            type="button"
                            id="stamp-check-btn"
                            class="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 text-xs transition-colors"
                            title="Stamp Checkmark (✓)"
                        >
                            <i data-lucide="check" class="w-4 h-4 text-emerald-600"></i>
                        </button>

                        <button
                            type="button"
                            id="stamp-cross-btn"
                            class="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 text-xs transition-colors"
                            title="Stamp Cross (✕)"
                        >
                            <i data-lucide="x" class="w-4 h-4 text-rose-600"></i>
                        </button>

                        <button
                            type="button"
                            id="stamp-date-btn"
                            class="px-2 py-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 text-xs font-medium flex items-center gap-1 transition-colors"
                            title="Stamp Today's Date"
                        >
                            <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                            <span class="hidden md:inline">Date</span>
                        </button>

                        <button
                            type="button"
                            id="stamp-rect-btn"
                            class="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 text-xs transition-colors"
                            title="Add Box Outline"
                        >
                            <i data-lucide="square" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <!-- Page Navigation & Zoom -->
                    <div class="flex items-center gap-2">
                        <!-- Page Switcher -->
                        <div class="flex items-center gap-1 bg-slate-100 rounded-xl p-1 text-xs">
                            <button
                                type="button"
                                id="prev-page-btn"
                                class="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
                                title="Previous Page"
                            >
                                <i data-lucide="chevron-left" class="w-4 h-4"></i>
                            </button>
                            <span class="px-2 font-bold text-slate-700 select-none">
                                <span id="current-page-num">1</span> / <span id="total-page-num">1</span>
                            </span>
                            <button
                                type="button"
                                id="next-page-btn"
                                class="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
                                title="Next Page"
                            >
                                <i data-lucide="chevron-right" class="w-4 h-4"></i>
                            </button>
                        </div>

                        <!-- Zoom Controls -->
                        <div class="hidden sm:flex items-center gap-1 bg-slate-100 rounded-xl p-1 text-xs">
                            <button
                                type="button"
                                id="zoom-out-btn"
                                class="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
                                title="Zoom Out"
                            >
                                <i data-lucide="zoom-out" class="w-4 h-4"></i>
                            </button>
                            <span id="zoom-level-text" class="px-1.5 font-bold text-slate-700 select-none min-w-[42px] text-center">100%</span>
                            <button
                                type="button"
                                id="zoom-in-btn"
                                class="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
                                title="Zoom In"
                            >
                                <i data-lucide="zoom-in" class="w-4 h-4"></i>
                            </button>
                            <button
                                type="button"
                                id="zoom-fit-btn"
                                class="px-2 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white font-medium transition-colors"
                                title="Fit to Width"
                            >
                                Fit
                            </button>
                        </div>

                        <!-- Toggle Thumbnails Button -->
                        <button
                            type="button"
                            id="toggle-thumbnails-btn"
                            class="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                            title="Toggle Page Thumbnails"
                        >
                            <i data-lucide="layout-grid" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>

                <!-- Secondary Sub-Toolbar: Contextual Formatting & History -->
                <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
                    
                    <!-- Color, Font, and Stroke Pickers -->
                    <div class="flex items-center gap-3 flex-wrap">
                        <!-- Color Palette -->
                        <div class="flex items-center gap-1.5">
                            <span class="text-slate-500 font-medium">Color:</span>
                            <div class="flex items-center gap-1">
                                <button type="button" class="color-preset-btn w-5 h-5 rounded-full bg-black ring-2 ring-blue-500 ring-offset-1" data-color="#000000" title="Black"></button>
                                <button type="button" class="color-preset-btn w-5 h-5 rounded-full bg-blue-600 hover:scale-110 transition-transform" data-color="#2563eb" title="Blue"></button>
                                <button type="button" class="color-preset-btn w-5 h-5 rounded-full bg-rose-600 hover:scale-110 transition-transform" data-color="#dc2626" title="Red"></button>
                                <button type="button" class="color-preset-btn w-5 h-5 rounded-full bg-emerald-600 hover:scale-110 transition-transform" data-color="#16a34a" title="Green"></button>
                                <label class="cursor-pointer" title="Custom Color">
                                    <input type="color" id="custom-color-picker" value="#000000" class="w-5 h-5 rounded-full border border-slate-300 p-0 overflow-hidden cursor-pointer">
                                </label>
                            </div>
                        </div>

                        <div class="h-4 w-px bg-slate-200 hidden sm:block"></div>

                        <!-- Font Size (For Text Tool) -->
                        <div id="font-size-group" class="flex items-center gap-1.5">
                            <span class="text-slate-500 font-medium">Size:</span>
                            <select id="text-font-size" class="px-2 py-1 rounded-lg border border-slate-200 bg-white font-medium text-slate-700">
                                <option value="12">12 pt</option>
                                <option value="14">14 pt</option>
                                <option value="16" selected>16 pt</option>
                                <option value="18">18 pt</option>
                                <option value="22">22 pt</option>
                                <option value="28">28 pt</option>
                                <option value="36">36 pt</option>
                            </select>
                        </div>

                        <!-- Font Family -->
                        <div id="font-family-group" class="flex items-center gap-1.5">
                            <select id="text-font-family" class="px-2 py-1 rounded-lg border border-slate-200 bg-white font-medium text-slate-700">
                                <option value="Arial, sans-serif" selected>Sans-Serif</option>
                                <option value="'Times New Roman', serif">Serif</option>
                                <option value="'Courier New', monospace">Monospace</option>
                                <option value="cursive">Cursive</option>
                            </select>
                        </div>

                        <!-- Line / Pen Stroke Width -->
                        <div id="stroke-width-group" class="hidden items-center gap-1.5">
                            <span class="text-slate-500 font-medium">Stroke:</span>
                            <input type="range" id="pen-stroke-width" min="1" max="12" value="2" class="w-20 accent-blue-600 cursor-pointer">
                            <span id="stroke-width-label" class="font-bold text-slate-700 min-w-[20px]">2px</span>
                        </div>
                    </div>

                    <!-- History & Selection Commands -->
                    <div class="flex items-center gap-1">
                        <button
                            type="button"
                            id="undo-btn"
                            class="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Undo (Ctrl+Z)"
                            disabled
                        >
                            <i data-lucide="undo" class="w-3.5 h-3.5"></i>
                        </button>
                        <button
                            type="button"
                            id="redo-btn"
                            class="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Redo (Ctrl+Y)"
                            disabled
                        >
                            <i data-lucide="redo" class="w-3.5 h-3.5"></i>
                        </button>
                        <div class="h-4 w-px bg-slate-200 mx-1"></div>
                        <button
                            type="button"
                            id="delete-selected-btn"
                            class="px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 font-medium flex items-center gap-1 transition-colors"
                            title="Delete Selected Item (Delete / Backspace)"
                        >
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            <span>Delete</span>
                        </button>
                        <button
                            type="button"
                            id="clear-page-btn"
                            class="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-medium transition-colors"
                            title="Clear Annotations on Current Page"
                        >
                            Clear Page
                        </button>
                    </div>

                </div>

            </div>

            <!-- Canvas Viewport Layout (With optional thumbnail strip) -->
            <div class="flex gap-4 items-start">
                
                <!-- Side Thumbnail Strip (Toggleable) -->
                <div id="thumbnail-drawer" class="hidden w-40 shrink-0 bg-white rounded-2xl border border-slate-200 p-3 shadow-xs max-h-[720px] overflow-y-auto space-y-2.5">
                    <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Pages</div>
                    <div id="thumbnail-strip-items" class="space-y-2.5"></div>
                </div>

                <!-- Main Dual Canvas Display Area -->
                <div class="flex-1 bg-slate-100 rounded-3xl border border-slate-200/90 p-4 sm:p-8 min-h-[550px] flex items-center justify-center overflow-auto">
                    <div id="canvas-container-outer" class="relative shadow-2xl rounded-lg bg-white overflow-hidden transition-all">
                        <!-- Bottom Locked PDF.js Canvas -->
                        <canvas id="pdf-base-canvas" class="absolute top-0 left-0 pointer-events-none block"></canvas>
                        <!-- Top Interactive Fabric.js Canvas -->
                        <canvas id="fabric-overlay-canvas" class="relative block"></canvas>
                    </div>
                </div>

            </div>

            <!-- Processing Progress Bar -->
            <div id="export-progress-panel" class="hidden bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-3">
                <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto animate-spin">
                    <i data-lucide="loader-2" class="w-5 h-5"></i>
                </div>
                <div>
                    <h4 class="text-sm font-bold text-slate-900" id="export-status-title">Exporting Document...</h4>
                    <p class="text-xs text-slate-500 mt-0.5" id="export-status-desc">Merging transparent annotation overlays at 2.5x high-DPI quality...</p>
                </div>
                <div class="w-full max-w-md mx-auto bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div id="export-progress-bar" class="bg-blue-600 h-2.5 rounded-full transition-all duration-200" style="width: 15%"></div>
                </div>
            </div>

            <!-- In-Tool Ad Slot -->
            <?php render_ad_slot('in-tool'); ?>

            <!-- Success / Download Card -->
            <div id="result-panel" class="hidden bg-white rounded-3xl border border-emerald-200/80 p-6 sm:p-10 shadow-xs">
                <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
                    <div class="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                        <i data-lucide="check-circle" class="w-8 h-8"></i>
                    </div>

                    <div>
                        <h3 class="text-xl font-bold text-emerald-950">PDF Signed & Annotated Successfully!</h3>
                        <p id="result-summary" class="text-xs sm:text-sm text-emerald-800 mt-1">Your high-resolution signed document is ready for download.</p>
                    </div>

                    <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            id="download-signed-pdf-btn"
                            class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>Download Signed PDF</span>
                        </button>
                        <button
                            type="button"
                            id="continue-editing-btn"
                            class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-sm transition-colors cursor-pointer"
                        >
                            Continue Editing
                        </button>
                    </div>
                </div>
            </div>

        </div>

    </div>
</section>

<!-- Signature Studio Modal -->
<div id="signature-modal" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <i data-lucide="pen" class="w-4 h-4"></i>
                </div>
                <h3 class="text-base font-bold text-slate-900">Signature Studio</h3>
            </div>
            <button type="button" id="close-signature-modal-btn" class="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                <i data-lucide="x" class="w-5 h-5"></i>
            </button>
        </div>

        <!-- Signature Mode Tabs -->
        <div class="border-b border-slate-100 bg-slate-50/70 px-6 pt-3 flex gap-2">
            <button
                type="button"
                id="sig-tab-draw-btn"
                class="px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
            >
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                <span>Draw Signature</span>
            </button>
            <button
                type="button"
                id="sig-tab-type-btn"
                class="px-4 py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
            >
                <i data-lucide="type" class="w-3.5 h-3.5"></i>
                <span>Type Signature</span>
            </button>
            <button
                type="button"
                id="sig-tab-upload-btn"
                class="px-4 py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
            >
                <i data-lucide="upload" class="w-3.5 h-3.5"></i>
                <span>Upload Image</span>
            </button>
        </div>

        <!-- Modal Body Content -->
        <div class="p-6 space-y-4">

            <!-- Tab 1: Draw Signature -->
            <div id="sig-pane-draw" class="space-y-3">
                <div class="relative bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden h-48 flex items-center justify-center">
                    <canvas id="signature-draw-canvas" width="500" height="192" class="w-full h-full cursor-crosshair touch-none"></canvas>
                    <span id="sig-draw-hint" class="absolute pointer-events-none text-xs text-slate-400 select-none">Draw your signature with mouse or touch</span>
                </div>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-slate-500 font-medium">Ink:</span>
                        <button type="button" class="sig-ink-btn w-6 h-6 rounded-full bg-black ring-2 ring-blue-500 ring-offset-1" data-ink="#000000"></button>
                        <button type="button" class="sig-ink-btn w-6 h-6 rounded-full bg-blue-700" data-ink="#1d4ed8"></button>
                        <button type="button" class="sig-ink-btn w-6 h-6 rounded-full bg-rose-700" data-ink="#be123c"></button>
                    </div>
                    <button type="button" id="sig-clear-draw-btn" class="text-xs text-slate-500 hover:text-rose-600 font-medium flex items-center gap-1">
                        <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                        <span>Clear</span>
                    </button>
                </div>
            </div>

            <!-- Tab 2: Type Signature -->
            <div id="sig-pane-type" class="hidden space-y-4">
                <div>
                    <label for="sig-type-input" class="block text-xs font-semibold text-slate-700 mb-1">Your Full Name:</label>
                    <input
                        type="text"
                        id="sig-type-input"
                        placeholder="e.g. Jane Doe"
                        class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                </div>

                <div class="space-y-2">
                    <span class="text-xs font-semibold text-slate-600 block">Select Handwriting Style:</span>
                    <div class="grid grid-cols-2 gap-2" id="sig-font-presets">
                        <button
                            type="button"
                            class="sig-font-choice p-3 rounded-xl border-2 border-blue-600 bg-blue-50/50 text-center font-bold text-lg select-none"
                            style="font-family: 'Brush Script MT', 'Dancing Script', cursive;"
                            data-font="'Brush Script MT', cursive"
                        >
                            <span class="sig-font-preview">Jane Doe</span>
                        </button>
                        <button
                            type="button"
                            class="sig-font-choice p-3 rounded-xl border border-slate-200 hover:border-slate-300 text-center font-bold text-lg select-none"
                            style="font-family: 'Great Vibes', 'Segoe Script', cursive;"
                            data-font="'Segoe Script', cursive"
                        >
                            <span class="sig-font-preview">Jane Doe</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Tab 3: Upload Image Signature -->
            <div id="sig-pane-upload" class="hidden space-y-3">
                <div
                    id="sig-upload-box"
                    class="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center cursor-pointer hover:bg-slate-50 transition-colors"
                >
                    <input type="file" id="sig-file-input" class="hidden" accept="image/png,image/jpeg">
                    <i data-lucide="image" class="w-8 h-8 text-slate-400 mx-auto mb-2"></i>
                    <p class="text-xs font-semibold text-slate-700">Click to upload signature image</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">Transparent PNG or clear JPG recommended</p>
                </div>
                <div id="sig-upload-preview-wrap" class="hidden relative h-32 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center p-2">
                    <img id="sig-upload-preview-img" alt="Signature preview" class="max-h-full max-w-full object-contain">
                    <button type="button" id="sig-upload-remove-btn" class="absolute top-2 right-2 p-1 bg-white rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 shadow-xs">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>

        </div>

        <!-- Modal Footer Actions -->
        <div class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
            <button
                type="button"
                id="cancel-sig-modal-btn"
                class="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-xs font-semibold transition-colors cursor-pointer"
            >
                Cancel
            </button>
            <button
                type="button"
                id="apply-signature-btn"
                class="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
                <i data-lucide="check" class="w-4 h-4"></i>
                <span>Use Signature</span>
            </button>
        </div>

    </div>
</div>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'sign-annotate-pdf'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js',
    '/assets/js/pdf-render.js?v=' . APP_VERSION,
    '/assets/js/tools/sign-annotate-pdf.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
