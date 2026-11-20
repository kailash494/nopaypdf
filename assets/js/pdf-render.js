/**
 * PDFToolKit - Shared Client-Side PDF Rendering & ZIP Suite (window.PDFRender)
 *
 * Utilizes PDF.js (v3.11.174) for non-blocking canvas thumbnail rendering,
 * and JSZip (v3.10.1) for client-side archive packaging.
 * Permissive MIT/Apache 2.0 compatible.
 */

(function (window) {
    'use strict';

    let workerInitialized = false;

    const PDFRender = {
        /**
         * Initialize the PDF.js Web Worker once safely.
         */
        initPdfJsWorker() {
            if (workerInitialized) return;
            if (typeof pdfjsLib !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                workerInitialized = true;
            } else {
                console.warn('pdfjsLib is not loaded on the page');
            }
        },

        /**
         * Load a PDF document for previewing without detaching the caller's ArrayBuffer.
         * Clones the ArrayBuffer before passing it to PDF.js worker.
         * @param {ArrayBuffer} arrayBuffer
         * @returns {Promise<{ pdfProxy: Object, numPages: number }>}
         */
        async loadPreviewDocument(arrayBuffer) {
            this.initPdfJsWorker();
            if (!arrayBuffer) {
                throw new Error('No ArrayBuffer provided to loadPreviewDocument');
            }

            // CRITICAL: Clone the buffer so PDF.js Web Worker transfer never detaches the original
            const clonedBytes = new Uint8Array(arrayBuffer).slice();

            const loadingTask = pdfjsLib.getDocument({
                data: clonedBytes,
                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                cMapPacked: true,
            });

            const pdfProxy = await loadingTask.promise;
            return {
                pdfProxy,
                pdfDoc: pdfProxy,
                numPages: pdfProxy.numPages,
                pageCount: pdfProxy.numPages,
            };
        },

        /**
         * Convenience alias for loadPreviewDocument
         */
        async loadPreviewDoc(arrayBuffer) {
            return this.loadPreviewDocument(arrayBuffer);
        },

        /**
         * Safely destroy a PDFDocumentProxy instance
         */
        async destroyDoc(pdfDoc) {
            if (pdfDoc && typeof pdfDoc.destroy === 'function') {
                try {
                    await pdfDoc.destroy();
                } catch (e) {}
            }
        },

        /**
         * Render a specific page of a PDFDocumentProxy onto a <canvas>.
         * @param {Object} pdfProxy
         * @param {number} pageNum 1-based page number
         * @param {Object} options { maxWidth: number, rotationDelta: number, targetCanvas: HTMLCanvasElement }
         * @returns {Promise<HTMLCanvasElement>}
         */
        async renderPageToCanvas(pdfProxy, pageNum, options = {}) {
            const {
                maxWidth = 220,
                rotationDelta = 0,
                targetCanvas = null,
            } = options;

            const page = await pdfProxy.getPage(pageNum);

            // Compute cumulative rotation (page intrinsic rotation + user rotation)
            const intrinsicRotation = page.rotate || 0;
            const effectiveRotation = ((intrinsicRotation + rotationDelta) % 360 + 360) % 360;

            // Compute viewport for scaling
            const unscaledViewport = page.getViewport({ scale: 1.0, rotation: effectiveRotation });
            const scale = maxWidth / unscaledViewport.width;
            const viewport = page.getViewport({ scale, rotation: effectiveRotation });

            const canvas = targetCanvas || document.createElement('canvas');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);

            const ctx = canvas.getContext('2d', { alpha: false });
            // Fill crisp white background before rendering
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const renderContext = {
                canvasContext: ctx,
                viewport,
            };

            await page.render(renderContext).promise;
            return canvas;
        },

        /**
         * Render thumbnails across pages in small async batches to preserve tab responsiveness.
         * Supports AbortSignal to immediately cancel obsolete renders if a file changes.
         * @param {Object} pdfProxy
         * @param {HTMLElement} containerEl
         * @param {Object} options { onPageRendered, batchSize, signal, maxWidth, rotationGetter }
         */
        async renderThumbnailsBatched(pdfProxy, containerEl, options = {}) {
            const {
                onPageRendered = () => {},
                batchSize = 6,
                signal = null,
                maxWidth = 200,
                rotationGetter = () => 0,
            } = options;

            const numPages = pdfProxy.numPages;

            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                if (signal && signal.aborted) {
                    return;
                }

                try {
                    const rotDelta = typeof rotationGetter === 'function' ? rotationGetter(pageNum) : 0;
                    const canvas = await this.renderPageToCanvas(pdfProxy, pageNum, {
                        maxWidth,
                        rotationDelta: rotDelta,
                    });

                    if (signal && signal.aborted) return;

                    onPageRendered(pageNum, canvas);
                } catch (err) {
                    if (signal && signal.aborted) return;
                    console.error(`Failed rendering thumbnail for page ${pageNum}:`, err);
                }

                // Yield control to the browser every batchSize pages
                if (pageNum % batchSize === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        },

        /**
         * Parse custom range expressions like "1-3, 5, 8-10" into structured validated page numbers.
         * @param {string} rangeString
         * @param {number} totalPages
         * @returns {{ valid: boolean, groups: number[][], flatPages: number[], error?: string }}
         */
        parsePageRanges(rangeString, totalPages) {
            if (!rangeString || typeof rangeString !== 'string' || !rangeString.trim()) {
                return { valid: false, groups: [], flatPages: [], error: 'Please enter at least one page or range.' };
            }

            const rawTokens = rangeString.split(',').map(t => t.trim()).filter(Boolean);
            if (rawTokens.length === 0) {
                return { valid: false, groups: [], flatPages: [], error: 'Range expression cannot be empty.' };
            }

            const groups = [];
            const flatSet = new Set();
            const flatPages = [];

            for (const token of rawTokens) {
                if (token.includes('-')) {
                    const parts = token.split('-');
                    if (parts.length !== 2) {
                        return { valid: false, groups: [], flatPages: [], error: `Invalid range format: "${token}"` };
                    }

                    const start = parseInt(parts[0].trim(), 10);
                    const end = parseInt(parts[1].trim(), 10);

                    if (isNaN(start) || isNaN(end)) {
                        return { valid: false, groups: [], flatPages: [], error: `Non-numeric values in range: "${token}"` };
                    }
                    if (start < 1) {
                        return { valid: false, groups: [], flatPages: [], error: `Page number must be 1 or greater: "${token}"` };
                    }
                    if (end > totalPages) {
                        return { valid: false, groups: [], flatPages: [], error: `Page ${end} exceeds total document pages (${totalPages}).` };
                    }
                    if (start > end) {
                        return { valid: false, groups: [], flatPages: [], error: `Start page cannot be greater than end page: "${token}"` };
                    }

                    const group = [];
                    for (let p = start; p <= end; p++) {
                        group.push(p);
                        if (!flatSet.has(p)) {
                            flatSet.add(p);
                            flatPages.push(p);
                        }
                    }
                    groups.push(group);
                } else {
                    const page = parseInt(token, 10);
                    if (isNaN(page)) {
                        return { valid: false, groups: [], flatPages: [], error: `Invalid page number: "${token}"` };
                    }
                    if (page < 1 || page > totalPages) {
                        return { valid: false, groups: [], flatPages: [], error: `Page ${page} is out of bounds (document has ${totalPages} pages).` };
                    }

                    groups.push([page]);
                    if (!flatSet.has(page)) {
                        flatSet.add(page);
                        flatPages.push(page);
                    }
                }
            }

            return {
                valid: true,
                groups,
                flatPages,
            };
        },

        /**
         * Pack multiple files into a ZIP archive and trigger download.
         * @param {Array<{ name: string, bytes: Uint8Array }>} entries
         * @param {string} zipFilename
         * @param {Function} onProgress
         */
        async buildAndDownloadZip(entries, zipFilename = 'documents.zip', onProgress = () => {}) {
            if (typeof JSZip === 'undefined') {
                throw new Error('JSZip library is not loaded on the page');
            }

            const zip = new JSZip();
            for (const entry of entries) {
                zip.file(entry.name, entry.bytes, { binary: true });
            }

            const blob = await zip.generateAsync(
                {
                    type: 'blob',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 6 }
                },
                (metadata) => {
                    onProgress(metadata.percent);
                }
            );

            PDFCore.downloadBlob(blob, zipFilename, 'application/zip');
        }
    };

    window.PDFRender = PDFRender;

})(window);
