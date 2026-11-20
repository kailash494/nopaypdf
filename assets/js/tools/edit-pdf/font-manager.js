/**
 * PDFToolKit - Font Manager Module (window.FontManager)
 *
 * Maps PDF.js extracted font names/styles to SIL OFL 1.1 Liberation Fonts.
 * Handles font cache, fontkit TrueType subsetting, and graceful StandardFonts fallback.
 * 100% Client-Side. Permissive MIT / Apache 2.0 / SIL OFL 1.1 compatible.
 */

(function (window) {
    'use strict';

    const fontCache = new Map();

    const FONT_MAP = {
        sans: {
            regular: 'LiberationSans-Regular.ttf',
            bold: 'LiberationSans-Bold.ttf',
            italic: 'LiberationSans-Italic.ttf',
            boldItalic: 'LiberationSans-BoldItalic.ttf',
            cssName: 'Liberation Sans',
            standardRegular: 'Helvetica',
            standardBold: 'HelveticaBold',
            standardItalic: 'HelveticaOblique',
            standardBoldItalic: 'HelveticaBoldOblique',
        },
        serif: {
            regular: 'LiberationSerif-Regular.ttf',
            bold: 'LiberationSerif-Bold.ttf',
            italic: 'LiberationSerif-Italic.ttf',
            boldItalic: 'LiberationSerif-Bold.ttf', // fallback
            cssName: 'Liberation Serif',
            standardRegular: 'TimesRoman',
            standardBold: 'TimesRomanBold',
            standardItalic: 'TimesRomanItalic',
            standardBoldItalic: 'TimesRomanBoldItalic',
        },
        mono: {
            regular: 'LiberationMono-Regular.ttf',
            bold: 'LiberationMono-Bold.ttf',
            italic: 'LiberationMono-Regular.ttf', // fallback
            boldItalic: 'LiberationMono-Bold.ttf', // fallback
            cssName: 'Liberation Mono',
            standardRegular: 'Courier',
            standardBold: 'CourierBold',
            standardItalic: 'CourierOblique',
            standardBoldItalic: 'CourierBoldOblique',
        },
    };

    const FontManager = {
        /**
         * Classify a PDF.js font descriptor into a family, weight, and style.
         * @param {string} fontName
         * @param {Object} styleObj
         * @returns {{ family: 'sans'|'serif'|'mono', bold: boolean, italic: boolean, cssFont: string }}
         */
        detectFontTraits(fontName = '', styleObj = {}) {
            const rawName = (fontName || '').toLowerCase();
            const fontFamily = (styleObj?.fontFamily || '').toLowerCase();
            const combined = `${rawName} ${fontFamily}`;

            // 1. Detect Family
            let family = 'sans';
            if (/courier|mono|consolas|fixed|code|menlo/.test(combined)) {
                family = 'mono';
            } else if (/times|serif|georgia|minion|garamond|palatino|cambria/.test(combined)) {
                family = 'serif';
            }

            // 2. Detect Bold
            const bold = /bold|black|heavy|700|800|900/.test(combined);

            // 3. Detect Italic
            const italic = /italic|oblique|slanted/.test(combined);

            const cssName = FONT_MAP[family].cssName;
            const cssStyle = italic ? 'italic' : 'normal';
            const cssWeight = bold ? '700' : '400';

            return {
                family,
                bold,
                italic,
                cssName,
                cssFont: `${cssStyle} ${cssWeight} 14px "${cssName}", sans-serif`,
            };
        },

        /**
         * Fetch a Liberation TTF ArrayBuffer, caching in memory.
         * @param {string} filename
         * @returns {Promise<ArrayBuffer>}
         */
        async fetchFontBuffer(filename) {
            if (fontCache.has(filename)) {
                return fontCache.get(filename);
            }

            const url = `/assets/fonts/liberation/${filename}`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`Failed to load font from ${url} (HTTP ${res.status})`);
            }

            const buffer = await res.arrayBuffer();
            fontCache.set(filename, buffer);
            return buffer;
        },

        /**
         * Embed the matched Liberation font using fontkit + subsetting,
         * with graceful fallback to PDFLib.StandardFonts if TTF fails.
         * @param {Object} pdfDoc PDFDocument instance
         * @param {Object} traits { family, bold, italic }
         * @returns {Promise<Object>} Embedded PDFFont
         */
        async embedMatchedFont(pdfDoc, traits = {}) {
            const family = traits.family === 'serif' || traits.family === 'mono' ? traits.family : 'sans';
            const bold = Boolean(traits.bold);
            const italic = Boolean(traits.italic);

            const map = FONT_MAP[family];
            let fontFile = map.regular;
            let standardKey = map.standardRegular;

            if (bold && italic) {
                fontFile = map.boldItalic;
                standardKey = map.standardBoldItalic;
            } else if (bold) {
                fontFile = map.bold;
                standardKey = map.standardBold;
            } else if (italic) {
                fontFile = map.italic;
                standardKey = map.standardItalic;
            }

            // 1. Attempt TrueType embedding with fontkit
            if (window.fontkit && typeof pdfDoc.registerFontkit === 'function') {
                try {
                    pdfDoc.registerFontkit(window.fontkit);
                    const fontBytes = await this.fetchFontBuffer(fontFile);
                    // Embed with subset: true so output PDFs remain compact
                    return await pdfDoc.embedFont(fontBytes, { subset: true });
                } catch (err) {
                    console.warn(`Fontkit embedding failed for ${fontFile}, falling back to StandardFonts:`, err);
                }
            }

            // 2. Fallback to PDFLib StandardFonts
            const { StandardFonts } = window.PDFLib;
            const standardFontName = StandardFonts[standardKey] || StandardFonts.Helvetica;
            return await pdfDoc.embedFont(standardFontName);
        },

        /**
         * Return the CSS font-family name for a given family key.
         */
        getCssFamily(family) {
            return FONT_MAP[family]?.cssName || FONT_MAP.sans.cssName;
        },
    };

    window.FontManager = FontManager;
})(window);
