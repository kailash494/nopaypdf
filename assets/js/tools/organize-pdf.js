/**
 * NoPayPDF - Organize PDF Pages Client-Side Controller
 * Reorder, Rotate, Duplicate & Delete Pages Visually
 */

(function () {
    'use strict';

    // DOM Elements
    const dropzoneView = document.getElementById('dropzone-view');
    const workspaceView = document.getElementById('workspace-view');
    const dropzoneEl = document.getElementById('organize-dropzone');
    const fileInput = document.getElementById('organize-file-input');
    const addMorePdfBtn = document.getElementById('add-more-pdf-btn');
    const addMorePdfInput = document.getElementById('add-more-pdf-input');
    const totalPagesBadge = document.getElementById('total-pages-badge');
    const pagesGrid = document.getElementById('pages-grid');

    // Bulk buttons
    const rotateAllLeftBtn = document.getElementById('rotate-all-left-btn');
    const rotateAllRightBtn = document.getElementById('rotate-all-right-btn');
    const reverseAllBtn = document.getElementById('reverse-all-btn');
    const undoBtn = document.getElementById('undo-btn');
    const resetOriginalBtn = document.getElementById('reset-original-btn');

    // Save & Result elements
    const savePdfBtn = document.getElementById('save-pdf-btn');
    const outputNameInput = document.getElementById('organize-output-name');
    const progressContainer = document.getElementById('organize-progress-container');
    const resultView = document.getElementById('result-view');
    const resultSummary = document.getElementById('result-summary');
    const downloadBtn = document.getElementById('download-organized-btn');
    const resetBtn = document.getElementById('organize-reset-btn');
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    const errorDismissBtn = document.getElementById('error-dismiss-btn');

    // State
    const progress = PDFCore.createProgress(progressContainer);
    let sourceFiles = []; // Array<{ name: string, buffer: ArrayBuffer, pdfProxy: Object, numPages: number }>
    let pageList = [];    // Array<{ id: string, sourceFileIndex: number, sourcePageIndex: number, rotationDelta: number, sourceFileName: string }>
    let initialSnapshot = [];
    const historyStack = [];
    const thumbCache = new Map(); // `${sourceFileIndex}:${sourcePageIndex}` -> HTMLCanvasElement | Promise
    let nextId = 1;
    let draggedIndex = null;
    let lastOrganizedBytes = null;

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

    function pushHistory() {
        historyStack.push(JSON.parse(JSON.stringify(pageList)));
        if (historyStack.length > 20) {
            historyStack.shift();
        }
        updateUndoBtn();
    }

    function updateUndoBtn() {
        if (undoBtn) {
            undoBtn.disabled = historyStack.length === 0;
        }
    }

    function cleanupAll() {
        sourceFiles.forEach(f => {
            if (f.pdfProxy) {
                PDFRender.destroyDoc(f.pdfProxy).catch(() => {});
            }
        });
        sourceFiles = [];
        pageList = [];
        initialSnapshot = [];
        historyStack.length = 0;
        thumbCache.clear();
        updateUndoBtn();
        pagesGrid.innerHTML = '';
        lastOrganizedBytes = null;
    }

    async function getCachedPageThumbnail(src, sourceFileIndex, sourcePageIndex) {
        const key = `${sourceFileIndex}:${sourcePageIndex}`;
        const existing = thumbCache.get(key);
        if (existing) return existing;

        const promise = PDFRender.renderPageToCanvas(src.pdfProxy, sourcePageIndex + 1, {
            maxWidth: 160,
            rotationDelta: 0,
        }).then((rendered) => {
            thumbCache.set(key, rendered);
            return rendered;
        });
        thumbCache.set(key, promise);
        return promise;
    }

    function cloneThumbCanvas(sourceCanvas, rotationDeg) {
        const clone = document.createElement('canvas');
        clone.width = sourceCanvas.width;
        clone.height = sourceCanvas.height;
        const cctx = clone.getContext('2d');
        cctx?.drawImage(sourceCanvas, 0, 0);
        clone.className = 'page-thumbnail-canvas max-h-[115px] max-w-[115px] transition-transform duration-150';
        clone.style.transform = `rotate(${rotationDeg}deg)`;
        return clone;
    }

    // Add files into workspace atomically
    async function addFiles(files) {
        clearError();
        const loadedBatch = [];
        try {
            for (const file of files) {
                const buffer = await file.arrayBuffer();
                const { pdfProxy, numPages } = await PDFRender.loadPreviewDocument(buffer);
                loadedBatch.push({
                    name: file.name,
                    buffer,
                    pdfProxy,
                    numPages,
                });
            }

            const newPages = [];
            loadedBatch.forEach((entry) => {
                const fileIndex = sourceFiles.length;
                sourceFiles.push(entry);
                for (let p = 0; p < entry.numPages; p++) {
                    const item = {
                        id: `p-${nextId++}`,
                        sourceFileIndex: fileIndex,
                        sourcePageIndex: p,
                        rotationDelta: 0,
                        sourceFileName: entry.name,
                    };
                    pageList.push(item);
                    newPages.push(JSON.parse(JSON.stringify(item)));
                }
            });

            initialSnapshot.push(...newPages);
            lastOrganizedBytes = null;

            dropzoneView.classList.add('hidden');
            resultView.classList.add('hidden');
            workspaceView.classList.remove('hidden');

            renderGridUI();
        } catch (err) {
            await Promise.all(loadedBatch.map((entry) => PDFRender.destroyDoc(entry.pdfProxy)));
            console.error('Organize load error:', err);
            showError(`Failed to load PDF: ${PDFCore.formatPdfError(err)}`);
        }
    }

    // Render the grid of page cards
    function renderGridUI() {
        if (!pagesGrid || !totalPagesBadge) return;
        totalPagesBadge.textContent = pageList.length;
        lastOrganizedBytes = null;
        resultView?.classList.add('hidden');

        if (pageList.length === 0) {
            pagesGrid.innerHTML = `
                <div class="col-span-full py-12 text-center text-slate-500">
                    <p class="text-sm font-semibold">No pages remaining.</p>
                    <p class="text-xs mt-1">Click "Undo" or "Add Another PDF" to continue.</p>
                </div>
            `;
            if (savePdfBtn) savePdfBtn.disabled = true;
            return;
        }

        if (savePdfBtn) savePdfBtn.disabled = false;
        pagesGrid.innerHTML = '';

        pageList.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'page-thumbnail-card bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between relative group';
            card.draggable = true;
            card.dataset.index = index;

            const rot = ((item.rotationDelta % 360) + 360) % 360;
            const rotBadge = rot !== 0
                ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">${rot}°</span>`
                : '';

            const showFileBadge = sourceFiles.length > 1;
            const safeSourceName = PDFCore.escapeHtml(item.sourceFileName);
            const fileBadge = showFileBadge
                ? `<span class="text-[9px] text-slate-400 font-medium truncate max-w-[80px]" title="${safeSourceName}">${safeSourceName}</span>`
                : '';

            card.innerHTML = `
                <div class="w-full flex items-center justify-between text-xs mb-1.5 px-0.5 select-none">
                    <div class="flex items-center gap-1.5 overflow-hidden">
                        <span class="w-5 h-5 rounded-md bg-blue-50 text-blue-600 font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                            ${index + 1}
                        </span>
                        ${fileBadge}
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                        ${rotBadge}
                        <button type="button" class="btn-delete p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete page" aria-label="Delete">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>

                <!-- Canvas Preview -->
                <div class="canvas-wrapper w-full h-[140px] flex items-center justify-center bg-slate-50 rounded-lg overflow-hidden border border-slate-100 cursor-grab active:cursor-grabbing">
                    <span class="text-[10px] text-slate-400 loading-indicator animate-pulse">Rendering...</span>
                </div>

                <!-- Per-Page Controls -->
                <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-slate-500">
                    <div class="flex items-center gap-0.5">
                        <button type="button" class="btn-rotate-left p-1 rounded hover:bg-slate-100 hover:text-slate-800" title="Rotate -90°" aria-label="Rotate Left">
                            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                        </button>
                        <button type="button" class="btn-rotate-right p-1 rounded hover:bg-slate-100 hover:text-slate-800" title="Rotate +90°" aria-label="Rotate Right">
                            <i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i>
                        </button>
                        <button type="button" class="btn-duplicate p-1 rounded hover:bg-slate-100 hover:text-blue-600" title="Duplicate page" aria-label="Duplicate">
                            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <div class="flex items-center gap-0.5">
                        <button type="button" class="btn-move-left p-1 rounded hover:bg-slate-100 hover:text-slate-800 ${index === 0 ? 'opacity-30 pointer-events-none' : ''}" title="Move Left" aria-label="Move Left">
                            <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
                        </button>
                        <button type="button" class="btn-move-right p-1 rounded hover:bg-slate-100 hover:text-slate-800 ${index === pageList.length - 1 ? 'opacity-30 pointer-events-none' : ''}" title="Move Right" aria-label="Move Right">
                            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
            `;

            // HTML5 Drag & Drop
            card.addEventListener('dragstart', (e) => {
                draggedIndex = index;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                draggedIndex = null;
                document.querySelectorAll('.page-thumbnail-card').forEach(c => c.classList.remove('drag-over-card'));
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                card.classList.add('drag-over-card');
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over-card');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over-card');
                const targetIndex = parseInt(card.dataset.index, 10);
                if (draggedIndex !== null && draggedIndex !== targetIndex) {
                    pushHistory();
                    const movedItem = pageList.splice(draggedIndex, 1)[0];
                    pageList.splice(targetIndex, 0, movedItem);
                    renderGridUI();
                }
            });

            // Action Button Handlers
            card.querySelector('.btn-rotate-left')?.addEventListener('click', () => {
                pushHistory();
                item.rotationDelta = (item.rotationDelta - 90) % 360;
                renderGridUI();
            });

            card.querySelector('.btn-rotate-right')?.addEventListener('click', () => {
                pushHistory();
                item.rotationDelta = (item.rotationDelta + 90) % 360;
                renderGridUI();
            });

            card.querySelector('.btn-duplicate')?.addEventListener('click', () => {
                pushHistory();
                const copy = { ...item, id: `p-${nextId++}` };
                pageList.splice(index + 1, 0, copy);
                renderGridUI();
            });

            card.querySelector('.btn-delete')?.addEventListener('click', () => {
                pushHistory();
                pageList.splice(index, 1);
                renderGridUI();
            });

            card.querySelector('.btn-move-left')?.addEventListener('click', () => {
                if (index > 0) {
                    pushHistory();
                    const el = pageList.splice(index, 1)[0];
                    pageList.splice(index - 1, 0, el);
                    renderGridUI();
                }
            });

            card.querySelector('.btn-move-right')?.addEventListener('click', () => {
                if (index < pageList.length - 1) {
                    pushHistory();
                    const el = pageList.splice(index, 1)[0];
                    pageList.splice(index + 1, 0, el);
                    renderGridUI();
                }
            });

            pagesGrid.appendChild(card);

            // Render or reuse cached Canvas + CSS rotate transform
            const src = sourceFiles[item.sourceFileIndex];
            if (src && src.pdfProxy) {
                const wrapper = card.querySelector('.canvas-wrapper');
                const cacheKey = `${item.sourceFileIndex}:${item.sourcePageIndex}`;
                const cached = thumbCache.get(cacheKey);
                if (cached instanceof HTMLCanvasElement) {
                    if (wrapper) {
                        wrapper.innerHTML = '';
                        wrapper.appendChild(cloneThumbCanvas(cached, rot));
                    }
                } else {
                    getCachedPageThumbnail(src, item.sourceFileIndex, item.sourcePageIndex).then((baseCanvas) => {
                        if (wrapper && card.isConnected) {
                            wrapper.innerHTML = '';
                            wrapper.appendChild(cloneThumbCanvas(baseCanvas, rot));
                        }
                    }).catch((err) => {
                        console.error('Thumbnail error:', err);
                    });
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
        multiple: true,
        onFilesAdded: (files) => addFiles(files),
        onError: (errs) => showError(errs.join(' '))
    });

    // Add another PDF setup
    if (addMorePdfBtn && addMorePdfInput) {
        addMorePdfBtn.addEventListener('click', () => {
            addMorePdfInput.value = '';
            addMorePdfInput.click();
        });

        addMorePdfInput.addEventListener('change', () => {
            if (addMorePdfInput.files && addMorePdfInput.files.length > 0) {
                const { valid, errors } = PDFCore.validateFiles(addMorePdfInput.files, {
                    acceptExtensions: ['pdf'],
                    multiple: true,
                });
                if (errors.length > 0) showError(errors.join(' '));
                if (valid.length > 0) addFiles(valid);
            }
        });
    }

    // Bulk Toolbar Handlers
    if (rotateAllLeftBtn) {
        rotateAllLeftBtn.addEventListener('click', () => {
            if (pageList.length === 0) return;
            pushHistory();
            pageList.forEach(p => p.rotationDelta = (p.rotationDelta - 90) % 360);
            renderGridUI();
        });
    }

    if (rotateAllRightBtn) {
        rotateAllRightBtn.addEventListener('click', () => {
            if (pageList.length === 0) return;
            pushHistory();
            pageList.forEach(p => p.rotationDelta = (p.rotationDelta + 90) % 360);
            renderGridUI();
        });
    }

    if (reverseAllBtn) {
        reverseAllBtn.addEventListener('click', () => {
            if (pageList.length < 2) return;
            pushHistory();
            pageList.reverse();
            renderGridUI();
        });
    }

    if (undoBtn) {
        undoBtn.addEventListener('click', () => {
            if (historyStack.length > 0) {
                pageList = historyStack.pop();
                updateUndoBtn();
                renderGridUI();
            }
        });
    }

    if (resetOriginalBtn) {
        resetOriginalBtn.addEventListener('click', () => {
            if (initialSnapshot.length > 0) {
                pushHistory();
                pageList = JSON.parse(JSON.stringify(initialSnapshot));
                renderGridUI();
            }
        });
    }

    // Save Organized PDF Execution
    if (savePdfBtn) {
        savePdfBtn.addEventListener('click', async () => {
            clearError();
            if (resultView) resultView.classList.add('hidden');
            if (pageList.length === 0) {
                showError('Cannot export an empty document. Please add at least one page.');
                return;
            }

            try {
                savePdfBtn.disabled = true;
                savePdfBtn.classList.add('opacity-75', 'cursor-not-allowed');
                progress.start('Compiling organized PDF...');

                // Cache loaded PDFLib documents by sourceFileIndex
                const pdfLibDocs = [];
                for (let f = 0; f < sourceFiles.length; f++) {
                    const src = sourceFiles[f];
                    const doc = await PDFLib.PDFDocument.load(src.buffer);
                    pdfLibDocs.push(doc);
                }

                const targetDoc = await PDFLib.PDFDocument.create();

                for (let i = 0; i < pageList.length; i++) {
                    const item = pageList[i];
                    progress.update(
                        Math.round((i / pageList.length) * 85),
                        `Assembling page ${i + 1} of ${pageList.length}...`
                    );

                    const srcDoc = pdfLibDocs[item.sourceFileIndex];
                    const [copiedPage] = await targetDoc.copyPages(srcDoc, [item.sourcePageIndex]);

                    // Apply cumulative rotation
                    const currentAngle = copiedPage.getRotation().angle || 0;
                    const finalAngle = ((currentAngle + item.rotationDelta) % 360 + 360) % 360;
                    copiedPage.setRotation(PDFLib.degrees(finalAngle));

                    targetDoc.addPage(copiedPage);
                }

                progress.update(90, 'Writing final PDF...');
                lastOrganizedBytes = await targetDoc.save();

                progress.complete('Organize complete!');

                if (resultView && resultSummary) {
                    resultSummary.textContent = `Generated clean PDF with ${pageList.length} pages (${PDFCore.formatBytes(lastOrganizedBytes.length)}).`;
                    resultView.classList.remove('hidden');
                    resultView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } catch (err) {
                console.error('Organize export error:', err);
                showError(err.message || 'An error occurred while exporting the organized PDF.');
                progress.reset();
            } finally {
                savePdfBtn.disabled = false;
                savePdfBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        });
    }

    // Download Result
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (!lastOrganizedBytes) return;
            const requested = outputNameInput?.value || 'organized.pdf';
            const cleanName = PDFCore.sanitizeFilename(requested, 'pdf');
            PDFCore.downloadBlob(lastOrganizedBytes, cleanName, 'application/pdf');
        });
    }

    // Reset workflow
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            cleanupAll();
            if (fileInput) fileInput.value = '';
            if (addMorePdfInput) addMorePdfInput.value = '';
            if (outputNameInput) outputNameInput.value = 'organized.pdf';
            progress.reset();
            resultView?.classList.add('hidden');
            workspaceView.classList.add('hidden');
            dropzoneView.classList.remove('hidden');
            clearError();
        });
    }

})();
