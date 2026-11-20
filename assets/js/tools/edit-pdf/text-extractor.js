/**
 * NoPayPDF - Text Extractor Module (window.TextExtractor)
 *
 * Exact operator-level fill color extraction from page.getOperatorList(),
 * mathematical vector background detection for headers/table rows,
 * pure white (#FFFFFF) vector page defaults (zero pixel sampling on white pages),
 * constituent rawRuns storage for surgical content-stream removal,
 * and high-DPI halo pixel sampling fallback for image backgrounds.
 *
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

    function multMatrix(m1, m2) {
        return [
            m1[0] * m2[0] + m1[1] * m2[2],
            m1[0] * m2[1] + m1[1] * m2[3],
            m1[2] * m2[0] + m1[3] * m2[2],
            m1[2] * m2[1] + m1[3] * m2[3],
            m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
            m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
        ];
    }

    function transformPoint(p, m) {
        return [
            p[0] * m[0] + p[1] * m[2] + m[4],
            p[0] * m[1] + p[1] * m[3] + m[5],
        ];
    }

    const TextExtractor = {
        /**
         * Extract operator-level fill colors and vector background geometry from page.getOperatorList().
         * @param {Object} page PDFPageProxy
         * @returns {Promise<{ textColors: Array<string>, vectorRects: Array, imageRects: Array }>}
         */
        async extractPageGraphics(page) {
            const textColors = [];
            const vectorRects = [];
            const imageRects = [];

            try {
                const opList = await page.getOperatorList();
                const OPS = window.pdfjsLib ? window.pdfjsLib.OPS : {};

                const graphicsStack = [];
                let ctm = [1, 0, 0, 1, 0, 0];
                let currentColor = '#000000';

                let pendingPaths = []; // [{ minX, minY, maxX, maxY, width, height }]

                for (let i = 0; i < opList.fnArray.length; i++) {
                    const fn = opList.fnArray[i];
                    const args = opList.argsArray[i];

                    if (fn === OPS.save) {
                        graphicsStack.push({ ctm: ctm.slice(), color: currentColor });
                    } else if (fn === OPS.restore) {
                        const state = graphicsStack.pop();
                        if (state) {
                            ctm = state.ctm;
                            currentColor = state.color;
                        }
                    } else if (fn === OPS.transform && args && args.length >= 6) {
                        ctm = multMatrix(args.slice(0, 6), ctm);
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
                    } else if ((fn === OPS.setFillColor || fn === OPS.setFillColorN) && args && args.length >= 1) {
                        if (args.length === 1) {
                            currentColor = rgbToHex(args[0], args[0], args[0]);
                        } else if (args.length === 3) {
                            currentColor = rgbToHex(args[0], args[1], args[2]);
                        } else if (args.length >= 4) {
                            const c = args[0] > 1 ? args[0] / 255 : args[0];
                            const m = args[1] > 1 ? args[1] / 255 : args[1];
                            const y = args[2] > 1 ? args[2] / 255 : args[2];
                            const k = args[3] > 1 ? args[3] / 255 : args[3];
                            const r = 255 * (1 - c) * (1 - k);
                            const g = 255 * (1 - m) * (1 - k);
                            const b = 255 * (1 - y) * (1 - k);
                            currentColor = rgbToHex(r, g, b);
                        }
                    } else if (fn === OPS.showText || fn === OPS.showSpacedText || fn === OPS.nextLineShowText || fn === OPS.nextLineSetSpacingShowText) {
                        textColors.push(currentColor);
                    } else if (fn === OPS.rectangle && args && args.length >= 4) {
                        const x = args[0];
                        const y = args[1];
                        const w = args[2];
                        const h = args[3];
                        const corners = [
                            transformPoint([x, y], ctm),
                            transformPoint([x + w, y], ctm),
                            transformPoint([x + w, y + h], ctm),
                            transformPoint([x, y + h], ctm),
                        ];
                        const xs = corners.map(p => p[0]);
                        const ys = corners.map(p => p[1]);
                        const minX = Math.min(...xs);
                        const maxX = Math.max(...xs);
                        const minY = Math.min(...ys);
                        const maxY = Math.max(...ys);

                        pendingPaths.push({
                            minX,
                            minY,
                            maxX,
                            maxY,
                            width: maxX - minX,
                            height: maxY - minY,
                        });
                    } else if (fn === OPS.constructPath && args && args.length >= 2) {
                        const ops = args[0];
                        const coords = args[1];
                        if (coords && coords.length >= 4) {
                            let pts = [];
                            for (let c = 0; c < coords.length; c += 2) {
                                pts.push(transformPoint([coords[c], coords[c + 1]], ctm));
                            }
                            const xs = pts.map(p => p[0]);
                            const ys = pts.map(p => p[1]);
                            const minX = Math.min(...xs);
                            const maxX = Math.max(...xs);
                            const minY = Math.min(...ys);
                            const maxY = Math.max(...ys);

                            pendingPaths.push({
                                minX,
                                minY,
                                maxX,
                                maxY,
                                width: maxX - minX,
                                height: maxY - minY,
                            });
                        }
                    } else if (fn === OPS.fill || fn === OPS.eoFill || fn === OPS.fillStroke || fn === OPS.eoFillStroke) {
                        if (pendingPaths.length > 0) {
                            for (const p of pendingPaths) {
                                vectorRects.push({
                                    minX: p.minX,
                                    minY: p.minY,
                                    maxX: p.maxX,
                                    maxY: p.maxY,
                                    width: p.width,
                                    height: p.height,
                                    colorHex: currentColor,
                                });
                            }
                            pendingPaths = [];
                        }
                    } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
                        // Standard PDF images draw in unit square (0,0) to (1,1) transformed by CTM
                        const corners = [
                            transformPoint([0, 0], ctm),
                            transformPoint([1, 0], ctm),
                            transformPoint([1, 1], ctm),
                            transformPoint([0, 1], ctm),
                        ];
                        const xs = corners.map(p => p[0]);
                        const ys = corners.map(p => p[1]);
                        imageRects.push({
                            minX: Math.min(...xs),
                            maxX: Math.max(...xs),
                            minY: Math.min(...ys),
                            maxY: Math.max(...ys),
                        });
                    }
                }
            } catch (err) {
                console.warn('Operator list graphics extraction warning:', err);
            }

            return { textColors, vectorRects, imageRects };
        },

        /**
         * Extract and strictly group text line blocks from a PDF.js page.
         * @param {Object} page PDFPageProxy instance
         * @param {number} pageIndex 0-based page index
         * @param {Map<string, Uint8Array>|null} embeddedFontsMap Optional pre-extracted embedded font streams
         * @returns {Promise<{ blocks: Array, rawText: string, charCount: number }>}
         */
        async extractPageText(page, pageIndex = 0, embeddedFontsMap = null) {
            // Extract operator colors, vector rectangles, and image bounding boxes
            const graphics = await this.extractPageGraphics(page);
            const opColors = graphics.textColors;
            const vectorRects = graphics.vectorRects;
            const imageRects = graphics.imageRects;

            const textContent = await page.getTextContent({ includeMarkedContent: false });
            const items = textContent.items || [];
            if (items.length === 0) {
                return { blocks: [], rawText: '', charCount: 0 };
            }

            // Page dimensions in PDF points
            const view = page.view || [0, 0, 612, 792];
            const pageWidthPt = view[2] - view[0];
            const pageHeightPt = view[3] - view[1];

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
                // 1. Same font
                const sameFont = (currentBlock.loadedName === run.loadedName || currentBlock.realName === run.realName) &&
                                 currentBlock.bold === run.bold &&
                                 currentBlock.italic === run.italic;

                // 2. Font size within 0.5 pt
                const sameSize = Math.abs(currentBlock.fontSizePt - run.fontSizePt) <= 0.5;

                // 3. Exact color match
                const sameColor = currentBlock.colorHex.toLowerCase() === run.colorHex.toLowerCase();

                // 4. Same baseline within 0.25 * fontSize
                const sameBaseline = Math.abs(currentBlock.baselinePdfY - run.baselinePdfY) <= (0.25 * run.fontSizePt);

                // 5. Horizontal gap: cannot exceed 0.55 * fontSize
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
                    currentBlock.rawRuns.push({
                        str: run.str,
                        pdfX: run.pdfX,
                        pdfY: run.pdfY,
                        baselinePdfY: run.baselinePdfY,
                        pdfWidth: run.pdfWidth,
                        pdfHeight: run.pdfHeight,
                        fontSizePt: run.fontSizePt,
                    });
                } else {
                    lineBlocks.push(currentBlock);
                    currentBlock = this._createNewBlock(run, pageIndex);
                }
            }

            if (currentBlock) {
                lineBlocks.push(currentBlock);
            }

            // Assign True Mathematical Vector Background Colors
            for (const b of lineBlocks) {
                const centerX = b.pdfX + (b.pdfWidth / 2);
                const centerY = b.baselinePdfY + (b.fontSizePt * 0.3);

                let matchedVectorColor = null;

                // Walk vectorRects in reverse order (topmost first)
                for (let r = vectorRects.length - 1; r >= 0; r--) {
                    const vr = vectorRects[r];
                    // Skip full-page background rects (> 85% of page width & height)
                    if (vr.width >= pageWidthPt * 0.85 && vr.height >= pageHeightPt * 0.85) {
                        continue;
                    }
                    // Skip thin borders (< 4pt)
                    if (vr.width < 4 || vr.height < 4) {
                        continue;
                    }

                    if (centerX >= (vr.minX - 1) && centerX <= (vr.maxX + 1) &&
                        centerY >= (vr.minY - 1) && centerY <= (vr.maxY + 1)) {
                        matchedVectorColor = vr.colorHex;
                        break;
                    }
                }

                if (matchedVectorColor) {
                    b.bgHex = matchedVectorColor;
                    b.vectorBgHex = matchedVectorColor;
                    b.hasVectorBg = true;
                } else {
                    // Check if an image sits underneath
                    let hasImage = false;
                    for (const ir of imageRects) {
                        if (centerX >= (ir.minX - 1) && centerX <= (ir.maxX + 1) &&
                            centerY >= (ir.minY - 1) && centerY <= (ir.maxY + 1)) {
                            hasImage = true;
                            break;
                        }
                    }

                    b.hasImageBg = hasImage;
                    // Standard vector page: Pure #FFFFFF default
                    b.bgHex = '#ffffff';
                    b.vectorBgHex = '#ffffff';
                }
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
                vectorBgHex: '#ffffff',
                hasVectorBg: false,
                hasImageBg: false,
                sampleVariance: 0,
                letterSpacingPt: 0,
                modified: false,
                deleted: false,
                tier: 1,
                runs: [run],
                rawRuns: [{
                    str: run.str,
                    pdfX: run.pdfX,
                    pdfY: run.pdfY,
                    baselinePdfY: run.baselinePdfY,
                    pdfWidth: run.pdfWidth,
                    pdfHeight: run.pdfHeight,
                    fontSizePt: run.fontSizePt,
                }],
            };
        },

        /**
         * Sample perimeter background colors from rendered canvas ONLY for image backgrounds.
         * For standard vector pages, bgHex is already exact vector color or #FFFFFF.
         */
        sampleBlockColors(canvas, blocks = [], scale = 1.0, pageHeightPt = 792) {
            if (!canvas || blocks.length === 0) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;

            // Compute true backing-store ratio (accounting for high-DPI scaling)
            const expectedWidth = (blocks[0]?.pageWidthPt || 612) * scale;
            const backingRatio = expectedWidth > 0 ? (canvasWidth / expectedWidth) : 1.0;
            const totalScale = scale * backingRatio;

            for (const b of blocks) {
                // If block already has verified vector color or is on clean vector page without images, NEVER sample pixels!
                if (!b.hasImageBg) {
                    continue;
                }

                // Sample a 2px outer halo 4px-7px OUTSIDE the text bounding box (prevent glyph ink contamination)
                const haloOffset = Math.round(5 * totalScale);
                const cx = Math.round(b.pdfX * totalScale) - haloOffset;
                const baselineY = (pageHeightPt - b.baselinePdfY) * totalScale;
                const cy = Math.round(baselineY - (b.fontSizePt * totalScale * b.ascentRatio)) - haloOffset;
                const cw = Math.max(8, Math.round(b.pdfWidth * totalScale) + (haloOffset * 2));
                const ch = Math.max(8, Math.round(b.fontSizePt * totalScale * (b.ascentRatio + Math.abs(b.descentRatio))) + (haloOffset * 2));

                if (cx < 0 || cy < 0 || cx + cw > canvasWidth || cy + ch > canvasHeight) {
                    continue;
                }

                try {
                    const imgData = ctx.getImageData(cx, cy, cw, ch);
                    const data = imgData.data;
                    const samples = [];

                    // Sample perimeter border pixels
                    for (let x = 0; x < cw; x += 4) {
                        const topIdx = (0 * cw + x) * 4;
                        samples.push([data[topIdx], data[topIdx + 1], data[topIdx + 2]]);
                        const botIdx = ((ch - 1) * cw + x) * 4;
                        samples.push([data[botIdx], data[botIdx + 1], data[botIdx + 2]]);
                    }

                    if (samples.length > 0) {
                        // Outlier rejection: sort by brightness (L = 0.299R + 0.587G + 0.114B)
                        samples.sort((c1, c2) => {
                            const l1 = 0.299 * c1[0] + 0.587 * c1[1] + 0.114 * c1[2];
                            const l2 = 0.299 * c2[0] + 0.587 * c2[1] + 0.114 * c2[2];
                            return l1 - l2;
                        });

                        // Select 85th percentile brightest cluster
                        const p85Idx = Math.floor(samples.length * 0.85);
                        const cluster = samples.slice(Math.max(0, p85Idx - 3), Math.min(samples.length, p85Idx + 4));

                        const r = Math.round(cluster.reduce((sum, c) => sum + c[0], 0) / cluster.length);
                        const g = Math.round(cluster.reduce((sum, c) => sum + c[1], 0) / cluster.length);
                        const b_col = Math.round(cluster.reduce((sum, c) => sum + c[2], 0) / cluster.length);

                        // Snap near-white neutral grays strictly to #FFFFFF
                        const maxCh = Math.max(r, g, b_col);
                        const minCh = Math.min(r, g, b_col);
                        if (r >= 235 && g >= 235 && b_col >= 235 && (maxCh - minCh) <= 8) {
                            b.bgHex = '#ffffff';
                        } else {
                            b.bgHex = rgbToHex(r, g, b_col);
                        }
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
