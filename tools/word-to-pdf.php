<?php
declare(strict_types=1);

/**
 * NoPayPDF - Word (DOCX) to PDF Converter
 * 100% In-Browser Execution via Mammoth.js, DOMPurify, html2canvas & jsPDF
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';

$tool = get_tool_by_slug('word-to-pdf');
if (!$tool) {
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'title' => 'Select or Drag Your Word File',
        'desc' => 'Upload your Microsoft Word document (.docx). Your file remains 100% local and is never uploaded to any remote server.',
    ],
    [
        'title' => 'Preview & Customize Page Layout',
        'desc' => 'Inspect the instant document preview, select your preferred page size (A4, Letter), orientation, and margin spacing.',
    ],
    [
        'title' => 'Generate & Download PDF',
        'desc' => 'Click "Convert to PDF" to generate your document instantly in your browser and download the resulting file.',
    ],
];

$faqs = [
    [
        'q' => 'Is my Word document uploaded to any server or cloud service?',
        'a' => 'No. NoPayPDF operates 100% locally in your web browser. Your confidential contracts, resumes, and personal documents never leave your computer.',
    ],
    [
        'q' => 'Which Word file formats are supported?',
        'a' => 'Modern Microsoft Word (.docx) and template (.dotx) files are natively supported. For legacy Word 97-2003 binary files (.doc), simply save as .docx in Word, Google Docs, or LibreOffice before converting.',
    ],
    [
        'q' => 'Are tables, images, and text formatting preserved?',
        'a' => 'Yes. Our converter parses paragraphs, headings, bulleted and numbered lists, bold and italic text styles, tables, and embedded images.',
    ],
    [
        'q' => 'Is there any file size or document page limit?',
        'a' => 'No artificial caps or paywalls exist. Processing speed and capacity depend on your device hardware because everything compiles directly in your browser.',
    ],
    [
        'q' => 'Can I use this Word to PDF converter on Mac, Windows, Linux, and mobile?',
        'a' => 'Yes. NoPayPDF works on all modern web browsers including Google Chrome, Mozilla Firefox, Microsoft Edge, and Apple Safari with zero plugins or installation required.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/word-to-pdf',
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
        <div id="docx-dropzone" class="dropzone-container border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl p-10 sm:p-14 text-center bg-white cursor-pointer shadow-xs transition-all flex flex-col items-center justify-center">
            <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <i data-lucide="file-text" class="w-8 h-8"></i>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold text-slate-900">Choose Word Document to Convert</h2>
            <p class="text-xs sm:text-sm text-slate-500 mt-2 max-w-md">
                Drag and drop a <strong>.docx</strong> file here, or click to browse. 100% private in-browser conversion.
            </p>
            <button type="button" class="mt-6 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-sm transition-colors pointer-events-none flex items-center gap-2">
                <i data-lucide="upload" class="w-4 h-4"></i>
                <span>Select Word File</span>
            </button>
            <input type="file" id="docx-file-input" class="hidden" accept=".docx,.dotx,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
            
            <p class="mt-4 text-[11px] text-slate-400">
                Supports Microsoft Word (.docx, .dotx). Legacy .doc binary files can be opened and saved as .docx first.
            </p>
        </div>
    </div>

    <!-- Active Workspace View -->
    <div id="workspace-view" class="hidden space-y-6">
        <!-- Active File Info Banner -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="file-text" class="w-5 h-5"></i>
                </div>
                <div class="min-w-0">
                    <h3 id="doc-filename" class="text-sm font-bold text-slate-900 truncate">document.docx</h3>
                    <p id="doc-meta" class="text-xs text-slate-500">Ready for conversion</p>
                </div>
            </div>
            <button type="button" id="change-doc-btn" class="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors self-end sm:self-auto">
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                <span>Change File</span>
            </button>
        </div>

        <!-- Layout Controls -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
                <i data-lucide="sliders" class="w-4 h-4 text-blue-600"></i>
                <span>Page Layout & Options</span>
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <label for="page-size" class="block text-xs font-semibold text-slate-700 mb-1.5">Page Size</label>
                    <select id="page-size" class="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="a4" selected>A4 (210 &times; 297 mm)</option>
                        <option value="letter">US Letter (8.5 &times; 11 in)</option>
                        <option value="legal">Legal (8.5 &times; 14 in)</option>
                    </select>
                </div>

                <div>
                    <label for="page-orientation" class="block text-xs font-semibold text-slate-700 mb-1.5">Orientation</label>
                    <select id="page-orientation" class="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="portrait" selected>Portrait</option>
                        <option value="landscape">Landscape</option>
                    </select>
                </div>

                <div>
                    <label for="page-margins" class="block text-xs font-semibold text-slate-700 mb-1.5">Margins</label>
                    <select id="page-margins" class="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="compact">Compact (10 mm)</option>
                        <option value="normal" selected>Normal (20 mm)</option>
                        <option value="wide">Wide (30 mm)</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Document Preview Canvas -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <i data-lucide="eye" class="w-4 h-4 text-blue-600"></i>
                    <span>Document Preview</span>
                </h3>
                <span class="text-[11px] text-slate-400">Rendered client-side</span>
            </div>

            <div class="bg-slate-100 p-4 sm:p-8 rounded-xl overflow-x-auto max-h-[600px] flex justify-center">
                <div id="docx-paper-preview" class="bg-white shadow-md p-8 sm:p-12 text-slate-800 text-xs sm:text-sm leading-relaxed max-w-[750px] w-full min-h-[400px] overflow-hidden">
                    <div id="docx-rendered-content"></div>
                </div>
            </div>
        </div>

        <!-- Action Bar -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="w-full sm:w-auto flex-1 max-w-sm">
                <label for="output-filename" class="block text-xs font-semibold text-slate-700 mb-1">Output Filename</label>
                <div class="relative">
                    <input
                        type="text"
                        id="output-filename"
                        value="document.pdf"
                        class="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12 font-mono"
                    >
                    <span class="absolute right-3 top-2 text-xs text-slate-400">.pdf</span>
                </div>
            </div>

            <div class="w-full sm:w-auto flex items-center gap-3 self-end sm:self-auto">
                <button
                    type="button"
                    id="convert-btn"
                    class="w-full sm:w-auto px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                    <i data-lucide="file-down" class="w-4 h-4"></i>
                    <span>Convert to PDF Now</span>
                </button>
            </div>
        </div>

        <!-- Progress Bar -->
        <div id="convert-progress-container"></div>
    </div>

    <!-- In-Tool Ad Slot with Safe Margin -->
    <?php render_ad_slot('in-tool'); ?>

    <!-- Result Download Card -->
    <div id="result-view" class="hidden bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
        <div class="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <i data-lucide="check-circle" class="w-8 h-8"></i>
        </div>
        <div>
            <h3 class="text-xl font-bold text-emerald-950">PDF Successfully Generated!</h3>
            <p id="result-summary" class="text-xs sm:text-sm text-emerald-800 mt-1"></p>
        </div>
        <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
                type="button"
                id="download-doc-btn"
                class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
                <i data-lucide="download" class="w-4 h-4"></i>
                <span>Download PDF Document</span>
            </button>
            <button
                type="button"
                id="convert-reset-btn"
                class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-sm transition-colors cursor-pointer"
            >
                Start New Conversion
            </button>
        </div>
    </div>
</section>

<!-- Off-screen isolated iframe for html2canvas (shields html2canvas from Tailwind v4 oklch colors) -->
<iframe id="isolated-docx-render-iframe" title="Isolated Word Render Sandbox" style="position: fixed; left: -9999px; top: -9999px; width: 800px; height: 1000px; border: 0; visibility: hidden;"></iframe>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'word-to-pdf'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    '/assets/vendor/mammoth/mammoth.browser.min.js?v=' . APP_VERSION,
    'https://unpkg.com/dompurify@3.2.4/dist/purify.min.js',
    'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
    'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js',
    '/assets/js/tools/word-to-pdf.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
