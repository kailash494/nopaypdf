<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';
require_once __DIR__ . '/../includes/seo.php';
require_once __DIR__ . '/../includes/ad-slots.php';

$registry = get_tool_registry();
$tool = $registry['edit-pdf'] ?? null;
if (!$tool) {
    http_response_code(404);
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'step' => 1,
        'title' => 'Open PDF File',
        'desc' => 'Drag and drop your PDF into the editor or select it from your device. The document loads instantly in memory with zero uploads.',
    ],
    [
        'step' => 2,
        'title' => 'Directly Edit Text & Add Elements',
        'desc' => 'Click existing text lines to edit wording, change fonts, or mask content. Insert AcroForm fields, interactive links, signatures, images, or whiteout rectangles.',
    ],
    [
        'step' => 3,
        'title' => 'Export & Download',
        'desc' => 'Choose optional form flattening or irreversible redaction flattening, then download your vector-perfect edited PDF document.',
    ],
];

$faqs = [
    [
        'q' => 'Can I directly edit existing text in my PDF without uploading it?',
        'a' => 'Yes. PDFToolKit is 100% client-side. The editor extracts existing text coordinates and lines directly in your browser. Clicking on any line allows you to modify text, update numbers, fix typos, or change styling with zero server uploads.',
    ],
    [
        'q' => 'What fonts does the editor use for replacing text?',
        'a' => 'PDFToolKit uses official metric-compatible SIL Open Font License 1.1 Liberation Fonts (Liberation Sans, Liberation Serif, and Liberation Mono). They are metric equivalents to standard document typefaces, ensuring matching character widths and line layout.',
    ],
    [
        'q' => 'Are created AcroForm fields compatible with Adobe Acrobat and web browsers?',
        'a' => 'Yes. All text fields, textareas, checkboxes, radio buttons, and dropdowns created in the editor are standard ISO 32000 compliant native PDF AcroForm dictionaries that work in all standard PDF viewers.',
    ],
    [
        'q' => 'How does the "Flatten Edited Pages" irreversible redaction work?',
        'a' => 'When enabled, only pages containing modified text or whiteout covers are re-rasterized at ultra-high resolution (2.5x high-DPI) into clean imagery, irreversibly purging the underlying text bytes and vector streams so confidential data cannot be recovered by forensic copy-paste.',
    ],
    [
        'q' => 'Does the editor preserve the vector quality of untouched pages?',
        'a' => 'Yes. Our hybrid vector-preserving pipeline copies unmodified pages and vectors directly from your original document, preserving 100% of the original vector curves, embedded imagery, and selectable text.',
    ],
    [
        'q' => 'Can I add clickable links and jump to specific pages?',
        'a' => 'Yes. The Links tool lets you draw clickable hotspot rectangles and configure either external web links (HTTPS URLs) or internal page jumps directly into the PDF annotation tree.',
    ],
];

render_seo_head($tool, $faqs);
require_once __DIR__ . '/../includes/header.php';
?>

<!-- Pinned Permissive Client Libraries -->
<script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
<script src="https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js"></script>

<!-- Editor Custom Stylesheet -->
<link rel="stylesheet" href="/assets/css/edit-pdf.css?v=<?= APP_VERSION ?>">

<!-- Initial Hero & Upload Section -->
<div id="tool-hero-section">
    <?php render_tool_hero($tool); ?>

    <section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="space-y-6">
            <!-- Error Notification Banner -->
            <div id="error-alert" class="hidden bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3">
                <i data-lucide="alert-circle" class="w-5 h-5 text-rose-600 shrink-0 mt-0.5"></i>
                <div class="flex-1 text-xs sm:text-sm" id="error-message"></div>
                <button type="button" id="error-dismiss-btn" class="text-rose-400 hover:text-rose-700">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Scanned Document Guidance Banner -->
            <div id="scanned-banner" class="hidden bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div class="flex items-start gap-3">
                    <i data-lucide="info" class="w-5 h-5 text-amber-600 shrink-0 mt-0.5"></i>
                    <div>
                        <h4 class="text-xs sm:text-sm font-bold text-amber-900">Scanned Document Detected</h4>
                        <p class="text-xs text-amber-700 mt-0.5">This PDF appears to be a scanned image without selectable text. You can still add annotations, whiteout, and signatures, or run our OCR tool first to make text editable.</p>
                    </div>
                </div>
                <a href="/ocr-pdf" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0">
                    Open OCR PDF
                </a>
            </div>

            <!-- Dropzone Container -->
            <div
                id="editor-dropzone"
                class="relative border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white rounded-3xl p-8 sm:p-14 text-center transition-all cursor-pointer shadow-xs hover:shadow-md group"
            >
                <input type="file" id="editor-file-input" class="hidden" accept=".pdf,application/pdf">

                <div class="flex flex-col items-center justify-center space-y-4">
                    <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                        <i data-lucide="file-pen" class="w-8 h-8"></i>
                    </div>
                    <div>
                        <p class="text-base sm:text-lg font-bold text-slate-900">
                            Drop your PDF here, or <span class="text-blue-600 underline">browse device</span>
                        </p>
                        <p class="text-xs sm:text-sm text-slate-500 mt-1">
                            Direct in-browser editing \u2022 Zero uploads \u2022 Full privacy
                        </p>
                    </div>
                    <div class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors">
                        <i data-lucide="upload" class="w-4 h-4"></i>
                        <span>Select PDF Document</span>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>

<!-- Full Desktop Workspace Section (Visible once PDF is loaded) -->
<section id="editor-workspace-section" class="hidden w-full flex-1 flex flex-col bg-slate-100 border-t border-slate-200 select-none">
    
    <!-- Top Action Bar -->
    <div class="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-4 z-20">
        <div class="flex items-center gap-3 min-w-0">
            <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <i data-lucide="file-pen" class="w-4 h-4"></i>
            </div>
            <div class="min-w-0">
                <h3 id="editor-doc-title" class="text-xs sm:text-sm font-bold text-slate-900 truncate">document.pdf</h3>
                <p id="editor-doc-meta" class="text-[10px] text-slate-500">100% Client-Side In-Memory</p>
            </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
            <button
                type="button"
                id="btn-reset-editor"
                class="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
                Change File
            </button>
            <button
                type="button"
                id="btn-apply-changes"
                class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
                <i data-lucide="download" class="w-4 h-4"></i>
                <span>Apply Changes</span>
            </button>
        </div>
    </div>

    <!-- Primary Sticky Toolbar -->
    <div class="sticky top-16 z-30 bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between overflow-x-auto shadow-xs gap-3">
        <div class="flex items-center gap-1.5 flex-nowrap shrink-0">
            <!-- Tool Buttons -->
            <button type="button" class="editor-tool-btn editor-toolbar-btn active" data-tool="text-edit" title="Edit Existing Text Lines">
                <i data-lucide="type" class="w-3.5 h-3.5"></i>
                <span>Edit Text</span>
            </button>
            <button type="button" class="editor-tool-btn editor-toolbar-btn" data-tool="add-text" title="Add New Text Box">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                <span>Add Text</span>
            </button>
            <button type="button" class="editor-tool-btn editor-toolbar-btn" data-tool="links" title="Add Clickable Links">
                <i data-lucide="link" class="w-3.5 h-3.5"></i>
                <span>Links</span>
            </button>
            <button type="button" class="editor-tool-btn editor-toolbar-btn" data-tool="forms" title="Add AcroForm Fields">
                <i data-lucide="form-input" class="w-3.5 h-3.5"></i>
                <span>Forms</span>
            </button>
            <button type="button" class="editor-tool-btn editor-toolbar-btn" data-tool="images" title="Insert Image Stamp">
                <i data-lucide="image" class="w-3.5 h-3.5"></i>
                <span>Images</span>
            </button>
            <button type="button" class="editor-tool-btn editor-toolbar-btn" data-tool="sign" title="Add Digital Signature">
                <i data-lucide="pen-tool" class="w-3.5 h-3.5"></i>
                <span>Sign</span>
            </button>
            <button type="button" class="editor-tool-btn editor-toolbar-btn" data-tool="whiteout" title="Cover/Mask Sensitive Content">
                <i data-lucide="square" class="w-3.5 h-3.5"></i>
                <span>Whiteout</span>
            </button>
            <button type="button" class="editor-tool-btn editor-toolbar-btn" data-tool="shapes" title="Draw Geometric Shapes">
                <i data-lucide="shapes" class="w-3.5 h-3.5"></i>
                <span>Shapes</span>
            </button>
            <button type="button" class="editor-tool-btn editor-toolbar-btn" data-tool="draw" title="Freehand Drawing">
                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                <span>Draw</span>
            </button>
        </div>

        <div class="flex items-center gap-2 shrink-0">
            <!-- Search & Replace -->
            <button
                type="button"
                id="btn-open-find"
                class="editor-toolbar-btn"
                title="Find & Replace Text (Ctrl+F)"
                onclick="document.getElementById('find-replace-drawer').classList.toggle('hidden'); document.getElementById('find-query-input').focus();"
            >
                <i data-lucide="search" class="w-3.5 h-3.5"></i>
                <span class="hidden sm:inline">Find & Replace</span>
            </button>

            <!-- Undo / Redo -->
            <button type="button" id="btn-undo" class="editor-toolbar-btn" title="Undo (Ctrl+Z)">
                <i data-lucide="undo-2" class="w-3.5 h-3.5"></i>
            </button>
            <button type="button" id="btn-redo" class="editor-toolbar-btn" title="Redo (Ctrl+Y)">
                <i data-lucide="redo-2" class="w-3.5 h-3.5"></i>
            </button>

            <!-- Zoom -->
            <select id="zoom-select" class="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer">
                <option value="0.75">75%</option>
                <option value="1.0" selected>100%</option>
                <option value="1.25">125%</option>
                <option value="1.5">150%</option>
            </select>
        </div>
    </div>

    <!-- Contextual Sub-Toolbar (Active when editing text blocks) -->
    <div id="context-sub-toolbar" class="hidden sub-toolbar px-4 py-2 flex items-center justify-between gap-3 text-xs overflow-x-auto">
        <div class="flex items-center gap-2 flex-wrap">
            <span class="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Typography:</span>
            <!-- Font Family -->
            <select id="sub-font-select" class="px-2 py-1 rounded-md border border-slate-200 bg-slate-50 font-medium">
                <option value="original">Original (Embedded)</option>
                <option value="sans">Liberation Sans (Arial)</option>
                <option value="serif">Liberation Serif (Times)</option>
                <option value="mono">Liberation Mono (Courier)</option>
                <option value="carlito">Carlito (Calibri)</option>
                <option value="caladea">Caladea (Cambria)</option>
                <option value="inter">Inter (Segoe UI / SF Pro)</option>
                <option value="roboto">Roboto</option>
                <option value="open-sans">Open Sans</option>
                <option value="montserrat">Montserrat</option>
            </select>
            <span id="sub-font-tier-pill" class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 hidden"></span>

            <!-- Font Size -->
            <input type="number" id="sub-font-size" value="12" min="6" max="96" class="w-14 px-2 py-1 rounded-md border border-slate-200 bg-slate-50 font-medium text-center">

            <!-- Bold / Italic -->
            <button type="button" id="sub-bold-btn" class="px-2.5 py-1 rounded-md border border-slate-200 font-extrabold hover:bg-slate-100">B</button>
            <button type="button" id="sub-italic-btn" class="px-2.5 py-1 rounded-md border border-slate-200 italic font-serif hover:bg-slate-100">I</button>

            <!-- Colors -->
            <div class="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                <label class="text-[10px] text-slate-500 font-semibold">Text:</label>
                <input type="color" id="sub-text-color" value="#1e293b" class="w-6 h-6 rounded cursor-pointer border-0 p-0">
            </div>

            <div class="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                <label class="text-[10px] text-slate-500 font-semibold">Mask Fill:</label>
                <input type="color" id="sub-bg-color" value="#ffffff" class="w-6 h-6 rounded cursor-pointer border-0 p-0">
            </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
            <button type="button" id="sub-reset-btn" class="px-2.5 py-1 rounded-md text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-semibold">
                Reset Text
            </button>
            <button type="button" id="sub-delete-btn" class="px-2.5 py-1 rounded-md text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 font-semibold">
                Delete Line
            </button>
        </div>
    </div>

    <!-- Find & Replace Floating Drawer -->
    <div id="find-replace-drawer" class="hidden bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-4 text-xs shadow-md">
        <div class="flex items-center gap-3 flex-1 max-w-2xl">
            <div class="flex items-center gap-1.5 flex-1">
                <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400"></i>
                <input type="text" id="find-query-input" placeholder="Find text..." class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
            </div>
            <div class="flex items-center gap-1.5 flex-1">
                <i data-lucide="replace" class="w-3.5 h-3.5 text-slate-400"></i>
                <input type="text" id="replace-query-input" placeholder="Replace with..." class="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
            </div>
            <span id="find-count-label" class="text-slate-500 font-medium whitespace-nowrap">0 found</span>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" id="btn-find-next" class="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold">Next</button>
            <button type="button" id="btn-replace-one" class="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold">Replace</button>
            <button type="button" id="btn-replace-all" class="px-3 py-1 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">Replace All</button>
            <button type="button" id="btn-close-find" class="p-1 text-slate-400 hover:text-slate-600">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        </div>
    </div>

    <!-- Main Workspace Area: Thumbnail Rail + Stage Viewport -->
    <div class="flex-1 flex overflow-hidden relative">
        
        <!-- Left Thumbnail Rail -->
        <aside id="thumbnail-rail" class="w-48 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto p-3 space-y-3">
            <div class="flex items-center justify-between">
                <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pages</span>
                <button type="button" id="add-blank-page-btn" class="p-1 rounded text-blue-600 hover:bg-blue-50" title="Insert Blank Page">
                    <i data-lucide="plus-circle" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Thumbnail List -->
            <div id="thumbnail-rail-list" class="space-y-3"></div>

            <div class="pt-4 border-t border-slate-200">
                <button type="button" id="delete-page-btn" class="w-full py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-semibold flex items-center justify-center gap-1.5 border border-rose-200">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    <span>Delete Page</span>
                </button>
            </div>
        </aside>

        <!-- Toggle Rail Button -->
        <button
            type="button"
            id="toggle-rail-btn"
            class="absolute top-3 left-3 z-20 p-2 rounded-xl bg-white border border-slate-200 shadow-md text-slate-600 hover:text-blue-600 hover:bg-slate-50"
            title="Toggle Thumbnails"
        >
            <i data-lucide="panel-left" class="w-4 h-4"></i>
        </button>

        <!-- Center Viewport Container -->
        <div class="editor-viewport-container flex-1 overflow-auto p-8 flex items-start justify-center">
            <!-- 3-Layer Synchronized Stage Stack -->
            <div id="stage-stack" class="stage-stack">
                <!-- Layer 1: PDF.js Base Canvas -->
                <canvas id="stage-base-canvas" class="stage-layer-base"></canvas>
                
                <!-- Layer 2: Interactive DOM Overlay -->
                <div id="stage-dom-layer" class="stage-layer-dom"></div>
                
                <!-- Layer 3: Fabric.js Interactive Vector Overlay -->
                <div class="stage-layer-fabric-wrap">
                    <canvas id="stage-fabric-canvas"></canvas>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Modals & Hidden Elements -->
<input type="file" id="hidden-image-input" class="hidden" accept="image/png,image/jpeg,image/webp">

<!-- Signatures Studio Modal -->
<div id="signature-modal" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 class="text-base font-bold text-slate-900">Signatures Studio</h3>
            <button type="button" id="btn-close-sig-modal" class="text-slate-400 hover:text-slate-600">
                <i data-lucide="x" class="w-5 h-5"></i>
            </button>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-slate-200">
            <button type="button" id="sig-tab-draw-btn" class="px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-bold text-xs">Draw</button>
            <button type="button" id="sig-tab-type-btn" class="px-4 py-2 border-b-2 border-transparent text-slate-500 font-bold text-xs">Type</button>
        </div>

        <!-- Draw Pane -->
        <div id="sig-pane-draw" class="space-y-3">
            <canvas id="sig-draw-canvas" width="450" height="150" class="border border-slate-300 rounded-xl bg-slate-50/50 w-full cursor-crosshair"></canvas>
            <div class="flex justify-end">
                <button type="button" id="btn-clear-sig-draw" class="text-xs text-slate-500 hover:text-slate-800 font-semibold">Clear</button>
            </div>
        </div>

        <!-- Type Pane -->
        <div id="sig-pane-type" class="hidden space-y-3">
            <input type="text" id="sig-type-input" value="Jane Doe" placeholder="Type name..." class="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm">
            <div class="p-4 border border-slate-200 rounded-xl text-center text-3xl text-slate-800 font-serif italic" style="font-family: 'Brush Script MT', cursive;">
                Jane Doe
            </div>
        </div>

        <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" onclick="document.getElementById('signature-modal').classList.add('hidden')" class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="button" id="btn-apply-signature" class="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700">Stamp Signature</button>
        </div>
    </div>
</div>

<!-- Export Modal -->
<div id="export-modal" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 class="text-lg font-bold text-slate-900">Export Edited PDF</h3>
            <button type="button" id="btn-close-export-modal" class="text-slate-400 hover:text-slate-600">
                <i data-lucide="x" class="w-5 h-5"></i>
            </button>
        </div>

        <div class="space-y-4">
            <!-- Output Filename -->
            <div>
                <label for="export-filename-input" class="block text-xs font-semibold text-slate-700 mb-1">Output Filename</label>
                <input type="text" id="export-filename-input" value="document-edited.pdf" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500">
            </div>

            <!-- Export Options -->
            <div class="space-y-3 pt-2">
                <label class="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" id="opt-flatten-forms" class="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                    <div>
                        <span class="text-xs font-bold text-slate-800">Flatten Form Fields</span>
                        <p class="text-[11px] text-slate-500">Locks editable inputs and converts them into read-only vector text.</p>
                    </div>
                </label>

                <label class="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" id="opt-flatten-redact" class="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                    <div>
                        <span class="text-xs font-bold text-slate-800">Flatten Edited Pages for Irreversible Redaction</span>
                        <p class="text-[11px] text-slate-500">Rasterizes pages with whiteout covers or edited text so underlying data cannot be extracted.</p>
                    </div>
                </label>
            </div>

            <!-- Progress Bar -->
            <div id="export-progress-wrap" class="hidden space-y-2 pt-2">
                <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div id="export-progress-bar" class="h-full w-0 bg-blue-600 transition-all duration-200"></div>
                </div>
                <p id="export-progress-text" class="text-xs text-center text-slate-500 font-medium">Assembling vector pages...</p>
            </div>

            <!-- Result Wrap -->
            <div id="export-result-wrap" class="hidden space-y-4 pt-4 border-t border-slate-100 text-center">
                <div class="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <i data-lucide="check" class="w-6 h-6"></i>
                </div>
                <div>
                    <h4 class="text-base font-bold text-slate-900">Your Edited PDF is Ready!</h4>
                    <p class="text-xs text-slate-500 mt-0.5">Processed 100% inside your browser.</p>
                </div>
                <button
                    type="button"
                    id="btn-download-exported"
                    class="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
                >
                    <i data-lucide="download" class="w-4 h-4"></i>
                    <span>Download Edited PDF</span>
                </button>

                <!-- In-Tool Ad Slot with Generous Margin -->
                <div class="my-6">
                    <?php render_ad_slot('in-tool'); ?>
                </div>
            </div>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onclick="document.getElementById('export-modal').classList.add('hidden')" class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="button" id="btn-confirm-export" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all">Export Document</button>
        </div>
    </div>
</div>

<!-- SEO & FAQ Sections -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'edit-pdf'); ?>

<!-- Scripts -->
<script src="/assets/js/pdf-core.js?v=<?= APP_VERSION ?>"></script>
<script src="/assets/js/pdf-render.js?v=<?= APP_VERSION ?>"></script>
<script src="/assets/js/tools/edit-pdf/font-manager.js?v=<?= APP_VERSION ?>"></script>
<script src="/assets/js/tools/edit-pdf/text-extractor.js?v=<?= APP_VERSION ?>"></script>
<script src="/assets/js/tools/edit-pdf/editor-state.js?v=<?= APP_VERSION ?>"></script>
<script src="/assets/js/tools/edit-pdf/canvas-stage.js?v=<?= APP_VERSION ?>"></script>
<script src="/assets/js/tools/edit-pdf/pdf-exporter.js?v=<?= APP_VERSION ?>"></script>
<script src="/assets/js/tools/edit-pdf/main.js?v=<?= APP_VERSION ?>"></script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
