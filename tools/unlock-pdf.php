<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/tool-registry.php';
require_once __DIR__ . '/../includes/tool-layout.php';
require_once __DIR__ . '/../includes/seo.php';
require_once __DIR__ . '/../includes/ad-slots.php';

$registry = get_tool_registry();
$tool = $registry['unlock-pdf'] ?? null;
if (!$tool) {
    http_response_code(404);
    require __DIR__ . '/../pages/404.php';
    exit;
}

$howToSteps = [
    [
        'step' => 1,
        'title' => 'Upload Locked PDF',
        'desc' => 'Select or drop your password-protected PDF file into the secure in-browser workspace.',
    ],
    [
        'step' => 2,
        'title' => 'Enter Password (If Required)',
        'desc' => 'Our engine auto-detects encryption status. Enter your authorized open password or unlock permissions directly.',
    ],
    [
        'step' => 3,
        'title' => 'Download Unlocked Document',
        'desc' => 'Decryption finishes in milliseconds inside your browser. Download your unrestricted PDF instantly.',
    ],
];

$faqs = [
    [
        'q' => 'Can NoPayPDF open or recover an unknown password?',
        'a' => 'No. Modern PDFs utilize robust 128-bit or 256-bit AES encryption which cannot be opened without the authorized password. You must enter the correct password to decrypt the document and remove the lock.',
    ],
    [
        'q' => 'Can I edit the document or add signatures once it is unlocked?',
        'a' => 'Yes. Once restriction flags and passwords are removed, you can open your document in our <a href="/edit-pdf/" class="text-brand-600 hover:text-brand-700 underline font-medium">Edit PDF</a> tool to update text, fill forms, or add digital signatures.',
    ],
    [
        'q' => 'Can I set a new password on the document after unlocking?',
        'a' => 'Yes. If you unlocked the document to remove an outdated passcode, you can set fresh credentials and owner permissions using our client-side <a href="/protect-pdf/" class="text-brand-600 hover:text-brand-700 underline font-medium">Protect PDF</a> tool.',
    ],
    [
        'q' => 'Can I split or merge the unlocked PDF with other files?',
        'a' => 'Yes! With security restrictions lifted, you can extract individual pages using <a href="/split-pdf/" class="text-brand-600 hover:text-brand-700 underline font-medium">Split PDF</a> or combine multiple reports using <a href="/merge-pdf/" class="text-brand-600 hover:text-brand-700 underline font-medium">Merge PDF</a>.',
    ],
    [
        'q' => 'What if the PDF only has printing or editing restrictions?',
        'a' => 'If a document only has owner restrictions (preventing printing, copying, or form filling) but no open password, NoPayPDF detects this automatically and allows you to strip all restrictions with a single click.',
    ],
    [
        'q' => 'Is my password or document transmitted to any server?',
        'a' => 'Never. Decryption is performed entirely in your browser using QPDF WebAssembly. Neither your file bytes nor your entered password are sent across the Internet.',
    ],
];

$pageMeta = [
    'title' => $tool['meta_title'],
    'description' => $tool['meta_desc'],
    'canonical' => SITE_URL . '/unlock-pdf/',
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
            id="unlock-dropzone"
            class="relative border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer shadow-xs hover:shadow-md group"
        >
            <input type="file" id="unlock-file-input" class="hidden" accept=".pdf,application/pdf">

            <div class="flex flex-col items-center justify-center space-y-4">
                <div class="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                    <i data-lucide="unlock" class="w-8 h-8"></i>
                </div>
                <div>
                    <h2 class="text-base sm:text-lg font-bold text-slate-900">
                        Choose a Protected PDF to Unlock
                    </h2>
                    <p class="text-xs sm:text-sm text-slate-500 mt-1">
                        Drag and drop your file here, or <span class="text-blue-600 font-semibold underline">browse files</span>
                    </p>
                </div>
                <div class="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                    <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-600"></i>
                    <span>100% In-Browser Decryption &bull; Files Never Leave Your Device</span>
                </div>
            </div>
        </div>

        <!-- File Loaded Workspace -->
        <div id="unlock-workspace" class="hidden space-y-6">

            <!-- File Header Info Card -->
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-center gap-3.5 min-w-0">
                    <div class="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <i data-lucide="file-text" class="w-6 h-6"></i>
                    </div>
                    <div class="min-w-0">
                        <h3 id="file-name-label" class="text-sm font-bold text-slate-900 truncate">document.pdf</h3>
                        <p id="file-meta-label" class="text-xs text-slate-500 mt-0.5">0 KB</p>
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

            <!-- Detection Status & Password Card -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">

                <!-- Status 1: Not Encrypted -->
                <div id="status-not-encrypted" class="hidden bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900 flex items-start gap-3">
                    <i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-600 shrink-0 mt-0.5"></i>
                    <div class="text-xs sm:text-sm">
                        <strong class="font-bold">This PDF is already unlocked!</strong>
                        <p class="text-emerald-700 mt-0.5">This document has no password protection or viewing restrictions.</p>
                    </div>
                </div>

                <!-- Status 2: Owner-Restricted (No Open PW needed) -->
                <div id="status-owner-restricted" class="hidden bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-900 flex items-start gap-3">
                    <i data-lucide="info" class="w-5 h-5 text-blue-600 shrink-0 mt-0.5"></i>
                    <div class="text-xs sm:text-sm">
                        <strong class="font-bold">Permissions Lock Detected</strong>
                        <p class="text-blue-700 mt-0.5">This file has printing or editing restrictions but requires no open password. Click the button below to strip all restrictions.</p>
                    </div>
                </div>

                <!-- Status 3: Password Required Form -->
                <div id="status-password-required" class="hidden space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Enter Document Password</h3>
                            <p class="text-xs text-slate-500 mt-0.5">This PDF is encrypted. Enter the open password to decrypt.</p>
                        </div>
                        <span class="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1.5">
                            <i data-lucide="lock" class="w-3 h-3"></i>
                            <span>Password Protected</span>
                        </span>
                    </div>

                    <div class="max-w-md">
                        <label for="unlock-password-input" class="block text-xs font-semibold text-slate-700 mb-1.5">
                            PDF Password
                        </label>
                        <div class="relative">
                            <input
                                type="password"
                                id="unlock-password-input"
                                placeholder="Enter password to open"
                                class="w-full px-3.5 py-2.5 pr-10 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                            <button
                                type="button"
                                id="btn-toggle-unlock-pw"
                                aria-label="Toggle PDF password visibility"
                                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                            >
                                <i data-lucide="eye" class="w-4 h-4"></i>
                            </button>
                        </div>
                        <p id="unlock-input-error" class="hidden text-[11px] text-rose-600 font-semibold mt-1.5"></p>
                    </div>
                </div>

                <!-- Legal / Ethical Disclaimer -->
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-500 flex items-start gap-2">
                    <i data-lucide="shield-alert" class="w-4 h-4 text-slate-400 shrink-0 mt-0.5"></i>
                    <span>Please ensure you are the legitimate owner or authorized to remove restrictions from this PDF document.</span>
                </div>
            </div>

            <!-- Action & Progress Bar -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <button
                    type="button"
                    id="unlock-submit-btn"
                    class="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                    <i data-lucide="unlock" class="w-4 h-4"></i>
                    <span>Unlock PDF Document</span>
                </button>

                <div id="unlock-progress-container"></div>
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
                        <h3 class="text-xl font-bold text-emerald-950">PDF Successfully Unlocked!</h3>
                        <p id="result-summary" class="text-xs sm:text-sm text-emerald-800 mt-1"></p>
                    </div>

                    <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            id="download-unlocked-btn"
                            class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>Download Unlocked PDF</span>
                        </button>
                        <button
                            type="button"
                            id="unlock-reset-btn"
                            class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-semibold text-sm transition-colors cursor-pointer"
                        >
                            Unlock Another PDF
                        </button>
                    </div>
                </div>
            </div>

        </div>

    </div>
</section>

<!-- SEO Steps, FAQs & Cross-Links -->
<?php render_tool_seo_sections($howToSteps, $faqs, 'unlock-pdf'); ?>

<!-- Permissive Client Libraries -->
<?php
$extraScripts = [
    '/assets/vendor/qpdf/qpdf.js',
    '/assets/js/qpdf-client.js?v=' . APP_VERSION,
    '/assets/js/tools/unlock-pdf.js?v=' . APP_VERSION,
];
require_once __DIR__ . '/../includes/footer.php';
?>
