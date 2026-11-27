/**
 * NoPayPDF - PDF to JPG / PNG Client-Side Controller
 * 100% In-Browser Execution via PDF.js & JSZip
 */

(function () {
    'use strict';

    // DOM Elements
    const dropzoneView = document.getElementById('dropzone-view');
    const workspaceView = document.getElementById('workspace-view');
    const dropzoneEl = document.getElementById('pdf-to-jpg-dropzone');
    const fileInput = document.getElementById('pdf-to-jpg-file-input');
    const changeFileBtn = document.getElementById('change-file-btn');
    const docNameEl = document.getElementById('doc-name');
    const docSizeEl = document.getElementById('doc-size');
    const docPageCountEl = document.getElementById('doc-page-count');

    // Settings
    const formatRadios = document.querySelectorAll('input[name="image-format"]');
    const dpiSelect = document.getElementById('dpi-select');
    const dpiWarning = document.getElementById('dpi-warning');
    const qualitySliderContainer = document.getElementById('quality-slider-container');
    const qualitySlider = document.getElementById('jpg-quality');
    const qualityDisplay = document.getElementById('quality-display');

    // Page Scope
    const scopeRadios = document.querySelectorAll('input[name="page-scope"]');
    const customRangeRow = document.getElementById('custom-range-row');
    const rangeInput = document.getElementById('page-range-input');
    const rangeFeedback = document.getElementById('range-preview-feedback');
    const selectedPagesCountEl = document.getElementById('selected-pages-count');
    const pagesPreviewGrid = document.getElementById('pages-preview-grid');

    // Action & Result
    const convertBtn = document.getElementById('convert-action-btn');
    const progressContainer = document.getElementById('convert-progress-container');
    const resultView = document.getElementById('result-view');
    const resultSummary = document.getElementById('result-summary');
    const downloadZipBtn = document.getElementById('download-zip-btn');
    const convertedImagesGrid = document.getElementById('converted-images-grid');
    const resetBtn = document.getElementById('convert-reset-btn');
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    const errorDismissBtn = document.getElementById('error-dismiss-btn');

    // State
    const progress = PDFCore.createProgress(progressContainer);
    let currentFile = null;
    let currentPdfProxy = null;
    let totalPages = 0;
    let selectedPages = new Set();
    let renderAbortCtrl = null;
    let convertedEntries = []; // Array<{ pageNum: number, name: string, blob: Blob, url: string, width: number, height: number, sizeBytes: number }>

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

    function cleanupPreviews() {
        if (renderAbortCtrl) {
            renderAbortCtrl.abort();
            renderAbortCtrl = null;
        }
        if (currentPdfProxy) {
            try { currentPdfProxy.destroy(); } catch (e) {}
            currentPdfProxy = null;
        }
        convertedEntries.forEach(entry => {
            if (entry.url) {
                try { URL.revokeObjectURL(entry.url); } catch (e) {}
            }
        });
        convertedEntries = [];
        selectedPages.clear();
        pagesPreviewGrid.innerHTML = '';
        convertedImagesGrid.innerHTML = '';
    }

    // Format toggle (JPG vs PNG)
    formatRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const isJpg = document.querySelector('input[name="image-format"]:checked')?.value === 'jpg';
            if (qualitySliderContainer) {
                if (isJpg) {
                    qualitySliderContainer.classList.remove('hidden');
                } else {
                    qualitySliderContainer.classList.add('hidden');
                }
            }
        });
    });

    // Quality slider display
    if (qualitySlider && qualityDisplay) {
        qualitySlider.addEventListener('input', () => {
            qualityDisplay.textContent = `${qualitySlider.value}%`;
        });
    }

    // DPI warning
    if (dpiSelect && dpiWarning) {
        dpiSelect.addEventListener('change', () => {
            const dpi = parseInt(dpiSelect.value, 10);
            if (dpi === 300 && totalPages > 20) {
                dpiWarning.classList.remove('hidden');
            } else {
                dpiWarning.classList.add('hidden');
            }
        });
    }

    // Scope toggle (All vs Custom)
    scopeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const isCustom = document.querySelector('input[name="page-scope"]:checked')?.value === 'custom';
            if (customRangeRow) {
                if (isCustom) {
                    customRangeRow.classList.remove('hidden');
                    syncRangeInputFromSelection();
                } else {
                    customRangeRow.classList.add('hidden');
                    // Select all
                    selectedPages.clear();
                    for (let i = 1; i <= totalPages; i++) selectedPages.add(i);
                    updateThumbnailSelectionUI();
                }
            }
        });
    });

    function syncRangeInputFromSelection() {
        if (!rangeInput) return;
        const sorted = Array.from(selectedPages).sort((a, b) => a - b);
        if (sorted.length === 0) {
            rangeInput.value = '';
            return;
        }
        // Build ranges
        const ranges = [];
        let start = sorted[0];
        let end = sorted[0];

        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === end + 1) {
                end = sorted[i];
            } else {
                ranges.push(start === end ? `${start}` : `${start}-${end}`);
                start = sorted[i];
                end = sorted[i];
            }
        }
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        rangeInput.value = ranges.join(', ');
        validateRangeInput();
    }

    function validateRangeInput() {
        if (!rangeInput || !rangeFeedback) return { valid: false, flatPages: [] };
        const val = rangeInput.value.trim();
        const parsed = PDFRender.parsePageRanges(val, totalPages);

        if (!parsed.valid) {
            rangeFeedback.textContent = parsed.error;
            rangeFeedback.className = 'text-xs text-red-600 mt-1 font-medium';
            return parsed;
        }

        rangeFeedback.textContent = `Valid selection: ${parsed.flatPages.length} page(s) selected.`;
        rangeFeedback.className = 'text-xs text-emerald-600 mt-1 font-medium';
        return parsed;
    }

    if (rangeInput) {
        rangeInput.addEventListener('input', () => {
            const parsed = validateRangeInput();
            if (parsed.valid) {
                selectedPages = new Set(parsed.flatPages);
                updateThumbnailSelectionUI();
            }
        });
    }

    function updateThumbnailSelectionUI() {
        if (selectedPagesCountEl) {
            selectedPagesCountEl.textContent = selectedPages.size;
        }
        const cards = pagesPreviewGrid.querySelectorAll('.page-thumbnail-card');
        cards.forEach(card => {
            const p = parseInt(card.dataset.page, 10);
            const isSelected = selectedPages.has(p);
            const chk = card.querySelector('.page-checkbox');
            if (chk) chk.checked = isSelected;
            if (isSelected) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }

    // Load file and initiate previews
    async function handleFileLoaded(file) {
        clearError();
        cleanupPreviews();

        currentFile = file;
        docNameEl.textContent = file.name;
        docSizeEl.textContent = PDFCore.formatBytes(file.size);

        try {
            const buffer = await file.arrayBuffer();
            const { pdfProxy, numPages } = await PDFRender.loadPreviewDocument(buffer);
            currentPdfProxy = pdfProxy;
            totalPages = numPages;
            docPageCountEl.textContent = numPages;

            // Default all pages selected
            for (let i = 1; i <= numPages; i++) selectedPages.add(i);

            // Check DPI warning
            if (dpiSelect && parseInt(dpiSelect.value, 10) === 300 && totalPages > 20) {
                dpiWarning?.classList.remove('hidden');
            } else {
                dpiWarning?.classList.add('hidden');
            }

            dropzoneView.classList.add('hidden');
            resultView.classList.add('hidden');
            workspaceView.classList.remove('hidden');

            renderThumbnails();
        } catch (err) {
            console.error('PDF to JPG load error:', err);
            showError(`Failed to read "${file.name}": ${PDFCore.formatPdfError(err)}`);
            cleanupPreviews();
            workspaceView.classList.add('hidden');
            dropzoneView.classList.remove('hidden');
        }
    }

    async function renderThumbnails() {
        if (!currentPdfProxy) return;
        pagesPreviewGrid.innerHTML = '';
        renderAbortCtrl = new AbortController();
        const signal = renderAbortCtrl.signal;

        for (let i = 1; i <= totalPages; i++) {
            const card = document.createElement('div');
            card.className = 'page-thumbnail-card bg-white p-2 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-between cursor-pointer relative';
            card.dataset.page = i;

            card.innerHTML = `
                <div class="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1 px-0.5">
                    <span>#${i}</span>
                    <input type="checkbox" class="page-checkbox rounded text-blue-600 focus:ring-blue-500 pointer-events-none" checked>
                </div>
                <div class="canvas-wrapper w-full h-[120px] flex items-center justify-center bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                    <span class="text-[10px] text-slate-400 loading-indicator animate-pulse">Loading...</span>
                </div>
            `;

            card.addEventListener('click', () => {
                const p = parseInt(card.dataset.page, 10);
                if (selectedPages.has(p)) {
                    selectedPages.delete(p);
                } else {
                    selectedPages.add(p);
                }

                // If scope is "all", automatically switch to "custom" on individual deselect
                const scopeCustomRadio = document.querySelector('input[name="page-scope"][value="custom"]');
                if (scopeCustomRadio && selectedPages.size < totalPages) {
                    scopeCustomRadio.checked = true;
                    customRangeRow?.classList.remove('hidden');
                }
                syncRangeInputFromSelection();
                updateThumbnailSelectionUI();
            });

            pagesPreviewGrid.appendChild(card);
        }

        updateThumbnailSelectionUI();

        await PDFRender.renderThumbnailsBatched(currentPdfProxy, pagesPreviewGrid, {
            batchSize: 6,
            signal,
            maxWidth: 150,
            onPageRendered: (pageNum, canvas) => {
                const card = pagesPreviewGrid.querySelector(`.page-thumbnail-card[data-page="${pageNum}"]`);
                if (card) {
                    const wrapper = card.querySelector('.canvas-wrapper');
                    if (wrapper) {
                        canvas.className = 'page-thumbnail-canvas max-h-[120px]';
                        wrapper.innerHTML = '';
                        wrapper.appendChild(canvas);
                    }
                }
            }
        });

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // Dropzone setup
    PDFCore.initDropzone({
        dropzoneEl,
        inputEl: fileInput,
        multiple: false,
        onFilesAdded: (files) => {
            if (files.length > 0) handleFileLoaded(files[0]);
        },
        onError: (errs) => showError(errs.join(' '))
    });

    if (changeFileBtn) {
        changeFileBtn.addEventListener('click', () => {
            fileInput.value = '';
            fileInput.click();
        });
    }

    // Conversion Execution Engine
    if (convertBtn) {
        convertBtn.addEventListener('click', async () => {
            clearError();
            if (resultView) resultView.classList.add('hidden');
            if (!currentPdfProxy || totalPages === 0) {
                showError('Please select a valid PDF file first.');
                return;
            }

            const scope = document.querySelector('input[name="page-scope"]:checked')?.value || 'all';
            if (scope === 'custom') {
                const parsed = validateRangeInput();
                if (!parsed.valid || parsed.flatPages.length === 0) {
                    showError(parsed.error || 'Please enter valid page ranges to convert.');
                    return;
                }
                selectedPages = new Set(parsed.flatPages);
                updateThumbnailSelectionUI();
            }

            const targetPages = Array.from(selectedPages).sort((a, b) => a - b);
            if (targetPages.length === 0) {
                showError('Please select at least one page to convert.');
                return;
            }

            const format = document.querySelector('input[name="image-format"]:checked')?.value || 'jpg';
            const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
            const ext = format === 'png' ? 'png' : 'jpg';

            const dpiVal = parseInt(dpiSelect?.value || '150', 10);
            // 72 DPI = 1.0 scale; 150 DPI = 2.083; 300 DPI = 4.166
            const scale = dpiVal / 72;

            const qualityVal = format === 'jpg'
                ? parseFloat((parseInt(qualitySlider?.value || '88', 10) / 100).toFixed(2))
                : 1.0;

            const baseName = (currentFile?.name ? currentFile.name.replace(/\.[^/.]+$/, '') : 'document') || 'document';
            const padWidth = Math.max(2, String(totalPages).length);

            try {
                convertBtn.disabled = true;
                convertBtn.classList.add('opacity-75', 'cursor-not-allowed');
                progress.start(`Rendering ${targetPages.length} page(s) at ${dpiVal} DPI...`);

                convertedEntries.forEach(e => {
                    if (e.url) try { URL.revokeObjectURL(e.url); } catch (err) {}
                });
                convertedEntries = [];
                convertedImagesGrid.innerHTML = '';

                for (let i = 0; i < targetPages.length; i++) {
                    const pageNum = targetPages[i];
                    progress.update(
                        Math.round((i / targetPages.length) * 85),
                        `Rendering page ${pageNum} (${i + 1} of ${targetPages.length})...`
                    );

                    const page = await currentPdfProxy.getPage(pageNum);
                    const viewport = page.getViewport({ scale, rotation: page.rotate || 0 });

                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.floor(viewport.width));
                    canvas.height = Math.max(1, Math.floor(viewport.height));

                    const ctx = canvas.getContext('2d', { alpha: format === 'png' });

                    // Paint solid white background for JPEG so transparent PDFs don't export black
                    if (format === 'jpg') {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }

                    await page.render({ canvasContext: ctx, viewport }).promise;

                    const outWidth = canvas.width;
                    const outHeight = canvas.height;

                    // Extract single Blob cleanly (avoids keeping duplicate Uint8Array buffers in memory)
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, qualityVal));
                    canvas.width = 0;
                    canvas.height = 0;

                    if (!blob) {
                        throw new Error(`Failed to encode page ${pageNum} as ${ext.toUpperCase()}.`);
                    }

                    const previewUrl = URL.createObjectURL(blob);
                    const pad = String(pageNum).padStart(padWidth, '0');
                    const imgFileName = `${baseName}-page-${pad}.${ext}`;

                    convertedEntries.push({
                        pageNum,
                        name: imgFileName,
                        blob,
                        url: previewUrl,
                        width: outWidth,
                        height: outHeight,
                        sizeBytes: blob.size,
                    });

                    // Yield control to main thread
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                progress.complete('Conversion complete!');

                // Render result cards into convertedImagesGrid
                convertedEntries.forEach(entry => {
                    const safeName = PDFCore.escapeHtml(entry.name);
                    const card = document.createElement('div');
                    card.className = 'converted-image-card bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between';
                    card.innerHTML = `
                        <div>
                            <div class="w-full h-[150px] bg-slate-50 border border-slate-100 rounded-lg overflow-hidden flex items-center justify-center p-1 mb-2">
                                <img src="${entry.url}" alt="${safeName}" class="max-h-full max-w-full object-contain">
                            </div>
                            <div class="px-0.5">
                                <div class="flex items-center justify-between text-xs font-bold text-slate-800">
                                    <span>Page ${entry.pageNum}</span>
                                    <span class="text-[11px] text-slate-400 font-normal">${entry.width} × ${entry.height} px</span>
                                </div>
                                <p class="text-[11px] text-slate-500 mt-0.5 truncate" title="${safeName}">${safeName}</p>
                                <span class="text-[10px] font-semibold text-slate-400">${PDFCore.formatBytes(entry.sizeBytes)}</span>
                            </div>
                        </div>
                        <div class="mt-3 pt-2 border-t border-slate-100">
                            <button type="button" class="btn-download-single w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors">
                                <i data-lucide="download" class="w-3.5 h-3.5"></i>
                                <span>Download</span>
                            </button>
                        </div>
                    `;

                    card.querySelector('.btn-download-single')?.addEventListener('click', () => {
                        PDFCore.downloadBlob(entry.blob, entry.name, mimeType);
                    });

                    convertedImagesGrid.appendChild(card);
                });

                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }

                // Summary and ZIP button setup
                if (resultSummary) {
                    const totalSize = convertedEntries.reduce((sum, e) => sum + e.sizeBytes, 0);
                    resultSummary.textContent = `Converted ${convertedEntries.length} page(s) to ${format.toUpperCase()} (${dpiVal} DPI, ${PDFCore.formatBytes(totalSize)} total).`;
                }

                if (downloadZipBtn) {
                    if (convertedEntries.length === 1) {
                        downloadZipBtn.innerHTML = `
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>Download ${format.toUpperCase()} Image</span>
                        `;
                    } else {
                        downloadZipBtn.innerHTML = `
                            <i data-lucide="archive" class="w-4 h-4"></i>
                            <span>Download All as ZIP (${convertedEntries.length} Images)</span>
                        `;
                    }
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }

                if (resultView) {
                    resultView.classList.remove('hidden');
                    resultView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } catch (err) {
                console.error('PDF to JPG error:', err);
                showError(err.message || 'An error occurred while converting the PDF.');
                progress.reset();
            } finally {
                convertBtn.disabled = false;
                convertBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        });
    }

    // Download ZIP button
    if (downloadZipBtn) {
        downloadZipBtn.addEventListener('click', async () => {
            if (convertedEntries.length === 0) return;
            const format = document.querySelector('input[name="image-format"]:checked')?.value || 'jpg';
            const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
            const baseName = PDFCore.sanitizeFilename(currentFile?.name || 'document', 'pdf').replace(/\.pdf$/i, '') || 'document';

            if (convertedEntries.length === 1) {
                const single = convertedEntries[0];
                PDFCore.downloadBlob(single.blob, single.name, mimeType);
            } else {
                const zip = new window.JSZip();
                convertedEntries.forEach((e) => zip.file(e.name, e.blob, { binary: true }));
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                PDFCore.downloadBlob(zipBlob, `${baseName}-images.zip`, 'application/zip');
            }
        });
    }

    // Reset button
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            cleanupPreviews();
            currentFile = null;
            totalPages = 0;
            if (fileInput) fileInput.value = '';
            if (rangeInput) rangeInput.value = '';
            if (rangeFeedback) rangeFeedback.textContent = '';
            const jpgRadio = document.querySelector('input[name="image-format"][value="jpg"]');
            if (jpgRadio) jpgRadio.checked = true;
            if (qualitySliderContainer) qualitySliderContainer.classList.remove('hidden');
            if (dpiSelect) dpiSelect.value = '150';
            if (qualitySlider) qualitySlider.value = '88';
            if (qualityDisplay) qualityDisplay.textContent = '88%';
            const allScope = document.querySelector('input[name="page-scope"][value="all"]');
            if (allScope) allScope.checked = true;
            if (customRangeRow) customRangeRow.classList.add('hidden');
            progress.reset();
            resultView?.classList.add('hidden');
            workspaceView.classList.add('hidden');
            dropzoneView.classList.remove('hidden');
            clearError();
        });
    }

})();
