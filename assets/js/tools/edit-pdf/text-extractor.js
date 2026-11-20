/**
 * PDFToolKit - Text Extractor Module (window.TextExtractor)
 *
 * Extracts text content, coordinate matrices, groups adjacent runs into line blocks,
 * samples background/text colors from canvas, and detects scanned documents.
 * 100% Client-Side. Permissive MIT / Apache 2.0 compatible.
 */

(function (window) {
    'use strict';

    let idCounter = 1;

    function generateId() {
        return `tb-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    const TextExtractor = {
        /**
         * Extract and group text line blocks from a single PDF.js page.
         * @param {Object} page PDFPageProxy instance
         * @param {number} pageIndex 0-based page index
         * @returns {Promise<{ blocks: Array, rawText: string, charCount: number }>}
         */
        async extractPageText(page, pageIndex = 0) {
            const textContent = await page.getTextContent({ includeMarkedContent: false });
            const unscaledViewport = page.getViewport({ scale: 1.0, rotation: page.rotate || 0 });
            const items = textContent.items || [];

            if (items.length === 0) {
                return { blocks: [], rawText: '', charCount: 0 };
            }

            const rawRuns = [];
            let totalChars = 0;
            let fullText = '';

            for (const item of items) {
                const str = item.str || '';
                if (!str) continue;
                totalChars += str.length;
                fullText += str + ' ';

                const tx = item.transform; // [a, b, c, d, e, f]
                // Font size in points (height)
                const fontSizePt = Math.hypot(tx[2], tx[3]) || Math.hypot(tx[0], tx[1]) || item.height || 12;
                
                // Font classification
                const styleObj = textContent.styles ? textContent.styles[item.fontName] : null;
                const fontTraits = window.FontManager 
                    ? window.FontManager.detectFontTraits(item.fontName, styleObj)
                    : { family: 'sans', bold: false, italic: false };

                // PDF User space coordinates (bottom-left origin)
                const pdfX = tx[4];
                const pdfY = tx[5];
                const pdfWidth = item.width || (str.length * fontSizePt * 0.5);
                const pdfHeight = item.height || fontSizePt;

                rawRuns.push({
                    str,
                    pdfX,
                    pdfY,
                    pdfWidth,
                    pdfHeight,
                    fontSizePt,
                    family: fontTraits.family,
                    bold: fontTraits.bold,
                    italic: fontTraits.italic,
                });
            }

            // Group horizontal runs into lines
            // Sort by vertical position (descending in PDF space = top to bottom) then by horizontal (left to right)
            rawRuns.sort((a, b) => {
                if (Math.abs(a.pdfY - b.pdfY) > 3) {
                    return b.pdfY - a.pdfY;
                }
                return a.pdfX - b.pdfX;
            });

            const lineBlocks = [];
            let currentBlock = null;

            for (const run of rawRuns) {
                if (!currentBlock) {
                    currentBlock = this._createNewBlock(run, pageIndex);
                    continue;
                }

                // Check if run belongs on the same horizontal baseline
                const sameY = Math.abs(currentBlock.pdfY - run.pdfY) <= 3.5;
                const sameFont = currentBlock.family === run.family &&
                                 currentBlock.bold === run.bold &&
                                 currentBlock.italic === run.italic &&
                                 Math.abs(currentBlock.fontSizePt - run.fontSizePt) <= 2.5;

                // Horizontal gap check
                const currentRight = currentBlock.pdfX + currentBlock.pdfWidth;
                const gap = run.pdfX - currentRight;
                const maxGap = run.fontSizePt * 1.8;

                if (sameY && sameFont && gap >= -2 && gap <= maxGap) {
                    // Merge into current line
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
                pdfWidth: run.pdfWidth,
                pdfHeight: run.pdfHeight,
                fontSizePt: Math.round(run.fontSizePt * 10) / 10,
                fontFamily: run.family,
                bold: run.bold,
                italic: run.italic,
                colorHex: '#1e293b', // Default dark slate
                bgHex: '#ffffff',    // Default white background
                sampleVariance: 0,
                modified: false,
                deleted: false,
                runs: [run],
            };
        },

        /**
         * Auto-sample background and text colors from rendered PDF.js canvas.
         * @param {HTMLCanvasElement} canvas Rendered page canvas
         * @param {Array} blocks Array of text line blocks
         * @param {number} scale Current viewport scale applied to canvas
         * @param {number} pageHeightPt Height of page in points
         */
        sampleBlockColors(canvas, blocks = [], scale = 1.0, pageHeightPt = 792) {
            if (!canvas || blocks.length === 0) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;

            for (const b of blocks) {
                // Convert PDF points (bottom-left) to canvas coordinates (top-left)
                const cx = Math.round(b.pdfX * scale);
                const cy = Math.round((pageHeightPt - b.pdfY - b.fontSizePt) * scale);
                const cw = Math.max(4, Math.round(b.pdfWidth * scale));
                const ch = Math.max(4, Math.round(b.fontSizePt * 1.2 * scale));

                if (cx < 0 || cy < 0 || cx + cw > canvasWidth || cy + ch > canvasHeight) {
                    continue;
                }

                try {
                    // 1. Sample perimeter pixels for background color
                    const imgData = ctx.getImageData(cx, cy, cw, ch);
                    const data = imgData.data;

                    const bgSamples = [];
                    // Top and bottom row
                    for (let x = 0; x < cw; x += 2) {
                        const topIdx = (0 * cw + x) * 4;
                        bgSamples.push([data[topIdx], data[topIdx + 1], data[topIdx + 2]]);
                        const botIdx = ((ch - 1) * cw + x) * 4;
                        bgSamples.push([data[botIdx], data[botIdx + 1], data[botIdx + 2]]);
                    }

                    if (bgSamples.length > 0) {
                        // Median calculation
                        const avgR = bgSamples.reduce((acc, c) => acc + c[0], 0) / bgSamples.length;
                        const avgG = bgSamples.reduce((acc, c) => acc + c[1], 0) / bgSamples.length;
                        const avgB = bgSamples.reduce((acc, c) => acc + c[2], 0) / bgSamples.length;

                        // Check variance
                        let variance = 0;
                        for (const c of bgSamples) {
                            variance += Math.hypot(c[0] - avgR, c[1] - avgG, c[2] - avgB);
                        }
                        variance /= bgSamples.length;
                        b.sampleVariance = Math.round(variance);

                        // If variance is low and near white, default clean #FFFFFF
                        if (avgR > 240 && avgG > 240 && avgB > 240) {
                            b.bgHex = '#ffffff';
                        } else {
                            b.bgHex = rgbToHex(avgR, avgG, avgB);
                        }

                        // 2. Sample darkest/contrasting pixels for text color
                        let bestText = null;
                        let maxDiff = -1;
                        for (let i = 0; i < data.length; i += 16) {
                            const r = data[i], g = data[i + 1], bVal = data[i + 2], a = data[i + 3];
                            if (a < 128) continue;
                            const diff = Math.hypot(r - avgR, g - avgG, bVal - avgB);
                            if (diff > maxDiff) {
                                maxDiff = diff;
                                bestText = [r, g, bVal];
                            }
                        }

                        if (bestText && maxDiff > 30) {
                            b.colorHex = rgbToHex(bestText[0], bestText[1], bestText[2]);
                        }
                    }
                } catch (e) {
                    // Cross-origin or read error fallback
                }
            }
        },

        /**
         * Check if all pages combined have 0 characters (scanned image PDF).
         */
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
