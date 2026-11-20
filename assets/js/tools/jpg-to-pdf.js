/**
 * NoPayPDF - JPG / PNG / WebP to PDF Client-Side Controller
 * 100% In-Browser Execution via pdf-lib
 */

(function () {
    'use strict';

    // DOM Elements
    const dropzoneView = document.getElementById('dropzone-view');
    const workspaceView = document.getElementById('workspace-view');
    const dropzoneEl = document.getElementById('jpg-dropzone');
    const fileInput = document.getElementById('jpg-file-input');
    const addMoreBtn = document.getElementById('add-more-img-btn');
    const addMoreInput = document.getElementById('add-more-img-input');
    const queueCountEl = document.getElementById('queue-count');
    const imageQueueGrid = document.getElementById('image-queue-grid');
    const sortAzBtn = document.getElementById('sort-az-btn');
    const sortReverseBtn = document.getElementById('sort-reverse-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');

    // Layout Settings
    const pageSizeSelect = document.getElementById('page-size-select');
    const orientationContainer = document.getElementById('orientation-container');
    const orientationSelect = document.getElementById('orientation-select');
    const marginSelect = document.getElementById('margin-select');
    const outputFilenameInput = document.getElementById('output-filename');

    // Action & Result
    const createPdfBtn = document.getElementById('create-pdf-btn');
    const progressContainer = document.getElementById('jpg-progress-container');
    const resultView = document.getElementById('result-view');
    const resultSummary = document.getElementById('result-summary');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const resetBtn = document.getElementById('jpg-reset-btn');
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    const errorDismissBtn = document.getElementById('error-dismiss-btn');

    // State
    const progress = PDFCore.createProgress(progressContainer);
    let imageItems = []; // Array<{ id: string, file: File, rotation: number, previewUrl: string, width: number, height: number }>
    let nextId = 1;
    let draggedIndex = null;
    let lastGeneratedPdfBytes = null;

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
        imageItems.forEach(item => {
            if (item.previewUrl) {
                try { URL.revokeObjectURL(item.previewUrl); } catch (e) {}
            }
        });
        imageItems = [];
        if (imageQueueGrid) imageQueueGrid.innerHTML = '';
        lastGeneratedPdfBytes = null;
    }

    // Toggle orientation control when "Fit to Image" is chosen
    if (pageSizeSelect && orientationContainer) {
        pageSizeSelect.addEventListener('change', () => {
            if (pageSizeSelect.value === 'fit') {
                orientationContainer.classList.add('opacity-40', 'pointer-events-none');
            } else {
                orientationContainer.classList.remove('opacity-40', 'pointer-events-none');
            }
        });
    }

    // Read image natural dimensions via createImageBitmap or Image
    async function inspectImageFile(file) {
        try {
            if ('createImageBitmap' in window) {
                const bmp = await createImageBitmap(file);
                const width = bmp.width;
                const height = bmp.height;
                bmp.close();
                return { width, height };
            }
        } catch (e) {
            // Fallback to Image element
        }

        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 600 });
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve({ width: 800, height: 600 });
            };
            img.src = url;
        });
    }

    // Add new images to the queue
    async function addImages(files) {
        clearError();
        try {
            for (const file of files) {
                const { width, height } = await inspectImageFile(file);
                const previewUrl = URL.createObjectURL(file);

                imageItems.push({
                    id: `img-${nextId++}`,
                    file,
                    rotation: 0,
                    previewUrl,
                    width,
                    height,
                });
            }

            dropzoneView.classList.add('hidden');
            resultView.classList.add('hidden');
            workspaceView.classList.remove('hidden');

            renderQueueGrid();
        } catch (err) {
            console.error('Error adding images:', err);
            showError('Could not process one or more images.');
        }
    }

    // Render image cards in the queue grid
    function renderQueueGrid() {
        if (!imageQueueGrid || !queueCountEl) return;
        queueCountEl.textContent = imageItems.length;

        if (imageItems.length === 0) {
            workspaceView.classList.add('hidden');
            dropzoneView.classList.remove('hidden');
            return;
        }

        imageQueueGrid.innerHTML = '';

        imageItems.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'image-queue-card bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between relative group';
            card.draggable = true;
            card.dataset.index = index;

            const rotBadge = item.rotation !== 0
                ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">${item.rotation}°</span>`
                : '';

            card.innerHTML = `
                <div>
                    <div class="w-full flex items-center justify-between text-xs mb-1.5 px-0.5 select-none">
                        <span class="w-5 h-5 rounded-md bg-blue-50 text-blue-600 font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                            ${index + 1}
                        </span>
                        <div class="flex items-center gap-1">
                            ${rotBadge}
                            <button type="button" class="btn-remove p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Remove image" aria-label="Remove">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Image Preview -->
                    <div class="w-full h-[120px] bg-slate-50 border border-slate-100 rounded-lg overflow-hidden flex items-center justify-center p-1 cursor-grab active:cursor-grabbing">
                        <img src="${item.previewUrl}" alt="${item.file.name}" class="image-preview-thumb max-h-full max-w-full" style="transform: rotate(${item.rotation}deg)">
                    </div>

                    <div class="mt-2 px-0.5">
                        <p class="text-[11px] font-semibold text-slate-800 truncate" title="${item.file.name}">${item.file.name}</p>
                        <div class="flex items-center justify-between text-[10px] text-slate-400 mt-0.5 font-medium">
                            <span>${item.width} × ${item.height} px</span>
                            <span>${PDFCore.formatBytes(item.file.size)}</span>
                        </div>
                    </div>
                </div>

                <!-- Per-Image Actions -->
                <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-slate-500">
                    <button type="button" class="btn-rotate p-1 rounded hover:bg-slate-100 hover:text-slate-800 flex items-center gap-1 text-[11px] font-medium" title="Rotate clockwise 90°">
                        <i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i>
                        <span>Rotate</span>
                    </button>
                    <div class="flex items-center gap-0.5">
                        <button type="button" class="btn-move-left p-1 rounded hover:bg-slate-100 hover:text-slate-800 ${index === 0 ? 'opacity-30 pointer-events-none' : ''}" title="Move left">
                            <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
                        </button>
                        <button type="button" class="btn-move-right p-1 rounded hover:bg-slate-100 hover:text-slate-800 ${index === imageItems.length - 1 ? 'opacity-30 pointer-events-none' : ''}" title="Move right">
                            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
            `;

            // HTML5 Drag and drop reordering
            card.addEventListener('dragstart', (e) => {
                draggedIndex = index;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                draggedIndex = null;
                document.querySelectorAll('.image-queue-card').forEach(c => c.classList.remove('drag-over-item'));
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
                    const movedItem = imageItems.splice(draggedIndex, 1)[0];
                    imageItems.splice(targetIndex, 0, movedItem);
                    renderQueueGrid();
                }
            });

            // Action button handlers
            card.querySelector('.btn-rotate')?.addEventListener('click', () => {
                item.rotation = (item.rotation + 90) % 360;
                renderQueueGrid();
            });

            card.querySelector('.btn-remove')?.addEventListener('click', () => {
                try { URL.revokeObjectURL(item.previewUrl); } catch (e) {}
                imageItems.splice(index, 1);
                renderQueueGrid();
            });

            card.querySelector('.btn-move-left')?.addEventListener('click', () => {
                if (index > 0) {
                    const moved = imageItems.splice(index, 1)[0];
                    imageItems.splice(index - 1, 0, moved);
                    renderQueueGrid();
                }
            });

            card.querySelector('.btn-move-right')?.addEventListener('click', () => {
                if (index < imageItems.length - 1) {
                    const moved = imageItems.splice(index, 1)[0];
                    imageItems.splice(index + 1, 0, moved);
                    renderQueueGrid();
                }
            });

            imageQueueGrid.appendChild(card);
        });

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // Dropzone setup
    PDFCore.initDropzone({
        dropzoneEl,
        inputEl: fileInput,
        accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
        multiple: true,
        onFilesAdded: (files) => addImages(files),
        onError: (errs) => showError(errs.join(' '))
    });

    // Add More button
    if (addMoreBtn && addMoreInput) {
        addMoreBtn.addEventListener('click', () => {
            addMoreInput.value = '';
            addMoreInput.click();
        });

        addMoreInput.addEventListener('change', () => {
            if (addMoreInput.files && addMoreInput.files.length > 0) {
                const { valid, errors } = PDFCore.validateFiles(addMoreInput.files, {
                    acceptExtensions: ['jpg', 'jpeg', 'png', 'webp'],
                    acceptMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
                    multiple: true,
                });
                if (errors.length > 0) showError(errors.join(' '));
                if (valid.length > 0) addImages(valid);
            }
        });
    }

    // Quick toolbar actions
    if (sortAzBtn) {
        sortAzBtn.addEventListener('click', () => {
            imageItems.sort((a, b) => a.file.name.localeCompare(b.file.name));
            renderQueueGrid();
        });
    }

    if (sortReverseBtn) {
        sortReverseBtn.addEventListener('click', () => {
            imageItems.reverse();
            renderQueueGrid();
        });
    }

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            cleanupPreviews();
            renderQueueGrid();
            clearError();
        });
    }

    // Helper: Normalize an image file to clean JPEG or PNG bytes using an offscreen canvas
    async function normalizeImageBytes(item) {
        const file = item.file;
        const isPng = file.type === 'image/png';
        const hasRotation = item.rotation !== 0;
        const isWebp = file.type === 'image/webp';

        // Load image into bitmap/element
        let imgSource;
        if ('createImageBitmap' in window) {
            imgSource = await createImageBitmap(file);
        } else {
            imgSource = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = item.previewUrl;
            });
        }

        const natW = imgSource.width;
        const natH = imgSource.height;

        const isRotated90or270 = item.rotation === 90 || item.rotation === 270;
        const canvasW = isRotated90or270 ? natH : natW;
        const canvasH = isRotated90or270 ? natW : natH;

        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');

        if (!isPng) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvasW, canvasH);
        }

        ctx.save();
        ctx.translate(canvasW / 2, canvasH / 2);
        ctx.rotate((item.rotation * Math.PI) / 180);
        ctx.drawImage(imgSource, -natW / 2, -natH / 2);
        ctx.restore();

        if (imgSource.close) imgSource.close();

        const exportFormat = isPng ? 'image/png' : 'image/jpeg';
        const blob = await new Promise(res => canvas.toBlob(res, exportFormat, 0.92));
        const arrayBuf = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);

        // Cleanup canvas
        canvas.width = 0;
        canvas.height = 0;

        return {
            bytes,
            isPng,
            width: canvasW,
            height: canvasH,
        };
    }

    // Compilation Engine
    if (createPdfBtn) {
        createPdfBtn.addEventListener('click', async () => {
            clearError();
            if (resultView) resultView.classList.add('hidden');
            if (imageItems.length === 0) {
                showError('Please add at least one image to convert.');
                return;
            }

            try {
                createPdfBtn.disabled = true;
                createPdfBtn.classList.add('opacity-75', 'cursor-not-allowed');
                progress.start('Compiling images into PDF document...');

                const pdfDoc = await PDFLib.PDFDocument.create();
                const pageSizeChoice = pageSizeSelect?.value || 'a4';
                const orientationChoice = orientationSelect?.value || 'auto';
                const margin = parseInt(marginSelect?.value || '20', 10);

                // Standard points dimensions (72 pt per inch)
                // A4: 595.28 x 841.89 pt
                // Letter: 612 x 792 pt
                const baseDimensions = {
                    a4: { w: 595.28, h: 841.89 },
                    letter: { w: 612.0, h: 792.0 },
                };

                for (let i = 0; i < imageItems.length; i++) {
                    const item = imageItems[i];
                    progress.update(
                        Math.round((i / imageItems.length) * 85),
                        `Processing image ${i + 1} of ${imageItems.length} (${item.file.name})...`
                    );

                    const normalized = await normalizeImageBytes(item);
                    let embeddedImage;

                    if (normalized.isPng) {
                        embeddedImage = await pdfDoc.embedPng(normalized.bytes);
                    } else {
                        embeddedImage = await pdfDoc.embedJpg(normalized.bytes);
                    }

                    const imgW = normalized.width;
                    const imgH = normalized.height;

                    let pageWidth, pageHeight;

                    if (pageSizeChoice === 'fit') {
                        // Fit to image: 1 image pixel = 0.75 pt (96 DPI -> 72 DPI)
                        pageWidth = (imgW * 72) / 96;
                        pageHeight = (imgH * 72) / 96;
                    } else {
                        const standard = baseDimensions[pageSizeChoice] || baseDimensions.a4;
                        const isLandscape = orientationChoice === 'landscape' || (orientationChoice === 'auto' && imgW > imgH);

                        if (isLandscape) {
                            pageWidth = Math.max(standard.w, standard.h);
                            pageHeight = Math.min(standard.w, standard.h);
                        } else {
                            pageWidth = Math.min(standard.w, standard.h);
                            pageHeight = Math.max(standard.w, standard.h);
                        }
                    }

                    const printableW = Math.max(10, pageWidth - margin * 2);
                    const printableH = Math.max(10, pageHeight - margin * 2);

                    const scale = Math.min(printableW / imgW, printableH / imgH, 1.0);
                    const drawW = imgW * scale;
                    const drawH = imgH * scale;

                    const drawX = margin + (printableW - drawW) / 2;
                    const drawY = margin + (printableH - drawH) / 2;

                    const page = pdfDoc.addPage([pageWidth, pageHeight]);
                    page.drawImage(embeddedImage, {
                        x: drawX,
                        y: drawY,
                        width: drawW,
                        height: drawH,
                    });
                }

                progress.update(90, 'Writing final PDF...');
                lastGeneratedPdfBytes = await pdfDoc.save();

                progress.complete('PDF Created Successfully!');

                if (resultView && resultSummary) {
                    resultSummary.textContent = `Combined ${imageItems.length} image(s) into a ${imageItems.length}-page PDF document (${PDFCore.formatBytes(lastGeneratedPdfBytes.length)}).`;
                    resultView.classList.remove('hidden');
                    resultView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } catch (err) {
                console.error('Image to PDF error:', err);
                showError(err.message || 'An error occurred while compiling the PDF.');
                progress.reset();
            } finally {
                createPdfBtn.disabled = false;
                createPdfBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        });
    }

    // Download PDF Button
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', () => {
            if (!lastGeneratedPdfBytes) return;
            const requestedName = outputFilenameInput?.value || 'images-to-pdf.pdf';
            const cleanName = PDFCore.sanitizeFilename(requestedName, 'pdf');
            PDFCore.downloadBlob(lastGeneratedPdfBytes, cleanName, 'application/pdf');
        });
    }

    // Reset workflow
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            cleanupPreviews();
            progress.reset();
            resultView?.classList.add('hidden');
            workspaceView.classList.add('hidden');
            dropzoneView.classList.remove('hidden');
            clearError();
        });
    }

})();
