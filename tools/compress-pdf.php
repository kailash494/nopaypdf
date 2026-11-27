<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';
require_once __DIR__ . '/../includes/seo.php';
require_once __DIR__ . '/../includes/ad-slots.php';

$registry = get_tool_registry();
$tool = $registry['compress-pdf'] ?? null;
if (!$tool) {
    http_response_code(404);
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'step' => 1,
        'title' => 'Select Your PDF Document',
        'desc' => 'Drag and drop your PDF into the upload zone or click to choose a file from your device.',
    ],
    [
        'step' => 2,
        'title' => 'Choose a Compression Preset',
        'desc' => 'Select Lossless to preserve searchable vector text, or choose Balanced, Strong, or Extreme for maximal image reduction.',
    ],
    [
        'step' => 3,
        'title' => 'Download Compressed PDF',
        'desc' => 'Preview the exact size reduction metrics and download your compact, web-ready PDF instantly.',
    ],
];

$faqs = [
    [
        'q' => 'How does in-browser PDF compression work?',
        'a' => 'NoPayPDF leverages WebAssembly (QPDF) to restructure object tables and compress streams without losing vector fidelity. For visual compression, it renders and re-encodes pages using client-side canvas technology. All operations execute strictly in your browser.',
    ],
    [
        'q' => 'Can I password protect the compressed PDF?',
        'a' => 'Yes. Once your PDF is optimized for email or web upload, you can encrypt it with robust 256-bit AES security using our client-side <a href="/protect-pdf/" class="text-brand-600 hover:text-brand-700 underline font-medium">Protect PDF</a> tool.',
    ],
    [
        'q' => 'Can I edit document text after compressing?',
        'a' => 'Yes! If you used the Lossless preset, text vectors remain fully intact. You can open the file in our <a href="/edit-pdf/" class="text-brand-600 hover:text-brand-700 underline font-medium">Edit PDF</a> tool to modify sentences, add annotations, or fill out forms.',
    ],
    [
        'q' => 'Will my PDF text remain selectable and searchable?',
        'a' => 'If you choose the "Lossless Structure" preset, all text, vectors, bookmarks, and links remain 100% intact, selectable, and searchable. Visual presets (Balanced, Strong, Extreme) optimize page images and flatten pages into compact graphics for maximum file reduction.',
    ],
    [
        'q' => 'How can I save even more space on print documents?',
        'a' => 'If your document has colorful charts or ink-heavy graphics destined for printing, convert it to monochrome with our <a href="/grayscale-pdf/" class="text-brand-600 hover:text-brand-700 underline font-medium">Grayscale PDF</a> tool to save ink and reduce file size.',
    ],
    [
        'q' => 'Is my confidential data safe?',
        'a' => 'Yes, 100%. Your documents never touch our servers or any third-party cloud. Compression takes place in your computer or phone browser memory, ensuring total privacy for sensitive legal, financial, or personal documents.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/compress-pdf/',
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
        <div id="error-alert" role="alert" class="hidden bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3">
            <i data-lucide="alert-circle" class="w-5 h-5 text-rose-600 shrink-0 mt-0.5"></i>
            <div class="flex-1 text-xs sm:text-sm" id="error-message"></div>
            <button type="button" id="error-dismiss-btn" aria-label="Dismiss error" class="text-rose-400 hover:text-rose-700">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        </div>

        <!-- Dropzone Container -->
        <div
            id="compress-dropzone"
            class="relative border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer shadow-xs hover:shadow-md group"
        >
            <input type="file" id="compress-file-input" class="hidden" accept=".pdf,application/pdf">

            <div class="flex flex-col items-center justify-center space-y-4">
                <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                    <i data-lucide="file-down" class="w-8 h-8"></i>
                </div>
                <div>
                    <h2 class="text-base sm:text-lg font-bold text-slate-900">
                        Choose a PDF to Compress
                    </h2>
                    <p class="text-xs sm:text-sm text-slate-500 mt-1">
                        Drag and drop your file here, or <span class="text-blue-600 font-semibold underline">browse files</span>
                    </p>
                </div>
                <div class="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                    <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-600"></i>
                    <span>100% In-Browser Compression &bull; Zero Server Uploads</span>
                </div>
            </div>
        </div>

        <!-- File Loaded Workspace -->
        <div id="compress-workspace" class="hidden space-y-6">

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
                        class="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        Change File
                    </button>
                </div>
            </div>

            <!-- Compression Preset Cards -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div>
                    <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Select Compression Level</h3>
                    <p class="text-xs text-slate-500 mt-0.5">Choose the balance between size reduction and visual/text fidelity.</p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5" id="presets-container">

                    <!-- Preset 1: Lossless -->
                    <label class="preset-card relative p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between space-y-3 bg-slate-50/50 has-checked:border-blue-600 has-checked:bg-blue-50/30">
                        <input type="radio" name="compression-preset" value="lossless" class="sr-only">
                        <div class="space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold text-slate-900">Lossless</span>
                                <span class="text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">QPDF</span>
                            </div>
                            <p class="text-[11px] text-slate-500 leading-snug">
                                Compresses PDF streams and object tables. Keeps 100% vector text selectable and crystal-clear.
                            </p>
                        </div>
                        <div class="text-[11px] font-semibold text-blue-600">Preserves Searchable Text</div>
                    </label>

                    <!-- Preset 2: Balanced (Default) -->
                    <label class="preset-card relative p-4 rounded-xl border-2 border-blue-600 bg-blue-50/30 cursor-pointer transition-all flex flex-col justify-between space-y-3 has-checked:border-blue-600 has-checked:bg-blue-50/30">
                        <input type="radio" name="compression-preset" value="balanced" checked class="sr-only">
                        <div class="space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold text-slate-900">Balanced</span>
                                <span class="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-1.5 py-0.5 rounded">Recommended</span>
                            </div>
                            <p class="text-[11px] text-slate-500 leading-snug">
                                High quality visual compression (~108 DPI, 72% JPEG quality). Optimal for sharing and archiving.
                            </p>
                        </div>
                        <div class="text-[11px] font-semibold text-slate-700">Moderate Size Reduction</div>
                    </label>

                    <!-- Preset 3: Strong -->
                    <label class="preset-card relative p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between space-y-3 bg-slate-50/50 has-checked:border-blue-600 has-checked:bg-blue-50/30">
                        <input type="radio" name="compression-preset" value="strong" class="sr-only">
                        <div class="space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold text-slate-900">Strong</span>
                                <span class="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Web / Email</span>
                            </div>
                            <p class="text-[11px] text-slate-500 leading-snug">
                                Compact visual rendering (~90 DPI, 55% JPEG quality). Ideal for email attachments and web upload limits.
                            </p>
                        </div>
                        <div class="text-[11px] font-semibold text-slate-700">High Size Reduction</div>
                    </label>

                    <!-- Preset 4: Extreme -->
                    <label class="preset-card relative p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between space-y-3 bg-slate-50/50 has-checked:border-blue-600 has-checked:bg-blue-50/30">
                        <input type="radio" name="compression-preset" value="extreme" class="sr-only">
                        <div class="space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold text-slate-900">Extreme</span>
                                <span class="text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">Smallest</span>
                            </div>
                            <p class="text-[11px] text-slate-500 leading-snug">
                                Maximum compression (~72 DPI, 40% JPEG quality). Use when document size is the absolute highest priority.
                            </p>
                        </div>
                        <div class="text-[11px] font-semibold text-slate-700">Smallest Possible File</div>
                    </label>
                </div>

                <!-- Transparency Note for Visual Compression -->
                <div id="visual-compression-notice" class="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-800">
                    <i data-lucide="info" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"></i>
                    <span>Visual presets (Balanced, Strong, Extreme) rasterize and optimize page graphics for maximum compression. Choose <strong>Lossless</strong> if you require selectable vector text.</span>
                </div>
            </div>

            <!-- Action & Progress Bar -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <button
                    type="button"
                    id="compress-submit-btn"
                    class="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                    <i data-lucide="file-down" class="w-4 h-4"></i>
                    <span>Compress PDF Now</span>
                </button>

                <div id="compress-progress-container"></div>
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
                        <h3 class="text-xl font-bold text-emerald-950">Compression Complete!</h3>
                        <p id="result-summary" class="text-xs sm:text-sm text-emerald-800 mt-1"></p>
                    </div>

                    <!-- Metrics Comparison Grid -->
                    <div class="grid grid-cols-3 gap-2 sm:gap-4 max-w-lg mx-auto bg-white/80 p-4 rounded-xl border border-emerald-200 text-center">
                        <div>
                            <span class="block text-[11px] font-semibold text-slate-500 uppercase">Original</span>
                            <span id="metric-original-size" class="text-sm sm:text-base font-bold text-slate-800">-</span>
                        </div>
                        <div>
                            <span class="block text-[11px] font-semibold text-slate-500 uppercase">Compressed</span>
                            <span id="metric-compressed-size" class="text-sm sm:text-base font-bold text-emerald-700">-</span>
                        </div>
                        <div>
                            <span class="block text-[11px] font-semibold text-slate-500 uppercase">Reduction</span>
                            <span id="metric-reduction-percent" class="text-sm sm:text-base font-bold text-emerald-600">-</span>
                        </div>
                    </div>

                    <!-- Guard Banner if Output was not smaller -->
                    <div id="no-savings-guard" class="hidden bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-lg mx-auto">
                        <div class="flex items-start gap-2.5">
                            <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"></i>
                            <span>This document is already highly optimized. The compressed file is not smaller than the original. You can download the original or try a stronger visual preset above.</span>
                        </div>
                        <button
                            type="button"
                            id="download-original-btn"
                            class="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors cursor-pointer"
                        >
                            Download Original PDF
                        </button>
                    </div>

                    <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            id="download-compressed-btn"
                            class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>Download Compressed PDF</span>
                        </button>
                        <button
                            type="button"
                            id="compress-reset-btn"
                            class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-sm transition-colors cursor-pointer"
                        >
                            Compress Another PDF
                        </button>
                    </div>
                </div>
            </div>

        </div>

    </div>
</section>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'compress-pdf'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    '/assets/vendor/qpdf/qpdf.js',
    '/assets/js/qpdf-client.js?v=' . APP_VERSION,
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    '/assets/js/pdf-render.js?v=' . APP_VERSION,
    '/assets/js/tools/compress-pdf.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
