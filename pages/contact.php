<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/seo.php';
require_once __DIR__ . '/../includes/ad-slots.php';

$pageMeta = [
    'title' => 'Contact Us & Support | ' . SITE_NAME,
    'description' => 'Get in touch with the PDFToolKit team for support, feature requests, and bug reports. Completely free and private PDF tools running directly in your browser.',
    'canonical' => SITE_URL . '/contact',
    'type' => 'website',
];

render_seo_head($pageMeta);
require_once __DIR__ . '/../includes/header.php';
?>

<section class="py-12 sm:py-16 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <!-- Breadcrumb -->
        <nav class="flex items-center justify-center gap-2 text-xs text-slate-500 mb-4" aria-label="Breadcrumb">
            <a href="/" class="hover:text-blue-600 transition-colors">Home</a>
            <span class="text-slate-300">/</span>
            <span class="text-slate-900 font-semibold">Contact & Support</span>
        </nav>

        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Contact & Support
        </h1>
        <p class="mt-4 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Have a question, suggestion, or bug report? We would love to hear from you.
        </p>
    </div>
</section>

<section class="py-12 sm:py-16 bg-white">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

        <!-- Critical Privacy Notice Banner -->
        <div class="p-5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-3.5 text-xs sm:text-sm text-amber-950">
            <i data-lucide="shield-alert" class="w-5 h-5 text-amber-600 shrink-0 mt-0.5"></i>
            <div class="space-y-1">
                <span class="font-bold block">Important Privacy Notice regarding PDF Files:</span>
                <p class="text-amber-900/90 leading-relaxed">
                    Because PDFToolKit operates 100% inside your web browser, our support team <strong>does not have access to your documents</strong>, nor do we ever ask for them. Please <strong>do not attach or send confidential or personal PDF files</strong> when emailing us. To report an issue with a specific document, describe the error message and file properties (such as file size, page count, or PDF version) instead.
                </p>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            
            <!-- Support Channels Column -->
            <div class="space-y-6">
                <div class="space-y-2">
                    <h2 class="text-xl font-bold text-slate-900">Get in Touch</h2>
                    <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        For general inquiries, feature requests, or partnerships, reach out directly via email. We aim to respond within 24–48 business hours.
                    </p>
                </div>

                <!-- Direct Email Card -->
                <div class="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                        <i data-lucide="mail" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Official Support Email</span>
                        <a href="mailto:<?= htmlspecialchars(CONTACT_EMAIL, ENT_QUOTES, 'UTF-8') ?>" class="text-base font-bold text-blue-600 hover:text-blue-700 transition-colors">
                            <?= htmlspecialchars(CONTACT_EMAIL, ENT_QUOTES, 'UTF-8') ?>
                        </a>
                    </div>
                    <p class="text-[11px] text-slate-500">
                        Available Monday through Friday for technical support and website inquiries.
                    </p>
                </div>

                <!-- Quick Help FAQ Links -->
                <div class="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                    <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <i data-lucide="help-circle" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Self-Service Help</span>
                        <h3 class="text-sm font-bold text-slate-900 mt-0.5">Looking for answers?</h3>
                    </div>
                    <ul class="text-xs text-slate-600 space-y-2">
                        <li>
                            <a href="/privacy-policy" class="text-blue-600 hover:underline font-medium">&bull; How does browser-only PDF processing work?</a>
                        </li>
                        <li>
                            <a href="/terms" class="text-blue-600 hover:underline font-medium">&bull; Commercial and personal usage terms</a>
                        </li>
                        <li>
                            <a href="/licenses" class="text-blue-600 hover:underline font-medium">&bull; Open-source license attributions</a>
                        </li>
                    </ul>
                </div>

            </div>

            <!-- Bug Reporting Checklist Column -->
            <div class="p-6 sm:p-8 rounded-3xl border border-slate-200 bg-white shadow-xs space-y-5">
                <div class="flex items-center gap-2.5 text-slate-900 font-bold text-base">
                    <div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <i data-lucide="bug" class="w-4 h-4"></i>
                    </div>
                    <span>How to Report a Bug</span>
                </div>

                <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    If you encountered an issue or error while processing a PDF, including the following details in your email will help us diagnose and resolve it quickly:
                </p>

                <div class="space-y-3 text-xs text-slate-700">
                    <div class="flex items-start gap-2.5">
                        <div class="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">1</div>
                        <div>
                            <strong class="text-slate-900 block font-semibold">Tool Name:</strong>
                            <span>Which tool were you using (e.g. Merge PDF, OCR PDF, Crop PDF)?</span>
                        </div>
                    </div>

                    <div class="flex items-start gap-2.5">
                        <div class="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">2</div>
                        <div>
                            <strong class="text-slate-900 block font-semibold">Browser & Operating System:</strong>
                            <span>Your browser name and version (e.g. Chrome 122, Safari 17) and device OS (Windows 11, macOS, iOS, Android).</span>
                        </div>
                    </div>

                    <div class="flex items-start gap-2.5">
                        <div class="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">3</div>
                        <div>
                            <strong class="text-slate-900 block font-semibold">Error Message:</strong>
                            <span>The exact error text displayed in the red notification banner or browser console.</span>
                        </div>
                    </div>

                    <div class="flex items-start gap-2.5">
                        <div class="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">4</div>
                        <div>
                            <strong class="text-slate-900 block font-semibold">General File Characteristics:</strong>
                            <span>File size, page count, and whether the document was scanned or password-encrypted (do not attach the file).</span>
                        </div>
                    </div>
                </div>

                <div class="pt-4 border-t border-slate-100">
                    <a
                        href="mailto:<?= htmlspecialchars(CONTACT_EMAIL, ENT_QUOTES, 'UTF-8') ?>?subject=PDFToolKit%20Bug%20Report"
                        class="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <i data-lucide="mail" class="w-4 h-4"></i>
                        <span>Email Bug Report</span>
                    </a>
                </div>
            </div>

        </div>

    </div>
</section>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
