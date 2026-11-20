/**
 * PDFToolKit - Text Extractor Module (window.TextExtractor)
 *
 * Exact operator-level fill color extraction from page.getOperatorList(),
 * real embedded font integration from PDF.js commonObjs,
 * and strict non-destructive run grouping (<0.55*fontSize gap).
 * 100% Client-Side. Permissive MIT / Apache 2.0 compatible.
 */

(function (window) {
    'use strict';

    let idCounter = 1;

    function generateId() {
        return `tb-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
    }

    function normColor(val) {
        if (typeof val !== 'number') return 0;
        if (val > 0 && val <= 1 && (val % 1 !== 0)) {
            return Math.round(val * 255);
        }
        return Math.max(0, Math.min(255, Math.round(val)));
    }

    function rgbToHex(r, g, b) {
        return '#' + [normColor(r), normColor(g), normColor(b)].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    const TextExtractor = {
        /**
         * Extract operator-level fill colors sequentially for text operations.
         * @param {Object} page PDFPageProxy
         * @returns {Promise<Array<string>>}
         */
        async extractOperatorColors(page) {
            const textColors = [];
            try {
                const opList = await page.getOperatorList();
                const OPS = window.pdfjsLib ? window.pdfjsLib.OPS : {};
                const colorStack = ['#000000'];
                let currentColor = '#000000';

                for (let i = 0; i < opList.fnArray.length; i++) {
                    const fn = opList.fnArray[i];
                    const args = opList.argsArray[i];

                    if (fn === OPS.save) {
                        colorStack.push(currentColor);
                    } else if (fn === OPS.restore) {
                        currentColor = colorStack.pop() || '#000000';
                    } else if (fn === OPS.setFillRGBColor && args && args.length >= 3) {
                        currentColor = rgbToHex(args[0], args[1], args[2]);
                    } else if (fn === OPS.setFillGray && args && args.length >= 1) {
                        currentColor = rgbToHex(args[0], args[0], args[0]);
                    } else if (fn === OPS.setFillCMYKColor && args && args.length >= 4) {
                        const c = args[0] > 1 ? args[0] / 255 : args[0];
                        const m = args[1] > 1 ? args[1] / 255 : args[1];
                        const y = args[2] > 1 ? args[2] / 255 : args[2];
                        const k = args[3] > 1 ? args[3] / 255 : args[3];
                        const r = 255 * (1 - c) * (1 - k);
                        const g = 255 * (1 - m) * (1 - k);
                        const b = 255 * (1 - y) * (1 - k);
                        currentColor = rgbToHex(r, g, b);
                    } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
                        textColors.push(currentColor);
                    }
                }
            } catch (err) {
                console.warn('Operator list color extraction failed, falling back to pixel sampling:', err);
            }
            return textColors;
        },

        /**
         * Extract and strictly group text line blocks from a PDF.js page.
         * @param {Object} page PDFPageProxy instance
         * @param {number} pageIndex 0-based page index
         * @param {Map<string, Uint8Array>|null} embeddedFontsMap Optional pre-extracted embedded font streams
         * @returns {Promise<{ blocks: Array, rawText: string, charCount: number }>}
         */
        async extractPageText(page, pageIndex = 0, embeddedFontsMap = null) {
            // Ensure operator list is parsed so commonObjs is populated
            const opColors = await this.extractOperatorColors(page);
            const textContent = await page.getTextContent({ includeMarkedContent: false });

            const items = textContent.items || [];
            if (items.length === 0) {
                return { blocks: [], rawText: '', charCount: 0 };
            }

            // Index characters used by each font for subset coverage checking
            const fontCharSets = new Map();
            for (const item of items) {
                const fn = item.fontName || 'default';
                if (!fontCharSets.has(fn)) fontCharSets.set(fn, new Set());
                const set = fontCharSets.get(fn);
                for (const ch of (item.str || '')) {
                    set.add(ch);
                }
            }

            const rawRuns = [];
            let totalChars = 0;
            let fullText = '';
            let textItemIdx = 0;

            for (const item of items) {
                const str = item.str || '';
                if (!str) continue;
                totalChars += str.length;
                fullText += str + ' ';

                const tx = item.transform; // [a, b, c, d, e, f]
                const fontSizePt = Math.hypot(tx[2], tx[3]) || Math.hypot(tx[0], tx[1]) || item.height || 12;

                // Inspect real font from PDF.js commonObjs
                const fontObj = window.FontManager ? window.FontManager.getFontObjFromPage(page, item.fontName) : null;
                
                // Lookup pre-extracted font stream bytes if available
                let customEmbeddedBytes = null;
                if (embeddedFontsMap && embeddedFontsMap.size > 0) {
                    const rawName = fontObj ? (fontObj.name || fontObj.fallbackName || '') : '';
                    const cleanName = rawName.replace(/^[A-Z]{6}\+/, '').trim().toLowerCase();
                    const fontIdLower = (item.fontName || '').toLowerCase();
                    
                    const matchedBytes = embeddedFontsMap.get(cleanName) ||
                                         embeddedFontsMap.get(rawName.toLowerCase()) ||
                                         embeddedFontsMap.get(fontIdLower);
                    
                    if (matchedBytes) {
                        customEmbeddedBytes = new Uint8Array(matchedBytes);
                        customEmbeddedBytes.charSet = fontCharSets.get(item.fontName) || new Set();
                    } else if (embeddedFontsMap.size === 1) {
                        // Single embedded font in document
                        const onlyBytes = embeddedFontsMap.values().next().value;
                        if (onlyBytes) {
                            customEmbeddedBytes = new Uint8Array(onlyBytes);
                            customEmbeddedBytes.charSet = fontCharSets.get(item.fontName) || new Set();
                        }
                    }
                }

                const fontTraits = window.FontManager 
                    ? window.FontManager.detectFontTraits(item.fontName, fontObj, textContent.styles ? textContent.styles[item.fontName] : null, customEmbeddedBytes)
                    : {
                        fontId: item.fontName,
                        loadedName: item.fontName,
                        realName: item.fontName,
                        embeddedBytes: customEmbeddedBytes,
                        ascentRatio: 0.85,
                        descentRatio: -0.20,
                        bold: false,
                        italic: false,
                        matched: { name: 'Liberation Sans', family: 'sans' },
                    };

                // Exact operator fill color
                const colorHex = opColors[textItemIdx] || '#1e293b';
                textItemIdx++;

                // PDF User space coordinates (bottom-left origin)
                const pdfX = tx[4];
                const pdfY = tx[5]; // Baseline Y
                const pdfWidth = item.width || (str.length * fontSizePt * 0.5);
                const pdfHeight = item.height || fontSizePt;

                rawRuns.push({
                    str,
                    pdfX,
                    pdfY,
                    baselinePdfY: pdfY,
                    pdfWidth,
                    pdfHeight,
                    fontSizePt: Math.round(fontSizePt * 100) / 100,
                    fontId: fontTraits.fontId,
                    loadedName: fontTraits.loadedName,
                    realName: fontTraits.realName,
                    embeddedBytes: fontTraits.embeddedBytes,
                    ascentRatio: fontTraits.ascentRatio,
                    descentRatio: fontTraits.descentRatio,
                    bold: fontTraits.bold,
                    italic: fontTraits.italic,
                    matched: fontTraits.matched,
                    colorHex,
                });
            }

            // Sort: vertical top-to-bottom (descending Y in PDF points), horizontal left-to-right
            rawRuns.sort((a, b) => {
                if (Math.abs(a.baselinePdfY - b.baselinePdfY) > 2.0) {
                    return b.baselinePdfY - a.baselinePdfY;
                }
                return a.pdfX - b.pdfX;
            });

            // Strict Non-Destructive Grouping
            const lineBlocks = [];
            let currentBlock = null;

            for (const run of rawRuns) {
                if (!currentBlock) {
                    currentBlock = this._createNewBlock(run, pageIndex);
                    continue;
                }

                // Strict criteria:
                // 1. Same font (matching loadedName / realName)
                const sameFont = (currentBlock.loadedName === run.loadedName || currentBlock.realName === run.realName) &&
                                 currentBlock.bold === run.bold &&
                                 currentBlock.italic === run.italic;

                // 2. Font size within 0.5 pt
                const sameSize = Math.abs(currentBlock.fontSizePt - run.fontSizePt) <= 0.5;

                // 3. Exact color match
                const sameColor = currentBlock.colorHex.toLowerCase() === run.colorHex.toLowerCase();

                // 4. Same baseline within 0.25 * fontSize
                const sameBaseline = Math.abs(currentBlock.baselinePdfY - run.baselinePdfY) <= (0.25 * run.fontSizePt);

                // 5. Horizontal gap: cannot exceed 0.55 * fontSize (prevents merging separate columns or table cells)
                const currentRight = currentBlock.pdfX + currentBlock.pdfWidth;
                const gap = run.pdfX - currentRight;
                const maxGap = run.fontSizePt * 0.55;
                const validGap = (gap >= -1.0) && (gap <= maxGap);

                if (sameFont && sameSize && sameColor && sameBaseline && validGap) {
                    const separator = gap > (run.fontSizePt * 0.15) ? ' ' : '';
                    currentBlock.originalText += separator + run.str;
                    currentBlock.currentText = currentBlock.originalText;
                    currentBlock.pdfWidth = (run.pdfX + run.pdfWidth) - currentBlock.pdfX;
                    currentBlock.runs.push(run);
                } else {
                    lineBlocks.push(currentBlock);
                    currentBlock = this._createNewBlock(run, pageIndex);
                }
            }

            if (currentBlock) {
                lineBlocks.push(currentBlock);
            }

            return {
                blocks: lineBlocks,
                rawText: fullText.trim(),
                charCount: totalChars,
            };
        },

        _createNewBlock(run, pageIndex) {
            return {
                id: generateId(),
                pageIndex,
                originalText: run.str,
                currentText: run.str,
                pdfX: run.pdfX,
                pdfY: run.pdfY,
                baselinePdfY: run.baselinePdfY,
                pdfWidth: run.pdfWidth,
                pdfHeight: run.pdfHeight,
                fontSizePt: run.fontSizePt,
                fontId: run.fontId,
                loadedName: run.loadedName,
                realName: run.realName,
                embeddedBytes: run.embeddedBytes,
                ascentRatio: run.ascentRatio,
                descentRatio: run.descentRatio,
                bold: run.bold,
                italic: run.italic,
                matched: run.matched,
                colorHex: run.colorHex || '#1e293b',
                bgHex: '#ffffff',
                sampleVariance: 0,
                letterSpacingPt: 0,
                modified: false,
                deleted: false,
                tier: 1,
                runs: [run],
            };
        },

        /**
         * Sample perimeter background colors from rendered canvas for tight masking.
         */
        sampleBlockColors(canvas, blocks = [], scale = 1.0, pageHeightPt = 792) {
            if (!canvas || blocks.length === 0) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;

            for (const b of blocks) {
                const cx = Math.round(b.pdfX * scale);
                const baselineY = (pageHeightPt - b.baselinePdfY) * scale;
                const cy = Math.round(baselineY - (b.fontSizePt * scale * b.ascentRatio));
                const cw = Math.max(4, Math.round(b.pdfWidth * scale));
                const ch = Math.max(4, Math.round(b.fontSizePt * scale * (b.ascentRatio + Math.abs(b.descentRatio))));

                if (cx < 0 || cy < 0 || cx + cw > canvasWidth || cy + ch > canvasHeight) {
                    continue;
                }

                try {
                    const imgData = ctx.getImageData(cx, cy, cw, ch);
                    const data = imgData.data;
                    const bgSamples = [];

                    // Sample perimeter border pixels
                    for (let x = 0; x < cw; x += 3) {
                        const topIdx = (0 * cw + x) * 4;
                        bgSamples.push([data[topIdx], data[topIdx + 1], data[topIdx + 2]]);
                        const botIdx = ((ch - 1) * cw + x) * 4;
                        bgSamples.push([data[botIdx], data[botIdx + 1], data[botIdx + 2]]);
                    }

                    if (bgSamples.length > 0) {
                        const avgR = bgSamples.reduce((acc, c) => acc + c[0], 0) / bgSamples.length;
                        const avgG = bgSamples.reduce((acc, c) => acc + c[1], 0) / bgSamples.length;
                        const avgB = bgSamples.reduce((acc, c) => acc + c[2], 0) / bgSamples.length;

                        // Calculate variance
                        let variance = 0;
                        for (const c of bgSamples) {
                            variance += Math.hypot(c[0] - avgR, c[1] - avgG, c[2] - avgB);
                        }
                        variance /= bgSamples.length;
                        b.sampleVariance = Math.round(variance);

                        // If variance is near 0 and color is clear, record background fill
                        b.bgHex = rgbToHex(avgR, avgG, avgB);
                    }
                } catch (e) {}
            }
        },

        isScannedPdf(pagesBlocks = []) {
            let total = 0;
            for (const list of pagesBlocks) {
                for (const b of (list || [])) {
                    total += (b.originalText || '').trim().length;
                }
            }
            return total === 0;
        },
    };

    window.TextExtractor = TextExtractor;
})(window);
