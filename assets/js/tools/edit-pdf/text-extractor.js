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
        if (typeof val !== 'number' || isNaN(val)) return 0;
        if (val > 0 && val < 1) {
            return Math.round(val * 255);
        }
        if (val === 1) {
            return 255;
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
                        let opStr = '';
                        if (args && args[0]) {
                            if (typeof args[0] === 'string') {
                                opStr = args[0];
                            } else if (Array.isArray(args[0])) {
                                for (const item of args[0]) {
                                    if (typeof item === 'string') opStr += item;
                                    else if (item && typeof item === 'object') {
                                        if (typeof item.unicode === 'string') opStr += item.unicode;
                                        else if (typeof item.fontChar === 'string') opStr += item.fontChar;
                                    }
                                }
                            }
                        }
                        textColors.push({ color: currentColor, str: opStr });
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
                const scaleY = Math.hypot(tx[2], tx[3]) || item.height || 12;
                const scaleX = Math.hypot(tx[0], tx[1]) || scaleY;
                const hScale = scaleY > 0 ? (scaleX / scaleY) : 1.0;
                const fontSizePt = Math.round(scaleY * 100) / 100;
                const roundedHScale = Math.round(hScale * 100) / 100;

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
                let colorHex = '#1e293b';
                if (opColors.length > 0) {
                    const exactMatch = opColors.find((op, idx) => {
                        return idx >= Math.max(0, textItemIdx - 3) &&
                               idx <= Math.min(opColors.length - 1, textItemIdx + 3) &&
                               op.str && (op.str === str || op.str.includes(str) || str.includes(op.str));
                    });
                    if (exactMatch) {
                        colorHex = exactMatch.color;
                    } else if (textItemIdx < opColors.length) {
                        const entry = opColors[textItemIdx];
                        colorHex = (typeof entry === 'object' && entry !== null) ? entry.color : (entry || '#1e293b');
                    }
                }
                textItemIdx++;

                // PDF User space coordinates (bottom-left origin)
                const pdfX = tx[4];
                const pdfY = tx[5]; // Baseline Y
                const pdfWidth = item.width || (str.length * fontSizePt * 0.5);
                const pdfHeight = item.height || fontSizePt;

                const baseFontName = (fontTraits.realName || '').replace(/^\//, '').replace(/^[A-Z]{6}\+/, '').trim() || fontTraits.loadedName || 'Original';

                rawRuns.push({
                    str,
                    pdfX,
                    pdfY,
                    baselinePdfY: pdfY,
                    pdfWidth,
                    pdfHeight,
                    fontSizePt,
                    hScale: roundedHScale,
                    fontId: fontTraits.fontId,
                    loadedName: fontTraits.loadedName,
                    realName: fontTraits.realName,
                    baseFontName,
                    embeddedBytes: fontTraits.embeddedBytes,
                    ascentRatio: fontTraits.ascentRatio,
                    descentRatio: fontTraits.descentRatio,
                    bold: fontTraits.bold,
                    italic: fontTraits.italic,
                    matched: fontTraits.matched,
                    colorHex,
                    exactPdfColorHex: colorHex,
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
                        hScale: run.hScale || 1.0,
                    });
                } else {
                    lineBlocks.push(currentBlock);
                    currentBlock = this._createNewBlock(run, pageIndex);
                }
            }

            if (currentBlock) {
                lineBlocks.push(currentBlock);
            }

            // All blocks initialize with clean white background defaults (never guess from operator-list vectors)
            for (const b of lineBlocks) {
                b.bgHex = '#ffffff';
                b.autoBgHex = '#ffffff';
                b.vectorBgHex = '#ffffff';
                b.hasVectorBg = false;
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
                hScale: run.hScale || 1.0,
                fontId: run.fontId,
                loadedName: run.loadedName,
                realName: run.realName,
                baseFontName: run.baseFontName || (run.realName || '').replace(/^\//, '').replace(/^[A-Z]{6}\+/, '').trim() || run.loadedName || 'Original',
                embeddedBytes: run.embeddedBytes,
                ascentRatio: run.ascentRatio,
                descentRatio: run.descentRatio,
                bold: run.bold,
                italic: run.italic,
                matched: run.matched,
                colorHex: run.colorHex || '#1e293b',
                exactPdfColorHex: run.exactPdfColorHex || run.colorHex || '#1e293b',
                bgHex: '#ffffff',
                autoBgHex: '#ffffff',
                vectorBgHex: '#ffffff',
                origPdfWidth: run.pdfWidth,
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
                    hScale: run.hScale || 1.0,
                }],
            };
        },

        /**
         * Sample authoritative background and text colors directly from the clean rendered baseCanvas.
         * Runs for ALL text blocks on the page (both vector pages and raster image scans).
         * @param {HTMLCanvasElement} canvas Rendered PDF.js baseCanvas
         * @param {Array} blocks Array of textBlock objects on this page
         * @param {Object|number} viewportOrScale PDFPage viewport object, or numeric scale fallback
         * @param {number} pageHeightPt Page height in PDF points (default 792)
         */
        sampleBlockColors(canvas, blocks = [], viewportOrScale = 1.0, pageHeightPt = 792) {
            if (!canvas || blocks.length === 0) return;
            const ctx = canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
            if (!ctx) return;

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;

            const isViewportObj = viewportOrScale && typeof viewportOrScale === 'object' && typeof viewportOrScale.convertToViewportRectangle === 'function';
            const scale = typeof viewportOrScale === 'number' ? viewportOrScale : (viewportOrScale?.scale || 1.0);

            // Compute fallback scales if viewport object is not provided
            const expectedWidth = (blocks[0]?.pageWidthPt || 612) * scale;
            const backingRatio = expectedWidth > 0 ? (canvasWidth / expectedWidth) : 1.0;
            const totalScale = scale * backingRatio;

            const scaleX = isViewportObj && viewportOrScale.width > 0 ? (canvasWidth / viewportOrScale.width) : backingRatio * scale;
            const scaleY = isViewportObj && viewportOrScale.height > 0 ? (canvasHeight / viewportOrScale.height) : backingRatio * scale;

            for (const b of blocks) {
                const ascentRatio = b.ascentRatio || 0.85;
                const descentRatio = Math.abs(b.descentRatio !== undefined ? b.descentRatio : -0.20);
                const baselinePdfY = b.baselinePdfY !== undefined ? b.baselinePdfY : b.pdfY;
                const ascentPt = b.fontSizePt * ascentRatio;
                const descentPt = b.fontSizePt * descentRatio;

                let boxX, boxY, boxW, boxH;

                if (isViewportObj) {
                    const x1 = b.pdfX;
                    const y1 = baselinePdfY - descentPt;
                    const x2 = b.pdfX + b.pdfWidth;
                    const y2 = baselinePdfY + ascentPt;

                    const vRect = viewportOrScale.convertToViewportRectangle([x1, y1, x2, y2]);
                    const vx1 = Math.min(vRect[0], vRect[2]);
                    const vy1 = Math.min(vRect[1], vRect[3]);
                    const vx2 = Math.max(vRect[0], vRect[2]);
                    const vy2 = Math.max(vRect[1], vRect[3]);

                    boxX = Math.round(vx1 * scaleX);
                    boxY = Math.round(vy1 * scaleY);
                    boxW = Math.max(4, Math.round((vx2 - vx1) * scaleX));
                    boxH = Math.max(4, Math.round((vy2 - vy1) * scaleY));
                } else {
                    const baselineCanvasY = (pageHeightPt - baselinePdfY) * totalScale;
                    const fontSizePx = b.fontSizePt * totalScale;

                    boxX = Math.round(b.pdfX * totalScale);
                    boxY = Math.round(baselineCanvasY - (fontSizePx * ascentRatio));
                    boxW = Math.max(4, Math.round(b.pdfWidth * totalScale));
                    boxH = Math.max(4, Math.round(fontSizePx * (ascentRatio + descentRatio)));
                }

                // 1. Sample Background from Perimeter Ring (1-3px outside text box)
                const ringOffset = Math.max(1, Math.min(4, Math.round(2 * (scaleX || 1))));
                const pLeft = Math.max(0, boxX - ringOffset);
                const pRight = Math.min(canvasWidth - 1, boxX + boxW + ringOffset);
                const pTop = Math.max(0, boxY - ringOffset);
                const pBottom = Math.min(canvasHeight - 1, boxY + boxH + ringOffset);

                const ringWidth = pRight - pLeft + 1;
                const ringHeight = pBottom - pTop + 1;

                // Default every block to clean white background
                let finalBgHex = '#ffffff';

                if (ringWidth > 0 && ringHeight > 0) {
                    try {
                        const ringImg = ctx.getImageData(pLeft, pTop, ringWidth, ringHeight);
                        const rData = ringImg.data;
                        const bgSamples = [];

                        const samplePx = (rx, ry) => {
                            if (rx < 0 || rx >= ringWidth || ry < 0 || ry >= ringHeight) return;
                            const idx = (ry * ringWidth + rx) * 4;
                            let r = rData[idx];
                            let g = rData[idx + 1];
                            let b_col = rData[idx + 2];
                            const a = rData[idx + 3];

                            // Transparent canvas pixel (alpha 0) is pure white
                            if (a === 0) {
                                bgSamples.push([255, 255, 255]);
                            } else if (a < 255) {
                                const alpha = a / 255;
                                r = Math.round(r * alpha + 255 * (1 - alpha));
                                g = Math.round(g * alpha + 255 * (1 - alpha));
                                b_col = Math.round(b_col * alpha + 255 * (1 - alpha));
                                bgSamples.push([r, g, b_col]);
                            } else {
                                bgSamples.push([r, g, b_col]);
                            }
                        };

                        // Sample top and bottom perimeter rows
                        for (let x = 0; x < ringWidth; x += 2) {
                            samplePx(x, 0);
                            samplePx(x, ringHeight - 1);
                        }
                        // Sample left and right perimeter columns
                        for (let y = 1; y < ringHeight - 1; y += 2) {
                            samplePx(0, y);
                            samplePx(ringWidth - 1, y);
                        }

                        if (bgSamples.length > 0) {
                            // Strict Majority Rule:
                            // Check how many pixels are non-white (not near-white)
                            const isNearWhite = (c) => {
                                return c[0] >= 245 && c[1] >= 245 && c[2] >= 245 &&
                                       Math.abs(c[0] - c[1]) <= 8 &&
                                       Math.abs(c[0] - c[2]) <= 8 &&
                                       Math.abs(c[1] - c[2]) <= 8;
                            };

                            const nonWhiteSamples = bgSamples.filter(c => !isNearWhite(c));
                            const nonWhiteRatio = nonWhiteSamples.length / bgSamples.length;

                            // Unless >= 75% of perimeter pixels are non-white, force white!
                            if (nonWhiteRatio >= 0.75) {
                                // Find mode/median cluster among non-white pixels
                                const colorCounts = new Map();
                                for (const c of nonWhiteSamples) {
                                    // 5-bit color buckets (~8 levels per channel)
                                    const key = `${c[0] >> 3}_${c[1] >> 3}_${c[2] >> 3}`;
                                    if (!colorCounts.has(key)) {
                                        colorCounts.set(key, { count: 0, rSum: 0, gSum: 0, bSum: 0, samples: [] });
                                    }
                                    const item = colorCounts.get(key);
                                    item.count++;
                                    item.rSum += c[0];
                                    item.gSum += c[1];
                                    item.bSum += c[2];
                                    item.samples.push(c);
                                }

                                let bestCluster = null;
                                for (const item of colorCounts.values()) {
                                    if (!bestCluster || item.count > bestCluster.count) {
                                        bestCluster = item;
                                    }
                                }

                                if (bestCluster) {
                                    const avgR = Math.round(bestCluster.rSum / bestCluster.count);
                                    const avgG = Math.round(bestCluster.gSum / bestCluster.count);
                                    const avgB = Math.round(bestCluster.bSum / bestCluster.count);

                                    // Check that >= 75% of ALL sampled perimeter pixels agree with this uniform color (within RGB tolerance 18)
                                    const agreeingSamples = bgSamples.filter(c =>
                                        Math.abs(c[0] - avgR) <= 18 &&
                                        Math.abs(c[1] - avgG) <= 18 &&
                                        Math.abs(c[2] - avgB) <= 18
                                    );

                                    if (agreeingSamples.length / bgSamples.length >= 0.75) {
                                        finalBgHex = rgbToHex(avgR, avgG, avgB);
                                    }
                                }
                            }
                        }
                    } catch (err) {}
                }

                b.bgHex = finalBgHex;
                b.autoBgHex = finalBgHex;
                b.hasVectorBg = (finalBgHex.toLowerCase() !== '#ffffff');

                // 2. Sample Foreground Glyph Ink Color inside bounding box
                // If authoritative vector PDF graphics color is already known, NEVER overwrite with fuzzy canvas pixel averages
                const hasAuthoritativeColor = Boolean(b.exactPdfColorHex && b.exactPdfColorHex !== '#1e293b');
                if (hasAuthoritativeColor && !b.hasImageBg) {
                    b.colorHex = b.exactPdfColorHex;
                } else {
                    const bgR = normColor(parseInt(finalBgHex.slice(1, 3), 16) || 255);
                    const bgG = normColor(parseInt(finalBgHex.slice(3, 5), 16) || 255);
                    const bgB = normColor(parseInt(finalBgHex.slice(5, 7), 16) || 255);

                    const cX = Math.max(0, boxX);
                    const cY = Math.max(0, boxY);
                    const cW = Math.min(canvasWidth - cX, boxW);
                    const cH = Math.min(canvasHeight - cY, boxH);

                    if (cW > 2 && cH > 2) {
                        try {
                            const boxImg = ctx.getImageData(cX, cY, cW, cH);
                            const bData = boxImg.data;
                            const inkPixels = [];

                            for (let i = 0; i < bData.length; i += 4) {
                                let r = bData[i];
                                let g = bData[i + 1];
                                let b_col = bData[i + 2];
                                const a = bData[i + 3];

                                if (a === 0) continue;
                                if (a < 255) {
                                    const alpha = a / 255;
                                    r = Math.round(r * alpha + 255 * (1 - alpha));
                                    g = Math.round(g * alpha + 255 * (1 - alpha));
                                    b_col = Math.round(b_col * alpha + 255 * (1 - alpha));
                                }

                                const dist = Math.hypot(r - bgR, g - bgG, b_col - bgB);
                                if (dist > 35) {
                                    inkPixels.push({ r, g, b: b_col, dist });
                                }
                            }

                            if (inkPixels.length >= 3) {
                                inkPixels.sort((p1, p2) => p2.dist - p1.dist);
                                // Take the top 20% most contrasting pixels (the center of glyph strokes, ignoring anti-aliased edges)
                                const startIdx = 0;
                                const endIdx = Math.max(3, Math.floor(inkPixels.length * 0.20));
                                const coreInk = inkPixels.slice(startIdx, endIdx);

                                if (coreInk.length > 0) {
                                    const inkR = Math.round(coreInk.reduce((sum, p) => sum + p.r, 0) / coreInk.length);
                                    const inkG = Math.round(coreInk.reduce((sum, p) => sum + p.g, 0) / coreInk.length);
                                    const inkB = Math.round(coreInk.reduce((sum, p) => sum + p.b, 0) / coreInk.length);

                                    if (inkR <= 22 && inkG <= 22 && inkB <= 22) {
                                        b.colorHex = '#000000';
                                    } else {
                                        b.colorHex = rgbToHex(inkR, inkG, inkB);
                                    }
                                }
                            }
                        } catch (err) {}
                    }
                }
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
