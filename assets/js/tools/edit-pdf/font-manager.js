/**
 * NoPayPDF - Font Manager Module (window.FontManager)
 *
 * Real Embedded Font Extraction & 2-Tier Matching Architecture:
 * - Tier 1: Exact original embedded font bytes from PDF.js commonObjs, verified via window.fontkit
 * - Tier 2: 40-Font Permissive Catalog (7 bundled local + 33 verified static TrueType CDN fonts, SIL OFL 1.1 / Apache 2.0)
 * 100% Client-Side. Zero commercial fonts. Permissive MIT / Apache 2.0 / SIL OFL 1.1 compatible.
 */

(function (window) {
    'use strict';

    const fontCache = new Map();
    const inFlightFetches = new Map();
    const inFlightFontFaces = new Map();
    const loadedFontVariants = new Set();
    const loadedWebFonts = new Set();
    const toastedFailures = new Set();

    const CDN_GF_MAIN = 'https://cdn.jsdelivr.net/gh/google/fonts@main/';
    const CDN_GF_PINNED = 'https://cdn.jsdelivr.net/gh/google/fonts@814345fe12e0a3ce4d2032c7f4b79e82e75119b4/';

    const STD_DEFAULTS = {
        sans: { standardRegular: 'Helvetica', standardBold: 'HelveticaBold', standardItalic: 'HelveticaOblique', standardBoldItalic: 'HelveticaBoldOblique' },
        serif: { standardRegular: 'TimesRoman', standardBold: 'TimesRomanBold', standardItalic: 'TimesRomanItalic', standardBoldItalic: 'TimesRomanBoldItalic' },
        mono: { standardRegular: 'Courier', standardBold: 'CourierBold', standardItalic: 'CourierOblique', standardBoldItalic: 'CourierBoldOblique' },
    };

    // 1. Curated 40-Font Catalog (7 Local + 33 Verified Static Non-Variable .ttf Fonts)
    const FONT_CATALOG = {
        // --- Category 1: Document & Office (7) ---
        sans: {
            key: 'sans', cssName: 'Liberation Sans', alias: 'Arial / Helvetica',
            aliases: ['arial', 'helvetica', 'helvetica neue', 'arimo', 'verdana', 'tahoma', 'sans'],
            category: 'Document & Office', localDir: 'liberation', stdFamily: 'sans',
            regular: 'LiberationSans-Regular.ttf', bold: 'LiberationSans-Bold.ttf',
            italic: 'LiberationSans-Italic.ttf', boldItalic: 'LiberationSans-BoldItalic.ttf',
        },
        serif: {
            key: 'serif', cssName: 'Liberation Serif', alias: 'Times New Roman',
            aliases: ['times', 'times new roman', 'nimbus roman', 'serif'],
            category: 'Document & Office', localDir: 'liberation', stdFamily: 'serif',
            regular: 'LiberationSerif-Regular.ttf', bold: 'LiberationSerif-Bold.ttf',
            italic: 'LiberationSerif-Italic.ttf', boldItalic: 'LiberationSerif-Bold.ttf',
        },
        mono: {
            key: 'mono', cssName: 'Liberation Mono', alias: 'Courier New',
            aliases: ['courier', 'courier new', 'consolas', 'mono'],
            category: 'Document & Office', localDir: 'liberation', stdFamily: 'mono',
            regular: 'LiberationMono-Regular.ttf', bold: 'LiberationMono-Bold.ttf',
            italic: 'LiberationMono-Regular.ttf', boldItalic: 'LiberationMono-Bold.ttf',
        },
        carlito: {
            key: 'carlito', cssName: 'Carlito', alias: 'Calibri',
            aliases: ['calibri', 'office sans'],
            category: 'Document & Office', localDir: 'carlito', stdFamily: 'sans',
            regular: 'Carlito-Regular.ttf', bold: 'Carlito-Bold.ttf',
        },
        caladea: {
            key: 'caladea', cssName: 'Caladea', alias: 'Cambria',
            aliases: ['cambria', 'office serif'],
            category: 'Document & Office', stdFamily: 'serif',
            regularUrl: `${CDN_GF_MAIN}ofl/caladea/Caladea-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/caladea/Caladea-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/caladea/Caladea-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/caladea/Caladea-BoldItalic.ttf`,
        },
        gelasio: {
            key: 'gelasio', cssName: 'Gelasio', alias: 'Georgia',
            aliases: ['georgia', 'editorial office'],
            category: 'Document & Office', stdFamily: 'serif',
            regularUrl: `${CDN_GF_PINNED}ofl/gelasio/Gelasio-Regular.ttf`,
            boldUrl: `${CDN_GF_PINNED}ofl/gelasio/Gelasio-Bold.ttf`,
            italicUrl: `${CDN_GF_PINNED}ofl/gelasio/Gelasio-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_PINNED}ofl/gelasio/Gelasio-BoldItalic.ttf`,
        },
        tinos: {
            key: 'tinos', cssName: 'Tinos', alias: 'Times Metric',
            aliases: ['times', 'times new roman', 'tinos'],
            category: 'Document & Office', stdFamily: 'serif',
            regularUrl: `${CDN_GF_MAIN}ofl/tinos/Tinos-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/tinos/Tinos-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/tinos/Tinos-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/tinos/Tinos-BoldItalic.ttf`,
        },

        // --- Category 2: Modern Sans (12) ---
        roboto: {
            key: 'roboto', cssName: 'Roboto', alias: 'Android / Clean Sans',
            aliases: ['roboto', 'clean sans'],
            category: 'Modern Sans', localDir: 'roboto', stdFamily: 'sans',
            regular: 'Roboto-Regular.ttf', bold: 'Roboto-Bold.ttf',
        },
        opensans: {
            key: 'opensans', cssName: 'Open Sans', alias: 'Segoe UI',
            aliases: ['segoe ui', 'open sans', 'trebuchet ms'],
            category: 'Modern Sans', localDir: 'opensans', stdFamily: 'sans',
            regular: 'OpenSans-Regular.ttf', bold: 'OpenSans-Bold.ttf',
        },
        lato: {
            key: 'lato', cssName: 'Lato', alias: 'Corporate / Fintech',
            aliases: ['lato', 'fintech'],
            category: 'Modern Sans', localDir: 'lato', stdFamily: 'sans',
            regular: 'Lato-Regular.ttf', bold: 'Lato-Bold.ttf',
        },
        montserrat: {
            key: 'montserrat', cssName: 'Montserrat', alias: 'Geometric',
            aliases: ['futura', 'century gothic', 'montserrat'],
            category: 'Modern Sans', stdFamily: 'sans',
            regularUrl: 'https://cdn.jsdelivr.net/gh/JulietaUla/Montserrat@master/fonts/ttf/Montserrat-Regular.ttf',
            boldUrl: 'https://cdn.jsdelivr.net/gh/JulietaUla/Montserrat@master/fonts/ttf/Montserrat-Bold.ttf',
            italicUrl: 'https://cdn.jsdelivr.net/gh/JulietaUla/Montserrat@master/fonts/ttf/Montserrat-Italic.ttf',
            boldItalicUrl: 'https://cdn.jsdelivr.net/gh/JulietaUla/Montserrat@master/fonts/ttf/Montserrat-BoldItalic.ttf',
        },
        poppins: {
            key: 'poppins', cssName: 'Poppins', alias: 'Modern Geometric',
            aliases: ['poppins', 'avenir'],
            category: 'Modern Sans', stdFamily: 'sans',
            regularUrl: `${CDN_GF_MAIN}ofl/poppins/Poppins-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/poppins/Poppins-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/poppins/Poppins-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/poppins/Poppins-BoldItalic.ttf`,
        },
        titilliumweb: {
            key: 'titilliumweb', cssName: 'Titillium Web', alias: 'Modern Technical Sans',
            aliases: ['titillium', 'clean ui sans', 'technical sans'],
            category: 'Modern Sans', stdFamily: 'sans',
            regularUrl: `${CDN_GF_MAIN}ofl/titilliumweb/TitilliumWeb-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/titilliumweb/TitilliumWeb-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/titilliumweb/TitilliumWeb-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/titilliumweb/TitilliumWeb-BoldItalic.ttf`,
        },
        dmsans: {
            key: 'dmsans', cssName: 'DM Sans', alias: 'Minimal UI',
            aliases: ['dm sans', 'inter', 'modern ui'],
            category: 'Modern Sans', stdFamily: 'sans',
            regularUrl: `${CDN_GF_PINNED}ofl/dmsans/DMSans-Regular.ttf`,
            boldUrl: `${CDN_GF_PINNED}ofl/dmsans/DMSans-Bold.ttf`,
            italicUrl: `${CDN_GF_PINNED}ofl/dmsans/DMSans-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_PINNED}ofl/dmsans/DMSans-BoldItalic.ttf`,
        },
        ptsans: {
            key: 'ptsans', cssName: 'PT Sans', alias: 'Humanist Sans',
            aliases: ['pt sans', 'humanist'],
            category: 'Modern Sans', stdFamily: 'sans',
            regularUrl: `${CDN_GF_MAIN}ofl/ptsans/PT_Sans-Web-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/ptsans/PT_Sans-Web-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/ptsans/PT_Sans-Web-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/ptsans/PT_Sans-Web-BoldItalic.ttf`,
        },
        firasans: {
            key: 'firasans', cssName: 'Fira Sans', alias: 'Readable Web Sans',
            aliases: ['fira sans', 'trebuchet ms'],
            category: 'Modern Sans', stdFamily: 'sans',
            regularUrl: `${CDN_GF_MAIN}ofl/firasans/FiraSans-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/firasans/FiraSans-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/firasans/FiraSans-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/firasans/FiraSans-BoldItalic.ttf`,
        },
        ibmplexsans: {
            key: 'ibmplexsans', cssName: 'IBM Plex Sans', alias: 'Neutral Grotesk',
            aliases: ['ibm plex', 'plex sans', 'grotesk'],
            category: 'Modern Sans', stdFamily: 'sans',
            regularUrl: `${CDN_GF_PINNED}ofl/ibmplexsans/IBMPlexSans-Regular.ttf`,
            boldUrl: `${CDN_GF_PINNED}ofl/ibmplexsans/IBMPlexSans-Bold.ttf`,
            italicUrl: `${CDN_GF_PINNED}ofl/ibmplexsans/IBMPlexSans-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_PINNED}ofl/ibmplexsans/IBMPlexSans-BoldItalic.ttf`,
        },
        notosans: {
            key: 'notosans', cssName: 'Noto Sans', alias: 'Universal Sans',
            aliases: ['noto sans', 'universal'],
            category: 'Modern Sans', stdFamily: 'sans',
            regularUrl: `${CDN_GF_PINNED}ofl/notosans/NotoSans-Regular.ttf`,
            boldUrl: `${CDN_GF_PINNED}ofl/notosans/NotoSans-Bold.ttf`,
            italicUrl: `${CDN_GF_PINNED}ofl/notosans/NotoSans-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_PINNED}ofl/notosans/NotoSans-BoldItalic.ttf`,
        },
        barlow: {
            key: 'barlow', cssName: 'Barlow', alias: 'Technical Grotesk',
            aliases: ['barlow', 'din', 'industrial'],
            category: 'Modern Sans', stdFamily: 'sans',
            regularUrl: `${CDN_GF_MAIN}ofl/barlow/Barlow-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/barlow/Barlow-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/barlow/Barlow-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/barlow/Barlow-BoldItalic.ttf`,
        },

        // --- Category 3: Classic Serif (8) ---
        merriweather: {
            key: 'merriweather', cssName: 'Merriweather', alias: 'Editorial Serif',
            aliases: ['merriweather', 'newspaper serif'],
            category: 'Classic Serif', stdFamily: 'serif',
            regularUrl: `${CDN_GF_PINNED}ofl/merriweather/Merriweather-Regular.ttf`,
            boldUrl: `${CDN_GF_PINNED}ofl/merriweather/Merriweather-Bold.ttf`,
            italicUrl: `${CDN_GF_PINNED}ofl/merriweather/Merriweather-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_PINNED}ofl/merriweather/Merriweather-BoldItalic.ttf`,
        },
        spectral: {
            key: 'spectral', cssName: 'Spectral', alias: 'Literary Serif',
            aliases: ['spectral', 'garamond'],
            category: 'Classic Serif', stdFamily: 'serif',
            regularUrl: `${CDN_GF_MAIN}ofl/spectral/Spectral-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/spectral/Spectral-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/spectral/Spectral-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/spectral/Spectral-BoldItalic.ttf`,
        },
        ptserif: {
            key: 'ptserif', cssName: 'PT Serif', alias: 'Transitional Serif',
            aliases: ['pt serif'],
            category: 'Classic Serif', stdFamily: 'serif',
            regularUrl: `${CDN_GF_MAIN}ofl/ptserif/PT_Serif-Web-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/ptserif/PT_Serif-Web-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/ptserif/PT_Serif-Web-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/ptserif/PT_Serif-Web-BoldItalic.ttf`,
        },
        notoserif: {
            key: 'notoserif', cssName: 'Noto Serif', alias: 'Universal Serif',
            aliases: ['noto serif'],
            category: 'Classic Serif', stdFamily: 'serif',
            regularUrl: `${CDN_GF_PINNED}ofl/notoserif/NotoSerif-Regular.ttf`,
            boldUrl: `${CDN_GF_PINNED}ofl/notoserif/NotoSerif-Bold.ttf`,
            italicUrl: `${CDN_GF_PINNED}ofl/notoserif/NotoSerif-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_PINNED}ofl/notoserif/NotoSerif-BoldItalic.ttf`,
        },
        librebaskerville: {
            key: 'librebaskerville', cssName: 'Libre Baskerville', alias: 'Book Serif',
            aliases: ['baskerville', 'libre baskerville', 'book'],
            category: 'Classic Serif', stdFamily: 'serif',
            regularUrl: `${CDN_GF_PINNED}ofl/librebaskerville/LibreBaskerville-Regular.ttf`,
            boldUrl: `${CDN_GF_PINNED}ofl/librebaskerville/LibreBaskerville-Bold.ttf`,
            italicUrl: `${CDN_GF_PINNED}ofl/librebaskerville/LibreBaskerville-Italic.ttf`,
        },
        zillaslab: {
            key: 'zillaslab', cssName: 'Zilla Slab', alias: 'Modern Slab Serif',
            aliases: ['zilla slab', 'slab', 'rockwell'],
            category: 'Classic Serif', stdFamily: 'serif',
            regularUrl: `${CDN_GF_MAIN}ofl/zillaslab/ZillaSlab-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/zillaslab/ZillaSlab-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/zillaslab/ZillaSlab-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/zillaslab/ZillaSlab-BoldItalic.ttf`,
        },
        cardo: {
            key: 'cardo', cssName: 'Cardo', alias: 'Classic Scholar',
            aliases: ['palatino', 'book antiqua', 'cardo'],
            category: 'Classic Serif', stdFamily: 'serif',
            regularUrl: `${CDN_GF_MAIN}ofl/cardo/Cardo-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/cardo/Cardo-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/cardo/Cardo-Italic.ttf`,
        },
        volkhov: {
            key: 'volkhov', cssName: 'Volkhov', alias: 'High-Contrast Serif',
            aliases: ['volkhov'],
            category: 'Classic Serif', stdFamily: 'serif',
            regularUrl: `${CDN_GF_MAIN}ofl/volkhov/Volkhov-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/volkhov/Volkhov-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/volkhov/Volkhov-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/volkhov/Volkhov-BoldItalic.ttf`,
        },

        // --- Category 4: Monospace (7) ---
        jetbrainsmono: {
            key: 'jetbrainsmono', cssName: 'JetBrains Mono', alias: 'Developer Mono',
            aliases: ['jetbrains', 'consolas', 'monaco', 'menlo', 'code'],
            category: 'Monospace', stdFamily: 'mono',
            regularUrl: 'https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@v2.304/fonts/ttf/JetBrainsMono-Regular.ttf',
            boldUrl: 'https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@v2.304/fonts/ttf/JetBrainsMono-Bold.ttf',
            italicUrl: 'https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@v2.304/fonts/ttf/JetBrainsMono-Italic.ttf',
            boldItalicUrl: 'https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@v2.304/fonts/ttf/JetBrainsMono-BoldItalic.ttf',
        },
        firacode: {
            key: 'firacode', cssName: 'Fira Code', alias: 'Programming Mono',
            aliases: ['fira code', 'code'],
            category: 'Monospace', stdFamily: 'mono',
            regularUrl: 'https://cdn.jsdelivr.net/gh/tonsky/FiraCode@5.2/distr/ttf/FiraCode-Regular.ttf',
            boldUrl: 'https://cdn.jsdelivr.net/gh/tonsky/FiraCode@5.2/distr/ttf/FiraCode-Bold.ttf',
        },
        inconsolata: {
            key: 'inconsolata', cssName: 'Inconsolata', alias: 'Clean Terminal',
            aliases: ['inconsolata', 'terminal', 'monospace'],
            category: 'Monospace', stdFamily: 'mono',
            regularUrl: `${CDN_GF_MAIN}ofl/inconsolata/static/Inconsolata-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/inconsolata/static/Inconsolata-Bold.ttf`,
        },
        ibmplexmono: {
            key: 'ibmplexmono', cssName: 'IBM Plex Mono', alias: 'Technical Mono',
            aliases: ['ibm plex mono'],
            category: 'Monospace', stdFamily: 'mono',
            regularUrl: `${CDN_GF_MAIN}ofl/ibmplexmono/IBMPlexMono-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/ibmplexmono/IBMPlexMono-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/ibmplexmono/IBMPlexMono-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/ibmplexmono/IBMPlexMono-BoldItalic.ttf`,
        },
        cousine: {
            key: 'cousine', cssName: 'Cousine', alias: 'Courier Metric',
            aliases: ['cousine', 'courier'],
            category: 'Monospace', stdFamily: 'mono',
            regularUrl: `${CDN_GF_MAIN}ofl/cousine/Cousine-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/cousine/Cousine-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/cousine/Cousine-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/cousine/Cousine-BoldItalic.ttf`,
        },
        courierprime: {
            key: 'courierprime', cssName: 'Courier Prime', alias: 'Screenplay Mono',
            aliases: ['courier prime', 'typewriter'],
            category: 'Monospace', stdFamily: 'mono',
            regularUrl: `${CDN_GF_MAIN}ofl/courierprime/CourierPrime-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/courierprime/CourierPrime-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/courierprime/CourierPrime-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/courierprime/CourierPrime-BoldItalic.ttf`,
        },
        spacemono: {
            key: 'spacemono', cssName: 'Space Mono', alias: 'Geometric Fixed',
            aliases: ['space mono', 'fixed'],
            category: 'Monospace', stdFamily: 'mono',
            regularUrl: `${CDN_GF_MAIN}ofl/spacemono/SpaceMono-Regular.ttf`,
            boldUrl: `${CDN_GF_MAIN}ofl/spacemono/SpaceMono-Bold.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/spacemono/SpaceMono-Italic.ttf`,
            boldItalicUrl: `${CDN_GF_MAIN}ofl/spacemono/SpaceMono-BoldItalic.ttf`,
        },

        // --- Category 5: Handwriting & Display (6) ---
        pacifico: {
            key: 'pacifico', cssName: 'Pacifico', alias: 'Brush Script',
            aliases: ['script', 'brush', 'pacifico'],
            category: 'Handwriting & Display', stdFamily: 'serif',
            regularUrl: `${CDN_GF_MAIN}ofl/pacifico/Pacifico-Regular.ttf`,
        },
        greatvibes: {
            key: 'greatvibes', cssName: 'Great Vibes', alias: 'Formal Calligraphy',
            aliases: ['calligraphy', 'signature', 'great vibes'],
            category: 'Handwriting & Display', stdFamily: 'serif',
            regularUrl: `${CDN_GF_MAIN}ofl/greatvibes/GreatVibes-Regular.ttf`,
        },
        sacramento: {
            key: 'sacramento', cssName: 'Sacramento', alias: 'Monoline Cursive',
            aliases: ['handwriting', 'monoline', 'sacramento'],
            category: 'Handwriting & Display', stdFamily: 'serif',
            regularUrl: `${CDN_GF_MAIN}ofl/sacramento/Sacramento-Regular.ttf`,
        },
        satisfy: {
            key: 'satisfy', cssName: 'Satisfy', alias: 'Signature Cursive',
            aliases: ['satisfy', 'cursive', 'signature'],
            category: 'Handwriting & Display', stdFamily: 'serif',
            regularUrl: `${CDN_GF_MAIN}apache/satisfy/Satisfy-Regular.ttf`,
        },
        bebasneue: {
            key: 'bebasneue', cssName: 'Bebas Neue', alias: 'Condensed Headline',
            aliases: ['bebas', 'headline', 'impact', 'display'],
            category: 'Handwriting & Display', stdFamily: 'sans',
            regularUrl: `${CDN_GF_MAIN}ofl/bebasneue/BebasNeue-Regular.ttf`,
        },
        dmserifdisplay: {
            key: 'dmserifdisplay', cssName: 'DM Serif Display', alias: 'Editorial Headline',
            aliases: ['dm serif', 'display serif', 'poster'],
            category: 'Handwriting & Display', stdFamily: 'serif',
            regularUrl: `${CDN_GF_MAIN}ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf`,
            italicUrl: `${CDN_GF_MAIN}ofl/dmserifdisplay/DMSerifDisplay-Italic.ttf`,
        },
    };

    const LOCAL_FONTS = FONT_CATALOG;
    const LOCAL_LIBERATION = FONT_CATALOG;

    // 2. Comprehensive Font Matcher Table
    // Normalizes proprietary and popular fonts to local bundled TrueType fonts (100% offline)
    const FONT_MATCHER_MATRIX = [
        // Metric-Compatible Replacements for Microsoft Office Fonts
        { pattern: /calibri|carlito/i, name: 'Carlito', family: 'sans', local: 'carlito' },
        { pattern: /roboto/i, name: 'Roboto', family: 'sans', local: 'roboto' },
        { pattern: /open\s*sans/i, name: 'Open Sans', family: 'sans', local: 'opensans' },
        { pattern: /segoe\s*ui|sf\s*pro|san\s*francisco|apple\s*system/i, name: 'Open Sans', family: 'sans', local: 'opensans' },
        { pattern: /lato/i, name: 'Lato', family: 'sans', local: 'lato' },
        { pattern: /inter|fintech/i, name: 'Lato', family: 'sans', local: 'lato' },

        // Standard Document & Metric Fonts
        { pattern: /arial|helvetica|helveticaneue|arimo|nimbus\s*sans/i, name: 'Liberation Sans', family: 'sans', local: 'sans' },
        { pattern: /times\s*new\s*roman|times|tinos|nimbus\s*roman/i, name: 'Liberation Serif', family: 'serif', local: 'serif' },
        { pattern: /courier\s*new|courier|cousine|nimbus\s*mono/i, name: 'Liberation Mono', family: 'mono', local: 'mono' },
        { pattern: /cambria|caladea/i, name: 'Liberation Serif', family: 'serif', local: 'serif' },
        { pattern: /georgia|gelasio/i, name: 'Liberation Serif', family: 'serif', local: 'serif' },
        { pattern: /verdana|tahoma|dejavu\s*sans/i, name: 'Liberation Sans', family: 'sans', local: 'sans' },
        { pattern: /garamond|eb\s*garamond/i, name: 'Liberation Serif', family: 'serif', local: 'serif' },
        { pattern: /palatino|book\s*antiqua/i, name: 'Liberation Serif', family: 'serif', local: 'serif' },
        { pattern: /century\s*gothic|futura|montserrat/i, name: 'Carlito', family: 'sans', local: 'carlito' },
        { pattern: /trebuchet\s*ms|fira\s*sans/i, name: 'Open Sans', family: 'sans', local: 'opensans' },
        { pattern: /consolas|menlo|monaco|fira\s*code|jetbrains\s*mono/i, name: 'Liberation Mono', family: 'mono', local: 'mono' },

        // Popular Open-Source & Web Fonts
        { pattern: /roboto\s*mono/i, name: 'Liberation Mono', family: 'mono', local: 'mono' },
        { pattern: /roboto\s*slab/i, name: 'Liberation Serif', family: 'serif', local: 'serif' },
        { pattern: /source\s*sans/i, name: 'Open Sans', family: 'sans', local: 'opensans' },
        { pattern: /source\s*serif/i, name: 'Liberation Serif', family: 'serif', local: 'serif' },
        { pattern: /source\s*code/i, name: 'Liberation Mono', family: 'mono', local: 'mono' },
        { pattern: /nunito|rubik|karla/i, name: 'Carlito', family: 'sans', local: 'carlito' },
        { pattern: /noto\s*sans/i, name: 'Roboto', family: 'sans', local: 'roboto' },
        { pattern: /noto\s*serif/i, name: 'Liberation Serif', family: 'serif', local: 'serif' },
        { pattern: /merriweather|lora|playfair/i, name: 'Liberation Serif', family: 'serif', local: 'serif' },
        { pattern: /ubuntu|pt\s*sans/i, name: 'Open Sans', family: 'sans', local: 'opensans' },
    ];

    const FontManager = {
        /**
         * Extract embedded font stream bytes directly from PDF arrayBuffer using PDF-Lib.
         * @param {ArrayBuffer} arrayBuffer
         * @returns {Promise<Map<string, Uint8Array>>}
         */
        async extractEmbeddedFonts(arrayBuffer) {
            const fontMap = new Map();
            if (!arrayBuffer || !window.PDFLib) return fontMap;
            try {
                const { PDFDocument, PDFName, decodePDFRawStream } = window.PDFLib;
                const pdfDoc = await PDFDocument.load(arrayBuffer);
                const pages = pdfDoc.getPages();

                for (const p of pages) {
                    const fontDict = p.node.Resources()?.lookup(PDFName.of('Font'));
                    if (!fontDict || typeof fontDict.entries !== 'function') continue;

                    for (const [key, fontRef] of fontDict.entries()) {
                        const fontObj = pdfDoc.context.lookup(fontRef);
                        if (!fontObj) continue;

                        let desc = null;
                        const descRef = fontObj.lookup(PDFName.of('FontDescriptor'));
                        if (descRef) {
                            desc = pdfDoc.context.lookup(descRef);
                        } else if (fontObj.lookup(PDFName.of('DescendantFonts'))) {
                            const arr = pdfDoc.context.lookup(fontObj.lookup(PDFName.of('DescendantFonts')));
                            if (arr && typeof arr.get === 'function') {
                                const df = pdfDoc.context.lookup(arr.get(0));
                                if (df) desc = pdfDoc.context.lookup(df.lookup(PDFName.of('FontDescriptor')));
                            }
                        }

                        if (desc) {
                            const baseFont = fontObj.lookup(PDFName.of('BaseFont'))?.asString() || '';
                            const clean = baseFont.replace(/^\//, '').replace(/^[A-Z]{6}\+/, '').trim().toLowerCase();
                            const raw = baseFont.replace(/^\//, '').toLowerCase();

                            const ff2 = desc.lookup(PDFName.of('FontFile2')) || desc.lookup(PDFName.of('FontFile3')) || desc.lookup(PDFName.of('FontFile'));
                            const ffStream = ff2 ? pdfDoc.context.lookup(ff2) : null;
                            if (ffStream) {
                                try {
                                    let contents = null;
                                    if (typeof decodePDFRawStream === 'function') {
                                        contents = decodePDFRawStream(ffStream).decode();
                                    } else if (typeof ffStream.decode === 'function') {
                                        contents = ffStream.decode();
                                    }
                                    if (contents && contents.length > 0) {
                                        if (clean) fontMap.set(clean, contents);
                                        if (raw) fontMap.set(raw, contents);
                                        const keyStr = key.asString().replace(/^\//, '').toLowerCase();
                                        if (keyStr) fontMap.set(keyStr, contents);
                                    }
                                } catch (decodeErr) {
                                    console.warn('Font stream decode failed:', decodeErr);
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn('extractEmbeddedFonts failed:', err);
            }
            return fontMap;
        },

        /**
         * Safely inspect page.commonObjs (or page.objs) to extract the font object from PDF.js.
         * @param {Object} page PDFPageProxy
         * @param {string} fontId e.g. "g_d0_f1"
         * @returns {Object|null}
         */
        getFontObjFromPage(page, fontId) {
            if (!page || !fontId) return null;
            try {
                if (page.commonObjs && typeof page.commonObjs.has === 'function' && page.commonObjs.has(fontId)) {
                    return page.commonObjs.get(fontId);
                }
                if (page.objs && typeof page.objs.has === 'function' && page.objs.has(fontId)) {
                    return page.objs.get(fontId);
                }
            } catch (e) {
                console.warn('Error reading fontObj from page.commonObjs:', e);
            }
            return null;
        },

        /**
         * Parse font traits, ascent, descent, and matching names from PDF.js font descriptor.
         * @param {string} fontId
         * @param {Object} fontObj
         * @param {Object} styleObj
         * @param {Uint8Array|null} customEmbeddedBytes
         * @returns {Object}
         */
        detectFontTraits(fontId = '', fontObj = null, styleObj = {}, customEmbeddedBytes = null) {
            let rawName = '';
            let loadedName = fontId;
            let embeddedBytes = customEmbeddedBytes || null;
            let ascentRatio = 0.85;
            let descentRatio = -0.20;
            let isBold = false;
            let isItalic = false;

            if (fontObj) {
                rawName = fontObj.name || fontObj.fallbackName || '';
                loadedName = fontObj.loadedName || fontId;
                if (!embeddedBytes) {
                    embeddedBytes = fontObj.data || null;
                }

                // Normalize ascent/descent
                const units = fontObj.unitsPerEm || 1000;
                if (typeof fontObj.ascent === 'number') {
                    ascentRatio = fontObj.ascent > 5 ? fontObj.ascent / units : fontObj.ascent;
                }
                if (typeof fontObj.descent === 'number') {
                    descentRatio = fontObj.descent < -5 ? fontObj.descent / units : fontObj.descent;
                }

                isBold = Boolean(fontObj.bold || fontObj.black);
                isItalic = Boolean(fontObj.italic);
            }

            // Strip 6-letter PDF subset prefix (e.g. "ABCDEF+Roboto-Bold" -> "Roboto-Bold")
            const realName = rawName.replace(/^[A-Z]{6}\+/, '').trim() || fontId;
            const combined = `${realName} ${styleObj?.fontFamily || ''}`.toLowerCase();

            if (!isBold) {
                isBold = /bold|black|heavy|700|800|900/i.test(combined);
            }
            if (!isItalic) {
                isItalic = /italic|oblique|slanted/i.test(combined);
            }

            // Look up best match in matrix
            const matched = this.matchFontName(realName, combined);

            return {
                fontId,
                loadedName, // Exact CSS font registered in document.fonts by PDF.js
                realName,   // Clean PostScript name
                embeddedBytes,
                ascentRatio: Math.max(0.65, Math.min(1.05, ascentRatio)),
                descentRatio: Math.min(-0.10, Math.max(-0.35, descentRatio)),
                bold: isBold,
                italic: isItalic,
                matched,
            };
        },

        /**
         * Match raw PostScript font name to a recognized OFL / Google Font or metric replacement.
         */
        matchFontName(realName = '', combined = '') {
            const testStr = `${realName} ${combined}`;
            for (const entry of FONT_MATCHER_MATRIX) {
                if (entry.pattern.test(testStr)) {
                    return entry;
                }
            }

            // Heuristic fallback based on serif/mono keywords
            if (/courier|mono|consolas|code|terminal/i.test(testStr)) {
                return { name: 'Liberation Mono', family: 'mono', google: null, local: 'mono' };
            }
            if (/times|serif|georgia|minion|roman/i.test(testStr)) {
                return { name: 'Liberation Serif', family: 'serif', google: null, local: 'serif' };
            }

            // Default to sans
            return { name: 'Liberation Sans', family: 'sans', google: null, local: 'sans' };
        },

        /**
         * Verify whether embedded font bytes contain glyphs for 100% of non-whitespace characters.
         * @param {Uint8Array} embeddedBytes
         * @param {string} text
         * @returns {boolean}
         */
        checkEmbeddedCoverage(embeddedBytes, text) {
            if (!embeddedBytes) {
                return false;
            }

            // 1. If embeddedBytes has an associated charSet from document extraction, test it directly
            if (embeddedBytes.charSet && typeof embeddedBytes.charSet.has === 'function') {
                for (let i = 0; i < text.length; i++) {
                    const ch = text[i];
                    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;
                    if (!embeddedBytes.charSet.has(ch)) {
                        return false;
                    }
                }
                return true;
            }

            // 2. Fall back to fontkit glyph parsing if standard cmap table is present
            if (window.fontkit && typeof window.fontkit.create === 'function') {
                try {
                    const font = window.fontkit.create(embeddedBytes);
                    for (let i = 0; i < text.length; i++) {
                        const ch = text[i];
                        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;
                        const cp = text.codePointAt(i);
                        if (!font.hasGlyphForCodePoint(cp)) {
                            return false;
                        }
                        if (cp > 0xFFFF) i++; // Handle surrogate pairs
                    }
                    return true;
                } catch (err) {
                    // Font lacks format 4 cmap subtable or is CID subset
                }
            }

            return false;
        },

        getCatalog() {
            return Object.values(FONT_CATALOG).map(cfg => ({
                key: cfg.key,
                cssName: cfg.cssName,
                alias: cfg.alias,
                aliases: cfg.aliases || [],
                category: cfg.category,
                isLocal: Boolean(cfg.localDir),
                stdFamily: cfg.stdFamily || 'sans',
            }));
        },

        resolveFontKey(keyOrName) {
            if (!keyOrName) return 'sans';
            const raw = String(keyOrName).trim();
            if (raw.toLowerCase() === 'original') return 'original';
            if (FONT_CATALOG[raw]) return raw;
            const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
            for (const cfg of Object.values(FONT_CATALOG)) {
                if (cfg.key.toLowerCase() === norm || cfg.cssName.toLowerCase().replace(/[^a-z0-9]/g, '') === norm) {
                    return cfg.key;
                }
            }
            for (const cfg of Object.values(FONT_CATALOG)) {
                if (Array.isArray(cfg.aliases) && cfg.aliases.some(a => a.toLowerCase().replace(/[^a-z0-9]/g, '') === norm)) {
                    return cfg.key;
                }
            }
            return 'sans';
        },

        getFontEntry(keyOrName) {
            const k = this.resolveFontKey(keyOrName);
            return FONT_CATALOG[k] || FONT_CATALOG.sans;
        },

        _getVariantSpec(cfg, bold = false, italic = false) {
            if (!cfg) cfg = FONT_CATALOG.sans;
            if (cfg.localDir) {
                let file = cfg.regular;
                let weight = '400';
                let style = 'normal';
                if (bold && italic && cfg.boldItalic) {
                    file = cfg.boldItalic; weight = '700'; style = 'italic';
                } else if (bold && cfg.bold) {
                    file = cfg.bold; weight = '700'; style = 'normal';
                } else if (italic && cfg.italic) {
                    file = cfg.italic; weight = '400'; style = 'italic';
                }
                return { url: `/assets/fonts/${cfg.localDir}/${file}`, cacheKey: `${cfg.localDir}/${file}`, weight, style, isRemote: false };
            }
            let url = cfg.regularUrl;
            let weight = '400';
            let style = 'normal';
            if (bold && italic && (cfg.boldItalicUrl || cfg.boldUrl || cfg.italicUrl)) {
                url = cfg.boldItalicUrl || cfg.boldUrl || cfg.italicUrl;
                weight = cfg.boldItalicUrl || cfg.boldUrl ? '700' : '400';
                style = cfg.boldItalicUrl || cfg.italicUrl ? 'italic' : 'normal';
            } else if (bold && cfg.boldUrl) {
                url = cfg.boldUrl;
                weight = '700';
            } else if (italic && cfg.italicUrl) {
                url = cfg.italicUrl;
                style = 'italic';
            }
            return { url, cacheKey: url, weight, style, isRemote: true };
        },

        /**
         * Ensure a matched or catalog font is loaded into document.fonts for live browser editing.
         */
        async loadWebFont(matched) {
            if (!matched) return;
            const key = matched.key || matched.local || this.resolveFontKey(matched.name || 'sans');
            return this.ensureFontLoaded(key, { silent: true });
        },

        async ensureFontLoaded(keyOrName, opts = {}) {
            const { bold = false, italic = false, silent = false } = opts;
            const key = this.resolveFontKey(keyOrName);
            if (key === 'original') return { key: 'original', cssName: FONT_CATALOG.sans.cssName, loaded: true, fallback: false };

            const cfg = FONT_CATALOG[key] || FONT_CATALOG.sans;
            const variant = this._getVariantSpec(cfg, bold, italic);
            const variantId = `${cfg.key}:${variant.weight}:${variant.style}`;

            if (loadedFontVariants.has(variantId)) {
                return { key: cfg.key, cssName: cfg.cssName, loaded: true, fallback: false, bytes: fontCache.get(variant.cacheKey) || null };
            }

            if (inFlightFontFaces.has(variantId)) {
                return inFlightFontFaces.get(variantId);
            }

            const task = (async () => {
                try {
                    const buffer = await this.fetchFontBuffer(variant.url);
                    if (variant.isRemote && typeof FontFace === 'function' && document.fonts) {
                        // Also ensure Regular face is registered if user asked for Bold/Italic
                        const regSpec = this._getVariantSpec(cfg, false, false);
                        if (regSpec.url && regSpec.url !== variant.url && !loadedFontVariants.has(`${cfg.key}:400:normal`)) {
                            try {
                                const regBuf = await this.fetchFontBuffer(regSpec.url);
                                const regFace = new FontFace(cfg.cssName, regBuf, { weight: '400', style: 'normal' });
                                await regFace.load();
                                document.fonts.add(regFace);
                                loadedFontVariants.add(`${cfg.key}:400:normal`);
                            } catch (e) {}
                        }
                        const face = new FontFace(cfg.cssName, buffer, { weight: variant.weight, style: variant.style });
                        await face.load();
                        document.fonts.add(face);
                    } else if (document.fonts && typeof document.fonts.load === 'function') {
                        await document.fonts.load(`${variant.style} ${variant.weight} 16px "${cfg.cssName}"`);
                    }
                    loadedFontVariants.add(variantId);
                    loadedWebFonts.add(cfg.cssName);

                    if (window.fabric?.util?.clearFabricFontCache) {
                        window.fabric.util.clearFabricFontCache(cfg.cssName);
                        window.fabric.util.clearFabricFontCache();
                    }
                    if (window.CanvasStage?.fabricCanvas) {
                        window.CanvasStage.fabricCanvas.requestRenderAll();
                    }
                    return { key: cfg.key, cssName: cfg.cssName, loaded: true, fallback: false, bytes: buffer };
                } catch (err) {
                    const fallbackKey = cfg.stdFamily && FONT_CATALOG[cfg.stdFamily] ? cfg.stdFamily : 'sans';
                    const fallbackCfg = FONT_CATALOG[fallbackKey];
                    if (!silent && !toastedFailures.has(cfg.key)) {
                        toastedFailures.add(cfg.key);
                        window.dispatchEvent(new CustomEvent('editor:toast', {
                            detail: { message: `Could not load "${cfg.cssName}" online; using ${fallbackCfg.cssName} fallback.`, type: 'warning' },
                        }));
                    }
                    return { key: fallbackKey, cssName: fallbackCfg.cssName, loaded: false, fallback: true, bytes: null };
                } finally {
                    inFlightFontFaces.delete(variantId);
                }
            })();

            inFlightFontFaces.set(variantId, task);
            return task;
        },

        /**
         * Fetch local or CDN TrueType font buffer with deduplication & SFNT validation.
         * Accepts (url), (dir, filename), or ('dir/file').
         */
        async fetchFontBuffer(dirOrUrl, filename) {
            let url = '';
            let cacheKey = '';
            if (filename) {
                cacheKey = `${dirOrUrl}/${filename}`;
                url = `/assets/fonts/${dirOrUrl}/${filename}`;
            } else if (/^https?:\/\//i.test(dirOrUrl) || dirOrUrl.startsWith('/')) {
                url = dirOrUrl;
                cacheKey = dirOrUrl;
            } else if (dirOrUrl.includes('/')) {
                const parts = dirOrUrl.split('/');
                cacheKey = `${parts[0]}/${parts[1]}`;
                url = `/assets/fonts/${parts[0]}/${parts[1]}`;
            } else {
                cacheKey = `liberation/${dirOrUrl}`;
                url = `/assets/fonts/liberation/${dirOrUrl}`;
            }

            if (fontCache.has(cacheKey)) {
                return fontCache.get(cacheKey);
            }
            if (inFlightFetches.has(cacheKey)) {
                return inFlightFetches.get(cacheKey);
            }

            const fetchPromise = (async () => {
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`Failed to load font from ${url} (HTTP ${res.status})`);
                }
                const buffer = await res.arrayBuffer();
                if (!buffer || buffer.byteLength < 100) {
                    throw new Error(`Invalid empty font buffer from ${url}`);
                }
                const view = new DataView(buffer);
                const magic = view.getUint32(0, false);
                const isValidSfnt = magic === 0x00010000 || magic === 0x4F54544F || magic === 0x74727565;
                if (!isValidSfnt) {
                    throw new Error(`Unsupported font container at ${url} (expected static TTF/OTF)`);
                }
                fontCache.set(cacheKey, buffer);
                return buffer;
            })();

            inFlightFetches.set(cacheKey, fetchPromise);
            try {
                return await fetchPromise;
            } finally {
                inFlightFetches.delete(cacheKey);
            }
        },

        /**
         * 2-Tier Font Embedding Pipeline for PDFLib export.
         * @param {Object} pdfDoc PDFDocument instance
         * @param {Object} block textBlock instance
         * @param {string} currentText
         * @returns {Promise<{ font: Object, tier: number, fontName: string }>}
         */
        async embedFontForBlock(pdfDoc, block, currentText) {
            if (window.fontkit && typeof pdfDoc.registerFontkit === 'function') {
                pdfDoc.registerFontkit(window.fontkit);
            }

            const explicitFontChanged = Boolean(block.fontFamily && block.fontFamily !== 'original');

            // TIER 1: Check if original embedded font bytes cover all typed characters (when not overridden)
            if (!explicitFontChanged && block.embeddedBytes && this.checkEmbeddedCoverage(block.embeddedBytes, currentText)) {
                try {
                    const embeddedFont = await pdfDoc.embedFont(block.embeddedBytes, { subset: false });
                    return {
                        font: embeddedFont,
                        tier: 1,
                        fontName: block.realName || 'Original Embedded',
                    };
                } catch (tier1Err) {
                    console.warn('Tier 1 embedFont failed, transitioning to Tier 2:', tier1Err);
                }
            }

            // TIER 2: Catalog TrueType Font (7 local or 33 cached static CDN TTFs)
            const matched = block.matched || this.matchFontName(block.realName);
            const bold = Boolean(block.bold);
            const italic = Boolean(block.italic);

            const targetKey = explicitFontChanged
                ? this.resolveFontKey(block.fontFamily)
                : this.resolveFontKey(matched.local || 'sans');
            const cfg = FONT_CATALOG[targetKey] || FONT_CATALOG.sans;
            const stdCfg = STD_DEFAULTS[cfg.stdFamily || 'sans'] || STD_DEFAULTS.sans;
            const spec = this._getVariantSpec(cfg, bold, italic);

            if (window.fontkit && typeof pdfDoc.registerFontkit === 'function') {
                try {
                    const ttfBytes = await this.fetchFontBuffer(spec.url);
                    const embeddedFont = await pdfDoc.embedFont(ttfBytes, { subset: true });
                    return {
                        font: embeddedFont,
                        tier: 2,
                        fontName: cfg.cssName,
                    };
                } catch (err) {
                    console.warn(`Tier 2 embedding failed for ${cfg.cssName} (${spec.url}), trying local fallback:`, err);
                    // Fallback to local stdFamily TTF if remote CDN failed
                    if (spec.isRemote) {
                        try {
                            const fbCfg = FONT_CATALOG[cfg.stdFamily || 'sans'] || FONT_CATALOG.sans;
                            const fbSpec = this._getVariantSpec(fbCfg, bold, italic);
                            const fbBytes = await this.fetchFontBuffer(fbSpec.url);
                            const fbEmbedded = await pdfDoc.embedFont(fbBytes, { subset: true });
                            return { font: fbEmbedded, tier: 2, fontName: fbCfg.cssName };
                        } catch (fbErr) {}
                    }
                }
            }

            // StandardFonts emergency fallback
            const { StandardFonts } = window.PDFLib;
            let standardKey = stdCfg.standardRegular;
            if (bold && italic) standardKey = stdCfg.standardBoldItalic;
            else if (bold) standardKey = stdCfg.standardBold;
            else if (italic) standardKey = stdCfg.standardItalic;
            const standardFontName = StandardFonts[standardKey] || StandardFonts.Helvetica;
            const font = await pdfDoc.embedFont(standardFontName);
            return {
                font,
                tier: 2,
                fontName: standardFontName,
            };
        },

        getCssFamily(family) {
            if (!family) return FONT_CATALOG.sans.cssName;
            const key = this.resolveFontKey(family);
            if (key === 'original') return FONT_CATALOG.sans.cssName;
            return (FONT_CATALOG[key] || FONT_CATALOG.sans).cssName;
        },

        /**
         * Preload all locally bundled @font-face fonts into document.fonts and flush Fabric's font cache
         * so added canvas text renders crisply offline or immediately on load.
         */
        async preloadLocalFonts() {
            if (!document.fonts || typeof document.fonts.load !== 'function') return;
            const loads = [];
            for (const cfg of Object.values(FONT_CATALOG)) {
                if (!cfg.localDir) continue;
                const fam = cfg.cssName;
                loads.push(document.fonts.load(`400 16px "${fam}"`).catch(() => null));
                if (cfg.bold) loads.push(document.fonts.load(`700 16px "${fam}"`).catch(() => null));
                if (cfg.italic) loads.push(document.fonts.load(`italic 400 16px "${fam}"`).catch(() => null));
                if (cfg.boldItalic) loads.push(document.fonts.load(`italic 700 16px "${fam}"`).catch(() => null));
            }
            await Promise.all(loads);
            if (window.fabric?.util?.clearFabricFontCache) {
                window.fabric.util.clearFabricFontCache();
            }
            if (window.CanvasStage?.fabricCanvas) {
                window.CanvasStage.fabricCanvas.requestRenderAll();
            }
        },
    };

    window.FontManager = FontManager;
})(window);
