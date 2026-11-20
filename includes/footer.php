<?php
declare(strict_types=1);

/**
 * NoPayPDF - Global Footer Template
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/ad-slots.php';
require_once __DIR__ . '/tool-registry.php';
?>
    </main>

    <!-- Bottom Leaderboard Ad Slot -->
    <?php render_ad_slot('bottom-banner'); ?>

    <!-- Comprehensive Client-Side Privacy Guarantee Strip -->
    <section class="bg-gradient-to-b from-slate-50 to-slate-100 border-t border-slate-200 py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-5xl mx-auto bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div class="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                    <i data-lucide="shield-check" class="w-8 h-8"></i>
                </div>
                <div class="flex-grow">
                    <h3 class="text-lg font-bold text-slate-900">100% Client-Side & Zero Server Uploads</h3>
                    <p class="text-sm text-slate-600 mt-1">
                        Unlike traditional cloud PDF converters that transfer your sensitive files across the internet to remote servers,
                        <strong>NoPayPDF</strong> executes all operations directly inside your web browser. Your private contracts, financial statements,
                        and personal documents never leave your computer or mobile device.
                    </p>
                </div>
                <div class="flex-shrink-0 w-full sm:w-auto">
                    <a href="/privacy-policy/" class="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
                        Read Privacy Architecture &rarr;
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Main Footer -->
    <footer class="bg-white border-t border-slate-200 text-slate-600 text-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                <!-- Brand Summary -->
                <div class="md:col-span-1 space-y-3">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                            <i data-lucide="file-check-2" class="w-4 h-4"></i>
                        </div>
                        <span class="text-lg font-bold text-slate-900">NoPay<span class="text-blue-600">PDF</span></span>
                    </div>
                    <p class="text-xs text-slate-500 leading-relaxed">
                        100% Free, private, and unlimited online PDF utility suite. No subscriptions, no sign-ups, and zero server uploads.
                    </p>
                    <div class="text-[11px] text-slate-400">
                        &copy; <?= date('Y') ?> NoPayPDF. All rights reserved.
                    </div>
                </div>

                <!-- Tool Categories Quick Navigation -->
                <div>
                    <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-900 mb-3">Organize & Convert</h4>
                    <ul class="space-y-2 text-xs">
                        <li><a href="/merge-pdf/" class="hover:text-blue-600 transition-colors">Merge PDF</a></li>
                        <li><a href="/split-pdf/" class="hover:text-blue-600 transition-colors">Split PDF</a></li>
                        <li><a href="/organize-pdf/" class="hover:text-blue-600 transition-colors">Organize Pages</a></li>
                        <li><a href="/word-to-pdf/" class="hover:text-blue-600 transition-colors">Word to PDF</a></li>
                        <li><a href="/pdf-to-jpg/" class="hover:text-blue-600 transition-colors">PDF to JPG</a></li>
                        <li><a href="/jpg-to-pdf/" class="hover:text-blue-600 transition-colors">JPG to PDF</a></li>
                    </ul>
                </div>

                <div>
                    <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-900 mb-3">Security & Optimization</h4>
                    <ul class="space-y-2 text-xs">
                        <li><a href="/compress-pdf/" class="hover:text-blue-600 transition-colors">Compress PDF</a></li>
                        <li><a href="/edit-pdf/" class="hover:text-blue-600 transition-colors">Edit PDF</a></li>
                        <li><a href="/ocr-pdf/" class="hover:text-blue-600 transition-colors">OCR PDF</a></li>
                        <li><a href="/protect-pdf/" class="hover:text-blue-600 transition-colors">Password Protect PDF</a></li>
                        <li><a href="/unlock-pdf/" class="hover:text-blue-600 transition-colors">Unlock PDF</a></li>
                        <li><a href="/watermark-pdf/" class="hover:text-blue-600 transition-colors">Add Watermark</a></li>
                    </ul>
                </div>

                <!-- Company & Trust Links -->
                <div>
                    <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-900 mb-3">About & Trust</h4>
                    <ul class="space-y-2 text-xs">
                        <li><a href="/about/" class="hover:text-blue-600 transition-colors">About NoPayPDF</a></li>
                        <li><a href="/contact/" class="hover:text-blue-600 transition-colors">Contact & Support</a></li>
                        <li><a href="/licenses/" class="hover:text-blue-600 transition-colors">Open-Source Licenses</a></li>
                        <li><a href="/privacy-policy/" class="hover:text-blue-600 transition-colors">Privacy Architecture</a></li>
                        <li><a href="/terms/" class="hover:text-blue-600 transition-colors">Terms of Service</a></li>
                        <li>
                            <button type="button" id="footer-cookie-settings-btn" class="hover:text-blue-600 transition-colors text-left cursor-pointer">
                                Cookie Preferences
                            </button>
                        </li>
                        <li><a href="/sitemap.xml" class="hover:text-blue-600 transition-colors" target="_blank" rel="noopener">XML Sitemap</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>

    <!-- GDPR / AdSense Cookie Consent Banner (Mobile Optimized & Accessible Tap Targets) -->
    <div id="cookie-consent-banner" class="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-5 bg-slate-900/95 backdrop-blur-md text-white border-t border-slate-800 shadow-2xl hidden items-center justify-between" role="dialog" aria-live="polite" aria-label="Cookie consent banner">
        <div class="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-4">
            <div class="flex items-start sm:items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="cookie" class="w-4 h-4"></i>
                </div>
                <p class="text-xs text-slate-300 leading-normal">
                    We use cookies and browser storage to support site functionality and deliver policy-compliant, non-invasive advertisements.
                    Your PDF files are <strong>never stored or tracked</strong>. Read our
                    <a href="/privacy-policy/" class="underline text-white hover:text-blue-300">Privacy Policy</a> for details.
                </p>
            </div>
            <div class="flex flex-col sm:flex-row items-center gap-2.5 flex-shrink-0 w-full sm:w-auto justify-end">
                <button type="button" id="cookie-accept-essential" class="w-full sm:w-auto px-4 py-2.5 min-h-[44px] flex items-center justify-center rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer">
                    Essential Only
                </button>
                <button type="button" id="cookie-accept-all" class="w-full sm:w-auto px-5 py-2.5 min-h-[44px] flex items-center justify-center rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-colors cursor-pointer">
                    Accept All
                </button>
                <button type="button" id="cookie-banner-close" class="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white cursor-pointer" aria-label="Dismiss banner">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="/assets/js/cookie-consent.js?v=<?= APP_VERSION ?>"></script>
    <script src="/assets/js/pdf-core.js?v=<?= APP_VERSION ?>"></script>

    <?php if (!empty($extraScripts) && is_array($extraScripts)): ?>
        <?php foreach ($extraScripts as $scriptSrc): ?>
            <script src="<?= htmlspecialchars($scriptSrc, ENT_QUOTES, 'UTF-8') ?>"></script>
        <?php endforeach; ?>
    <?php endif; ?>
    
    <script>
        function initApp() {
            // Initialize Lucide Icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            // Mobile menu toggle
            const mobileBtn = document.getElementById('mobile-menu-btn');
            const mobileMenu = document.getElementById('mobile-menu');
            if (mobileBtn && mobileMenu) {
                mobileBtn.addEventListener('click', function () {
                    mobileMenu.classList.toggle('hidden');
                });
            }

            // Footer cookie preferences button
            const cookiePrefBtn = document.getElementById('footer-cookie-settings-btn');
            if (cookiePrefBtn && window.PDFCookieConsent) {
                cookiePrefBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    window.PDFCookieConsent.openSettings();
                });
            }

            // Category link scroll and filter
            const filterFromNav = (cat) => {
                if (!cat) return;
                const pill = document.querySelector(`.category-filter-btn[data-category="${cat.toLowerCase()}"]`);
                if (pill) {
                    pill.click();
                }
            };

            document.querySelectorAll('.cat-nav-link, .mobile-cat-link, .cat-footer-link').forEach(link => {
                link.addEventListener('click', function (e) {
                    const cat = this.getAttribute('data-cat');
                    if (window.location.pathname === '/' || window.location.pathname === '/index.php') {
                        e.preventDefault();
                        filterFromNav(cat);
                        const targetSection = document.getElementById('tools-section');
                        if (targetSection) {
                            targetSection.scrollIntoView({ behavior: 'smooth' });
                        }
                        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
                            mobileMenu.classList.add('hidden');
                        }
                    }
                });
            });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initApp);
        } else {
            initApp();
        }
    </script>
</body>
</html>
