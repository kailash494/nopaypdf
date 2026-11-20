<?php
declare(strict_types=1);

/**
 * NoPayPDF - HTML & Plain Text to PDF Converter
 * 100% Client-Side Vector Text & Rich Document Generation
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';

$tool = get_tool_by_slug('html-to-pdf');
if (!$tool) {
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'title' => 'Input Text or HTML Code',
        'desc' => 'Paste raw text or HTML code into the editor, or upload a local .txt or .html file.',
    ],
    [
        'title' => 'Customize Typography & Layout',
        'desc' => 'Choose your page size (A4, Letter), orientation, font styling, margins, and preview the live layout.',
    ],
    [
        'title' => 'Generate & Instant Download',
        'desc' => 'Click "Convert to PDF" to compile your document locally and download a clean PDF immediately.',
    ],
];

$faqs = [
    [
        'q' => 'Is my HTML code or text uploaded to any server?',
        'a' => 'No. NoPayPDF compiles HTML and text documents 100% locally inside your web browser. Your private notes, invoices, and sensitive code never leave your machine.',
    ],
    [
        'q' => 'What is the difference between Text Mode and HTML Mode?',
        'a' => 'Text Mode creates ultra-crisp, searchable vector text with automatic line-wrapping and pagination, resulting in tiny file sizes. HTML Mode renders full CSS styling, tables, colors, and graphical layouts.',
    ],
    [
        'q' => 'Can I include images in my HTML?',
        'a' => 'Yes. Inline base64 images, SVGs, and locally referenced graphics are fully supported. Images hosted on external websites must permit CORS access to be captured by the browser.',
    ],
    [
        'q' => 'Is my HTML sanitized for security?',
        'a' => 'Yes. All HTML is strictly sanitized using industry-standard DOMPurify before rendering to prevent malicious script injection or cross-site scripting (XSS).',
    ],
    [
        'q' => 'Does this support CSS page breaks?',
        'a' => 'Yes. In HTML mode, you can use standard CSS page break properties like `page-break-before: always;` or `break-before: page;` to control multi-page pagination.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/html-to-pdf',
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

    <!-- Mode Selector Tabs -->
    <div class="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex flex-wrap gap-2 mb-6">
        <button type="button" data-mode="text" class="converter-mode-tab flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 text-white transition-all flex items-center justify-center gap-2">
            <i data-lucide="file-text" class="w-4 h-4"></i>
            <span>Plain Text to PDF (Vector Text)</span>
        </button>
        <button type="button" data-mode="html" class="converter-mode-tab flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-transparent text-slate-600 hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
            <i data-lucide="code-xml" class="w-4 h-4"></i>
            <span>HTML to PDF (Rich Layout)</span>
        </button>
    </div>

    <!-- Workspace View -->
    <div class="space-y-6">
        <!-- ======================================================== -->
        <!-- TAB 1: PLAIN TEXT TO PDF                                  -->
        <!-- ======================================================== -->
        <div id="tab-panel-text" class="tab-panel space-y-6">
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-bold text-slate-900">Enter or Paste Plain Text</h3>
                        <p class="text-xs text-slate-500">Generates selectable, searchable vector text with automatic pagination.</p>
                    </div>
                    <div>
                        <button type="button" id="load-txt-file-btn" class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                            <i data-lucide="upload" class="w-3.5 h-3.5"></i>
                            <span>Load .txt File</span>
                        </button>
                        <input type="file" id="txt-file-input" class="hidden" accept=".txt,text/plain">
                    </div>
                </div>

                <textarea
                    id="plain-text-input"
                    rows="10"
                    placeholder="Type or paste your text here... Long paragraphs will automatically wrap and flow onto new PDF pages seamlessly."
                    class="w-full p-4 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-sans"
                ></textarea>

                <div class="flex items-center justify-between text-xs text-slate-400">
                    <span id="text-stats">0 characters &bull; 0 lines</span>
                    <button type="button" id="load-sample-txt-btn" class="text-blue-600 hover:underline">Load Sample Document</button>
                </div>
            </div>

            <!-- Text Formatting Controls -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Typography & Page Settings</h3>

                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div>
                        <label for="text-font-family" class="block text-xs font-semibold text-slate-700 mb-1.5">Font</label>
                        <select id="text-font-family" class="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                            <option value="helvetica" selected>Helvetica (Sans)</option>
                            <option value="times">Times (Serif)</option>
                            <option value="courier">Courier (Mono)</option>
                        </select>
                    </div>

                    <div>
                        <label for="text-font-size" class="block text-xs font-semibold text-slate-700 mb-1.5">Font Size</label>
                        <select id="text-font-size" class="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                            <option value="10">10 pt (Compact)</option>
                            <option value="12" selected>12 pt (Standard)</option>
                            <option value="14">14 pt (Readable)</option>
                            <option value="16">16 pt (Large)</option>
                        </select>
                    </div>

                    <div>
                        <label for="text-line-spacing" class="block text-xs font-semibold text-slate-700 mb-1.5">Line Spacing</label>
                        <select id="text-line-spacing" class="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                            <option value="1.2">1.2 (Tight)</option>
                            <option value="1.5" selected>1.5 (Standard)</option>
                            <option value="1.8">1.8 (Spacious)</option>
                        </select>
                    </div>

                    <div>
                        <label for="text-page-size" class="block text-xs font-semibold text-slate-700 mb-1.5">Page Size</label>
                        <select id="text-page-size" class="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                            <option value="a4" selected>A4</option>
                            <option value="letter">US Letter</option>
                        </select>
                    </div>

                    <div>
                        <label for="text-orientation" class="block text-xs font-semibold text-slate-700 mb-1.5">Orientation</label>
                        <select id="text-orientation" class="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                            <option value="portrait" selected>Portrait</option>
                            <option value="landscape">Landscape</option>
                        </select>
                    </div>

                    <div>
                        <label for="text-margin" class="block text-xs font-semibold text-slate-700 mb-1.5">Margin</label>
                        <select id="text-margin" class="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                            <option value="20">Small (20 pt)</option>
                            <option value="40" selected>Normal (40 pt)</option>
                            <option value="60">Wide (60 pt)</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <!-- ======================================================== -->
        <!-- TAB 2: HTML TO PDF                                        -->
        <!-- ======================================================== -->
        <div id="tab-panel-html" class="tab-panel hidden space-y-6">
            <!-- CORS Notice -->
            <div class="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
                <i data-lucide="info" class="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5"></i>
                <p>
                    <strong>CORS Notice:</strong> Modern browsers protect your privacy by restricting cross-origin images. Inline SVG, base64 data URLs, and standard CSS graphics work cleanly. External images hosted on third-party servers must have permissive CORS headers.
                </p>
            </div>

            <!-- HTML Editor & Live Preview -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <!-- Code Editor -->
                <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-900 uppercase tracking-wider">HTML Source Code</span>
                        <div class="flex items-center gap-2">
                            <button type="button" id="load-sample-html-btn" class="text-xs text-blue-600 hover:underline">
                                Load Sample Invoice
                            </button>
                            <button type="button" id="load-html-file-btn" class="px-2.5 py-1 rounded border border-slate-200 text-[11px] font-semibold hover:bg-slate-50">
                                Open .html
                            </button>
                            <input type="file" id="html-file-input" class="hidden" accept=".html,.htm,text/html">
                        </div>
                    </div>

                    <textarea
                        id="html-source-input"
                        rows="14"
                        placeholder="Paste your HTML code here with inline or <style> tags..."
                        class="code-editor-textarea w-full p-3.5 text-xs bg-slate-900 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono leading-relaxed resize-y"
                    ></textarea>
                </div>

                <!-- Live Preview Pane -->
                <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-900 uppercase tracking-wider">Sanitized Live Preview</span>
                        <span class="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                            DOMPurify Protected
                        </span>
                    </div>

                    <div id="html-preview-container" class="w-full h-[320px] bg-slate-50 border border-slate-200 rounded-xl overflow-auto p-4">
                        <div id="html-preview-sandbox" class="html-preview-frame"></div>
                    </div>
                </div>
            </div>

            <!-- HTML Page Setup Controls -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">HTML Layout Setup</h3>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                        <label for="html-page-size" class="block text-xs font-semibold text-slate-700 mb-1.5">Page Size</label>
                        <select id="html-page-size" class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                            <option value="a4" selected>A4</option>
                            <option value="letter">US Letter</option>
                        </select>
                    </div>

                    <div>
                        <label for="html-orientation" class="block text-xs font-semibold text-slate-700 mb-1.5">Orientation</label>
                        <select id="html-orientation" class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                            <option value="portrait" selected>Portrait</option>
                            <option value="landscape">Landscape</option>
                        </select>
                    </div>

                    <div>
                        <label for="html-margin" class="block text-xs font-semibold text-slate-700 mb-1.5">Page Margin</label>
                        <select id="html-margin" class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                            <option value="10">Small (10 mm)</option>
                            <option value="15" selected>Standard (15 mm)</option>
                            <option value="25">Wide (25 mm)</option>
                        </select>
                    </div>

                    <div>
                        <label for="html-render-scale" class="block text-xs font-semibold text-slate-700 mb-1.5">Render Quality</label>
                        <select id="html-render-scale" class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                            <option value="1.5">Standard (1.5x scale)</option>
                            <option value="2.0" selected>High (2.0x scale — Default)</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <!-- Conversion Action Bar -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div class="sm:col-span-2">
                    <label for="convert-output-filename" class="block text-xs font-semibold text-slate-700 mb-1">Output File Name</label>
                    <input
                        type="text"
                        id="convert-output-filename"
                        value="document.pdf"
                        class="w-full px-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                </div>

                <div class="sm:col-span-1 flex flex-col justify-end">
                    <button
                        type="button"
                        id="convert-submit-btn"
                        class="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all"
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
                    class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                    <i data-lucide="download" class="w-4 h-4"></i>
                    <span>Download PDF Document</span>
                </button>
                <button
                    type="button"
                    id="convert-reset-btn"
                    class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-sm transition-colors"
                >
                    Start New Conversion
                </button>
            </div>
        </div>
    </div>
</section>

<!-- Off-screen isolated iframe for html2canvas (Completely shields html2canvas from Tailwind v4 oklch color functions) -->
<iframe id="isolated-html-render-iframe" title="Isolated Render Sandbox" style="position: fixed; left: -9999px; top: -9999px; width: 800px; height: 1000px; border: 0; visibility: hidden;"></iframe>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'html-to-pdf'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    'https://unpkg.com/dompurify@3.2.4/dist/purify.min.js',
    'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
    'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js',
    '/assets/js/tools/html-to-pdf.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
