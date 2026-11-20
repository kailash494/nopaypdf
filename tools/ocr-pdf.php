<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';
require_once __DIR__ . '/../includes/seo.php';
require_once __DIR__ . '/../includes/ad-slots.php';

$registry = get_tool_registry();
$tool = $registry['ocr-pdf'] ?? null;
if (!$tool) {
    http_response_code(404);
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'step' => 1,
        'title' => 'Select Scanned PDF',
        'desc' => 'Upload the scanned PDF or image-based document you want to extract text from.',
    ],
    [
        'step' => 2,
        'title' => 'Select Language & Quality',
        'desc' => 'Choose your document language (English, Spanish, French, etc.) and recognition quality.',
    ],
    [
        'step' => 3,
        'title' => 'Download Text or Searchable PDF',
        'desc' => 'Copy recognized text directly, download a .txt file, or export a searchable PDF with invisible text layers.',
    ],
];

$faqs = [
    [
        'q' => 'What is optical character recognition (OCR)?',
        'a' => 'OCR converts scanned image documents into machine-encoded, selectable, and searchable text, enabling copy-pasting, word searching, and indexing.',
    ],
    [
        'q' => 'How does the Searchable PDF output work?',
        'a' => 'NoPayPDF overlays an invisible, high-precision vector text layer directly on top of your scanned document images, allowing you to highlight, search (Ctrl+F), and copy text while preserving the original visual scan.',
    ],
    [
        'q' => 'What languages are supported?',
        'a' => 'NoPayPDF supports major global languages including English, Spanish, French, German, Italian, Portuguese, Arabic, Hindi, and Chinese Simplified using specialized neural LSTM recognition models.',
    ],
    [
        'q' => 'Are my confidential scans uploaded to an external server?',
        'a' => 'No. All image rasterization, WebAssembly neural network inference, and PDF layer generation execute 100% inside your web browser. Your private documents never leave your machine.',
    ],
    [
        'q' => 'Can I run OCR on long documents?',
        'a' => 'Yes. For documents exceeding 15–20 pages, we recommend processing in batches or selecting a Custom Page Range for optimal browser performance and speed.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/ocr-pdf',
    'tool' => $tool,
    'faqs' => $faqs,
];

require_once __DIR__ . '/../includes/header.php';
?>

<!-- Tool Hero Header -->
<?php render_tool_hero($tool); ?>

<!-- Main Tool Workspace -->
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

        <!-- 1. Upload Dropzone -->
        <div id="upload-panel" class="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xs">
            <div
                id="pdf-dropzone"
                class="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 group"
            >
                <input type="file" id="pdf-file-input" class="hidden" accept=".pdf,application/pdf">
                
                <div class="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                    <i data-lucide="scan-text" class="w-8 h-8"></i>
                </div>
                
                <h2 class="text-lg sm:text-xl font-bold text-slate-900 mb-1">
                    Choose a Scanned PDF for In-Browser OCR
                </h2>
                <p class="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-5">
                    Extract text and turn scanned pages into searchable documents. Fast, private, and 100% client-side.
                </p>

                <div class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors">
                    <i data-lucide="upload" class="w-4 h-4"></i>
                    <span>Select PDF Document</span>
                </div>
            </div>
        </div>

        <!-- 2. OCR Configuration Panel -->
        <div id="ocr-config-panel" class="hidden space-y-6">

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

                <button
                    type="button"
                    id="ocr-change-file-btn"
                    class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                >
                    Change File
                </button>
            </div>

            <!-- Long Document Performance Tip (Shown if pages > 15) -->
            <div id="long-doc-tip" class="hidden p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs text-blue-900">
                <i data-lucide="zap" class="w-4 h-4 text-blue-600 shrink-0 mt-0.5"></i>
                <p class="leading-relaxed">
                    <strong>Speed Tip:</strong> This document has <span id="long-doc-page-count">20</span> pages. In-browser OCR processes pages using your computer's local CPU. To get fast results, consider selecting a <strong>Custom Page Range</strong> (e.g. 5–10 pages at a time).
                </p>
            </div>

            <!-- OCR Settings Card -->
            <div class="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
                <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
                    <i data-lucide="settings-2" class="w-4 h-4 text-blue-600"></i>
                    <span>OCR Recognition Settings</span>
                </h3>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    <!-- Language Selection -->
                    <div class="space-y-1.5">
                        <label for="ocr-language-select" class="block text-xs font-semibold text-slate-700">Document Language:</label>
                        <select id="ocr-language-select" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden">
                            <option value="eng" selected>English (Default)</option>
                            <option value="spa">Spanish (Español)</option>
                            <option value="fra">French (Français)</option>
                            <option value="deu">German (Deutsch)</option>
                            <option value="ita">Italian (Italiano)</option>
                            <option value="por">Portuguese (Português)</option>
                            <option value="ara">Arabic (العربية)</option>
                            <option value="hin">Hindi (हिन्दी)</option>
                            <option value="chi_sim">Chinese Simplified (简体中文)</option>
                        </select>
                        <p class="text-[11px] text-slate-400">Loads neural LSTM traineddata locally into browser memory.</p>
                    </div>

                    <!-- Scan Quality / DPI -->
                    <div class="space-y-1.5">
                        <label for="ocr-dpi-select" class="block text-xs font-semibold text-slate-700">Recognition Quality:</label>
                        <select id="ocr-dpi-select" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden">
                            <option value="250" selected>Accurate (250 DPI) &bull; Recommended for scans</option>
                            <option value="180">Fast (180 DPI) &bull; High speed for clean text</option>
                        </select>
                        <p class="text-[11px] text-slate-400">Higher DPI improves detection of small fonts and faded characters.</p>
                    </div>

                </div>

                <!-- Page Range Selector -->
                <div class="space-y-2 pt-2 border-t border-slate-100">
                    <label class="block text-xs font-semibold text-slate-700">Pages to Recognize:</label>
                    <div class="flex items-center gap-5 text-xs font-medium text-slate-700">
                        <label class="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="ocr-scope" value="all" checked class="accent-blue-600">
                            <span>All Pages</span>
                        </label>
                        <label class="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="ocr-scope" value="custom" class="accent-blue-600">
                            <span>Custom Page Range</span>
                        </label>
                    </div>
                    <input
                        type="text"
                        id="ocr-custom-range-input"
                        placeholder="e.g. 1-3, 5"
                        class="hidden w-full max-w-sm px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                    >
                </div>

                <!-- Output Formats -->
                <div class="space-y-2 pt-2 border-t border-slate-100">
                    <span class="block text-xs font-semibold text-slate-700">Generated Outputs:</span>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                            <i data-lucide="file-check" class="w-4 h-4 text-blue-600"></i>
                            <span class="font-bold text-slate-800">Searchable PDF (.pdf)</span>
                            <span class="text-[11px] text-slate-500 ml-auto">Invisible text layer</span>
                        </div>
                        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                            <i data-lucide="file-text" class="w-4 h-4 text-emerald-600"></i>
                            <span class="font-bold text-slate-800">Plain Text File (.txt)</span>
                            <span class="text-[11px] text-slate-500 ml-auto">Full UTF-8 export</span>
                        </div>
                    </div>
                </div>

                <!-- Primary Action Button -->
                <button
                    type="button"
                    id="start-ocr-btn"
                    class="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                    <i data-lucide="scan-text" class="w-4 h-4"></i>
                    <span>Start In-Browser OCR</span>
                </button>
            </div>

            <!-- Live Progress Card -->
            <div id="ocr-progress-panel" class="hidden bg-white rounded-3xl border border-slate-200/80 p-8 text-center space-y-4 shadow-xs">
                <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto animate-spin">
                    <i data-lucide="loader-2" class="w-6 h-6"></i>
                </div>

                <div>
                    <h4 class="text-base font-bold text-slate-900" id="ocr-progress-title">Initializing OCR Engine...</h4>
                    <p class="text-xs text-slate-500 mt-1" id="ocr-progress-desc">Loading language neural model...</p>
                </div>

                <div class="w-full max-w-md mx-auto bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div id="ocr-progress-bar" class="bg-blue-600 h-3 rounded-full transition-all duration-200" style="width: 10%"></div>
                </div>

                <div class="pt-2">
                    <button
                        type="button"
                        id="cancel-ocr-btn"
                        class="px-4 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer"
                    >
                        Cancel OCR
                    </button>
                </div>
            </div>

            <!-- In-Tool Ad Slot -->
            <?php render_ad_slot('in-tool'); ?>

            <!-- Result Panel -->
            <div id="ocr-result-panel" class="hidden bg-white rounded-3xl border border-emerald-200/80 p-6 sm:p-8 shadow-xs space-y-6">
                
                <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                        <i data-lucide="check-circle" class="w-7 h-7"></i>
                    </div>

                    <div>
                        <h3 class="text-lg font-bold text-emerald-950">OCR Completed Successfully!</h3>
                        <p id="ocr-result-summary" class="text-xs text-emerald-800 mt-0.5">Extracted 0 words across 0 pages.</p>
                    </div>

                    <!-- Download Buttons Group -->
                    <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            id="download-searchable-pdf-btn"
                            class="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>Download Searchable PDF</span>
                        </button>
                        
                        <button
                            type="button"
                            id="download-text-btn"
                            class="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                            <i data-lucide="file-text" class="w-4 h-4"></i>
                            <span>Download Text (.txt)</span>
                        </button>
                    </div>
                </div>

                <!-- Non-Latin Character Language Notice (conditionally shown) -->
                <div id="non-latin-notice" class="hidden p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                    <i data-lucide="info" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"></i>
                    <p class="leading-relaxed">
                        <strong>Encoding Notice:</strong> Full UTF-8 non-Latin text is completely preserved in your <strong>Extracted Text (.txt)</strong> download. Standard PDF Helvetica indexing embeds alphanumeric Latin coordinates in the PDF layer.
                    </p>
                </div>

                <!-- Extracted Text Preview Area -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <i data-lucide="align-left" class="w-3.5 h-3.5 text-blue-600"></i>
                            <span>Recognized Text Preview</span>
                        </h4>

                        <button
                            type="button"
                            id="copy-text-btn"
                            class="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                            <span id="copy-btn-text">Copy All Text</span>
                        </button>
                    </div>

                    <textarea
                        id="extracted-text-area"
                        readonly
                        rows="10"
                        class="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-800 focus:outline-hidden leading-relaxed resize-y select-text"
                    ></textarea>
                </div>

                <div class="pt-2 text-center">
                    <button
                        type="button"
                        id="ocr-reset-btn"
                        class="px-5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                    >
                        OCR Another Document
                    </button>
                </div>

            </div>

        </div>

    </div>
</section>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'ocr-pdf'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    '/assets/js/pdf-render.js?v=' . APP_VERSION,
    '/assets/js/tools/ocr-pdf.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
