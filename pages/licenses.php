<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/seo.php';
require_once __DIR__ . '/../includes/ad-slots.php';

$pageMeta = [
    'title' => 'Open-Source Licenses & Third-Party Credits | ' . SITE_NAME,
    'description' => 'Legal copyright notices, licenses, and attributions for the permissively licensed open-source libraries that power PDFToolKit client-side tools.',
    'canonical' => SITE_URL . '/licenses',
    'type' => 'website',
];

render_seo_head($pageMeta);
require_once __DIR__ . '/../includes/header.php';

$libraries = [
    [
        'name' => 'pdf-lib',
        'version' => '1.17.1',
        'license' => 'MIT License',
        'author' => 'Andrew Dillon',
        'purpose' => 'PDF document creation, page splitting, merging, watermarking, margin cropping, and encryption metadata.',
        'url' => 'https://github.com/Hopding/pdf-lib',
    ],
    [
        'name' => 'PDF.js',
        'version' => '3.11.174',
        'license' => 'Apache License 2.0',
        'author' => 'Mozilla and individual contributors',
        'purpose' => 'High-fidelity in-browser PDF rendering, thumbnail generation, canvas rasterization, and text coordinate extraction.',
        'url' => 'https://github.com/mozilla/pdf.js',
    ],
    [
        'name' => 'JSZip',
        'version' => '3.10.1',
        'license' => 'MIT License',
        'author' => 'Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso',
        'purpose' => 'Client-side ZIP archive packaging for multi-page image and split document downloads.',
        'url' => 'https://github.com/Stuk/jszip',
    ],
    [
        'name' => 'jsPDF',
        'version' => '2.5.2',
        'license' => 'MIT License',
        'author' => 'James Hall, parallax, and individual contributors',
        'purpose' => 'Client-side rendering and vector typography generation for the HTML and formatted text to PDF tool.',
        'url' => 'https://github.com/parallax/jsPDF',
    ],
    [
        'name' => 'html2canvas',
        'version' => '1.4.1',
        'license' => 'MIT License',
        'author' => 'Niklas von Hertzen',
        'purpose' => 'DOM screenshot rasterization engine utilized by jsPDF for HTML to PDF rendering.',
        'url' => 'https://github.com/niklasvh/html2canvas',
    ],
    [
        'name' => 'DOMPurify',
        'version' => '3.2.4',
        'license' => 'Apache 2.0 / MPL 2.0',
        'author' => 'Cure53 and contributors',
        'purpose' => 'Client-side sanitization of user HTML snippets prior to rendering to defend against XSS.',
        'url' => 'https://github.com/cure53/DOMPurify',
    ],
    [
        'name' => 'qpdf-wasm',
        'version' => '0.3.1',
        'license' => 'ISC License (wrapper) / Apache 2.0 (QPDF)',
        'author' => 'neslinesli93, Jay Berkenbilt (QPDF author)',
        'purpose' => 'WebAssembly build of QPDF for AES-256 PDF encryption, decryption, password checking, and lossless stream optimization.',
        'url' => 'https://github.com/neslinesli93/qpdf-wasm',
    ],
    [
        'name' => 'Fabric.js',
        'version' => '5.3.1',
        'license' => 'MIT License',
        'author' => 'Juriy Zaytsev, FabricJS contributors',
        'purpose' => 'Interactive canvas manipulation, freehand signature drawing, text annotation, and shapes for the Sign & Annotate PDF editor.',
        'url' => 'https://github.com/fabricjs/fabric.js',
    ],
    [
        'name' => 'Tesseract.js',
        'version' => '5.1.1',
        'license' => 'Apache License 2.0',
        'author' => 'Naptha and contributors',
        'purpose' => 'WebAssembly optical character recognition (OCR) engine powering multi-language client-side text extraction.',
        'url' => 'https://github.com/naptha/tesseract.js',
    ],
    [
        'name' => 'Lucide Icons',
        'version' => '1.48.0',
        'license' => 'ISC License',
        'author' => 'Lucide Contributors (based on Feather Icons)',
        'purpose' => 'Lightweight, modern vector interface icons throughout the user interface.',
        'url' => 'https://lucide.dev',
    ],
    [
        'name' => 'Liberation Fonts',
        'version' => '2.1.5',
        'license' => 'SIL Open Font License 1.1',
        'author' => 'Red Hat, Inc., Google Corp, and Liberation Project',
        'purpose' => 'Metric-compatible open-source typography (Sans, Serif, Mono) for high-fidelity client-side PDF text editing and vector embedding.',
        'url' => 'https://github.com/liberationfonts/liberation-fonts',
    ],
    [
        'name' => '@pdf-lib/fontkit',
        'version' => '1.1.1',
        'license' => 'MIT License',
        'author' => 'Devon Govett, Andrew Dillon',
        'purpose' => 'Advanced font engine for subsetting and embedding custom TrueType/OpenType fonts in PDF documents via pdf-lib.',
        'url' => 'https://github.com/Hopding/fontkit',
    ],
];
?>

<section class="py-12 sm:py-16 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <!-- Breadcrumb -->
        <nav class="flex items-center justify-center gap-2 text-xs text-slate-500 mb-4" aria-label="Breadcrumb">
            <a href="/" class="hover:text-blue-600 transition-colors">Home</a>
            <span class="text-slate-300">/</span>
            <span class="text-slate-900 font-semibold">Open-Source Licenses</span>
        </nav>

        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Open-Source Licenses & Credits
        </h1>
        <p class="mt-4 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            PDFToolKit is built on the shoulders of open-source giants. We proudly attribute all third-party libraries under their respective permissive licenses.
        </p>

        <!-- Permissive Compliance Badge -->
        <div class="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold shadow-xs select-none">
            <i data-lucide="check-circle-2" class="w-4 h-4 text-blue-600"></i>
            <span>100% Permissive Licenses &bull; MIT, Apache 2.0 & ISC &bull; No Copyleft (GPL/AGPL)</span>
        </div>
    </div>
</section>

<section class="py-12 sm:py-16 bg-white">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

        <div class="space-y-3">
            <h2 class="text-xl sm:text-2xl font-bold text-slate-900">Third-Party Software Attribution</h2>
            <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
                The following client-side libraries are bundled or loaded via verified public content delivery networks. Each library is governed by its own permissive open-source license as detailed below:
            </p>
        </div>

        <!-- Libraries Directory Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <?php foreach ($libraries as $lib): ?>
                <div class="p-6 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 hover:border-blue-300 transition-all flex flex-col justify-between space-y-4">
                    <div>
                        <div class="flex items-center justify-between gap-2 mb-2">
                            <h3 class="text-base font-bold text-slate-900"><?= htmlspecialchars($lib['name'], ENT_QUOTES, 'UTF-8') ?></h3>
                            <span class="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold text-[11px]">
                                v<?= htmlspecialchars($lib['version'], ENT_QUOTES, 'UTF-8') ?>
                            </span>
                        </div>

                        <div class="text-xs text-slate-500 font-medium mb-2">
                            <span>License: <strong><?= htmlspecialchars($lib['license'], ENT_QUOTES, 'UTF-8') ?></strong></span>
                            <span class="mx-1">&bull;</span>
                            <span>By <?= htmlspecialchars($lib['author'], ENT_QUOTES, 'UTF-8') ?></span>
                        </div>

                        <p class="text-xs text-slate-600 leading-relaxed">
                            <?= htmlspecialchars($lib['purpose'], ENT_QUOTES, 'UTF-8') ?>
                        </p>
                    </div>

                    <div class="pt-3 border-t border-slate-200/60">
                        <a
                            href="<?= htmlspecialchars($lib['url'], ENT_QUOTES, 'UTF-8') ?>"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            <span>Upstream Repository & License</span>
                            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                        </a>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>

        <!-- Standard License Text Summaries -->
        <div class="space-y-6 pt-6 border-t border-slate-200">
            <h2 class="text-xl font-bold text-slate-900">Summary of Applicable Licenses</h2>

            <!-- MIT License Notice -->
            <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2 leading-relaxed">
                <h4 class="font-bold text-slate-900 text-sm">The MIT License (MIT)</h4>
                <p>
                    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
                </p>
                <p>
                    The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
                </p>
                <p class="text-[11px] text-slate-500 uppercase tracking-wide">
                    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
                </p>
            </div>

            <!-- Apache 2.0 License Notice -->
            <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2 leading-relaxed">
                <h4 class="font-bold text-slate-900 text-sm">Apache License, Version 2.0</h4>
                <p>
                    Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at
                    <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">http://www.apache.org/licenses/LICENSE-2.0</a>.
                </p>
                <p class="text-[11px] text-slate-500 uppercase tracking-wide">
                    UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN WRITING, SOFTWARE DISTRIBUTED UNDER THE LICENSE IS DISTRIBUTED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, EITHER EXPRESS OR IMPLIED.
                </p>
            </div>
        </div>

    </div>
</section>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
