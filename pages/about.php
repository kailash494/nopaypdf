<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/seo.php';
require_once __DIR__ . '/../includes/ad-slots.php';

$pageMeta = [
    'title' => 'About Us - 100% In-Browser Privacy Architecture | ' . SITE_NAME,
    'description' => 'Learn about NoPayPDF\'s mission, open-source technology stack, and privacy-first architecture where all PDF processing executes locally in your browser with zero server uploads.',
    'canonical' => SITE_URL . '/about',
    'type' => 'website',
];

require_once __DIR__ . '/../includes/header.php';
?>

<section class="py-12 sm:py-16 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <!-- Breadcrumb -->
        <nav class="flex items-center justify-center gap-2 text-xs text-slate-500 mb-4" aria-label="Breadcrumb">
            <a href="/" class="hover:text-blue-600 transition-colors">Home</a>
            <span class="text-slate-300">/</span>
            <span class="text-slate-900 font-semibold">About Us</span>
        </nav>

        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            About <span class="text-blue-600">NoPayPDF</span>
        </h1>
        <p class="mt-4 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Reinventing online document utilities with absolute privacy, zero-latency local processing, and open-source transparency.
        </p>

        <!-- Privacy Badge -->
        <div class="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold shadow-xs select-none">
            <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
            <span>100% Client-Side &bull; Zero Server Uploads &bull; Free & Open</span>
        </div>
    </div>
</section>

<section class="py-12 sm:py-16 bg-white">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

        <!-- Mission Statement -->
        <div class="space-y-4">
            <h2 class="text-2xl font-bold text-slate-900">Our Mission</h2>
            <p class="text-sm sm:text-base text-slate-600 leading-relaxed">
                Every day, millions of individuals and businesses need to merge contracts, fill tax forms, compress invoices, or extract text from scans. Traditional online PDF services require uploading these confidential documents to remote cloud servers, exposing sensitive financial, legal, and personal information to third-party data breaches, compliance liabilities, and unauthorized tracking.
            </p>
            <p class="text-sm sm:text-base text-slate-600 leading-relaxed">
                <strong>NoPayPDF was founded on a simple principle:</strong> Your documents belong to you. By harnessing cutting-edge browser technologies like WebAssembly, HTML5 Canvas, and modern Web Workers, NoPayPDF performs every PDF operation directly inside your web browser. Your files never leave your computer or phone, eliminating security risks while delivering instantaneous results without upload delays.
            </p>
        </div>

        <!-- Architectural Comparison Grid -->
        <div class="space-y-4">
            <h2 class="text-2xl font-bold text-slate-900">How NoPayPDF Compares</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Traditional Cloud Services -->
                <div class="p-6 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-3">
                    <div class="flex items-center gap-2 text-rose-700 font-bold text-sm">
                        <i data-lucide="cloud-off" class="w-5 h-5"></i>
                        <span>Traditional Cloud PDF Converters</span>
                    </div>
                    <ul class="text-xs sm:text-sm text-rose-900/80 space-y-2 list-disc list-inside">
                        <li>Uploads full document bytes across the public internet.</li>
                        <li>Stores files in remote server queues and temporary directories.</li>
                        <li>Subject to slow upload speeds and strict file size limits.</li>
                        <li>Vulnerable to server downtime and remote data breaches.</li>
                        <li>Restricted by daily limits or aggressive paywalls.</li>
                    </ul>
                </div>

                <!-- NoPayPDF Client-Side Model -->
                <div class="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                    <div class="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                        <i data-lucide="shield-check" class="w-5 h-5"></i>
                        <span>NoPayPDF Client-Side Architecture</span>
                    </div>
                    <ul class="text-xs sm:text-sm text-emerald-900/80 space-y-2 list-disc list-inside">
                        <li><strong>0 Bytes Uploaded:</strong> Files stay in your local device RAM.</li>
                        <li><strong>Zero Server Storage:</strong> No server-side databases or temp disks.</li>
                        <li><strong>Instant Speed:</strong> Zero network latency or upload lag.</li>
                        <li><strong>Full Offline Capability:</strong> Works reliably on weak connections.</li>
                        <li><strong>Completely Free:</strong> Unlimited use with no subscription walls.</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Four Core Tool Categories -->
        <div class="space-y-6">
            <h2 class="text-2xl font-bold text-slate-900">Our Comprehensive Tool Suite</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div class="p-5 rounded-2xl border border-slate-200/90 bg-slate-50 space-y-2">
                    <div class="flex items-center gap-2 text-blue-600 font-bold text-sm">
                        <i data-lucide="layout-grid" class="w-4 h-4"></i>
                        <span>Organize & Manage</span>
                    </div>
                    <p class="text-xs text-slate-600 leading-relaxed">
                        Merge multiple PDFs into a single file, split pages or custom ranges into individual documents, and reorder, rotate, or delete pages with live visual previews.
                    </p>
                </div>

                <div class="p-5 rounded-2xl border border-slate-200/90 bg-slate-50 space-y-2">
                    <div class="flex items-center gap-2 text-blue-600 font-bold text-sm">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        <span>Convert & Transform</span>
                    </div>
                    <p class="text-xs text-slate-600 leading-relaxed">
                        Convert PDF pages into high-resolution JPG or PNG images, assemble image galleries into clean unified PDFs, and convert rich HTML or formatted notes into printable documents.
                    </p>
                </div>

                <div class="p-5 rounded-2xl border border-slate-200/90 bg-slate-50 space-y-2">
                    <div class="flex items-center gap-2 text-blue-600 font-bold text-sm">
                        <i data-lucide="lock" class="w-4 h-4"></i>
                        <span>Security & Layout</span>
                    </div>
                    <p class="text-xs text-slate-600 leading-relaxed">
                        Compress file sizes with lossless QPDF streams or visual optimization, encrypt documents with AES-256 passwords, remove owner restrictions, add watermarks, and insert headers and footers.
                    </p>
                </div>

                <div class="p-5 rounded-2xl border border-slate-200/90 bg-slate-50 space-y-2">
                    <div class="flex items-center gap-2 text-blue-600 font-bold text-sm">
                        <i data-lucide="pen-tool" class="w-4 h-4"></i>
                        <span>Visual Editor & OCR</span>
                    </div>
                    <p class="text-xs text-slate-600 leading-relaxed">
                        Sign documents with custom drawing/typing studios, add annotations, highlights, and whiteout boxes, convert color PDFs to printer-friendly monochrome grayscale, trim page margins, and perform client-side OCR.
                    </p>
                </div>

            </div>
        </div>

        <!-- Open Source & Licensing -->
        <div class="space-y-4 pt-6 border-t border-slate-200">
            <h2 class="text-2xl font-bold text-slate-900">Open-Source & Transparent</h2>
            <p class="text-sm sm:text-base text-slate-600 leading-relaxed">
                NoPayPDF is built exclusively using permissively licensed (MIT, Apache 2.0, and ISC) open-source software. We believe in complete transparency and publish our full dependency list and copyright attributions on our <a href="/licenses" class="text-blue-600 hover:underline font-semibold">Open-Source Licenses page</a>.
            </p>
            <div class="flex flex-wrap gap-3 pt-2">
                <a href="/privacy-policy" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors">
                    Privacy Policy &rarr;
                </a>
                <a href="/licenses" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors">
                    View Library Licenses &rarr;
                </a>
                <a href="/contact" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors">
                    Contact Us &rarr;
                </a>
            </div>
        </div>

    </div>
</section>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
