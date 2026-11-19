<?php
declare(strict_types=1);

/**
 * PDFToolKit - Ad Container Slots & Layout Stability (CLS Prevention)
 *
 * Fixed container heights prevent Cumulative Layout Shift (CLS) when third-party ad scripts load.
 * Generous margins prevent accidental clicks next to action buttons, adhering to AdSense policies.
 */

require_once __DIR__ . '/config.php';

function render_ad_slot(string $slot): void
{
    if (!defined('ADS_ENABLED') || !ADS_ENABLED) {
        return;
    }

    $slotConfigs = [
        'top-banner' => [
            'id' => 'ad-slot-top-banner',
            'minHeightClass' => 'min-h-[90px]',
            'maxWidthClass' => 'max-w-5xl',
            'label' => 'Header Leaderboard (728x90 / Responsive)',
            'containerMargin' => 'my-4',
        ],
        'in-tool' => [
            'id' => 'ad-slot-in-tool',
            'minHeightClass' => 'min-h-[250px]',
            'maxWidthClass' => 'max-w-3xl',
            'label' => 'In-Tool Responsive Rectangle (300x250 / 728x90)',
            'containerMargin' => 'my-8',
        ],
        'bottom-banner' => [
            'id' => 'ad-slot-bottom-banner',
            'minHeightClass' => 'min-h-[90px]',
            'maxWidthClass' => 'max-w-5xl',
            'label' => 'Bottom Leaderboard (728x90 / Responsive)',
            'containerMargin' => 'my-6',
        ],
    ];

    $config = $slotConfigs[$slot] ?? [
        'id' => 'ad-slot-' . htmlspecialchars($slot, ENT_QUOTES, 'UTF-8'),
        'minHeightClass' => 'min-h-[90px]',
        'maxWidthClass' => 'max-w-4xl',
        'label' => 'Responsive Ad Slot',
        'containerMargin' => 'my-6',
    ];
    ?>
    <aside class="ad-slot-wrapper w-full flex flex-col items-center justify-center <?= $config['containerMargin'] ?> px-4" aria-label="Advertisement">
        <span class="text-[10px] uppercase tracking-wider text-slate-400 mb-1 font-medium">Advertisement</span>
        <div id="<?= $config['id'] ?>" class="ad-slot-container w-full <?= $config['maxWidthClass'] ?> <?= $config['minHeightClass'] ?> bg-slate-50/80 border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400 text-center transition-all">
            <!-- Google AdSense Slot Hook: <?= htmlspecialchars($slot, ENT_QUOTES, 'UTF-8') ?> -->
            <!--
            <ins class="adsbygoogle"
                 style="display:block"
                 data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
                 data-ad-slot="XXXXXXXXXX"
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
            <script>
                 (adsbygoogle = window.adsbygoogle || []).push({});
            </script>
            -->
            <div class="p-4 flex flex-col items-center gap-1 select-none pointer-events-none">
                <span class="font-medium text-slate-500"><?= htmlspecialchars($config['label'], ENT_QUOTES, 'UTF-8') ?></span>
                <span class="text-[11px] text-slate-400">Reserved CLS-safe container &bull; No user PDF data is ever tracked</span>
            </div>
        </div>
    </aside>
    <?php
}
