/**
 * NoPayPDF - Split PDF Client-Side Controller
 * 100% In-Browser Execution via pdf-lib, PDF.js & JSZip
 */

(function () {
    'use strict';

    // DOM Elements
    const dropzoneView = document.getElementById('dropzone-view');
    const workspaceView = document.getElementById('workspace-view');
    const dropzoneEl = document.getElementById('split-dropzone');
    const fileInput = document.getElementById('split-file-input');
    const changeFileBtn = document.getElementById('change-file-btn');
    const docNameEl = document.getElementById('doc-name');
    const docSizeEl = document.getElementById('doc-size');
    const docPageCountEl = document.getElementById('doc-page-count');
    const modeTabs = document.querySelectorAll('.split-mode-tab');
    const modePanels = document.querySelectorAll('.mode-panel');

    // Visual selection mode elements
    const visualGrid = document.getElementById('visual-grid');
    const visSelectedCountEl = document.getElementById('vis-selected-count');
    const visSelectAllBtn = document.getElementById('vis-select-all');
    const visSelectOddBtn = document.getElementById('vis-select-odd');
    const visSelectEvenBtn = document.getElementById('vis-select-even');
    const visSelectInvertBtn = document.getElementById('vis-select-invert');
    const visSelectClearBtn = document.getElementById('vis-select-clear');

    // Range mode elements
    const rangeInput = document.getElementById('range-input');
    const rangeFeedback = document.getElementById('range-preview-feedback');

    // Actions & Result elements
    const splitActionBtn = document.getElementById('split-action-btn');
    const progressContainer = document.getElementById('split-progress-container');
    const resultView = document.getElementById('result-view');
    const resultSummary = document.getElementById('result-summary');
    const downloadBtn = document.getElementById('download-split-btn');
    const downloadBtnLabel = document.getElementById('download-btn-label');
    const resetBtn = document.getElementById('split-reset-btn');
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    const errorDismissBtn = document.getElementById('error-dismiss-btn');

    // State
    const progress = PDFCore.createProgress(progressContainer);
    let activeMode = 'visual';
    let currentFile = null;
    let originalBuffer = null;
    let currentPdfProxy = null;
    let totalPages = 0;
    let selectedPages = new Set();
    let lastShiftIndex = null;
    let renderAbortCtrl = null;
    let lastResultPayload = null; // { type: 'pdf'|'zip', data: Uint8Array|Blob, filename: string }

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

    function cleanupCurrentPdf() {
        if (renderAbortCtrl) {
            renderAbortCtrl.abort();
            renderAbortCtrl = null;
        }
        if (currentPdfProxy) {
            try {
                currentPdfProxy.destroy();
            } catch (e) {
                console.warn('Error destroying pdfProxy:', e);
            }
            currentPdfProxy = null;
        }
        visualGrid.innerHTML = '';
        selectedPages.clear();
        lastShiftIndex = null;
        lastResultPayload = null;
    }

    // Switch Mode Tabs
    modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetMode = tab.dataset.mode;
            activeMode = targetMode;

            modeTabs.forEach(t => {
                t.classList.remove('bg-blue-600', 'text-white');
                t.classList.add('bg-transparent', 'text-slate-600');
            });
            tab.classList.add('bg-blue-600', 'text-white');
            tab.classList.remove('bg-transparent', 'text-slate-600');

            modePanels.forEach(p => p.classList.add('hidden'));
            const activePanel = document.getElementById(`mode-panel-${targetMode}`);
            if (activePanel) activePanel.classList.remove('hidden');
        });
    });

    // Update visual selection counter and UI states
    function updateVisualSelectionUI() {
        if (visSelectedCountEl) {
            visSelectedCountEl.textContent = selectedPages.size;
        }

        const cards = visualGrid.querySelectorAll('.page-thumbnail-card');
        cards.forEach(card => {
            const pageNum = parseInt(card.dataset.page, 10);
            const isSelected = selectedPages.has(pageNum);
            const checkbox = card.querySelector('.page-checkbox');
            if (checkbox) checkbox.checked = isSelected;

            if (isSelected) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }

    // Load file and initiate rendering
    async function handleFileLoaded(file) {
        clearError();
        cleanupCurrentPdf();

        currentFile = file;
        docNameEl.textContent = file.name;
        docSizeEl.textContent = PDFCore.formatBytes(file.size);

        try {
            originalBuffer = await file.arrayBuffer();

            // Load preview with PDFRender (clones ArrayBuffer safely)
            const { pdfProxy, numPages } = await PDFRender.loadPreviewDocument(originalBuffer);
            currentPdfProxy = pdfProxy;
            totalPages = numPages;
            docPageCountEl.textContent = numPages;

            // Default: select all pages in visual mode
            for (let i = 1; i <= numPages; i++) {
                selectedPages.add(i);
            }

            // Set placeholder for range input
            if (rangeInput) {
                rangeInput.value = numPages > 1 ? `1-${Math.ceil(numPages / 2)}, ${Math.ceil(numPages / 2) + 1}-${numPages}` : '1';
                validateRangeInput();
            }

            dropzoneView.classList.add('hidden');
            resultView.classList.add('hidden');
            workspaceView.classList.remove('hidden');

            renderThumbnailsGrid();
        } catch (err) {
            console.error('Split load error:', err);
            showError(`Failed to load "${file.name}": ${PDFCore.formatPdfError(err)}`);
            cleanupCurrentPdf();
            workspaceView.classList.add('hidden');
            dropzoneView.classList.remove('hidden');
        }
    }

    // Render thumbnail cards into visual grid in async batches
    async function renderThumbnailsGrid() {
        if (!currentPdfProxy) return;

        visualGrid.innerHTML = '';
        renderAbortCtrl = new AbortController();
        const signal = renderAbortCtrl.signal;

        // Create card placeholders first
        for (let i = 1; i <= totalPages; i++) {
            const card = document.createElement('div');
            card.className = 'page-thumbnail-card bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-between cursor-pointer relative';
            card.dataset.page = i;

            card.innerHTML = `
                <div class="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1.5 px-0.5">
                    <span>#${i}</span>
                    <input type="checkbox" class="page-checkbox rounded text-blue-600 focus:ring-blue-500 pointer-events-none" checked>
                </div>
                <div class="canvas-wrapper w-full h-[140px] flex items-center justify-center bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                    <span class="text-[10px] text-slate-400 loading-indicator animate-pulse">Loading...</span>
                </div>
            `;

            // Click handling with Shift+Click range support
            card.addEventListener('click', (e) => {
                const pageNum = parseInt(card.dataset.page, 10);
                if (e.shiftKey && lastShiftIndex !== null) {
                    const start = Math.min(lastShiftIndex, pageNum);
                    const end = Math.max(lastShiftIndex, pageNum);
                    const shouldSelect = !selectedPages.has(pageNum);
                    for (let p = start; p <= end; p++) {
                        if (shouldSelect) selectedPages.add(p);
                        else selectedPages.delete(p);
                    }
                } else {
                    if (selectedPages.has(pageNum)) {
                        selectedPages.delete(pageNum);
                    } else {
                        selectedPages.add(pageNum);
                    }
                    lastShiftIndex = pageNum;
                }
                updateVisualSelectionUI();
            });

            visualGrid.appendChild(card);
        }

        updateVisualSelectionUI();

        // Render canvases progressively in batches
        await PDFRender.renderThumbnailsBatched(currentPdfProxy, visualGrid, {
            batchSize: 6,
            signal,
            maxWidth: 160,
            onPageRendered: (pageNum, canvas) => {
                const card = visualGrid.querySelector(`.page-thumbnail-card[data-page="${pageNum}"]`);
                if (card) {
                    const wrapper = card.querySelector('.canvas-wrapper');
                    if (wrapper) {
                        canvas.className = 'page-thumbnail-canvas max-h-[140px]';
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

    // Visual selection button helpers
    if (visSelectAllBtn) {
        visSelectAllBtn.addEventListener('click', () => {
            for (let i = 1; i <= totalPages; i++) selectedPages.add(i);
            updateVisualSelectionUI();
        });
    }

    if (visSelectOddBtn) {
        visSelectOddBtn.addEventListener('click', () => {
            selectedPages.clear();
            for (let i = 1; i <= totalPages; i += 2) selectedPages.add(i);
            updateVisualSelectionUI();
        });
    }

    if (visSelectEvenBtn) {
        visSelectEvenBtn.addEventListener('click', () => {
            selectedPages.clear();
            for (let i = 2; i <= totalPages; i += 2) selectedPages.add(i);
            updateVisualSelectionUI();
        });
    }

    if (visSelectInvertBtn) {
        visSelectInvertBtn.addEventListener('click', () => {
            const inverted = new Set();
            for (let i = 1; i <= totalPages; i++) {
                if (!selectedPages.has(i)) inverted.add(i);
            }
            selectedPages = inverted;
            updateVisualSelectionUI();
        });
    }

    if (visSelectClearBtn) {
        visSelectClearBtn.addEventListener('click', () => {
            selectedPages.clear();
            updateVisualSelectionUI();
        });
    }

    // Range input live validator
    function validateRangeInput() {
        if (!rangeInput || !rangeFeedback) return { valid: false, groups: [] };
        const val = rangeInput.value.trim();
        const parsed = PDFRender.parsePageRanges(val, totalPages);

        if (!parsed.valid) {
            rangeFeedback.textContent = parsed.error;
            rangeFeedback.className = 'text-xs text-red-600 mt-1.5 font-medium';
            return parsed;
        }

        const groupCount = parsed.groups.length;
        const pageCount = parsed.flatPages.length;
        rangeFeedback.textContent = `Valid range: ${groupCount} file(s), ${pageCount} total page(s) extracted.`;
        rangeFeedback.className = 'text-xs text-emerald-600 mt-1.5 font-medium';
        return parsed;
    }

    if (rangeInput) {
        rangeInput.addEventListener('input', validateRangeInput);
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

    // Split Execution Engine
    if (splitActionBtn) {
        splitActionBtn.addEventListener('click', async () => {
            clearError();
            if (resultView) resultView.classList.add('hidden');
            if (!originalBuffer || totalPages === 0) {
                showError('Please upload a valid PDF document first.');
                return;
            }

            try {
                splitActionBtn.disabled = true;
                splitActionBtn.classList.add('opacity-75', 'cursor-not-allowed');
                progress.start('Preparing document for extraction...');

                const sourceDoc = await PDFLib.PDFDocument.load(originalBuffer);
                const baseDocName = currentFile?.name ? currentFile.name.replace(/\.[^/.]+$/, '') : 'document';

                // ==========================================
                // 1. VISUAL SELECTION MODE
                // ==========================================
                if (activeMode === 'visual') {
                    const sortedPages = Array.from(selectedPages).sort((a, b) => a - b);
                    if (sortedPages.length === 0) {
                        throw new Error('Please select at least one page to extract.');
                    }

                    const format = document.querySelector('input[name="visual-output-format"]:checked')?.value || 'merged';

                    if (format === 'merged') {
                        progress.update(25, 'Combining selected pages...');
                        const targetDoc = await PDFLib.PDFDocument.create();
                        const zeroIndices = sortedPages.map(p => p - 1);
                        const copied = await targetDoc.copyPages(sourceDoc, zeroIndices);
                        copied.forEach(p => targetDoc.addPage(p));

                        progress.update(80, 'Generating PDF...');
                        const pdfBytes = await targetDoc.save();

                        lastResultPayload = {
                            type: 'pdf',
                            data: pdfBytes,
                            filename: `${baseDocName}-selected.pdf`
                        };

                        resultSummary.textContent = `Extracted ${sortedPages.length} pages into 1 single PDF (${PDFCore.formatBytes(pdfBytes.length)}).`;
                    } else {
                        // ZIP of separate 1-page PDFs
                        progress.update(20, 'Extracting individual pages...');
                        const zipEntries = [];
                        for (let i = 0; i < sortedPages.length; i++) {
                            const pNum = sortedPages[i];
                            const singleDoc = await PDFLib.PDFDocument.create();
                            const [cp] = await singleDoc.copyPages(sourceDoc, [pNum - 1]);
                            singleDoc.addPage(cp);
                            const b = await singleDoc.save();
                            const pad = String(pNum).padStart(2, '0');
                            zipEntries.push({
                                name: `${baseDocName}-page-${pad}.pdf`,
                                bytes: b
                            });
                            progress.update(20 + Math.round((i / sortedPages.length) * 60));
                        }

                        progress.update(85, 'Packaging ZIP archive...');
                        const zip = new JSZip();
                        zipEntries.forEach(e => zip.file(e.name, e.bytes, { binary: true }));
                        const zipBlob = await zip.generateAsync({ type: 'blob' });

                        lastResultPayload = {
                            type: 'zip',
                            data: zipBlob,
                            filename: `${baseDocName}-pages.zip`
                        };

                        resultSummary.textContent = `Created ZIP archive with ${sortedPages.length} separate PDF files (${PDFCore.formatBytes(zipBlob.size)}).`;
                    }
                }

                // ==========================================
                // 2. CUSTOM RANGES MODE
                // ==========================================
                else if (activeMode === 'ranges') {
                    const parsed = validateRangeInput();
                    if (!parsed.valid || parsed.groups.length === 0) {
                        throw new Error(parsed.error || 'Please enter valid page ranges.');
                    }

                    const format = document.querySelector('input[name="range-output-format"]:checked')?.value || 'zip';

                    if (format === 'merged') {
                        progress.update(25, 'Extracting and merging ranges...');
                        const targetDoc = await PDFLib.PDFDocument.create();
                        const zeroIndices = parsed.flatPages.map(p => p - 1);
                        const copied = await targetDoc.copyPages(sourceDoc, zeroIndices);
                        copied.forEach(p => targetDoc.addPage(p));

                        progress.update(85, 'Saving combined PDF...');
                        const pdfBytes = await targetDoc.save();

                        lastResultPayload = {
                            type: 'pdf',
                            data: pdfBytes,
                            filename: `${baseDocName}-ranges.pdf`
                        };

                        resultSummary.textContent = `Combined ${parsed.groups.length} range(s) into 1 document (${PDFCore.formatBytes(pdfBytes.length)}).`;
                    } else {
                        // ZIP of separate range PDFs
                        progress.update(20, 'Extracting range documents...');
                        const zipEntries = [];
                        for (let g = 0; g < parsed.groups.length; g++) {
                            const groupPages = parsed.groups[g];
                            const rangeDoc = await PDFLib.PDFDocument.create();
                            const zeroIndices = groupPages.map(p => p - 1);
                            const copied = await rangeDoc.copyPages(sourceDoc, zeroIndices);
                            copied.forEach(p => rangeDoc.addPage(p));
                            const b = await rangeDoc.save();

                            const rangeLabel = groupPages.length > 1
                                ? `${groupPages[0]}-${groupPages[groupPages.length - 1]}`
                                : `${groupPages[0]}`;

                            zipEntries.push({
                                name: `${baseDocName}-range-${rangeLabel}.pdf`,
                                bytes: b
                            });
                            progress.update(20 + Math.round((g / parsed.groups.length) * 60));
                        }

                        progress.update(85, 'Packaging ZIP...');
                        const zip = new JSZip();
                        zipEntries.forEach(e => zip.file(e.name, e.bytes, { binary: true }));
                        const zipBlob = await zip.generateAsync({ type: 'blob' });

                        lastResultPayload = {
                            type: 'zip',
                            data: zipBlob,
                            filename: `${baseDocName}-ranges.zip`
                        };

                        resultSummary.textContent = `Extracted ${parsed.groups.length} separate range PDF(s) into ZIP (${PDFCore.formatBytes(zipBlob.size)}).`;
                    }
                }

                // ==========================================
                // 3. SPLIT EVERY PAGE MODE
                // ==========================================
                else if (activeMode === 'all') {
                    progress.update(15, `Splitting all ${totalPages} pages...`);
                    const zipEntries = [];

                    for (let p = 1; p <= totalPages; p++) {
                        const singleDoc = await PDFLib.PDFDocument.create();
                        const [copied] = await singleDoc.copyPages(sourceDoc, [p - 1]);
                        singleDoc.addPage(copied);
                        const b = await singleDoc.save();

                        const pad = String(p).padStart(2, '0');
                        zipEntries.push({
                            name: `${baseDocName}-page-${pad}.pdf`,
                            bytes: b
                        });
                        progress.update(15 + Math.round((p / totalPages) * 65));
                    }

                    progress.update(85, 'Compressing into ZIP archive...');
                    const zip = new JSZip();
                    zipEntries.forEach(e => zip.file(e.name, e.bytes, { binary: true }));
                    const zipBlob = await zip.generateAsync({ type: 'blob' });

                    lastResultPayload = {
                        type: 'zip',
                        data: zipBlob,
                        filename: `${baseDocName}-all-pages.zip`
                    };

                    resultSummary.textContent = `Successfully split all ${totalPages} pages into a single ZIP archive (${PDFCore.formatBytes(zipBlob.size)}).`;
                }

                progress.complete('Split complete!');

                // Update download button label
                if (downloadBtnLabel) {
                    downloadBtnLabel.textContent = lastResultPayload.type === 'zip'
                        ? 'Download ZIP Archive'
                        : 'Download Split PDF';
                }

                if (resultView) {
                    resultView.classList.remove('hidden');
                    resultView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } catch (err) {
                console.error('Split execution error:', err);
                showError(err.message || 'An error occurred while splitting the PDF.');
                progress.reset();
            } finally {
                splitActionBtn.disabled = false;
                splitActionBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        });
    }

    // Download result
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (!lastResultPayload) return;
            const mime = lastResultPayload.type === 'zip' ? 'application/zip' : 'application/pdf';
            PDFCore.downloadBlob(lastResultPayload.data, lastResultPayload.filename, mime);
        });
    }

    // Reset workflow
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            cleanupCurrentPdf();
            currentFile = null;
            originalBuffer = null;
            totalPages = 0;
            progress.reset();
            resultView?.classList.add('hidden');
            workspaceView.classList.add('hidden');
            dropzoneView.classList.remove('hidden');
            clearError();
        });
    }

})();
