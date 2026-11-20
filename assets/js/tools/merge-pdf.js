/**
 * NoPayPDF - Merge PDF Client-Side Controller
 * 100% In-Browser Execution via pdf-lib
 */

(function () {
    'use strict';

    // DOM Elements
    const dropzoneView = document.getElementById('dropzone-view');
    const workspaceView = document.getElementById('workspace-view');
    const dropzoneEl = document.getElementById('merge-dropzone');
    const fileInput = document.getElementById('merge-file-input');
    const addMoreBtn = document.getElementById('add-more-btn');
    const addMoreInput = document.getElementById('add-more-input');
    const fileQueueList = document.getElementById('file-queue-list');
    const queueCountEl = document.getElementById('queue-count');
    const sortAzBtn = document.getElementById('sort-az-btn');
    const sortReverseBtn = document.getElementById('sort-reverse-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const outputFilenameInput = document.getElementById('output-filename');
    const mergeActionBtn = document.getElementById('merge-action-btn');
    const progressContainer = document.getElementById('merge-progress-container');
    const resultView = document.getElementById('result-view');
    const resultSummary = document.getElementById('result-summary');
    const downloadBtn = document.getElementById('download-merged-btn');
    const resetBtn = document.getElementById('merge-reset-btn');
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    const errorDismissBtn = document.getElementById('error-dismiss-btn');

    // State
    const queue = PDFCore.createFileQueue();
    const progress = PDFCore.createProgress(progressContainer);
    const fileMetaCache = new WeakMap(); // file -> { pageCount, arrayBuffer }
    let lastMergedBytes = null;
    let draggedIndex = null;

    // Error helper
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

    // Read and cache file ArrayBuffer & page count
    async function loadFileMetadata(file) {
        if (fileMetaCache.has(file)) {
            return fileMetaCache.get(file);
        }

        try {
            const buffer = await file.arrayBuffer();
            let pageCount = 0;
            try {
                const doc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
                pageCount = doc.getPageCount();
            } catch (e) {
                // If encrypted or corrupted, still hold buffer; will error on merge
                pageCount = 0;
            }

            const meta = { buffer, pageCount };
            fileMetaCache.set(file, meta);
            return meta;
        } catch (err) {
            console.error('Error reading file buffer:', err);
            return { buffer: null, pageCount: 0 };
        }
    }

    // Render file queue item UI
    function renderQueueUI(files) {
        if (!queueCountEl || !fileQueueList) return;
        queueCountEl.textContent = files.length;

        if (files.length === 0) {
            workspaceView.classList.add('hidden');
            resultView.classList.add('hidden');
            dropzoneView.classList.remove('hidden');
            return;
        }

        dropzoneView.classList.add('hidden');
        workspaceView.classList.remove('hidden');

        fileQueueList.innerHTML = '';

        files.forEach((file, index) => {
            const card = document.createElement('div');
            card.className = 'file-queue-item bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 transition-all';
            card.draggable = true;
            card.dataset.index = index;

            // Retrieve cached page count if available
            const cached = fileMetaCache.get(file);
            const pageCountText = cached && cached.pageCount > 0 ? `${cached.pageCount} pages` : 'Reading...';

            card.innerHTML = `
                <div class="flex items-center gap-3 overflow-hidden flex-grow cursor-grab active:cursor-grabbing">
                    <span class="drag-handle text-slate-300 hover:text-slate-600 p-1">
                        <i data-lucide="grip-vertical" class="w-4 h-4"></i>
                    </span>
                    <span class="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        ${index + 1}
                    </span>
                    <div class="overflow-hidden">
                        <h4 class="text-sm font-semibold text-slate-900 truncate" title="${file.name}">
                            ${file.name}
                        </h4>
                        <div class="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span>${PDFCore.formatBytes(file.size)}</span>
                            <span>&bull;</span>
                            <span class="file-page-count font-medium text-slate-600">${pageCountText}</span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-1 flex-shrink-0">
                    <button type="button" class="btn-move-up p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 ${index === 0 ? 'opacity-30 pointer-events-none' : ''}" title="Move Up" aria-label="Move Up">
                        <i data-lucide="arrow-up" class="w-4 h-4"></i>
                    </button>
                    <button type="button" class="btn-move-down p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 ${index === files.length - 1 ? 'opacity-30 pointer-events-none' : ''}" title="Move Down" aria-label="Move Down">
                        <i data-lucide="arrow-down" class="w-4 h-4"></i>
                    </button>
                    <button type="button" class="btn-remove p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 ml-1" title="Remove file" aria-label="Remove">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            `;

            // HTML5 Drag and drop handlers
            card.addEventListener('dragstart', (e) => {
                draggedIndex = index;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                draggedIndex = null;
                document.querySelectorAll('.file-queue-item').forEach(c => c.classList.remove('drag-over-item'));
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                card.classList.add('drag-over-item');
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over-item');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over-item');
                const targetIndex = parseInt(card.dataset.index, 10);
                if (draggedIndex !== null && draggedIndex !== targetIndex) {
                    const delta = targetIndex - draggedIndex;
                    queue.move(draggedIndex, delta);
                }
            });

            // Action button handlers
            card.querySelector('.btn-move-up')?.addEventListener('click', () => queue.move(index, -1));
            card.querySelector('.btn-move-down')?.addEventListener('click', () => queue.move(index, 1));
            card.querySelector('.btn-remove')?.addEventListener('click', () => queue.remove(index));

            fileQueueList.appendChild(card);

            // Fetch page count async if not cached
            if (!cached) {
                loadFileMetadata(file).then(meta => {
                    const countEl = card.querySelector('.file-page-count');
                    if (countEl) {
                        countEl.textContent = meta.pageCount > 0 ? `${meta.pageCount} pages` : 'PDF document';
                    }
                });
            }
        });

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // Subscribe to queue changes
    queue.onChange((files) => {
        renderQueueUI(files);
        // Preload metadata for all files
        files.forEach(f => loadFileMetadata(f));
    });

    // Dropzone initialization
    PDFCore.initDropzone({
        dropzoneEl,
        inputEl: fileInput,
        multiple: true,
        onFilesAdded: (addedFiles) => {
            clearError();
            queue.add(addedFiles);
        },
        onError: (errors) => {
            showError(errors.join(' '));
        }
    });

    // Add More PDFs button
    if (addMoreBtn && addMoreInput) {
        addMoreBtn.addEventListener('click', () => {
            addMoreInput.value = '';
            addMoreInput.click();
        });

        addMoreInput.addEventListener('change', () => {
            if (addMoreInput.files && addMoreInput.files.length > 0) {
                const { valid, errors } = PDFCore.validateFiles(addMoreInput.files, {
                    acceptExtensions: ['pdf'],
                    multiple: true,
                });
                if (errors.length > 0) showError(errors.join(' '));
                if (valid.length > 0) queue.add(valid);
            }
        });
    }

    // Quick sort actions
    if (sortAzBtn) {
        sortAzBtn.addEventListener('click', () => {
            const sorted = [...queue.getAll()].sort((a, b) => a.name.localeCompare(b.name));
            queue.clear();
            queue.add(sorted);
        });
    }

    if (sortReverseBtn) {
        sortReverseBtn.addEventListener('click', () => {
            const reversed = [...queue.getAll()].reverse();
            queue.clear();
            queue.add(reversed);
        });
    }

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            queue.clear();
            clearError();
        });
    }

    // Merge Action
    if (mergeActionBtn) {
        mergeActionBtn.addEventListener('click', async () => {
            clearError();
            if (resultView) resultView.classList.add('hidden');
            const files = queue.getAll();

            if (files.length < 2) {
                showError('Please add at least 2 PDF files to merge.');
                return;
            }

            try {
                mergeActionBtn.disabled = true;
                mergeActionBtn.classList.add('opacity-75', 'cursor-not-allowed');
                progress.start('Initializing merge...');

                const mergedDoc = await PDFLib.PDFDocument.create();
                let totalMergedPages = 0;

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    progress.update(
                        Math.round((i / files.length) * 85),
                        `Merging ${file.name} (${i + 1} of ${files.length})...`
                    );

                    let buffer = fileMetaCache.get(file)?.buffer;
                    if (!buffer) {
                        buffer = await file.arrayBuffer();
                    }

                    let srcDoc;
                    try {
                        srcDoc = await PDFLib.PDFDocument.load(buffer);
                    } catch (loadErr) {
                        throw new Error(`Failed to read "${file.name}": ${PDFCore.formatPdfError(loadErr)}`);
                    }

                    const pageIndices = srcDoc.getPageIndices();
                    const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices);
                    copiedPages.forEach(p => mergedDoc.addPage(p));
                    totalMergedPages += copiedPages.length;
                }

                progress.update(92, 'Finalizing merged document...');
                lastMergedBytes = await mergedDoc.save();

                progress.complete('Merge complete!');

                // Show result view
                if (resultView && resultSummary) {
                    resultSummary.textContent = `Combined ${files.length} documents into ${totalMergedPages} pages (${PDFCore.formatBytes(lastMergedBytes.length)}).`;
                    resultView.classList.remove('hidden');
                    resultView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } catch (err) {
                console.error('Merge error:', err);
                showError(err.message || 'An unexpected error occurred during merge.');
                progress.reset();
            } finally {
                mergeActionBtn.disabled = false;
                mergeActionBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        });
    }

    // Download button
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (!lastMergedBytes) return;
            const requestedName = outputFilenameInput?.value || 'merged.pdf';
            const cleanName = PDFCore.sanitizeFilename(requestedName, 'pdf');
            PDFCore.downloadBlob(lastMergedBytes, cleanName, 'application/pdf');
        });
    }

    // Reset button
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            queue.clear();
            lastMergedBytes = null;
            progress.reset();
            resultView?.classList.add('hidden');
            clearError();
        });
    }

})();
