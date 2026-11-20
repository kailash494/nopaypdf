<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';
require_once __DIR__ . '/../includes/seo.php';
require_once __DIR__ . '/../includes/ad-slots.php';

$registry = get_tool_registry();
$tool = $registry['protect-pdf'] ?? null;
if (!$tool) {
    http_response_code(404);
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'step' => 1,
        'title' => 'Upload PDF File',
        'desc' => 'Drag and drop your PDF into the upload area or select it from your device storage.',
    ],
    [
        'step' => 2,
        'title' => 'Set Password & Permissions',
        'desc' => 'Create a strong open password and optionally configure granular printing, copying, and modification permissions.',
    ],
    [
        'step' => 3,
        'title' => 'Download Encrypted PDF',
        'desc' => 'Encrypt your file locally using military-grade AES-256 security and download your protected document.',
    ],
];

$faqs = [
    [
        'q' => 'What encryption standard does NoPayPDF use?',
        'a' => 'NoPayPDF uses industry-standard 256-bit AES (Advanced Encryption Standard) encryption powered by QPDF WebAssembly. It is recognized globally as the gold standard for secure PDF document protection.',
    ],
    [
        'q' => 'Can anyone (including NoPayPDF) see my password?',
        'a' => 'Never. All encryption runs strictly client-side inside your web browser. Neither your document nor your entered password is ever sent across the network or stored on any server.',
    ],
    [
        'q' => 'What is the difference between an Open Password and an Owner Password?',
        'a' => 'An Open Password (User Password) is required to view and open the PDF. An Owner Password (Permissions Password) controls restrictions like copying text, modifying annotations, or printing in high resolution.',
    ],
    [
        'q' => 'What happens if I forget the password I set?',
        'a' => 'Because AES-256 encryption is mathematically unbreakable without the key and NoPayPDF stores zero information on any server, there is no backdoor or password recovery mechanism. Be sure to remember or safely store your password.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/protect-pdf',
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

        <!-- Already Encrypted Warning Banner -->
        <div id="already-encrypted-banner" class="hidden bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex items-start gap-3">
                <i data-lucide="shield-alert" class="w-5 h-5 text-amber-600 shrink-0 mt-0.5"></i>
                <div>
                    <h4 class="text-xs sm:text-sm font-bold text-amber-900">This document is already password protected</h4>
                    <p class="text-xs text-amber-700 mt-0.5">To remove or change existing security restrictions, open our Unlock PDF tool.</p>
                </div>
            </div>
            <a href="/unlock-pdf" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0">
                Go to Unlock PDF
            </a>
        </div>

        <!-- Dropzone Container -->
        <div
            id="protect-dropzone"
            class="relative border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer shadow-xs hover:shadow-md group"
        >
            <input type="file" id="protect-file-input" class="hidden" accept=".pdf,application/pdf">

            <div class="flex flex-col items-center justify-center space-y-4">
                <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                    <i data-lucide="lock" class="w-8 h-8"></i>
                </div>
                <div>
                    <h2 class="text-base sm:text-lg font-bold text-slate-900">
                        Choose a PDF to Protect
                    </h2>
                    <p class="text-xs sm:text-sm text-slate-500 mt-1">
                        Drag and drop your file here, or <span class="text-blue-600 font-semibold underline">browse files</span>
                    </p>
                </div>
                <div class="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                    <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-600"></i>
                    <span>256-Bit AES Encryption &bull; Password Stays on Your Device</span>
                </div>
            </div>
        </div>

        <!-- File Loaded Workspace -->
        <div id="protect-workspace" class="hidden space-y-6">

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

            <!-- Password Configuration Panel -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Document Password</h3>
                        <p class="text-xs text-slate-500 mt-0.5">Set the open password required to view this PDF.</p>
                    </div>
                    <span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                        <i data-lucide="lock" class="w-3 h-3"></i>
                        <span>AES-256</span>
                    </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <!-- Open Password -->
                    <div>
                        <label for="user-password-input" class="block text-xs font-semibold text-slate-700 mb-1.5">
                            Open Password <span class="text-rose-500">*</span>
                        </label>
                        <div class="relative">
                            <input
                                type="password"
                                id="user-password-input"
                                placeholder="Enter document password"
                                class="w-full px-3.5 py-2.5 pr-10 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                            <button
                                type="button"
                                class="btn-toggle-pw absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                                data-target="user-password-input"
                            >
                                <i data-lucide="eye" class="w-4 h-4"></i>
                            </button>
                        </div>

                        <!-- Password Strength Indicator -->
                        <div class="mt-2 space-y-1">
                            <div class="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div id="password-strength-bar" class="h-full w-0 bg-rose-500 transition-all duration-300"></div>
                            </div>
                            <span id="password-strength-label" class="text-[11px] text-slate-400 font-medium">Enter at least 4 characters</span>
                        </div>
                    </div>

                    <!-- Confirm Password -->
                    <div>
                        <label for="confirm-password-input" class="block text-xs font-semibold text-slate-700 mb-1.5">
                            Confirm Password <span class="text-rose-500">*</span>
                        </label>
                        <div class="relative">
                            <input
                                type="password"
                                id="confirm-password-input"
                                placeholder="Repeat document password"
                                class="w-full px-3.5 py-2.5 pr-10 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                            <button
                                type="button"
                                class="btn-toggle-pw absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                                data-target="confirm-password-input"
                            >
                                <i data-lucide="eye" class="w-4 h-4"></i>
                            </button>
                        </div>
                        <span id="confirm-password-match-label" class="text-[11px] text-slate-400 font-medium mt-1 block">Passwords must match</span>
                    </div>
                </div>

                <!-- Collapsible Advanced Permissions Section -->
                <details class="group border border-slate-200 rounded-xl overflow-hidden">
                    <summary class="px-4 py-3 bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer flex items-center justify-between select-none hover:bg-slate-100/70 transition-colors">
                        <span class="flex items-center gap-2">
                            <i data-lucide="sliders" class="w-3.5 h-3.5 text-blue-600"></i>
                            <span>Advanced Permissions & Master Key (Optional)</span>
                        </span>
                        <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform"></i>
                    </summary>

                    <div class="p-4 sm:p-5 space-y-4 bg-white border-t border-slate-200">
                        <!-- Owner Password -->
                        <div>
                            <label for="owner-password-input" class="block text-xs font-semibold text-slate-700 mb-1">
                                Permissions / Owner Password
                            </label>
                            <div class="relative max-w-md">
                                <input
                                    type="password"
                                    id="owner-password-input"
                                    placeholder="Leave blank to auto-generate securely"
                                    class="w-full px-3.5 py-2 pr-10 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                                >
                                <button
                                    type="button"
                                    class="btn-toggle-pw absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                                    data-target="owner-password-input"
                                >
                                    <i data-lucide="eye" class="w-4 h-4"></i>
                                </button>
                            </div>
                            <p class="text-[11px] text-slate-400 mt-1">If left empty, a cryptographically secure random master key will be generated automatically.</p>
                        </div>

                        <!-- Granular Permissions Grid -->
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                            <!-- Printing -->
                            <div>
                                <label for="perm-print" class="block text-xs font-semibold text-slate-700 mb-1">Printing</label>
                                <select id="perm-print" class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                                    <option value="full" selected>Full Quality Allowed</option>
                                    <option value="low">Low Resolution (150 DPI)</option>
                                    <option value="none">Printing Blocked</option>
                                </select>
                            </div>

                            <!-- Text/Image Extraction -->
                            <div>
                                <label for="perm-extract" class="block text-xs font-semibold text-slate-700 mb-1">Copying Content</label>
                                <select id="perm-extract" class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                                    <option value="y" selected>Copying Allowed</option>
                                    <option value="n">Copying Blocked</option>
                                </select>
                            </div>

                            <!-- Modification -->
                            <div>
                                <label for="perm-modify" class="block text-xs font-semibold text-slate-700 mb-1">Modifications</label>
                                <select id="perm-modify" class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-medium">
                                    <option value="all" selected>All Changes Allowed</option>
                                    <option value="annotate">Annotations & Forms Only</option>
                                    <option value="none">Editing Blocked</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </details>
            </div>

            <!-- Action & Progress Bar -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <button
                    type="button"
                    id="protect-submit-btn"
                    class="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                    <i data-lucide="lock" class="w-4 h-4"></i>
                    <span>Encrypt PDF with Password</span>
                </button>

                <div id="protect-progress-container"></div>
            </div>

            <!-- In-Tool Ad Slot with Generous Margin -->
            <?php render_ad_slot('in-tool'); ?>

            <!-- Result Download Card -->
            <div id="result-view" class="hidden space-y-5">
                <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
                    <div class="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                        <i data-lucide="shield-check" class="w-8 h-8"></i>
                    </div>

                    <div>
                        <h3 class="text-xl font-bold text-emerald-950">PDF Successfully Encrypted!</h3>
                        <p id="result-summary" class="text-xs sm:text-sm text-emerald-800 mt-1"></p>
                    </div>

                    <div class="bg-white/80 p-4 rounded-xl border border-emerald-200 max-w-md mx-auto text-xs text-slate-600 space-y-1">
                        <div class="flex items-center justify-between">
                            <span class="font-semibold text-slate-700">Encryption:</span>
                            <span class="font-bold text-emerald-700">AES-256 Bit</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="font-semibold text-slate-700">Status:</span>
                            <span class="text-slate-800">Password Required to Open</span>
                        </div>
                    </div>

                    <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            id="download-protected-btn"
                            class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>Download Protected PDF</span>
                        </button>
                        <button
                            type="button"
                            id="protect-reset-btn"
                            class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-sm transition-colors cursor-pointer"
                        >
                            Protect Another PDF
                        </button>
                    </div>
                </div>
            </div>

        </div>

    </div>
</section>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'protect-pdf'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    '/assets/vendor/qpdf/qpdf.js',
    '/assets/js/qpdf-client.js?v=' . APP_VERSION,
    '/assets/js/tools/protect-pdf.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
