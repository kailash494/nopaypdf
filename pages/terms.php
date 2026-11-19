<?php
declare(strict_types=1);

/**
 * PDFToolKit - Terms of Service
 */

require_once __DIR__ . '/../includes/config.php';

$pageMeta = [
    'title' => 'Terms of Service | ' . SITE_NAME,
    'description' => 'Review the terms of use, acceptable use policy, and disclaimers for using PDFToolKit.',
    'canonical' => SITE_URL . '/terms',
];

require_once __DIR__ . '/../includes/header.php';
?>

<div class="py-12 sm:py-16 bg-white border-b border-slate-200">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Breadcrumb -->
        <nav class="flex items-center gap-2 text-xs text-slate-500 mb-6">
            <a href="/" class="hover:text-blue-600">Home</a>
            <span>/</span>
            <span class="text-slate-800 font-medium">Terms of Service</span>
        </nav>

        <h1 class="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Terms of Service</h1>
        <p class="text-xs text-slate-500 mt-2">Effective Date: <?= date('F j, Y') ?> &bull; Version <?= APP_VERSION ?></p>

        <div class="mt-8 prose prose-slate max-w-none text-sm text-slate-700 leading-relaxed space-y-6">
            <section>
                <h2 class="text-lg font-bold text-slate-900 mb-2">1. Agreement to Terms</h2>
                <p>
                    By accessing or using <strong><?= htmlspecialchars(SITE_NAME, ENT_QUOTES, 'UTF-8') ?></strong>, you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not use our services.
                </p>
            </section>

            <section>
                <h2 class="text-lg font-bold text-slate-900 mb-2">2. Description of Service</h2>
                <p>
                    <?= htmlspecialchars(SITE_NAME, ENT_QUOTES, 'UTF-8') ?> provides a suite of browser-based document utilities that execute entirely client-side on your device. We do not store, view, or retain copies of your documents. The service is provided free of charge for personal and commercial use.
                </p>
            </section>

            <section>
                <h2 class="text-lg font-bold text-slate-900 mb-2">3. Acceptable Use Policy</h2>
                <p>You agree not to use the service to:</p>
                <ul class="list-disc pl-5 mt-2 space-y-1">
                    <li>Process documents containing malicious code, automated exploits, or unauthorized software.</li>
                    <li>Attempt to disrupt, overload, or compromise the technical infrastructure or availability of the website.</li>
                    <li>Violate copyright, intellectual property, or confidentiality obligations owed to third parties.</li>
                </ul>
            </section>

            <section>
                <h2 class="text-lg font-bold text-slate-900 mb-2">4. Disclaimer of Warranties ("As-Is")</h2>
                <p>
                    <?= htmlspecialchars(SITE_NAME, ENT_QUOTES, 'UTF-8') ?> and its software utilities are provided on an <strong>"as-is" and "as-available"</strong> basis without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not guarantee that document conversions or manipulations will be error-free or uninterrupted.
                </p>
            </section>

            <section>
                <h2 class="text-lg font-bold text-slate-900 mb-2">5. Limitation of Liability</h2>
                <p>
                    To the fullest extent permitted by applicable law, in no event shall <?= htmlspecialchars(SITE_NAME, ENT_QUOTES, 'UTF-8') ?>, its creators, or operators be liable for any direct, indirect, incidental, consequential, special, or exemplary damages (including loss of data, loss of business profits, or business interruption) arising out of or in connection with the use of, or inability to use, our service.
                </p>
            </section>

            <section>
                <h2 class="text-lg font-bold text-slate-900 mb-2">6. Modifications to Terms</h2>
                <p>
                    We reserve the right to revise these Terms of Service at any time. Changes become effective immediately upon posting to this page. Your continued use of the website following changes constitutes acceptance of the modified terms.
                </p>
            </section>

            <section>
                <h2 class="text-lg font-bold text-slate-900 mb-2">7. Contact</h2>
                <p>
                    For questions regarding these Terms, please contact us at:
                    <br>
                    <strong class="text-slate-900"><?= htmlspecialchars(CONTACT_EMAIL, ENT_QUOTES, 'UTF-8') ?></strong>
                </p>
            </section>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
