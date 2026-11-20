<?php
declare(strict_types=1);

/**
 * NoPayPDF - Shared Tool Layout Partials
 * Renders standardized hero headers, breadcrumbs, how-to guides, and SEO FAQs.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/tool-registry.php';

function render_tool_hero(array $tool): void
{
    $category = $tool['category'] ?? 'Tools';
    $name = $tool['name'] ?? 'PDF Tool';
    $desc = $tool['short_desc'] ?? '';
    ?>
    <section class="py-10 sm:py-14 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <!-- Breadcrumb Navigation -->
            <nav class="flex items-center justify-center gap-2 text-xs text-slate-500 mb-4" aria-label="Breadcrumb">
                <a href="/" class="hover:text-blue-600 transition-colors">Home</a>
                <span class="text-slate-300">/</span>
                <a href="/#tools-section" data-cat="<?= htmlspecialchars(strtolower($category), ENT_QUOTES, 'UTF-8') ?>" class="hover:text-blue-600 transition-colors">
                    <?= htmlspecialchars($category, ENT_QUOTES, 'UTF-8') ?>
                </a>
                <span class="text-slate-300">/</span>
                <span class="text-slate-900 font-semibold"><?= htmlspecialchars($name, ENT_QUOTES, 'UTF-8') ?></span>
            </nav>

            <!-- Hero Heading -->
            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                <?= htmlspecialchars($name, ENT_QUOTES, 'UTF-8') ?>
            </h1>

            <p class="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
                <?= htmlspecialchars($desc, ENT_QUOTES, 'UTF-8') ?>
            </p>

            <!-- Privacy Trust Pill -->
            <div class="mt-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold shadow-xs select-none">
                <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
                <span>100% In-Browser Privacy &bull; Zero Server Uploads</span>
            </div>
        </div>
    </section>
    <?php
}

function render_tool_seo_sections(array $howToSteps, array $faqs, string $currentSlug): void
{
    $allTools = get_all_tools();
    ?>
    <!-- Step-by-Step Guide Section -->
    <section class="py-14 bg-white border-t border-slate-200">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-10">
                <h2 class="text-2xl font-bold text-slate-900">How to Use This Tool</h2>
                <p class="text-xs sm:text-sm text-slate-600 mt-1">Simple 3-step process performed 100% on your device.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <?php foreach ($howToSteps as $idx => $step): ?>
                    <div class="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 relative">
                        <span class="w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center mb-4 shadow-sm">
                            <?= $idx + 1 ?>
                        </span>
                        <h3 class="text-base font-bold text-slate-900 mb-1"><?= htmlspecialchars($step['title'], ENT_QUOTES, 'UTF-8') ?></h3>
                        <p class="text-xs text-slate-600 leading-relaxed"><?= htmlspecialchars($step['desc'], ENT_QUOTES, 'UTF-8') ?></p>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    </section>

    <!-- Frequently Asked Questions -->
    <?php if (!empty($faqs)): ?>
    <section class="py-14 bg-slate-50 border-t border-slate-200">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-10">
                <h2 class="text-2xl font-bold text-slate-900">Frequently Asked Questions</h2>
                <p class="text-xs sm:text-sm text-slate-600 mt-1">Common questions regarding privacy, compatibility, and file limits.</p>
            </div>

            <div class="space-y-3">
                <?php foreach ($faqs as $faq): ?>
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
    <?php endif; ?>

    <!-- More PDF Tools Internal Linking Strip -->
    <section class="py-14 bg-white border-t border-slate-200">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between mb-8">
                <div>
                    <h2 class="text-xl font-bold text-slate-900">Explore More PDF Tools</h2>
                    <p class="text-xs text-slate-500 mt-0.5">All running securely inside your browser.</p>
                </div>
                <a href="/#tools-section" class="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <span>View All Tools</span>
                    <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                </a>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <?php 
                $count = 0;
                foreach ($allTools as $slug => $otherTool):
                    if ($slug === $currentSlug || $count >= 4) continue;
                    $isActive = ($otherTool['status'] === 'active');
                    $linkUrl = $isActive ? '/' . htmlspecialchars($slug, ENT_QUOTES, 'UTF-8') : '/#tools-section';
                    $count++;
                ?>
                    <a href="<?= $linkUrl ?>" class="group p-4 rounded-xl border border-slate-200/90 hover:border-blue-300 hover:shadow-xs transition-all flex items-start gap-3 bg-white">
                        <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <i data-lucide="<?= htmlspecialchars($otherTool['icon'], ENT_QUOTES, 'UTF-8') ?>" class="w-4 h-4"></i>
                        </div>
                        <div class="overflow-hidden">
                            <h3 class="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                <?= htmlspecialchars($otherTool['name'], ENT_QUOTES, 'UTF-8') ?>
                            </h3>
                            <p class="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                                <?= htmlspecialchars($otherTool['short_desc'], ENT_QUOTES, 'UTF-8') ?>
                            </p>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        </div>
    </section>
    <?php
}
