<?php
declare(strict_types=1);

/**
 * NoPayPDF - Organize PDF Pages Tool
 * Reorder, Rotate, Duplicate & Delete Pages Visually
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';

$tool = get_tool_by_slug('organize-pdf');
if (!$tool) {
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'title' => 'Add Your PDF Files',
        'desc' => 'Upload one or multiple PDF documents. All pages appear immediately as visual interactive cards.',
    ],
    [
        'title' => 'Reorder, Rotate & Remove',
        'desc' => 'Drag pages into your desired order, rotate orientations by 90 degrees, duplicate pages, or delete unwanted pages.',
    ],
    [
        'title' => 'Save & Instant Download',
        'desc' => 'Click "Save Organized PDF" to compile your updated document structure in your browser and download instantly.',
    ],
];

$faqs = [
    [
        'q' => 'Can I combine and organize pages from multiple different PDFs?',
        'a' => 'Yes. You can upload multiple PDF documents simultaneously or click "Add Another PDF" to mix, match, and reorder pages from various files into one document.',
    ],
    [
        'q' => 'Are my rotated and reorganized pages uploaded anywhere?',
        'a' => 'No. NoPayPDF operates entirely within your web browser. Your private pages and text never leave your machine.',
    ],
    [
        'q' => 'What happens if I accidentally delete a page?',
        'a' => 'NoPayPDF includes an "Undo Last Action" feature so you can easily step back and restore deleted pages or previous orientations.',
    ],
    [
        'q' => 'Will rotating a page affect its resolution or text quality?',
        'a' => 'No. PDF rotation adjusts the document’s native display coordinates in the PDF header. Vector artwork, text formatting, and images remain completely crisp and unaltered.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/organize-pdf',
    'tool' => $tool,
    'faqs' => $faqs,
];

require_once __DIR__ . '/../includes/header.php';
?>

<!-- Tool Hero Header -->
<?php render_tool_hero($tool); ?>

<!-- Interactive Tool Workspace -->
<section class="py-10 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
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
        <div id="organize-dropzone" class="dropzone-container border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl p-10 sm:p-14 text-center bg-white cursor-pointer shadow-xs transition-all flex flex-col items-center justify-center">
            <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <i data-lucide="layout-grid" class="w-8 h-8"></i>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold text-slate-900">Choose PDF Files to Organize</h2>
            <p class="text-xs sm:text-sm text-slate-500 mt-2 max-w-md">
                Drag and drop one or more PDF files here. Rearrange, rotate, duplicate, or delete pages visually.
            </p>
            <button type="button" class="mt-6 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm transition-colors pointer-events-none">
                Select PDF Files
            </button>
            <input type="file" id="organize-file-input" class="hidden" multiple accept=".pdf,application/pdf">
        </div>
    </div>

    <!-- Active Workspace View -->
    <div id="workspace-view" class="hidden space-y-6">
        <!-- Top Control Bar -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="layout-grid" class="w-5 h-5"></i>
                </div>
                <div>
                    <h2 class="text-base font-bold text-slate-900">
                        Page Organizer (<span id="total-pages-badge">0</span> pages)
                    </h2>
                    <p class="text-xs text-slate-500">Drag cards or use buttons below to organize pages.</p>
                </div>
            </div>

            <!-- Bulk Page Operations Toolbar -->
            <div class="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
                <button type="button" id="add-more-pdf-btn" class="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    <span>Add Another PDF</span>
                </button>
                <input type="file" id="add-more-pdf-input" class="hidden" multiple accept=".pdf,application/pdf">

                <button type="button" id="rotate-all-left-btn" class="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors" title="Rotate all pages counter-clockwise (-90°)">
                    <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                    <span>Rotate All -90°</span>
                </button>

                <button type="button" id="rotate-all-right-btn" class="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors" title="Rotate all pages clockwise (+90°)">
                    <i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i>
                    <span>Rotate All +90°</span>
                </button>

                <button type="button" id="reverse-all-btn" class="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors" title="Reverse the entire sequence of pages">
                    <i data-lucide="arrow-up-down" class="w-3.5 h-3.5"></i>
                    <span>Reverse</span>
                </button>

                <button type="button" id="undo-btn" class="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-40 disabled:pointer-events-none" title="Undo last action">
                    <i data-lucide="undo-2" class="w-3.5 h-3.5"></i>
                    <span>Undo</span>
                </button>

                <button type="button" id="reset-original-btn" class="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs font-medium transition-colors" title="Reset all changes back to original upload state">
                    Reset
                </button>
            </div>
        </div>

        <!-- Interactive Pages Grid -->
        <div id="pages-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 p-2 bg-slate-100/60 rounded-2xl border border-slate-200 min-h-[220px]">
            <!-- Injected dynamically by JS -->
        </div>

        <!-- Export Configuration & Save Trigger -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div class="sm:col-span-2">
                    <label for="organize-output-name" class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Export File Name
                    </label>
                    <input
                        type="text"
                        id="organize-output-name"
                        value="organized.pdf"
                        class="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                </div>

                <div class="sm:col-span-1 flex flex-col justify-end">
                    <button
                        type="button"
                        id="save-pdf-btn"
                        class="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                        <i data-lucide="save" class="w-4 h-4"></i>
                        <span>Save Organized PDF</span>
                    </button>
                </div>
            </div>

            <!-- Progress Bar -->
            <div id="organize-progress-container"></div>
        </div>

        <!-- In-Tool Ad Slot with Safe Margin -->
        <?php render_ad_slot('in-tool'); ?>

        <!-- Result Download Card -->
        <div id="result-view" class="hidden bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
            <div class="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <i data-lucide="check-circle" class="w-8 h-8"></i>
            </div>
            <div>
                <h3 class="text-xl font-bold text-emerald-950">PDF Successfully Organized!</h3>
                <p id="result-summary" class="text-xs sm:text-sm text-emerald-800 mt-1"></p>
            </div>
            <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                    type="button"
                    id="download-organized-btn"
                    class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                    <i data-lucide="download" class="w-4 h-4"></i>
                    <span>Download Organized PDF</span>
                </button>
                <button
                    type="button"
                    id="organize-reset-btn"
                    class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-sm transition-colors"
                >
                    Organize Another PDF
                </button>
            </div>
        </div>
    </div>
</section>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'organize-pdf'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    '/assets/js/pdf-render.js?v=' . APP_VERSION,
    '/assets/js/tools/organize-pdf.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
