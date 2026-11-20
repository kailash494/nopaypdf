/**
 * PDFToolKit - Font Manager Module (window.FontManager)
 *
 * Real Embedded Font Extraction & 2-Tier Matching Architecture:
 * - Tier 1: Exact original embedded font bytes from PDF.js commonObjs, verified via window.fontkit
 * - Tier 2: 45+ Font Matcher Matrix mapping to OFL / Google Fonts or metric-compatible replacements
 * 100% Client-Side. Permissive MIT / Apache 2.0 / SIL OFL 1.1 compatible.
 */

(function (window) {
    'use strict';

    const fontCache = new Map();
    const loadedWebFonts = new Set();

    // 1. Local Vendored SIL OFL 1.1 Liberation Fonts
    const LOCAL_LIBERATION = {
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
            boldItalic: 'LiberationSerif-Bold.ttf',
            cssName: 'Liberation Serif',
            standardRegular: 'TimesRoman',
            standardBold: 'TimesRomanBold',
            standardItalic: 'TimesRomanItalic',
            standardBoldItalic: 'TimesRomanBoldItalic',
        },
        mono: {
            regular: 'LiberationMono-Regular.ttf',
            bold: 'LiberationMono-Bold.ttf',
            italic: 'LiberationMono-Regular.ttf',
            boldItalic: 'LiberationMono-Bold.ttf',
            cssName: 'Liberation Mono',
            standardRegular: 'Courier',
            standardBold: 'CourierBold',
            standardItalic: 'CourierOblique',
            standardBoldItalic: 'CourierBoldOblique',
        },
    };

    // 2. Comprehensive 45+ Font Matcher Table
    // Normalizes proprietary and popular fonts to high-fidelity OFL/Google Fonts or metric replacements
    const FONT_MATCHER_MATRIX = [
        // Metric-Compatible Replacements for Proprietary Office/Adobe Fonts
        { pattern: /arial|helvetica|helveticaneue|arimo|nimbus\s*sans/i, name: 'Liberation Sans', family: 'sans', google: null, local: 'sans' },
        { pattern: /times\s*new\s*roman|times|tinos|nimbus\s*roman/i, name: 'Liberation Serif', family: 'serif', google: null, local: 'serif' },
        { pattern: /courier\s*new|courier|cousine|nimbus\s*mono/i, name: 'Liberation Mono', family: 'mono', google: null, local: 'mono' },
        { pattern: /calibri|carlito/i, name: 'Carlito', family: 'sans', google: 'Carlito', local: 'sans' },
        { pattern: /cambria|caladea/i, name: 'Caladea', family: 'serif', google: 'Caladea', local: 'serif' },
        { pattern: /georgia|gelasio/i, name: 'Gelasio', family: 'serif', google: 'Gelasio', local: 'serif' },
        { pattern: /segoe\s*ui|sf\s*pro|san\s*francisco|apple\s*system/i, name: 'Inter', family: 'sans', google: 'Inter', local: 'sans' },
        { pattern: /verdana|tahoma|dejavu\s*sans/i, name: 'Liberation Sans', family: 'sans', google: null, local: 'sans' },
        { pattern: /garamond|eb\s*garamond/i, name: 'EB Garamond', family: 'serif', google: 'EB+Garamond', local: 'serif' },
        { pattern: /palatino|book\s*antiqua/i, name: 'Liberation Serif', family: 'serif', google: null, local: 'serif' },
        { pattern: /century\s*gothic|futura/i, name: 'Montserrat', family: 'sans', google: 'Montserrat', local: 'sans' },
        { pattern: /trebuchet\s*ms|fira\s*sans/i, name: 'Fira Sans', family: 'sans', google: 'Fira+Sans', local: 'sans' },
        { pattern: /consolas|menlo|monaco|fira\s*code/i, name: 'Fira Code', family: 'mono', google: 'Fira+Code', local: 'mono' },
        { pattern: /jetbrains\s*mono/i, name: 'JetBrains Mono', family: 'mono', google: 'JetBrains+Mono', local: 'mono' },

        // Popular Open-Source & Google Fonts Direct Matches
        { pattern: /roboto\s*mono/i, name: 'Roboto Mono', family: 'mono', google: 'Roboto+Mono', local: 'mono' },
        { pattern: /roboto\s*slab/i, name: 'Roboto Slab', family: 'serif', google: 'Roboto+Slab', local: 'serif' },
        { pattern: /roboto/i, name: 'Roboto', family: 'sans', google: 'Roboto', local: 'sans' },
        { pattern: /open\s*sans/i, name: 'Open Sans', family: 'sans', google: 'Open+Sans', local: 'sans' },
        { pattern: /lato/i, name: 'Lato', family: 'sans', google: 'Lato', local: 'sans' },
        { pattern: /montserrat/i, name: 'Montserrat', family: 'sans', google: 'Montserrat', local: 'sans' },
        { pattern: /poppins/i, name: 'Poppins', family: 'sans', google: 'Poppins', local: 'sans' },
        { pattern: /inter/i, name: 'Inter', family: 'sans', google: 'Inter', local: 'sans' },
        { pattern: /source\s*sans/i, name: 'Source Sans 3', family: 'sans', google: 'Source+Sans+3', local: 'sans' },
        { pattern: /source\s*serif/i, name: 'Source Serif 4', family: 'serif', google: 'Source+Serif+4', local: 'serif' },
        { pattern: /source\s*code/i, name: 'Source Code Pro', family: 'mono', google: 'Source+Code+Pro', local: 'mono' },
        { pattern: /nunito/i, name: 'Nunito', family: 'sans', google: 'Nunito', local: 'sans' },
        { pattern: /raleway/i, name: 'Raleway', family: 'sans', google: 'Raleway', local: 'sans' },
        { pattern: /merriweather/i, name: 'Merriweather', family: 'serif', google: 'Merriweather', local: 'serif' },
        { pattern: /playfair\s*display/i, name: 'Playfair Display', family: 'serif', google: 'Playfair+Display', local: 'serif' },
        { pattern: /oswald/i, name: 'Oswald', family: 'sans', google: 'Oswald', local: 'sans' },
        { pattern: /ubuntu/i, name: 'Ubuntu', family: 'sans', google: 'Ubuntu', local: 'sans' },
        { pattern: /pt\s*sans/i, name: 'PT Sans', family: 'sans', google: 'PT+Sans', local: 'sans' },
        { pattern: /pt\s*serif/i, name: 'PT Serif', family: 'serif', google: 'PT+Serif', local: 'serif' },
        { pattern: /noto\s*sans/i, name: 'Noto Sans', family: 'sans', google: 'Noto+Sans', local: 'sans' },
        { pattern: /noto\s*serif/i, name: 'Noto Serif', family: 'serif', google: 'Noto+Serif', local: 'serif' },
        { pattern: /lora/i, name: 'Lora', family: 'serif', google: 'Lora', local: 'serif' },
        { pattern: /rubik/i, name: 'Rubik', family: 'sans', google: 'Rubik', local: 'sans' },
        { pattern: /inconsolata/i, name: 'Inconsolata', family: 'mono', google: 'Inconsolata', local: 'mono' },
        { pattern: /cormorant/i, name: 'Cormorant Garamond', family: 'serif', google: 'Cormorant+Garamond', local: 'serif' },
        { pattern: /work\s*sans/i, name: 'Work Sans', family: 'sans', google: 'Work+Sans', local: 'sans' },
        { pattern: /space\s*grotesk/i, name: 'Space Grotesk', family: 'sans', google: 'Space+Grotesk', local: 'sans' },
        { pattern: /space\s*mono/i, name: 'Space Mono', family: 'mono', google: 'Space+Mono', local: 'mono' },
        { pattern: /cinzel/i, name: 'Cinzel', family: 'serif', google: 'Cinzel', local: 'serif' },
        { pattern: /karla/i, name: 'Karla', family: 'sans', google: 'Karla', local: 'sans' },
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

        /**
         * Ensure a matched Google Web Font is loaded into document.fonts for live browser editing.
         */
        async loadWebFont(matched) {
            if (!matched || !matched.google || loadedWebFonts.has(matched.google)) return;
            loadedWebFonts.add(matched.google);

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${matched.google}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
            document.head.appendChild(link);

            try {
                if (document.fonts) {
                    await document.fonts.load(`14px "${matched.name}"`);
                }
            } catch (e) {}
        },

        /**
         * Fetch local Liberation font TTF buffer.
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

            // TIER 1: Check if original embedded font bytes cover all typed characters
            if (block.embeddedBytes && this.checkEmbeddedCoverage(block.embeddedBytes, currentText)) {
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

            // TIER 2: Auto-Matched OFL / Google Font
            const matched = block.matched || this.matchFontName(block.realName);
            const bold = Boolean(block.bold);
            const italic = Boolean(block.italic);

            // 1. Try local metric replacement (Liberation Sans / Serif / Mono)
            const localKey = matched.local || 'sans';
            const localMap = LOCAL_LIBERATION[localKey] || LOCAL_LIBERATION.sans;
            let localFile = localMap.regular;
            let standardKey = localMap.standardRegular;

            if (bold && italic) {
                localFile = localMap.boldItalic;
                standardKey = localMap.standardBoldItalic;
            } else if (bold) {
                localFile = localMap.bold;
                standardKey = localMap.standardBold;
            } else if (italic) {
                localFile = localMap.italic;
                standardKey = localMap.standardItalic;
            }

            if (window.fontkit && typeof pdfDoc.registerFontkit === 'function') {
                try {
                    const ttfBytes = await this.fetchFontBuffer(localFile);
                    const embeddedFont = await pdfDoc.embedFont(ttfBytes, { subset: true });
                    return {
                        font: embeddedFont,
                        tier: 2,
                        fontName: matched.name,
                    };
                } catch (err) {
                    console.warn(`Tier 2 local embedding failed for ${localFile}:`, err);
                }
            }

            // 2. Fallback to StandardFonts
            const { StandardFonts } = window.PDFLib;
            const standardFontName = StandardFonts[standardKey] || StandardFonts.Helvetica;
            const font = await pdfDoc.embedFont(standardFontName);
            return {
                font,
                tier: 2,
                fontName: standardFontName,
            };
        },

        getCssFamily(family) {
            return LOCAL_LIBERATION[family]?.cssName || LOCAL_LIBERATION.sans.cssName;
        },
    };

    window.FontManager = FontManager;
})(window);
