<?php
declare(strict_types=1);

/**
 * PDFToolKit - Ad Container Slots & Layout Stability (CLS Prevention)
 *
 * Configurable via AD_MODE ('off' | 'placeholder' | 'adsense'):
 * - 'off': Outputs zero HTML, preventing empty grey boxes during Google AdSense site reviews.
 * - 'placeholder': Renders lightweight dev boxes to verify CLS layout stability.
 * - 'adsense': Renders production Google AdSense units using ADSENSE_PUBLISHER_ID.
 */

require_once __DIR__ . '/config.php';

function render_ad_slot(string $slot): void
{
    // If ad mode is off, output nothing
    if (defined('AD_MODE') && AD_MODE === 'off') {
        return;
    }
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

    $isAdSense = defined('AD_MODE') && AD_MODE === 'adsense' && defined('ADSENSE_PUBLISHER_ID') && !empty(ADSENSE_PUBLISHER_ID);
    $slotId = defined('ADSENSE_SLOTS') && is_array(ADSENSE_SLOTS) && isset(ADSENSE_SLOTS[$slot]) ? ADSENSE_SLOTS[$slot] : '';
    ?>
    <aside class="ad-slot-wrapper w-full flex flex-col items-center justify-center <?= $config['containerMargin'] ?> px-4 select-none" aria-label="Advertisement">
        <span class="text-[10px] uppercase tracking-wider text-slate-400 mb-1 font-medium">Advertisement</span>
        <div id="<?= $config['id'] ?>" class="ad-slot-container w-full <?= $config['maxWidthClass'] ?> <?= $config['minHeightClass'] ?> <?= $isAdSense ? 'bg-transparent overflow-hidden' : 'bg-slate-50/80 border border-dashed border-slate-200 rounded-lg' ?> flex items-center justify-center text-xs text-slate-400 text-center transition-all">
            <?php if ($isAdSense): ?>
                <ins class="adsbygoogle"
                     style="display:block;width:100%"
                     data-ad-client="<?= htmlspecialchars(ADSENSE_PUBLISHER_ID, ENT_QUOTES, 'UTF-8') ?>"
                     <?php if (!empty($slotId)): ?>data-ad-slot="<?= htmlspecialchars($slotId, ENT_QUOTES, 'UTF-8') ?>"<?php endif; ?>
                     data-ad-format="auto"
                     data-full-width-responsive="true"></ins>
                <script>
                     (adsbygoogle = window.adsbygoogle || []).push({});
                </script>
            <?php else: ?>
                <!-- Development Ad Space Placeholder (Disabled in production via AD_MODE='off') -->
                <div class="p-4 flex flex-col items-center gap-1 select-none pointer-events-none">
                    <span class="font-medium text-slate-500"><?= htmlspecialchars($config['label'], ENT_QUOTES, 'UTF-8') ?></span>
                    <span class="text-[11px] text-slate-400">Reserved CLS-safe container &bull; No user PDF data is ever tracked</span>
                </div>
            <?php endif; ?>
        </div>
    </aside>
    <?php
}
