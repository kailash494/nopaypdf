/**
 * NoPayPDF - Grayscale PDF Controller
 * Converts color documents to monochrome grayscale or high-contrast black and white.
 * 100% Client-Side. Permissive MIT/Apache 2.0 implementation.
 */

(function (window, document) {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        // --- DOM Elements ---
        const uploadPanel = document.getElementById('upload-panel');
        const pdfDropzone = document.getElementById('pdf-dropzone');
        const pdfFileInput = document.getElementById('pdf-file-input');
        const errorAlert = document.getElementById('error-alert');
        const errorMessage = document.getElementById('error-message');
        const errorDismissBtn = document.getElementById('error-dismiss-btn');

        const configPanel = document.getElementById('config-panel');
        const docFilename = document.getElementById('doc-filename');
        const docMeta = document.getElementById('doc-meta');
        const changeFileBtn = document.getElementById('change-file-btn');

        // Form controls
        const toneRadios = document.querySelectorAll('input[name="tone-mode"]');
        const toneOptionLabels = document.querySelectorAll('.tone-option-label');
        const thresholdSliderGroup = document.getElementById('threshold-slider-group');
        const thresholdSlider = document.getElementById('threshold-slider');
        const thresholdValLabel = document.getElementById('threshold-val-label');
        const resolutionSelect = document.getElementById('resolution-select');
        const pageScopeRadios = document.querySelectorAll('input[name="page-scope"]');
        const customRangeInput = document.getElementById('custom-range-input');
        const convertGrayscaleBtn = document.getElementById('convert-grayscale-btn');

        // Preview Canvases
        const originalPreviewCanvas = document.getElementById('original-preview-canvas');
        const grayscalePreviewCanvas = document.getElementById('grayscale-preview-canvas');
        const monoSingleCanvas = document.getElementById('mono-single-canvas');
        const splitPreviewWrap = document.getElementById('split-preview-wrap');
        const monoPreviewWrap = document.getElementById('mono-preview-wrap');
        const toggleSplitViewBtn = document.getElementById('toggle-split-view-btn');
        const toggleMonoOnlyBtn = document.getElementById('toggle-mono-only-btn');

        // Progress & Result
        const progressPanel = document.getElementById('progress-panel');
        const progressBar = document.getElementById('progress-bar');
        const progressTitle = document.getElementById('progress-title');
        const progressDesc = document.getElementById('progress-desc');
        const resultPanel = document.getElementById('result-panel');
        const resOrigSize = document.getElementById('res-orig-size');
        const resMonoSize = document.getElementById('res-mono-size');
        const downloadGrayscalePdfBtn = document.getElementById('download-grayscale-pdf-btn');
        const grayscaleResetBtn = document.getElementById('grayscale-reset-btn');

        // --- Application State ---
        let originalFile = null;
        let originalArrayBuffer = null;
        let pdfDocProxy = null;
        let totalPages = 1;
        let lastConvertedPdfBytes = null;
        let cachedPage1ImageData = null;

        // Init PDF.js
        PDFRender.initPdfJsWorker();

        function showError(msg) {
            errorMessage.textContent = msg;
            errorAlert.classList.remove('hidden');
        }

        function clearError() {
            errorAlert.classList.add('hidden');
            errorMessage.textContent = '';
        }

        errorDismissBtn?.addEventListener('click', clearError);

        // --- Initialize Dropzone ---
        PDFCore.initDropzone({
            dropzoneEl: pdfDropzone,
            inputEl: pdfFileInput,
            accept: '.pdf,application/pdf',
            multiple: false,
            onFilesAdded: async (files) => {
                const validation = PDFCore.validateFiles(files, {
                    acceptExtensions: ['pdf'],
                    maxFiles: 1,
                    maxSizeBytes: 100 * 1024 * 1024,
                });

                if (validation.errors.length > 0) {
                    showError(validation.errors[0]);
                    return;
                }

                await loadPdfDocument(validation.valid[0]);
            },
            onError: (err) => showError(err),
        });

        // --- Document Loader ---
        async function loadPdfDocument(file) {
            clearError();
            originalFile = file;

            try {
                originalArrayBuffer = await PDFCore.readFileAsArrayBuffer(file);
                const loaded = await PDFRender.loadPreviewDoc(originalArrayBuffer);
                pdfDocProxy = loaded.pdfProxy;
                totalPages = loaded.numPages;

                // Update UI Header
                docFilename.textContent = file.name;
                docMeta.textContent = `${totalPages} page${totalPages === 1 ? '' : 's'} • ${PDFCore.formatBytes(file.size)}`;

                // Switch Panels
                uploadPanel.classList.add('hidden');
                resultPanel.classList.add('hidden');
                configPanel.classList.remove('hidden');

                // Render Original Page 1 and generate Grayscale Preview
                await renderPage1Original();
                updateGrayscalePreview();

                if (typeof lucide !== 'undefined') lucide.createIcons();
            } catch (err) {
                console.error('Error loading PDF:', err);
                showError(PDFCore.formatPdfError(err));
            }
        }

        // --- Page 1 Rendering & Caching ---
        async function renderPage1Original() {
            if (!pdfDocProxy) return;
            const page = await pdfDocProxy.getPage(1);
            const intrinsicRotation = page.rotate || 0;
            const unscaled = page.getViewport({ scale: 1.0, rotation: intrinsicRotation });
            const scale = Math.min(320 / unscaled.width, 1.5);
            const viewport = page.getViewport({ scale, rotation: intrinsicRotation });

            originalPreviewCanvas.width = Math.floor(viewport.width);
            originalPreviewCanvas.height = Math.floor(viewport.height);

            const ctx = originalPreviewCanvas.getContext('2d', { alpha: false });
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, originalPreviewCanvas.width, originalPreviewCanvas.height);

            await page.render({ canvasContext: ctx, viewport }).promise;

            // Cache ImageData for fast live manipulation
            cachedPage1ImageData = ctx.getImageData(0, 0, originalPreviewCanvas.width, originalPreviewCanvas.height);
        }

        // --- Live Grayscale Pixel Transformation ---
        function applyGrayscaleAlgorithm(srcImageData, toneMode, threshold) {
            const width = srcImageData.width;
            const height = srcImageData.height;
            const srcData = srcImageData.data;

            const outImageData = new ImageData(width, height);
            const dstData = outImageData.data;
            const len = srcData.length;

            for (let i = 0; i < len; i += 4) {
                const r = srcData[i];
                const g = srcData[i + 1];
                const b = srcData[i + 2];
                const a = srcData[i + 3];

                // Perceptual human eye luminance
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;

                let finalVal = lum;
                if (toneMode === 'contrast') {
                    // S-curve contrast enhancement
                    finalVal = 255 * Math.pow(lum / 255, 1.35);
                } else if (toneMode === 'threshold') {
                    // Binary thresholding (0 or 255)
                    finalVal = lum >= threshold ? 255 : 0;
                }

                dstData[i] = finalVal;
                dstData[i + 1] = finalVal;
                dstData[i + 2] = finalVal;
                dstData[i + 3] = a;
            }

            return outImageData;
        }

        function updateGrayscalePreview() {
            if (!cachedPage1ImageData) return;

            const selectedTone = document.querySelector('input[name="tone-mode"]:checked')?.value || 'standard';
            const threshold = parseInt(thresholdSlider.value, 10) || 160;

            const transformed = applyGrayscaleAlgorithm(cachedPage1ImageData, selectedTone, threshold);

            // Update Grayscale Preview Canvas
            grayscalePreviewCanvas.width = transformed.width;
            grayscalePreviewCanvas.height = transformed.height;
            const ctxGray = grayscalePreviewCanvas.getContext('2d');
            ctxGray.putImageData(transformed, 0, 0);

            // Also sync Mono Single Canvas
            monoSingleCanvas.width = transformed.width;
            monoSingleCanvas.height = transformed.height;
            const ctxSingle = monoSingleCanvas.getContext('2d');
            ctxSingle.putImageData(transformed, 0, 0);
        }

        // --- Event Listeners for Live Preview Sync ---
        toneRadios.forEach((radio) => {
            radio.addEventListener('change', () => {
                const mode = radio.value;
                toneOptionLabels.forEach((lbl) => {
                    if (lbl.dataset.mode === mode) {
                        lbl.className = 'flex items-start gap-3 p-3 rounded-xl border-2 border-blue-600 bg-blue-50/40 cursor-pointer transition-all tone-option-label';
                    } else {
                        lbl.className = 'flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white cursor-pointer transition-all tone-option-label';
                    }
                });

                if (mode === 'threshold') {
                    thresholdSliderGroup.classList.remove('hidden');
                } else {
                    thresholdSliderGroup.classList.add('hidden');
                }

                updateGrayscalePreview();
            });
        });

        thresholdSlider?.addEventListener('input', (e) => {
            thresholdValLabel.textContent = e.target.value;
            updateGrayscalePreview();
        });

        // Toggle Split View vs Mono Only
        toggleSplitViewBtn?.addEventListener('click', () => {
            toggleSplitViewBtn.className = 'px-2.5 py-1 rounded-md font-semibold bg-white text-blue-600 shadow-2xs';
            toggleMonoOnlyBtn.className = 'px-2.5 py-1 rounded-md font-semibold text-slate-600 hover:text-slate-900';
            splitPreviewWrap.classList.remove('hidden');
            monoPreviewWrap.classList.add('hidden');
        });

        toggleMonoOnlyBtn?.addEventListener('click', () => {
            toggleMonoOnlyBtn.className = 'px-2.5 py-1 rounded-md font-semibold bg-white text-blue-600 shadow-2xs';
            toggleSplitViewBtn.className = 'px-2.5 py-1 rounded-md font-semibold text-slate-600 hover:text-slate-900';
            splitPreviewWrap.classList.add('hidden');
            monoPreviewWrap.classList.remove('hidden');
        });

        // Page Scope Switcher
        pageScopeRadios.forEach((radio) => {
            radio.addEventListener('change', () => {
                if (radio.value === 'custom') {
                    customRangeInput.classList.remove('hidden');
                    customRangeInput.focus();
                } else {
                    customRangeInput.classList.add('hidden');
                }
            });
        });

        // --- Sequential Conversion Pipeline ---
        convertGrayscaleBtn?.addEventListener('click', async () => {
            if (!originalArrayBuffer || !pdfDocProxy || !window.PDFLib) return;
            clearError();

            const selectedTone = document.querySelector('input[name="tone-mode"]:checked')?.value || 'standard';
            const threshold = parseInt(thresholdSlider.value, 10) || 160;
            const targetDpi = parseInt(resolutionSelect.value, 10) || 150;
            const pageScope = document.querySelector('input[name="page-scope"]:checked')?.value || 'all';

            let targetPages = [];
            if (pageScope === 'all') {
                for (let i = 1; i <= totalPages; i++) targetPages.push(i);
            } else {
                const parsed = PDFRender.parsePageRanges(customRangeInput.value, totalPages);
                if (!parsed.valid) {
                    showError(parsed.error || 'Please enter a valid page range.');
                    return;
                }
                targetPages = parsed.flatPages;
            }

            const targetPageSet = new Set(targetPages);

            progressPanel.classList.remove('hidden');
            resultPanel.classList.add('hidden');
            progressBar.style.width = '5%';
            progressTitle.textContent = 'Preparing Conversion...';
            progressDesc.textContent = `Rasterizing and converting ${targetPages.length} of ${totalPages} pages at ${targetDpi} DPI...`;

            try {
                const { PDFDocument } = window.PDFLib;
                const sourcePdfDoc = await PDFDocument.load(originalArrayBuffer.slice(0));
                const outPdfDoc = await PDFDocument.create();

                const renderScale = targetDpi / 72.0;

                for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                    const pct = Math.round(5 + (pageNum / totalPages) * 85);
                    progressBar.style.width = `${pct}%`;

                    if (targetPageSet.has(pageNum)) {
                        progressTitle.textContent = `Converting Page ${pageNum} of ${totalPages}...`;
                        progressDesc.textContent = `Applying ${selectedTone} monochrome filter...`;

                        const page = await pdfDocProxy.getPage(pageNum);
                        const intrinsicRotation = page.rotate || 0;
                        const viewport = page.getViewport({ scale: renderScale, rotation: intrinsicRotation });

                        // Offscreen canvas
                        const offCanvas = document.createElement('canvas');
                        offCanvas.width = Math.floor(viewport.width);
                        offCanvas.height = Math.floor(viewport.height);

                        const ctx = offCanvas.getContext('2d', { alpha: false });
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);

                        await page.render({ canvasContext: ctx, viewport }).promise;

                        // Pixel pass
                        const srcImgData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height);
                        const monoImgData = applyGrayscaleAlgorithm(srcImgData, selectedTone, threshold);
                        ctx.putImageData(monoImgData, 0, 0);

                        // Convert to blob
                        const isBinary = selectedTone === 'threshold';
                        const mimeType = isBinary ? 'image/png' : 'image/jpeg';
                        const quality = isBinary ? undefined : 0.88;

                        const blob = await new Promise((resolve) => offCanvas.toBlob(resolve, mimeType, quality));
                        const imgBytes = await PDFCore.readFileAsArrayBuffer(blob);

                        const embeddedImage = isBinary
                            ? await outPdfDoc.embedPng(imgBytes)
                            : await outPdfDoc.embedJpg(imgBytes);

                        // Page point dimensions from original
                        const origPage = sourcePdfDoc.getPage(pageNum - 1);
                        const ptWidth = origPage.getWidth();
                        const ptHeight = origPage.getHeight();

                        const newPage = outPdfDoc.addPage([ptWidth, ptHeight]);
                        newPage.drawImage(embeddedImage, {
                            x: 0,
                            y: 0,
                            width: ptWidth,
                            height: ptHeight,
                        });

                        // Release memory immediately
                        offCanvas.width = 0;
                        offCanvas.height = 0;
                    } else {
                        // Non-targeted pages copied directly to preserve original vectors
                        progressTitle.textContent = `Copying Page ${pageNum} of ${totalPages}...`;
                        const [copiedPage] = await outPdfDoc.copyPages(sourcePdfDoc, [pageNum - 1]);
                        outPdfDoc.addPage(copiedPage);
                    }

                    // Yield execution tick to keep browser UI responsive
                    await new Promise((r) => setTimeout(r, 0));
                }

                progressBar.style.width = '95%';
                progressTitle.textContent = 'Packaging PDF...';
                progressDesc.textContent = 'Compressing monochrome document streams...';

                lastConvertedPdfBytes = await outPdfDoc.save();

                progressBar.style.width = '100%';
                progressPanel.classList.add('hidden');
                resultPanel.classList.remove('hidden');

                // Update size comparison
                resOrigSize.textContent = PDFCore.formatBytes(originalFile.size);
                resMonoSize.textContent = PDFCore.formatBytes(lastConvertedPdfBytes.byteLength);

                if (typeof lucide !== 'undefined') lucide.createIcons();
            } catch (err) {
                console.error('Grayscale conversion error:', err);
                progressPanel.classList.add('hidden');
                showError('Failed to convert PDF: ' + err.message);
            }
        });

        // Download Converted Document
        downloadGrayscalePdfBtn?.addEventListener('click', () => {
            if (!lastConvertedPdfBytes || !originalFile) return;
            const originalBase = originalFile.name.replace(/\.[^/.]+$/, '');
            const exportName = `${originalBase}-grayscale.pdf`;
            PDFCore.downloadBlob(lastConvertedPdfBytes, exportName, 'application/pdf');
        });

        // Reset
        changeFileBtn?.addEventListener('click', resetAll);
        grayscaleResetBtn?.addEventListener('click', resetAll);

        function resetAll() {
            originalFile = null;
            originalArrayBuffer = null;
            pdfDocProxy = null;
            cachedPage1ImageData = null;
            lastConvertedPdfBytes = null;
            configPanel.classList.add('hidden');
            resultPanel.classList.add('hidden');
            progressPanel.classList.add('hidden');
            uploadPanel.classList.remove('hidden');
        }
    });
})(window, document);
