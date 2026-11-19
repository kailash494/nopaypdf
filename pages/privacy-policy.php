<?php
declare(strict_types=1);

/**
 * PDFToolKit - Privacy Policy
 */

require_once __DIR__ . '/../includes/config.php';

$pageMeta = [
    'title' => 'Privacy Policy - 100% Client-Side Guarantee | ' . SITE_NAME,
    'description' => 'Read how PDFToolKit protects your confidentiality. All PDF documents are processed locally in your browser with zero server uploads or data retention.',
    'canonical' => SITE_URL . '/privacy-policy',
];

require_once __DIR__ . '/../includes/header.php';
?>

<div class="py-12 sm:py-16 bg-white border-b border-slate-200">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Breadcrumb -->
        <nav class="flex items-center gap-2 text-xs text-slate-500 mb-6">
            <a href="/" class="hover:text-blue-600">Home</a>
            <span>/</span>
            <span class="text-slate-800 font-medium">Privacy Policy</span>
        </nav>

        <h1 class="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
        <p class="text-xs text-slate-500 mt-2">Effective Date: <?= date('F j, Y') ?> &bull; Version <?= APP_VERSION ?></p>

        <!-- Highlights Card -->
        <div class="mt-8 p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
            <div class="flex items-start gap-4">
                <i data-lucide="shield-check" class="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5"></i>
                <div class="space-y-1 text-sm">
                    <h3 class="font-bold text-emerald-950">The PDFToolKit Zero-Upload Privacy Guarantee</h3>
                    <p class="text-emerald-800 leading-relaxed">
                        PDFToolKit was designed from the ground up to respect your confidentiality. When you use our tools to merge, split, compress, or edit PDF documents, <strong>your files are never uploaded to our servers</strong>. All processing is executed 100% locally inside your web browser.
                    </p>
                </div>
            </div>
        </div>

        <div class="mt-10 prose prose-slate max-w-none text-sm text-slate-700 leading-relaxed space-y-6">
            <section>
                <h2 class="text-lg font-bold text-slate-900 mb-2">1. Information We Do Not Collect (Your Documents)</h2>
                <p>
                    Because PDFToolKit operates entirely within your web browser using client-side JavaScript, we do not receive, transmit, inspect, store, or log any contents of the files you open or process. Your documents remain exclusively in your computer or device's temporary memory while the browser tab is open, and disappear when you close it.
                </p>
            </section>

            <section>
                <h2 class="text-lg font-bold text-slate-900 mb-2">2. Client-Side Browser Storage</h2>
                <p>
                    PDFToolKit uses your browser's local storage (such as <code>localStorage</code>) strictly to remember your site preferences (for instance, your cookie consent decisions under key <code>pdftoolkit_consent_v1</code>). No document data or personally identifiable information is stored in persistent local storage.
                </p>
            </section>

            <section>
                <h2 class="text-lg font-bold text-slate-900 mb-2">3. Third-Party Advertising & Cookies</h2>
                <p>
                    To keep PDFToolKit 100% free for everyone without charging subscriptions, we may display advertising served by third-party ad networks such as Google AdSense.
                </p>
                <ul class="list-disc pl-5 mt-2 space-y-1">
                    <li>Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to our website or other websites.</li>
                    <li>Google's use of advertising cookies enables it and its partners to serve ads to our users based on their visits to our site and/or other sites on the Internet.</li>
                    <li>Users may opt out of personalized advertising by visiting <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">Google Ads Settings</a> or <a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">aboutads.info</a>.</li>
                    <li>You can also adjust your cookie preferences anytime via the <strong>Cookie Preferences</strong> link in our website footer.</li>
                </ul>
            </section>

            <section>
                <h2 class="text-lg font-bold text-slate-900 mb-2">4. Anonymous Web Analytics & Server Logs</h2>
                <p>
                    Our web hosting servers may record standard technical server logs (including your IP address, browser type, referral URL, and timestamps) solely for security, network diagnostics, and DDoS prevention. These logs are decoupled from your file interactions, as your files never reach our web server.
                </p>
            </section>

            <section>
                <h2 class="text-lg font-bold text-slate-900 mb-2">5. User Rights (GDPR & CCPA/CPRA)</h2>
                <p>
                    Depending on your jurisdiction, you may have rights under privacy laws such as the European General Data Protection Regulation (GDPR) or the California Consumer Privacy Act (CCPA). Because we do not store personal profiles, account credentials, or uploaded documents, we maintain no database of user records to export or delete.
                </p>
            </section>

            <section>
                <h2 class="text-lg font-bold text-slate-900 mb-2">6. Contact Information</h2>
                <p>
                    If you have questions or inquiries regarding our privacy practices or architecture, please contact us at:
                    <br>
                    <strong class="text-slate-900"><?= htmlspecialchars(CONTACT_EMAIL, ENT_QUOTES, 'UTF-8') ?></strong>
                </p>
            </section>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
