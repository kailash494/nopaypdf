<?php
declare(strict_types=1);

/**
 * NoPayPDF - Homepage & Tool Directory
 */

require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/tool-registry.php';

$allTools = get_all_tools();
$categories = get_tool_categories();

// Page metadata & FAQs for SEO & Schema.org JSON-LD
$faqs = [
    [
        'q' => 'Are my PDF documents uploaded to your servers?',
        'a' => 'No. NoPayPDF executes 100% of PDF processing locally inside your web browser using client-side JavaScript. Your confidential files never leave your device or travel across any network.'
    ],
    [
        'q' => 'Is NoPayPDF completely free to use?',
        'a' => 'Yes. All tools are 100% free with no hidden fees, subscriptions, watermark additions, or file count restrictions.'
    ],
    [
        'q' => 'What is the maximum file size I can process?',
        'a' => 'Because files are processed directly in your device\'s memory rather than uploaded to a remote server, limits depend solely on your computer or phone\'s available memory. Most modern devices comfortably process documents up to 150MB+.'
    ],
    [
        'q' => 'Can I use NoPayPDF on mobile devices?',
        'a' => 'Yes. NoPayPDF is fully responsive and compatible with all modern mobile and desktop browsers including Chrome, Safari, Firefox, and Edge.'
    ],
    [
        'q' => 'Do I need to install any software or extensions?',
        'a' => 'No installation or plugins are required. Everything runs immediately inside your standard web browser.'
    ]
];

$pageMeta = [
    'title' => 'NoPayPDF - 100% Free & Private Online PDF Tools (No Uploads)',
    'description' => 'Merge, split, compress, convert, and edit PDF documents directly in your web browser. 100% private with zero file uploads and unlimited free access.',
    'canonical' => SITE_URL . '/',
    'is_homepage' => true,
    'faqs' => $faqs,
];

require_once __DIR__ . '/includes/header.php';
?>

<!-- Hero Section -->
<section class="relative overflow-hidden py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <!-- Privacy Badge -->
        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-6 shadow-sm">
            <i data-lucide="shield-check" class="w-4 h-4 text-blue-600"></i>
            <span>Zero Server Uploads &bull; 100% Client-Side Privacy</span>
        </div>

        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Every PDF Tool You Need, <br class="hidden sm:inline">
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                100% Private in Your Browser
            </span>
        </h1>

        <p class="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Merge, split, compress, convert, protect, and edit your PDF files locally on your machine.
            Your sensitive documents never leave your computer or touch our servers.
        </p>

        <!-- Search Bar with Live Filter -->
        <div class="mt-8 max-w-xl mx-auto">
            <div class="relative flex items-center">
                <i data-lucide="search" class="w-5 h-5 absolute left-4 text-slate-400 pointer-events-none"></i>
                <input
                    type="text"
                    id="tool-search-input"
                    placeholder="Search by tool name (e.g. merge, split, compress, watermark)..."
                    class="w-full pl-12 pr-4 py-3.5 text-sm sm:text-base bg-white border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    aria-label="Search tools"
                >
                <button
                    type="button"
                    id="tool-search-clear"
                    class="hidden absolute right-3 p-1.5 text-slate-400 hover:text-slate-600"
                    aria-label="Clear search"
                >
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        </div>

        <!-- Trust Mini-Grid -->
        <div class="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium text-slate-600 max-w-3xl mx-auto">
            <div class="flex items-center justify-center gap-2 p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs">
                <i data-lucide="lock" class="w-4 h-4 text-emerald-600"></i>
                <span>No File Uploads</span>
            </div>
            <div class="flex items-center justify-center gap-2 p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs">
                <i data-lucide="zap" class="w-4 h-4 text-amber-500"></i>
                <span>Instant Processing</span>
            </div>
            <div class="flex items-center justify-center gap-2 p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs">
                <i data-lucide="infinity" class="w-4 h-4 text-blue-600"></i>
                <span>Unlimited & Free</span>
            </div>
            <div class="flex items-center justify-center gap-2 p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs">
                <i data-lucide="check-circle-2" class="w-4 h-4 text-indigo-600"></i>
                <span>No Watermarks</span>
            </div>
        </div>
    </div>
</section>

<!-- Tools Directory Section -->
<section id="tools-section" class="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
    <!-- Flagship Feature Banner: Full PDF Editor -->
    <div class="mb-10 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="space-y-2 max-w-2xl text-center md:text-left">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
                <i data-lucide="sparkles" class="w-3.5 h-3.5 text-blue-400"></i>
                <span>Flagship In-Browser Editor</span>
            </div>
            <h2 class="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight">
                Direct In-Browser PDF Text Editor & Forms
            </h2>
            <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Directly edit existing text, add signatures, create AcroForm fields, insert clickable links, and redact sensitive data with zero server uploads and 100% private in-memory processing.
            </p>
        </div>
        <a
            href="/edit-pdf/"
            class="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2 shrink-0 group"
        >
            <span>Open PDF Editor</span>
            <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-0.5 transition-transform"></i>
        </a>
    </div>

    <!-- Category Filter Pills -->
    <div class="flex items-center justify-center flex-wrap gap-2 mb-10">
        <?php foreach ($categories as $index => $cat): ?>
            <button
                type="button"
                data-category="<?= htmlspecialchars(strtolower($cat), ENT_QUOTES, 'UTF-8') ?>"
                class="category-filter-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all <?= $index === 0 ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200' ?>"
            >
                <?= htmlspecialchars($cat, ENT_QUOTES, 'UTF-8') ?>
            </button>
        <?php endforeach; ?>
    </div>

    <!-- Tool Cards Grid -->
    <div id="tools-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <?php foreach ($allTools as $slug => $tool): 
            $isActive = ($tool['status'] === 'active');
            $cardUrl = $isActive ? '/' . htmlspecialchars($slug, ENT_QUOTES, 'UTF-8') . '/' : '#';
        ?>
            <div
                class="tool-card group bg-white rounded-2xl border border-slate-200/90 p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all relative overflow-hidden"
                data-name="<?= htmlspecialchars(strtolower($tool['name']), ENT_QUOTES, 'UTF-8') ?>"
                data-desc="<?= htmlspecialchars(strtolower($tool['short_desc']), ENT_QUOTES, 'UTF-8') ?>"
                data-category="<?= htmlspecialchars(strtolower($tool['category']), ENT_QUOTES, 'UTF-8') ?>"
            >
                <div>
                    <!-- Icon & Status Badge -->
                    <div class="flex items-start justify-between mb-4">
                        <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <i data-lucide="<?= htmlspecialchars($tool['icon'], ENT_QUOTES, 'UTF-8') ?>" class="w-6 h-6"></i>
                        </div>
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                        </span>
                    </div>

                    <!-- Tool Name -->
                    <h3 class="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        <?= htmlspecialchars($tool['name'], ENT_QUOTES, 'UTF-8') ?>
                    </h3>

                    <!-- Tool Description -->
                    <p class="text-xs text-slate-600 mt-2 leading-relaxed">
                        <?= htmlspecialchars($tool['short_desc'], ENT_QUOTES, 'UTF-8') ?>
                    </p>
                </div>

                <!-- Card Action Footer -->
                <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span class="text-slate-400 font-medium"><?= htmlspecialchars($tool['category'], ENT_QUOTES, 'UTF-8') ?></span>
                    <?php if ($isActive): ?>
                        <a href="<?= $cardUrl ?>" class="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700">
                            <span>Open Tool</span>
                            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                        </a>
                    <?php else: ?>
                        <span class="text-slate-400 font-medium italic">Phase <?= (int)$tool['phase'] ?></span>
                    <?php endif; ?>
                </div>
            </div>
        <?php endforeach; ?>
    </div>

    <!-- Empty State for Search Filter -->
    <div id="no-tools-found" class="hidden text-center py-12">
        <div class="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <i data-lucide="search-x" class="w-6 h-6"></i>
        </div>
        <h4 class="text-sm font-semibold text-slate-800">No matching tools found</h4>
        <p class="text-xs text-slate-500 mt-1">Try searching with a different term or selecting another category.</p>
        <button type="button" id="reset-filters-btn" class="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            Reset All Filters
        </button>
    </div>
</section>

<!-- "Why Browser-Based PDF Processing?" Trust & Architecture Strip -->
<section class="py-16 bg-white border-y border-slate-200">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
            <h2 class="text-2xl sm:text-3xl font-bold text-slate-900">Why Browser-Based PDF Processing?</h2>
            <p class="text-sm text-slate-600 mt-2 max-w-xl mx-auto">
                Modern web browsers have the power to run complex document computations locally without sacrificing your privacy or network bandwidth.
            </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="p-6 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                    <i data-lucide="lock" class="w-5 h-5"></i>
                </div>
                <h3 class="text-base font-bold text-slate-900">Absolute Confidentiality</h3>
                <p class="text-xs text-slate-600 mt-2 leading-relaxed">
                    Financial statements, medical records, and signed legal agreements never touch third-party servers. Your data stays on your machine where it belongs.
                </p>
            </div>

            <div class="p-6 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                    <i data-lucide="zap" class="w-5 h-5"></i>
                </div>
                <h3 class="text-base font-bold text-slate-900">Zero Upload Delay</h3>
                <p class="text-xs text-slate-600 mt-2 leading-relaxed">
                    Say goodbye to waiting for slow 50MB file uploads and downloads. File processing starts immediately as soon as you drop your document.
                </p>
            </div>

            <div class="p-6 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4">
                    <i data-lucide="wifi-off" class="w-5 h-5"></i>
                </div>
                <h3 class="text-base font-bold text-slate-900">Low Bandwidth Usage</h3>
                <p class="text-xs text-slate-600 mt-2 leading-relaxed">
                    Because processing is performed locally by your computer's JavaScript engine, you conserve valuable internet data while working.
                </p>
            </div>
        </div>
    </div>
</section>

<!-- Frequently Asked Questions (FAQ) Section -->
<section class="py-16 bg-slate-50">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-10">
            <h2 class="text-2xl sm:text-3xl font-bold text-slate-900">Frequently Asked Questions</h2>
            <p class="text-xs sm:text-sm text-slate-600 mt-1">Everything you need to know about NoPayPDF and our client-side architecture.</p>
        </div>

        <div class="space-y-4">
            <?php foreach ($faqs as $index => $faq): ?>
                <details class="group bg-white rounded-xl border border-slate-200 p-5 open:shadow-xs transition-all cursor-pointer">
                    <summary class="flex items-center justify-between font-semibold text-sm sm:text-base text-slate-900 select-none">
                        <span><?= htmlspecialchars($faq['q'], ENT_QUOTES, 'UTF-8') ?></span>
                        <span class="ml-4 flex-shrink-0 text-slate-400 group-open:rotate-180 transition-transform">
                            <i data-lucide="chevron-down" class="w-5 h-5"></i>
                        </span>
                    </summary>
                    <p class="text-xs sm:text-sm text-slate-600 mt-3 pt-3 border-t border-slate-100 leading-relaxed cursor-text">
                        <?= htmlspecialchars($faq['a'], ENT_QUOTES, 'UTF-8') ?>
                    </p>
                </details>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<!-- Interactive Filter & Search Script -->
<script>
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('tool-search-input');
    const clearBtn = document.getElementById('tool-search-clear');
    const filterButtons = document.querySelectorAll('.category-filter-btn');
    const toolCards = document.querySelectorAll('.tool-card');
    const emptyState = document.getElementById('no-tools-found');
    const resetBtn = document.getElementById('reset-filters-btn');

    let activeCategory = 'all';
    let searchQuery = '';

    const filterTools = () => {
        let visibleCount = 0;

        toolCards.forEach(card => {
            const cardName = card.getAttribute('data-name') || '';
            const cardDesc = card.getAttribute('data-desc') || '';
            const cardCat = card.getAttribute('data-category') || '';

            const matchesCategory = (activeCategory === 'all' || cardCat === activeCategory);
            const matchesSearch = !searchQuery || cardName.includes(searchQuery) || cardDesc.includes(searchQuery);

            if (matchesCategory && matchesSearch) {
                card.style.display = 'flex';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        if (visibleCount === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
        }
    };

    // Category button handling
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            filterButtons.forEach(b => {
                b.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
                b.classList.add('bg-white', 'text-slate-700', 'border', 'border-slate-200');
            });
            this.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
            this.classList.remove('bg-white', 'text-slate-700', 'border-slate-200');

            activeCategory = this.getAttribute('data-category') || 'all';
            filterTools();
        });
    });

    // Search input handling
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            searchQuery = this.value.trim().toLowerCase();
            if (searchQuery.length > 0) {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
            }
            filterTools();
        });
    }

    // Clear search button
    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            searchInput.value = '';
            searchQuery = '';
            clearBtn.classList.add('hidden');
            searchInput.focus();
            filterTools();
        });
    }

    // Reset button
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            searchInput.value = '';
            searchQuery = '';
            clearBtn.classList.add('hidden');
            const allBtn = document.querySelector('.category-filter-btn[data-category="all"]');
            if (allBtn) {
                allBtn.click();
            }
        });
    }

    // Check URL parameters (e.g. ?cat=organize or ?q=merge)
    const urlParams = new URLSearchParams(window.location.search);
    const catParam = urlParams.get('cat');
    const qParam = urlParams.get('q');

    if (catParam) {
        const matchingBtn = document.querySelector(`.category-filter-btn[data-category="${catParam.toLowerCase()}"]`);
        if (matchingBtn) matchingBtn.click();
    }
    if (qParam && searchInput) {
        searchInput.value = qParam;
        searchQuery = qParam.toLowerCase();
        clearBtn.classList.remove('hidden');
        filterTools();
    }
});
</script>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
