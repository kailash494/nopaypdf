<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';
require_once __DIR__ . '/../includes/seo.php';
require_once __DIR__ . '/../includes/ad-slots.php';

$registry = get_tool_registry();
$tool = $registry['page-numbers'] ?? null;
if (!$tool) {
    http_response_code(404);
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'step' => 1,
        'title' => 'Select PDF Document',
        'desc' => 'Upload the document you want to number, paginate, or customize with headers and footers.',
    ],
    [
        'step' => 2,
        'title' => 'Choose Format & Position',
        'desc' => 'Select from preset numbering styles like "Page 1 of 10", choose top or bottom placement, and skip cover pages.',
    ],
    [
        'step' => 3,
        'title' => 'Download Numbered PDF',
        'desc' => 'Inspect the live preview on Page 1 and download your professionally formatted PDF document.',
    ],
];

$faqs = [
    [
        'q' => 'Can I skip numbering on the first page or cover sheet?',
        'a' => 'Yes. Simply check the "Skip First Page (Cover Page)" option. The numbering will begin cleanly on Page 2 with your chosen starting number.',
    ],
    [
        'q' => 'Can I add custom headers or footers along with page numbers?',
        'a' => 'Yes. Expand the "Custom Headers & Footers" panel to add document titles, department names, dates, or file names across the left, center, and right margins of your pages.',
    ],
    [
        'q' => 'What numbering formats are supported?',
        'a' => 'You can choose between simple numbers ("1"), "Page 1", "Page 1 of 10", "1 / 10", or write your own custom template with dynamic placeholders like {n} and {total}.',
    ],
    [
        'q' => 'Will adding page numbers affect my existing text or layout?',
        'a' => 'No. Page numbers and header/footer text are stamped in the top and bottom margins of each page, preserving all existing text, images, forms, and formatting intact.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/page-numbers',
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
            id="page-numbers-dropzone"
            class="relative border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer shadow-xs hover:shadow-md group"
        >
            <input type="file" id="page-numbers-file-input" class="hidden" accept=".pdf,application/pdf">

            <div class="flex flex-col items-center justify-center space-y-4">
                <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                    <i data-lucide="hash" class="w-8 h-8"></i>
                </div>
                <div>
                    <h2 class="text-base sm:text-lg font-bold text-slate-900">
                        Choose a PDF to Add Page Numbers
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
        <div id="page-numbers-workspace" class="hidden space-y-6">

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

                    <!-- Page Numbering Configuration Card -->
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <div class="flex items-center justify-between">
                            <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Page Numbers</h3>
                            <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                                <input type="checkbox" id="enable-page-numbers" checked class="w-4 h-4 rounded text-blue-600 accent-blue-600">
                                <span>Enable Numbering</span>
                            </label>
                        </div>

                        <div id="page-numbers-options" class="space-y-4">
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <!-- Position -->
                                <div>
                                    <label for="pn-position" class="block text-xs font-semibold text-slate-700 mb-1.5">Position</label>
                                    <select id="pn-position" class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                                        <option value="bottom-center" selected>Bottom Center</option>
                                        <option value="bottom-right">Bottom Right</option>
                                        <option value="bottom-left">Bottom Left</option>
                                        <option value="top-center">Top Center</option>
                                        <option value="top-right">Top Right</option>
                                        <option value="top-left">Top Left</option>
                                    </select>
                                </div>

                                <!-- Numbering Format -->
                                <div>
                                    <label for="pn-format" class="block text-xs font-semibold text-slate-700 mb-1.5">Numbering Format</label>
                                    <select id="pn-format" class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                                        <option value="page-n-of-total" selected>Page {n} of {total}</option>
                                        <option value="page-n">Page {n}</option>
                                        <option value="n-of-total">{n} / {total}</option>
                                        <option value="n-only">{n} (Number Only)</option>
                                        <option value="custom">Custom Template...</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Custom Template Input (Conditional) -->
                            <div id="custom-template-container" class="hidden">
                                <label for="pn-custom-template" class="block text-xs font-semibold text-slate-700 mb-1">
                                    Custom Template (use {n} and {total})
                                </label>
                                <input
                                    type="text"
                                    id="pn-custom-template"
                                    value="Doc #{n} of {total}"
                                    class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                                >
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-1">
                                <!-- Starting Number -->
                                <div>
                                    <label for="pn-start-number" class="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Starting Number
                                    </label>
                                    <input
                                        type="number"
                                        id="pn-start-number"
                                        value="1"
                                        min="1"
                                        max="9999"
                                        class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium"
                                    >
                                </div>

                                <!-- Skip Cover Page Toggle -->
                                <div class="pt-4 sm:pt-3">
                                    <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                                        <input type="checkbox" id="pn-skip-first-page" class="w-4 h-4 rounded text-blue-600 accent-blue-600">
                                        <span>Skip First Page (Cover Page)</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Collapsible Header & Footer Custom Slots -->
                    <details class="group border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                        <summary class="px-6 py-4 bg-slate-50/80 text-xs font-bold text-slate-800 cursor-pointer flex items-center justify-between select-none hover:bg-slate-100/70 transition-colors">
                            <span class="flex items-center gap-2">
                                <i data-lucide="layout-template" class="w-3.5 h-3.5 text-blue-600"></i>
                                <span>Custom Headers & Footers (Optional)</span>
                            </span>
                            <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform"></i>
                        </summary>

                        <div class="p-6 space-y-5 border-t border-slate-200">
                            <!-- Placeholder Chips Helper -->
                            <div class="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-900 space-y-1">
                                <span class="font-bold">Available Placeholders:</span>
                                <div class="flex flex-wrap gap-1.5 pt-1">
                                    <code class="bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-700">{n}</code> <span class="text-slate-500">Page</span>
                                    <code class="bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-700">{total}</code> <span class="text-slate-500">Total</span>
                                    <code class="bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-700">{date}</code> <span class="text-slate-500">Date</span>
                                    <code class="bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-700">{filename}</code> <span class="text-slate-500">File</span>
                                </div>
                            </div>

                            <!-- Header Slots -->
                            <div class="space-y-2">
                                <span class="text-xs font-bold text-slate-800 uppercase tracking-wider block">Top Header Slots</span>
                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label for="hdr-left" class="block text-[11px] font-semibold text-slate-600 mb-1">Header Left</label>
                                        <input type="text" id="hdr-left" placeholder="e.g. Confidential" class="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white">
                                    </div>
                                    <div>
                                        <label for="hdr-center" class="block text-[11px] font-semibold text-slate-600 mb-1">Header Center</label>
                                        <input type="text" id="hdr-center" placeholder="e.g. {filename}" class="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white">
                                    </div>
                                    <div>
                                        <label for="hdr-right" class="block text-[11px] font-semibold text-slate-600 mb-1">Header Right</label>
                                        <input type="text" id="hdr-right" placeholder="e.g. {date}" class="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white">
                                    </div>
                                </div>
                            </div>

                            <!-- Footer Slots -->
                            <div class="space-y-2 pt-2 border-t border-slate-100">
                                <span class="text-xs font-bold text-slate-800 uppercase tracking-wider block">Bottom Footer Slots</span>
                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label for="ftr-left" class="block text-[11px] font-semibold text-slate-600 mb-1">Footer Left</label>
                                        <input type="text" id="ftr-left" placeholder="e.g. Internal Use" class="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white">
                                    </div>
                                    <div>
                                        <label for="ftr-center" class="block text-[11px] font-semibold text-slate-600 mb-1">Footer Center</label>
                                        <input type="text" id="ftr-center" placeholder="" class="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white">
                                    </div>
                                    <div>
                                        <label for="ftr-right" class="block text-[11px] font-semibold text-slate-600 mb-1">Footer Right</label>
                                        <input type="text" id="ftr-right" placeholder="" class="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </details>

                    <!-- Typography & Margins Card -->
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Typography & Margins</h3>

                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <!-- Font Family -->
                            <div>
                                <label for="pn-font-family" class="block text-xs font-semibold text-slate-700 mb-1">Font</label>
                                <select id="pn-font-family" class="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                                    <option value="Helvetica" selected>Helvetica</option>
                                    <option value="TimesRoman">Times Roman</option>
                                    <option value="Courier">Courier</option>
                                </select>
                            </div>

                            <!-- Font Size -->
                            <div>
                                <label for="pn-font-size" class="block text-xs font-semibold text-slate-700 mb-1">Font Size</label>
                                <select id="pn-font-size" class="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                                    <option value="9">9 pt (Small)</option>
                                    <option value="11" selected>11 pt (Standard)</option>
                                    <option value="14">14 pt (Large)</option>
                                </select>
                            </div>

                            <!-- Margin -->
                            <div>
                                <label for="pn-margin" class="block text-xs font-semibold text-slate-700 mb-1">Edge Margin</label>
                                <select id="pn-margin" class="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                                    <option value="20">20 pt (Tight)</option>
                                    <option value="30" selected>30 pt (Standard)</option>
                                    <option value="45">45 pt (Spacious)</option>
                                </select>
                            </div>

                            <!-- Color -->
                            <div>
                                <label for="pn-color" class="block text-xs font-semibold text-slate-700 mb-1">Text Color</label>
                                <div class="flex items-center gap-1.5">
                                    <input type="color" id="pn-color" value="#334155" class="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-white">
                                    <input type="text" id="pn-color-hex" value="#334155" class="w-16 px-1.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono">
                                </div>
                            </div>
                        </div>

                        <!-- Target Page Selection -->
                        <div class="pt-2 border-t border-slate-100 space-y-2">
                            <span class="block text-xs font-semibold text-slate-700">Apply Numbering To:</span>
                            <div class="flex items-center gap-4">
                                <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                                    <input type="radio" name="pn-page-target" value="all" checked class="accent-blue-600">
                                    <span>All Pages</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                                    <input type="radio" name="pn-page-target" value="custom" class="accent-blue-600">
                                    <span>Custom Range</span>
                                </label>
                            </div>
                            <div id="pn-custom-range-container" class="hidden max-w-xs">
                                <input
                                    type="text"
                                    id="pn-page-ranges-input"
                                    placeholder="e.g. 2-10, 15"
                                    class="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                                >
                            </div>
                        </div>
                    </div>

                    <!-- Action & Progress Bar -->
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <button
                            type="button"
                            id="page-numbers-submit-btn"
                            class="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            <i data-lucide="hash" class="w-4 h-4"></i>
                            <span>Stamp Page Numbers into PDF</span>
                        </button>

                        <div id="page-numbers-progress-container"></div>
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
                                <canvas id="preview-overlay-canvas" class="absolute inset-0 pointer-events-none w-full h-full"></canvas>
                            </div>
                        </div>

                        <p class="text-[11px] text-slate-400 text-center">
                            Headers, footers, and page numbers update in real-time.
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
                        <h3 class="text-xl font-bold text-emerald-950">Document Numbered Successfully!</h3>
                        <p id="result-summary" class="text-xs sm:text-sm text-emerald-800 mt-1"></p>
                    </div>

                    <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            id="download-numbered-btn"
                            class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>Download Numbered PDF</span>
                        </button>
                        <button
                            type="button"
                            id="page-numbers-reset-btn"
                            class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-sm transition-colors cursor-pointer"
                        >
                            Number Another PDF
                        </button>
                    </div>
                </div>
            </div>

        </div>

    </div>
</section>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'page-numbers'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    '/assets/js/pdf-render.js?v=' . APP_VERSION,
    '/assets/js/tools/page-numbers.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
