<?php
declare(strict_types=1);

/**
 * PDFToolKit - Split PDF Tool
 * 100% Client-Side PDF Extraction & Splitting
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';

$tool = get_tool_by_slug('split-pdf');
if (!$tool) {
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'title' => 'Upload Your PDF File',
        'desc' => 'Drag and drop your PDF document into the box or select it from your device.',
    ],
    [
        'title' => 'Choose How to Split',
        'desc' => 'Select individual pages visually, enter custom page ranges, or choose to split every page.',
    ],
    [
        'title' => 'Extract & Instant Download',
        'desc' => 'Download your extracted pages as a single combined PDF or as individual files in a neat ZIP archive.',
    ],
];

$faqs = [
    [
        'q' => 'Is my document uploaded to your servers to be split?',
        'a' => 'No. All splitting, page rendering, and ZIP packaging happen locally in your browser memory. Your files never leave your device.',
    ],
    [
        'q' => 'What split modes are available?',
        'a' => 'You can select individual pages on visual thumbnails, define custom comma-separated page ranges (e.g. 1-3, 5, 8-10), or automatically split every single page into separate files.',
    ],
    [
        'q' => 'How will I receive the split files?',
        'a' => 'You can choose between receiving a single merged PDF of your selected pages, or downloading a ZIP archive containing each page or range as a separate PDF.',
    ],
    [
        'q' => 'Can I split password-protected PDFs?',
        'a' => 'PDFToolKit requires encrypted PDFs to be unlocked first before splitting pages. No sensitive passwords or documents are ever transmitted across the web.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/split-pdf',
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
        <div id="split-dropzone" class="dropzone-container border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl p-10 sm:p-14 text-center bg-white cursor-pointer shadow-xs transition-all flex flex-col items-center justify-center">
            <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <i data-lucide="scissors" class="w-8 h-8"></i>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold text-slate-900">Choose a PDF File to Split</h2>
            <p class="text-xs sm:text-sm text-slate-500 mt-2 max-w-md">
                Drag and drop your PDF document here, or click to browse from your device.
            </p>
            <button type="button" class="mt-6 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm transition-colors pointer-events-none">
                Select PDF File
            </button>
            <input type="file" id="split-file-input" class="hidden" accept=".pdf,application/pdf">
        </div>
    </div>

    <!-- Active Split Workspace -->
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

        <!-- Mode Selection Tabs -->
        <div class="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex flex-wrap gap-1">
            <button type="button" data-mode="visual" class="split-mode-tab flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 text-white transition-all flex items-center justify-center gap-2">
                <i data-lucide="layout-grid" class="w-4 h-4"></i>
                <span>Visual Selection</span>
            </button>
            <button type="button" data-mode="ranges" class="split-mode-tab flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-transparent text-slate-600 hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
                <i data-lucide="hash" class="w-4 h-4"></i>
                <span>Custom Ranges</span>
            </button>
            <button type="button" data-mode="all" class="split-mode-tab flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-transparent text-slate-600 hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
                <i data-lucide="copy" class="w-4 h-4"></i>
                <span>Split Every Page</span>
            </button>
        </div>

        <!-- Sub-panel: Visual Selection Mode -->
        <div id="mode-panel-visual" class="mode-panel space-y-4">
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-semibold text-slate-700 mr-1">Select:</span>
                    <button type="button" id="vis-select-all" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-medium text-slate-700">All</button>
                    <button type="button" id="vis-select-odd" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-medium text-slate-700">Odd Pages</button>
                    <button type="button" id="vis-select-even" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-medium text-slate-700">Even Pages</button>
                    <button type="button" id="vis-select-invert" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-medium text-slate-700">Invert</button>
                    <button type="button" id="vis-select-clear" class="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800">Clear</button>
                </div>
                <div class="text-slate-500">
                    <span id="vis-selected-count" class="font-bold text-blue-600">0</span> pages selected (Shift+Click to select ranges)
                </div>
            </div>

            <!-- Visual Thumbnails Grid -->
            <div id="visual-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 max-h-[500px] overflow-y-auto p-2">
                <!-- Page cards injected by JS -->
            </div>

            <!-- Output Format Toggle for Visual Mode -->
            <div class="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <span class="font-bold text-slate-800">Output Delivery:</span>
                <div class="flex items-center gap-4">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="visual-output-format" value="merged" checked class="text-blue-600 focus:ring-blue-500">
                        <span class="text-slate-700 font-medium">Merge selected into 1 PDF</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="visual-output-format" value="zip" class="text-blue-600 focus:ring-blue-500">
                        <span class="text-slate-700 font-medium">Extract as separate PDFs (ZIP)</span>
                    </label>
                </div>
            </div>
        </div>

        <!-- Sub-panel: Custom Ranges Mode -->
        <div id="mode-panel-ranges" class="mode-panel hidden bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
                <label for="range-input" class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Enter Page Ranges (e.g. 1-3, 5, 8-10)
                </label>
                <input
                    type="text"
                    id="range-input"
                    placeholder="1-2, 3-4"
                    class="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                <p id="range-preview-feedback" class="text-xs text-slate-500 mt-1.5"></p>
            </div>

            <!-- Output Format Toggle for Range Mode -->
            <div class="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <span class="font-bold text-slate-800">Output Delivery:</span>
                <div class="flex items-center gap-4">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="range-output-format" value="zip" checked class="text-blue-600 focus:ring-blue-500">
                        <span class="text-slate-700 font-medium">Separate PDF per range (ZIP)</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="range-output-format" value="merged" class="text-blue-600 focus:ring-blue-500">
                        <span class="text-slate-700 font-medium">Combine all ranges into 1 PDF</span>
                    </label>
                </div>
            </div>
        </div>

        <!-- Sub-panel: Split Every Page Mode -->
        <div id="mode-panel-all" class="mode-panel hidden bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i data-lucide="layers" class="w-5 h-5"></i>
                </div>
                <div>
                    <h4 class="text-sm font-bold text-slate-900">Extract All Pages into Separate Files</h4>
                    <p class="text-xs text-slate-600 mt-1 leading-relaxed">
                        Every single page of your PDF document will be converted into its own individual 1-page PDF file and bundled into a fast ZIP download.
                    </p>
                </div>
            </div>
        </div>

        <!-- Split Action Trigger & Progress -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <button
                type="button"
                id="split-action-btn"
                class="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all"
            >
                <i data-lucide="scissors" class="w-4 h-4"></i>
                <span>Split PDF Now</span>
            </button>

            <!-- Progress Bar -->
            <div id="split-progress-container"></div>
        </div>

        <!-- In-Tool Ad Slot with Safe Margin -->
        <?php render_ad_slot('in-tool'); ?>

        <!-- Result Download Card -->
        <div id="result-view" class="hidden bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
            <div class="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <i data-lucide="check-circle" class="w-8 h-8"></i>
            </div>
            <div>
                <h3 class="text-xl font-bold text-emerald-950">PDF Successfully Split!</h3>
                <p id="result-summary" class="text-xs sm:text-sm text-emerald-800 mt-1"></p>
            </div>
            <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                    type="button"
                    id="download-split-btn"
                    class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                    <i data-lucide="download" class="w-4 h-4"></i>
                    <span id="download-btn-label">Download Result</span>
                </button>
                <button
                    type="button"
                    id="split-reset-btn"
                    class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-sm transition-colors"
                >
                    Split Another PDF
                </button>
            </div>
        </div>
    </div>
</section>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'split-pdf'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
    '/assets/js/pdf-render.js?v=' . APP_VERSION,
    '/assets/js/tools/split-pdf.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
