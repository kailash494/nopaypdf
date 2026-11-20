<?php
declare(strict_types=1);

/**
 * NoPayPDF - Merge PDF Tool
 * 100% Client-Side PDF Concatenation
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';

$tool = get_tool_by_slug('merge-pdf');
if (!$tool) {
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'title' => 'Select Your PDF Documents',
        'desc' => 'Drag and drop two or more PDF files into the upload box or browse from your device.',
    ],
    [
        'title' => 'Reorder Your Pages & Files',
        'desc' => 'Drag items to reorder them or use the Move Up / Move Down buttons to set the exact sequence.',
    ],
    [
        'title' => 'Merge & Instant Download',
        'desc' => 'Click "Merge PDFs" to combine the files locally in your browser and instantly download your unified document.',
    ],
];

$faqs = [
    [
        'q' => 'Are my merged PDF files uploaded to a remote server?',
        'a' => 'No. NoPayPDF merges documents 100% locally on your computer or phone using client-side JavaScript. Your confidential files never touch our servers.',
    ],
    [
        'q' => 'How many PDF documents can I merge at once?',
        'a' => 'You can merge dozens of PDF files simultaneously. Because processing runs in your browser, limits depend solely on your computer’s available memory.',
    ],
    [
        'q' => 'Can I change the order of the files before merging?',
        'a' => 'Yes. You can drag and drop file cards or click the up/down arrows to position your files in any order you prefer.',
    ],
    [
        'q' => 'Does merging reduce the visual quality of my PDFs?',
        'a' => 'No. NoPayPDF preserves original vectors, fonts, images, and formatting exactly as they exist in the source files without compression artifacts.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/merge-pdf',
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

    <!-- Initial Dropzone View -->
    <div id="dropzone-view" class="w-full">
        <div id="merge-dropzone" class="dropzone-container border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl p-10 sm:p-14 text-center bg-white cursor-pointer shadow-xs transition-all flex flex-col items-center justify-center">
            <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <i data-lucide="files" class="w-8 h-8"></i>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold text-slate-900">Choose PDF Files to Merge</h2>
            <p class="text-xs sm:text-sm text-slate-500 mt-2 max-w-md">
                Drag and drop your PDF documents here, or click to browse from your device. Select two or more files.
            </p>
            <button type="button" class="mt-6 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm transition-colors pointer-events-none">
                Select PDF Files
            </button>
            <input type="file" id="merge-file-input" class="hidden" multiple accept=".pdf,application/pdf">
        </div>
    </div>

    <!-- Active File Queue & Configuration Workspace -->
    <div id="workspace-view" class="hidden space-y-6">
        <!-- Queue Header Toolbar -->
        <div class="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="layers" class="w-5 h-5"></i>
                </div>
                <div>
                    <h2 class="text-base font-bold text-slate-900">PDF Queue (<span id="queue-count">0</span> files)</h2>
                    <p class="text-xs text-slate-500">Drag items to rearrange the merge order.</p>
                </div>
            </div>

            <!-- Toolbar Action Buttons -->
            <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                <button type="button" id="add-more-btn" class="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    <span>Add More PDFs</span>
                </button>
                <input type="file" id="add-more-input" class="hidden" multiple accept=".pdf,application/pdf">

                <button type="button" id="sort-az-btn" class="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors" title="Sort Alphabetically">
                    <i data-lucide="arrow-down-a-z" class="w-3.5 h-3.5"></i>
                    <span>Sort A-Z</span>
                </button>

                <button type="button" id="sort-reverse-btn" class="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors" title="Reverse Current Order">
                    <i data-lucide="arrow-up-down" class="w-3.5 h-3.5"></i>
                    <span>Reverse</span>
                </button>

                <button type="button" id="clear-all-btn" class="px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs font-medium transition-colors" title="Remove all files">
                    Clear All
                </button>
            </div>
        </div>

        <!-- Reorderable File List -->
        <div id="file-queue-list" class="space-y-2.5">
            <!-- Dynamic Queue Item Cards Injected by JS -->
        </div>

        <!-- Merge Settings & Primary Action -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div class="sm:col-span-2">
                    <label for="output-filename" class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Output File Name
                    </label>
                    <div class="relative flex items-center">
                        <input
                            type="text"
                            id="output-filename"
                            value="merged.pdf"
                            class="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                    </div>
                </div>

                <div class="sm:col-span-1 flex flex-col justify-end">
                    <button
                        type="button"
                        id="merge-action-btn"
                        class="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all"
                    >
                        <i data-lucide="merge" class="w-4 h-4"></i>
                        <span>Merge PDFs Now</span>
                    </button>
                </div>
            </div>

            <!-- Progress Bar Container -->
            <div id="merge-progress-container"></div>
        </div>

        <!-- In-Tool Ad Slot with Safe Margin -->
        <?php render_ad_slot('in-tool'); ?>

        <!-- Result State Card -->
        <div id="result-view" class="hidden bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
            <div class="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <i data-lucide="check-circle" class="w-8 h-8"></i>
            </div>
            <div>
                <h3 class="text-xl font-bold text-emerald-950">PDFs Successfully Merged!</h3>
                <p id="result-summary" class="text-xs sm:text-sm text-emerald-800 mt-1"></p>
            </div>
            <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                    type="button"
                    id="download-merged-btn"
                    class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                    <i data-lucide="download" class="w-4 h-4"></i>
                    <span>Download Merged PDF</span>
                </button>
                <button
                    type="button"
                    id="merge-reset-btn"
                    class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-sm transition-colors"
                >
                    Merge Another Batch
                </button>
            </div>
        </div>
    </div>
</section>

<!-- SEO Steps, FAQs & Internal Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'merge-pdf'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    '/assets/js/pdf-render.js?v=' . APP_VERSION,
    '/assets/js/tools/merge-pdf.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
