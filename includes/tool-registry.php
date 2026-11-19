<?php
declare(strict_types=1);

/**
 * PDFToolKit - Central Tool Registry
 * Single source of truth for all planned and active PDF tools across Phases 2–5.
 */

function get_tool_registry(): array
{
    static $tools = [
        // Phase 2: Organize
        'merge-pdf' => [
            'slug' => 'merge-pdf',
            'name' => 'Merge PDF',
            'short_desc' => 'Combine multiple PDF documents into a single organized file in seconds.',
            'category' => 'Organize',
            'icon' => 'files',
            'phase' => 2,
            'status' => 'coming_soon',
            'meta_title' => 'Merge PDF Files Online - Free & 100% Private | PDFToolKit',
            'meta_desc' => 'Combine PDF files in your preferred order directly in your browser. Fast, free, unlimited, and 100% private with no server uploads.',
        ],
        'split-pdf' => [
            'slug' => 'split-pdf',
            'name' => 'Split PDF',
            'short_desc' => 'Extract specific pages or divide a PDF into separate individual documents.',
            'category' => 'Organize',
            'icon' => 'scissors',
            'phase' => 2,
            'status' => 'coming_soon',
            'meta_title' => 'Split PDF Online - Extract Pages Privately | PDFToolKit',
            'meta_desc' => 'Separate PDF pages or extract custom page ranges quickly. Safe, private, and runs completely inside your browser.',
        ],
        'organize-pdf' => [
            'slug' => 'organize-pdf',
            'name' => 'Organize PDF',
            'short_desc' => 'Reorder, rotate, or delete individual pages visually with instant preview.',
            'category' => 'Organize',
            'icon' => 'layout-grid',
            'phase' => 2,
            'status' => 'coming_soon',
            'meta_title' => 'Organize & Reorder PDF Pages Online | PDFToolKit',
            'meta_desc' => 'Drag and drop to rearrange, rotate, or remove PDF pages. Fast visual page organizer running 100% in your browser.',
        ],

        // Phase 3: Convert
        'pdf-to-jpg' => [
            'slug' => 'pdf-to-jpg',
            'name' => 'PDF to JPG',
            'short_desc' => 'Convert each page of your PDF into high-resolution JPG image files.',
            'category' => 'Convert',
            'icon' => 'image',
            'phase' => 3,
            'status' => 'coming_soon',
            'meta_title' => 'Convert PDF to JPG Online - High Resolution Images | PDFToolKit',
            'meta_desc' => 'Transform PDF pages into crisp JPG images locally on your device. Zero upload required, preserving complete privacy.',
        ],
        'jpg-to-pdf' => [
            'slug' => 'jpg-to-pdf',
            'name' => 'JPG to PDF',
            'short_desc' => 'Convert JPG, PNG, and other images into a polished, unified PDF document.',
            'category' => 'Convert',
            'icon' => 'file-image',
            'phase' => 3,
            'status' => 'coming_soon',
            'meta_title' => 'Convert JPG & Images to PDF Online | PDFToolKit',
            'meta_desc' => 'Easily turn images into clean PDF documents with custom orientation and margins. Instant local conversion in your browser.',
        ],
        'html-to-pdf' => [
            'slug' => 'html-to-pdf',
            'name' => 'HTML to PDF',
            'short_desc' => 'Convert HTML code snippets, articles, or rich formatted text into clean PDF files.',
            'category' => 'Convert',
            'icon' => 'code-xml',
            'phase' => 3,
            'status' => 'coming_soon',
            'meta_title' => 'Convert HTML to PDF Online - Free & Private | PDFToolKit',
            'meta_desc' => 'Render HTML content and formatted text into downloadable PDF documents directly on your device.',
        ],

        // Phase 4: Optimize & Security
        'compress-pdf' => [
            'slug' => 'compress-pdf',
            'name' => 'Compress PDF',
            'short_desc' => 'Reduce PDF file size while preserving document visual clarity and formatting.',
            'category' => 'Optimize & Security',
            'icon' => 'file-down',
            'phase' => 4,
            'status' => 'coming_soon',
            'meta_title' => 'Compress PDF Online - Reduce File Size Privately | PDFToolKit',
            'meta_desc' => 'Optimize and shrink large PDF files quickly without losing quality. Complete in-browser compression keeps your data safe.',
        ],
        'protect-pdf' => [
            'slug' => 'protect-pdf',
            'name' => 'Protect PDF',
            'short_desc' => 'Encrypt your PDF with robust password protection to prevent unauthorized access.',
            'category' => 'Optimize & Security',
            'icon' => 'lock',
            'phase' => 4,
            'status' => 'coming_soon',
            'meta_title' => 'Password Protect PDF Online - Encrypt Documents | PDFToolKit',
            'meta_desc' => 'Add strong encryption and passwords to your PDF files securely in your web browser. No files are ever sent across the web.',
        ],
        'unlock-pdf' => [
            'slug' => 'unlock-pdf',
            'name' => 'Unlock PDF',
            'short_desc' => 'Remove password security and viewing restrictions from your authorized PDF files.',
            'category' => 'Optimize & Security',
            'icon' => 'unlock',
            'phase' => 4,
            'status' => 'coming_soon',
            'meta_title' => 'Unlock Password-Protected PDF Online | PDFToolKit',
            'meta_desc' => 'Decrypt and remove password locks from PDFs you own directly on your machine without uploading sensitive files.',
        ],
        'watermark-pdf' => [
            'slug' => 'watermark-pdf',
            'name' => 'Watermark PDF',
            'short_desc' => 'Add custom text stamps or image watermarks across every page of your PDF.',
            'category' => 'Optimize & Security',
            'icon' => 'stamp',
            'phase' => 4,
            'status' => 'coming_soon',
            'meta_title' => 'Add Watermark to PDF Online - Text & Image Stamps | PDFToolKit',
            'meta_desc' => 'Stamp confidential marks, copyright notices, or custom logos on PDF documents locally in your browser.',
        ],
        'page-numbers' => [
            'slug' => 'page-numbers',
            'name' => 'Add Page Numbers',
            'short_desc' => 'Insert customizable numbering, headers, and footers into your PDF pages.',
            'category' => 'Optimize & Security',
            'icon' => 'hash',
            'phase' => 4,
            'status' => 'coming_soon',
            'meta_title' => 'Add Page Numbers to PDF Online | PDFToolKit',
            'meta_desc' => 'Customize page numbering format, font, and position on your PDF documents with ease and complete privacy.',
        ],

        // Phase 5: Edit & OCR
        'sign-annotate-pdf' => [
            'slug' => 'sign-annotate-pdf',
            'name' => 'Sign & Annotate',
            'short_desc' => 'Draw digital signatures, insert text notes, and highlight document content.',
            'category' => 'Edit & OCR',
            'icon' => 'pen-tool',
            'phase' => 5,
            'status' => 'coming_soon',
            'meta_title' => 'Sign & Annotate PDF Online - Free Digital Signatures | PDFToolKit',
            'meta_desc' => 'Sign documents, add annotations, text callouts, and highlights right in your browser. Private and secure.',
        ],
        'grayscale-pdf' => [
            'slug' => 'grayscale-pdf',
            'name' => 'Grayscale PDF',
            'short_desc' => 'Convert color documents to crisp black and white monochrome for print economy.',
            'category' => 'Edit & OCR',
            'icon' => 'contrast',
            'phase' => 5,
            'status' => 'coming_soon',
            'meta_title' => 'Convert PDF to Black and White / Grayscale Online | PDFToolKit',
            'meta_desc' => 'Transform colorful PDFs to monochrome black and white for efficient printing and smaller storage.',
        ],
        'crop-pdf' => [
            'slug' => 'crop-pdf',
            'name' => 'Crop PDF',
            'short_desc' => 'Trim page margins, remove unwanted headers, and adjust visible canvas boundaries.',
            'category' => 'Edit & OCR',
            'icon' => 'crop',
            'phase' => 5,
            'status' => 'coming_soon',
            'meta_title' => 'Crop PDF Margins Online - Free Visual Trimmer | PDFToolKit',
            'meta_desc' => 'Trim unnecessary whitespace and adjust page margins on any PDF document in your browser.',
        ],
        'ocr-pdf' => [
            'slug' => 'ocr-pdf',
            'name' => 'OCR PDF',
            'short_desc' => 'Extract text and make scanned documents searchable right in your browser.',
            'category' => 'Edit & OCR',
            'icon' => 'scan-text',
            'phase' => 5,
            'status' => 'coming_soon',
            'meta_title' => 'OCR PDF Online - Extract Text from Scanned PDFs | PDFToolKit',
            'meta_desc' => 'Convert scanned PDF pages into selectable, searchable text with client-side optical character recognition.',
        ],
    ];

    return $tools;
}

/**
 * Return all registered tools.
 */
function get_all_tools(): array
{
    return get_tool_registry();
}

/**
 * Return tools filtered by category name.
 */
function get_tools_by_category(string $category): array
{
    $tools = get_all_tools();
    if (strtolower($category) === 'all') {
        return $tools;
    }
    return array_filter($tools, function ($tool) use ($category) {
        return strcasecmp($tool['category'], $category) === 0;
    });
}

/**
 * Retrieve a specific tool definition by slug.
 */
function get_tool_by_slug(string $slug): ?array
{
    $tools = get_all_tools();
    return $tools[$slug] ?? null;
}

/**
 * Get distinct list of tool categories.
 */
function get_tool_categories(): array
{
    return [
        'All',
        'Organize',
        'Convert',
        'Optimize & Security',
        'Edit & OCR',
    ];
}
