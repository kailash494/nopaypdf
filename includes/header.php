<?php
declare(strict_types=1);

/**
 * PDFToolKit - Global Header Template
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/seo.php';
require_once __DIR__ . '/ad-slots.php';
require_once __DIR__ . '/tool-registry.php';

$pageMeta = $pageMeta ?? [];
?>
<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-50 text-slate-800 antialiased">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <?php render_seo_head($pageMeta); ?>

    <!-- SVG Favicon -->
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%232563eb%22/><text y=%2268%22 x=%2250%22 font-size=%2260%22 text-anchor=%22middle%22 fill=%22white%22 font-family=%22sans-serif%22 font-weight=%22bold%22>P</text></svg>">

    <!-- Tailwind CSS v4 Play CDN -->
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    
    <!-- Custom Application Styles -->
    <link rel="stylesheet" href="/assets/css/app.css?v=<?= APP_VERSION ?>">

    <!-- Lucide Icons (ISC License) -->
    <script src="https://unpkg.com/lucide@1.48.0/dist/umd/lucide.min.js"></script>

    <style>
        /* Modern system font stack */
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
        }
    </style>
</head>
<body class="min-h-full flex flex-col bg-slate-50 text-slate-800">
    <!-- Top Announcement / Privacy Bar -->
    <div class="bg-blue-600 text-white text-xs font-medium py-1.5 px-4 text-center select-none flex items-center justify-center gap-2">
        <i data-lucide="shield-check" class="w-3.5 h-3.5 inline"></i>
        <span>100% Client-Side Privacy: Your PDF files are processed directly on your device and are never uploaded to any server.</span>
    </div>

    <!-- Navigation Header -->
    <header class="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <!-- Brand Logo -->
                <div class="flex items-center gap-3">
                    <a href="/" class="flex items-center gap-2.5 group">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
                            <i data-lucide="file-check-2" class="w-5 h-5"></i>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                                PDF<span class="text-blue-600">ToolKit</span>
                            </span>
                            <span class="text-[10px] text-slate-500 font-medium -mt-1 tracking-wide">Client-Side PDF Suite</span>
                        </div>
                    </a>
                </div>

                <!-- Desktop Category Navigation -->
                <nav class="hidden md:flex items-center space-x-1 lg:space-x-2 text-sm font-medium">
                    <a href="/#tools-section" data-cat="all" class="cat-nav-link px-3 py-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors">All Tools</a>
                    <a href="/#tools-section" data-cat="organize" class="cat-nav-link px-3 py-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors">Organize</a>
                    <a href="/#tools-section" data-cat="convert" class="cat-nav-link px-3 py-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors">Convert</a>
                    <a href="/#tools-section" data-cat="optimize & security" class="cat-nav-link px-3 py-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors">Security</a>
                    <a href="/#tools-section" data-cat="edit & ocr" class="cat-nav-link px-3 py-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors">Edit & OCR</a>
                </nav>

                <!-- Header Actions & Privacy Pill -->
                <div class="hidden sm:flex items-center gap-3">
                    <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Zero Uploads</span>
                    </div>
                </div>

                <!-- Mobile menu button -->
                <div class="flex md:hidden">
                    <button type="button" id="mobile-menu-btn" class="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none" aria-label="Toggle navigation menu">
                        <i data-lucide="menu" class="w-6 h-6"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- Mobile Navigation Drawer -->
        <div id="mobile-menu" class="hidden md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1">
            <a href="/#tools-section" data-cat="all" class="mobile-cat-link block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50">All Tools</a>
            <a href="/#tools-section" data-cat="organize" class="mobile-cat-link block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50">Organize</a>
            <a href="/#tools-section" data-cat="convert" class="mobile-cat-link block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50">Convert</a>
            <a href="/#tools-section" data-cat="optimize & security" class="mobile-cat-link block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50">Security</a>
            <a href="/#tools-section" data-cat="edit & ocr" class="mobile-cat-link block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50">Edit & OCR</a>
            <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 px-3">
                <span>100% In-Browser Privacy</span>
                <span class="text-emerald-600 font-semibold">Active</span>
            </div>
        </div>
    </header>

    <!-- Top Leaderboard Ad Slot -->
    <?php render_ad_slot('top-banner'); ?>

    <!-- Main Content Area -->
    <main class="flex-grow">
