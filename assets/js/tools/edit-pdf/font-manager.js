/**
 * NoPayPDF - Font Manager Module (window.FontManager)
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

    // 1. Local Vendored Open-Source Fonts (SIL OFL 1.1 / Apache 2.0)
    const LOCAL_FONTS = {
        sans: {
            dir: 'liberation',
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
            dir: 'liberation',
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
            dir: 'liberation',
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
        carlito: {
            dir: 'carlito',
            regular: 'Carlito-Regular.ttf',
            bold: 'Carlito-Bold.ttf',
            italic: 'Carlito-Regular.ttf',
            boldItalic: 'Carlito-Bold.ttf',
            cssName: 'Carlito',
            standardRegular: 'Helvetica',
            standardBold: 'HelveticaBold',
            standardItalic: 'HelveticaOblique',
            standardBoldItalic: 'HelveticaBoldOblique',
        },
        roboto: {
            dir: 'roboto',
            regular: 'Roboto-Regular.ttf',
            bold: 'Roboto-Bold.ttf',
            italic: 'Roboto-Regular.ttf',
            boldItalic: 'Roboto-Bold.ttf',
            cssName: 'Roboto',
            standardRegular: 'Helvetica',
            standardBold: 'HelveticaBold',
            standardItalic: 'HelveticaOblique',
            standardBoldItalic: 'HelveticaBoldOblique',
        },
        opensans: {
            dir: 'opensans',
            regular: 'OpenSans-Regular.ttf',
            bold: 'OpenSans-Bold.ttf',
            italic: 'OpenSans-Regular.ttf',
            boldItalic: 'OpenSans-Bold.ttf',
            cssName: 'Open Sans',
            standardRegular: 'Helvetica',
            standardBold: 'HelveticaBold',
            standardItalic: 'HelveticaOblique',
            standardBoldItalic: 'HelveticaBoldOblique',
        },
        lato: {
            dir: 'lato',
            regular: 'Lato-Regular.ttf',
            bold: 'Lato-Bold.ttf',
            italic: 'Lato-Regular.ttf',
            boldItalic: 'Lato-Bold.ttf',
            cssName: 'Lato',
            standardRegular: 'Helvetica',
            standardBold: 'HelveticaBold',
            standardItalic: 'HelveticaOblique',
            standardBoldItalic: 'HelveticaBoldOblique',
        },
    };
    const LOCAL_LIBERATION = LOCAL_FONTS;

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

        /**
         * Ensure a matched font is loaded into document.fonts for live browser editing.
         */
        async loadWebFont(matched) {
            if (!matched || !matched.name) return;
            const fontName = matched.name;
            if (loadedWebFonts.has(fontName)) return;
            loadedWebFonts.add(fontName);

            try {
                if (document.fonts) {
                    await document.fonts.load(`14px "${fontName}"`);
                }
            } catch (e) {}
        },

        /**
         * Fetch local TrueType font buffer.
         * Accepts (dir, filename) or (filename).
         */
        async fetchFontBuffer(dirOrFile, filename) {
            let dir = 'liberation';
            let file = dirOrFile;
            if (filename) {
                dir = dirOrFile;
                file = filename;
            } else if (dirOrFile.includes('/')) {
                const parts = dirOrFile.split('/');
                dir = parts[0];
                file = parts[1];
            }

            const cacheKey = `${dir}/${file}`;
            if (fontCache.has(cacheKey)) {
                return fontCache.get(cacheKey);
            }
            const url = `/assets/fonts/${dir}/${file}`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`Failed to load font from ${url} (HTTP ${res.status})`);
            }
            const buffer = await res.arrayBuffer();
            fontCache.set(cacheKey, buffer);
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

            // TIER 2: Auto-Matched Local TrueType Font (Carlito, Roboto, Open Sans, Lato, Liberation)
            const matched = block.matched || this.matchFontName(block.realName);
            const bold = Boolean(block.bold);
            const italic = Boolean(block.italic);

            const localKey = (block.fontFamily && LOCAL_FONTS[block.fontFamily])
                ? block.fontFamily
                : (matched.local || 'sans');
            const localMap = LOCAL_FONTS[localKey] || LOCAL_FONTS.sans;

            let localFile = localMap.regular;
            let standardKey = localMap.standardRegular;

            if (bold && italic) {
                localFile = localMap.boldItalic || localMap.bold;
                standardKey = localMap.standardBoldItalic || localMap.standardBold;
            } else if (bold) {
                localFile = localMap.bold;
                standardKey = localMap.standardBold;
            } else if (italic) {
                localFile = localMap.italic;
                standardKey = localMap.standardItalic;
            }

            if (window.fontkit && typeof pdfDoc.registerFontkit === 'function') {
                try {
                    const ttfBytes = await this.fetchFontBuffer(localMap.dir, localFile);
                    const embeddedFont = await pdfDoc.embedFont(ttfBytes, { subset: true });
                    return {
                        font: embeddedFont,
                        tier: 2,
                        fontName: localMap.cssName,
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
            if (!family) return LOCAL_FONTS.sans.cssName;
            if (LOCAL_FONTS[family]?.cssName) return LOCAL_FONTS[family].cssName;
            const norm = String(family).toLowerCase().replace(/[^a-z]/g, '');
            for (const [k, cfg] of Object.entries(LOCAL_FONTS)) {
                if (cfg.cssName.toLowerCase().replace(/[^a-z]/g, '') === norm || k === norm) {
                    return cfg.cssName;
                }
            }
            return LOCAL_FONTS.sans.cssName;
        },

        /**
         * Preload all bundled @font-face fonts into document.fonts and flush Fabric's font cache
         * so added canvas text never renders blurry fallback glyphs or stale width metrics.
         */
        async preloadLocalFonts() {
            if (!document.fonts || typeof document.fonts.load !== 'function') return;
            const loads = [];
            for (const cfg of Object.values(LOCAL_FONTS)) {
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
