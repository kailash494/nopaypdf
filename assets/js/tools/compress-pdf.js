/**
 * NoPayPDF - Compress PDF Controller
 * Lossless QPDF WebAssembly + Multi-Preset Visual Image Re-encoding
 * 100% Client-Side Processing
 */

(function () {
    'use strict';

    // DOM Elements
    const dropzone = document.getElementById('compress-dropzone');
    const fileInput = document.getElementById('compress-file-input');
    const workspace = document.getElementById('compress-workspace');
    const fileNameLabel = document.getElementById('file-name-label');
    const fileMetaLabel = document.getElementById('file-meta-label');
    const changeFileBtn = document.getElementById('change-file-btn');
    const presetsContainer = document.getElementById('presets-container');
    const presetCards = document.querySelectorAll('.preset-card');
    const visualNotice = document.getElementById('visual-compression-notice');
    const submitBtn = document.getElementById('compress-submit-btn');
    const progressContainer = document.getElementById('compress-progress-container');
    const resultView = document.getElementById('result-view');
    const resultSummary = document.getElementById('result-summary');
    const metricOriginal = document.getElementById('metric-original-size');
    const metricCompressed = document.getElementById('metric-compressed-size');
    const metricReduction = document.getElementById('metric-reduction-percent');
    const noSavingsGuard = document.getElementById('no-savings-guard');
    const downloadBtn = document.getElementById('download-compressed-btn');
    const resetBtn = document.getElementById('compress-reset-btn');
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    const errorDismissBtn = document.getElementById('error-dismiss-btn');

    // State
    const progress = PDFCore.createProgress(progressContainer);
    let currentFile = null;
    let currentBuffer = null;
    let currentPdfDoc = null;
    let totalPages = 0;
    let compressedBlob = null;

    PDFRender.initPdfJsWorker();

    function showError(msg) {
        if (!errorAlert || !errorMessage) return;
        errorMessage.textContent = msg;
        errorAlert.classList.remove('hidden');
    }

    function clearError() {
        if (errorAlert) errorAlert.classList.add('hidden');
    }

    if (errorDismissBtn) {
        errorDismissBtn.addEventListener('click', clearError);
    }

    // Preset Selection UI
    if (presetsContainer) {
        presetsContainer.addEventListener('change', (e) => {
            const input = e.target.closest('input[name="compression-preset"]');
            if (!input) return;

            presetCards.forEach((card) => {
                const radio = card.querySelector('input[type="radio"]');
                if (radio && radio.checked) {
                    card.classList.add('border-blue-600', 'bg-blue-50/30');
                    card.classList.remove('border-slate-200', 'bg-slate-50/50');
                } else {
                    card.classList.remove('border-blue-600', 'bg-blue-50/30');
                    card.classList.add('border-slate-200', 'bg-slate-50/50');
                }
            });

            if (visualNotice) {
                if (input.value === 'lossless') {
                    visualNotice.classList.add('hidden');
                } else {
                    visualNotice.classList.remove('hidden');
                }
            }
        });
    }

    // Ingest Selected File
    async function loadPdfFile(file) {
        clearError();
        if (resultView) resultView.classList.add('hidden');

        try {
            submitBtn.disabled = true;
            progress.start('Reading PDF document...');

            currentFile = file;
            currentBuffer = await PDFCore.readFileAsArrayBuffer(file);

            // Load via PDF.js to inspect pages and validity
            if (currentPdfDoc) {
                await PDFRender.destroyDoc(currentPdfDoc);
                currentPdfDoc = null;
            }

            const preview = await PDFRender.loadPreviewDoc(currentBuffer);
            currentPdfDoc = preview.pdfDoc;
            totalPages = preview.pageCount;

            fileNameLabel.textContent = file.name;
            fileMetaLabel.textContent = `${PDFCore.formatBytes(file.size)} • ${totalPages} page${totalPages === 1 ? '' : 's'}`;

            dropzone.classList.add('hidden');
            workspace.classList.remove('hidden');
            progress.reset();
            submitBtn.disabled = false;
        } catch (err) {
            console.error('File load error:', err);
            showError('Unable to open this PDF document: ' + (err.message || String(err)));
            progress.reset();
            submitBtn.disabled = false;
        }
    }

    // Dropzone setup
    PDFCore.initDropzone({
        dropzoneEl: dropzone,
        inputEl: fileInput,
        multiple: false,
        onFilesAdded: (files) => {
            const file = files[0];
            if (file) loadPdfFile(file);
        },
        onError: (errs) => {
            showError(errs.join(' '));
        },
    });

    if (changeFileBtn) {
        changeFileBtn.addEventListener('click', () => {
            if (fileInput) {
                fileInput.value = '';
                fileInput.click();
            }
        });
    }

    // ----------------------------------------------------
    // COMPRESSION LOGIC
    // ----------------------------------------------------
    async function compressLossless(buffer) {
        progress.update(20, 'Initializing WebAssembly engine...');
        const result = await QPDFClient.optimizeLossless(buffer);
        progress.update(90, 'Finalizing lossless output...');
        return new Blob([result.outputBytes], { type: 'application/pdf' });
    }

    async function compressVisual(buffer, scale, quality) {
        const { PDFDocument } = window.PDFLib;
        const outPdf = await PDFDocument.create();

        // Load PDF.js proxy with cloned buffer
        const pdfJsDoc = await window.pdfjsLib.getDocument({
            data: new Uint8Array(buffer).slice(),
        }).promise;

        const count = pdfJsDoc.numPages;

        for (let pageNum = 1; pageNum <= count; pageNum++) {
            const pct = Math.round(15 + ((pageNum - 1) / count) * 75);
            progress.update(pct, `Optimizing page ${pageNum} of ${count}...`);

            const page = await pdfJsDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            const ctx = canvas.getContext('2d', { alpha: false });

            // Fill white background to prevent transparent backgrounds turning black
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({
                canvasContext: ctx,
                viewport: viewport,
            }).promise;

            // Re-encode to JPEG
            const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);

            // Clean canvas memory immediately
            canvas.width = 0;
            canvas.height = 0;

            // Embed into new PDF preserving original page dimensions in points
            const unscaledViewport = page.getViewport({ scale: 1.0 });
            const embeddedImage = await outPdf.embedJpg(jpegDataUrl);
            const newPage = outPdf.addPage([unscaledViewport.width, unscaledViewport.height]);
            newPage.drawImage(embeddedImage, {
                x: 0,
                y: 0,
                width: unscaledViewport.width,
                height: unscaledViewport.height,
            });
        }

        try {
            await pdfJsDoc.destroy();
        } catch (e) {}

        progress.update(95, 'Assembling compressed document...');
        const pdfBytes = await outPdf.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    }

    // Submit Handler
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (!currentBuffer || !currentFile) {
                showError('Please upload a PDF file first.');
                return;
            }

            clearError();
            if (resultView) resultView.classList.add('hidden');
            if (noSavingsGuard) noSavingsGuard.classList.add('hidden');

            const selectedPreset = document.querySelector('input[name="compression-preset"]:checked')?.value || 'balanced';

            try {
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

                progress.start('Starting compression...');

                let resultBlob;
                if (selectedPreset === 'lossless') {
                    resultBlob = await compressLossless(currentBuffer);
                } else if (selectedPreset === 'balanced') {
                    resultBlob = await compressVisual(currentBuffer, 1.5, 0.72);
                } else if (selectedPreset === 'strong') {
                    resultBlob = await compressVisual(currentBuffer, 1.25, 0.55);
                } else if (selectedPreset === 'extreme') {
                    resultBlob = await compressVisual(currentBuffer, 1.0, 0.40);
                } else {
                    resultBlob = await compressVisual(currentBuffer, 1.5, 0.72);
                }

                compressedBlob = resultBlob;
                progress.complete('Compression complete!');

                // Metrics
                const originalSize = currentFile.size;
                const newSize = resultBlob.size;
                const savedBytes = originalSize - newSize;
                const savedPct = Math.round((savedBytes / originalSize) * 100);

                if (metricOriginal) metricOriginal.textContent = PDFCore.formatBytes(originalSize);
                if (metricCompressed) metricCompressed.textContent = PDFCore.formatBytes(newSize);

                if (savedBytes > 0) {
                    if (metricReduction) metricReduction.textContent = `-${savedPct}%`;
                    if (resultSummary) {
                        resultSummary.textContent = `File reduced from ${PDFCore.formatBytes(originalSize)} to ${PDFCore.formatBytes(newSize)} (saved ${savedPct}%).`;
                    }
                } else {
                    // File didn't shrink or is slightly larger
                    if (metricReduction) metricReduction.textContent = `0%`;
                    if (noSavingsGuard) noSavingsGuard.classList.remove('hidden');
                    if (resultSummary) {
                        resultSummary.textContent = `Document processed (${PDFCore.formatBytes(newSize)}). This file was already compressed.`;
                    }
                }

                if (resultView) {
                    resultView.classList.remove('hidden');
                    resultView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } catch (err) {
                console.error('Compression error:', err);
                showError(err.message || 'An error occurred during compression.');
                progress.reset();
            } finally {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        });
    }

    // Download Handler
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (!compressedBlob || !currentFile) return;
            const originalName = currentFile.name.replace(/\.[^/.]+$/, '');
            const downloadName = `${originalName}-compressed.pdf`;
            PDFCore.downloadBlob(compressedBlob, downloadName);
        });
    }

    // Reset Handler
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            currentFile = null;
            currentBuffer = null;
            compressedBlob = null;
            if (currentPdfDoc) {
                await PDFRender.destroyDoc(currentPdfDoc);
                currentPdfDoc = null;
            }
            if (fileInput) fileInput.value = '';
            clearError();
            progress.reset();

            if (resultView) resultView.classList.add('hidden');
            if (workspace) workspace.classList.add('hidden');
            if (dropzone) dropzone.classList.remove('hidden');
        });
    }
})();
