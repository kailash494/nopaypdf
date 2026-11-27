/**
 * NoPayPDF - Crop PDF Controller
 * Interactive visual crop box overlay with precise margin inputs and non-destructive vector cropping.
 * Permissive MIT/Apache 2.0 implementation.
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

        const cropWorkspacePanel = document.getElementById('crop-workspace-panel');
        const docFilename = document.getElementById('doc-filename');
        const docMeta = document.getElementById('doc-meta');
        const cropChangeFileBtn = document.getElementById('crop-change-file-btn');

        // Page Switcher
        const cropPrevPageBtn = document.getElementById('crop-prev-page-btn');
        const cropNextPageBtn = document.getElementById('crop-next-page-btn');
        const cropCurrentPageNum = document.getElementById('crop-current-page-num');
        const cropTotalPageNum = document.getElementById('crop-total-page-num');

        // Units & Margins
        const unitBtns = document.querySelectorAll('.unit-btn');
        const unitLabels = document.querySelectorAll('.unit-label');
        const marginTopInput = document.getElementById('margin-top');
        const marginBottomInput = document.getElementById('margin-bottom');
        const marginLeftInput = document.getElementById('margin-left');
        const marginRightInput = document.getElementById('margin-right');
        const presetBtns = document.querySelectorAll('.preset-btn');
        const origSizeLabel = document.getElementById('orig-size-label');
        const croppedSizeLabel = document.getElementById('cropped-size-label');

        // Scope & Action
        const cropScopeSelect = document.getElementById('crop-scope-select');
        const cropCustomRangeInput = document.getElementById('crop-custom-range-input');
        const applyCropBtn = document.getElementById('apply-crop-btn');

        // Canvas & Visual Overlay
        const cropViewportWrap = document.getElementById('crop-viewport-wrap');
        const cropBaseCanvas = document.getElementById('crop-base-canvas');
        const cropMaskOverlay = document.getElementById('crop-mask-overlay');
        const activeCropBox = document.getElementById('active-crop-box');
        const maskTop = document.getElementById('mask-top');
        const maskBottom = document.getElementById('mask-bottom');
        const maskLeft = document.getElementById('mask-left');
        const maskRight = document.getElementById('mask-right');
        const cropHandles = document.querySelectorAll('.crop-handle');

        // Result
        const resultPanel = document.getElementById('result-panel');
        const downloadCroppedPdfBtn = document.getElementById('downloadCroppedPdfBtn') || document.getElementById('download-cropped-pdf-btn');
        const cropResetBtn = document.getElementById('crop-reset-btn');

        // --- Application State ---
        let originalFile = null;
        let originalArrayBuffer = null;
        let pdfDocProxy = null;
        let totalPages = 1;
        let currentPage = 1;
        let activeUnit = 'pt'; // 'pt' | 'mm' | 'in'

        // Page Point Dimensions
        let pagePtWidth = 612;
        let pagePtHeight = 792;
        let displayScale = 1.0; // canvas pixels per point

        // Margins stored internally in typographic points
        const marginsPt = {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        };

        let lastCroppedPdfBytes = null;

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

        function invalidateResult() {
            lastCroppedPdfBytes = null;
            resultPanel?.classList.add('hidden');
        }

        // --- Load Document ---
        async function loadPdfDocument(file) {
            clearError();

            try {
                const nextBuffer = await PDFCore.readFileAsArrayBuffer(file);
                const loaded = await PDFRender.loadPreviewDoc(nextBuffer);
                if (pdfDocProxy) {
                    await PDFRender.destroyDoc(pdfDocProxy);
                    pdfDocProxy = null;
                }
                originalFile = file;
                originalArrayBuffer = nextBuffer;
                pdfDocProxy = loaded.pdfProxy;
                totalPages = loaded.numPages;

                currentPage = 1;
                marginsPt.top = 0;
                marginsPt.right = 0;
                marginsPt.bottom = 0;
                marginsPt.left = 0;
                lastCroppedPdfBytes = null;

                docFilename.textContent = file.name;
                docMeta.textContent = `${totalPages} page${totalPages === 1 ? '' : 's'} • ${PDFCore.formatBytes(file.size)}`;
                cropTotalPageNum.textContent = String(totalPages);
                cropCurrentPageNum.textContent = '1';

                uploadPanel.classList.add('hidden');
                resultPanel.classList.add('hidden');
                cropWorkspacePanel.classList.remove('hidden');

                await renderPageCropStage();

                if (typeof lucide !== 'undefined') lucide.createIcons();
            } catch (err) {
                console.error('Error loading PDF:', err);
                showError(PDFCore.formatPdfError(err));
            }
        }

        // --- Render Page on Stage ---
        async function renderPageCropStage() {
            if (!pdfDocProxy) return;

            cropCurrentPageNum.textContent = String(currentPage);
            cropPrevPageBtn.disabled = currentPage <= 1;
            cropNextPageBtn.disabled = currentPage >= totalPages;

            const page = await pdfDocProxy.getPage(currentPage);
            const intrinsicRotation = page.rotate || 0;
            const baseViewport = page.getViewport({ scale: 1.0, rotation: intrinsicRotation });

            pagePtWidth = baseViewport.width;
            pagePtHeight = baseViewport.height;

            // Clamp stored margins cleanly if switching between heterogeneous page sizes
            const maxW = Math.max(0, pagePtWidth - 36);
            const maxH = Math.max(0, pagePtHeight - 36);
            marginsPt.top = Math.min(marginsPt.top, maxH);
            marginsPt.bottom = Math.min(marginsPt.bottom, Math.max(0, maxH - marginsPt.top));
            marginsPt.left = Math.min(marginsPt.left, maxW);
            marginsPt.right = Math.min(marginsPt.right, Math.max(0, maxW - marginsPt.left));

            // Guard positive stage width even if container is narrow/reflowing
            const parentWidth = cropViewportWrap.parentElement?.clientWidth || 420;
            const maxDisplayWidth = Math.max(220, Math.min(parentWidth - 48, 420));
            displayScale = maxDisplayWidth / pagePtWidth;

            const viewport = page.getViewport({ scale: displayScale, rotation: intrinsicRotation });

            cropBaseCanvas.width = Math.floor(viewport.width);
            cropBaseCanvas.height = Math.floor(viewport.height);
            cropBaseCanvas.style.width = `${Math.floor(viewport.width)}px`;
            cropBaseCanvas.style.height = `${Math.floor(viewport.height)}px`;

            cropViewportWrap.style.width = `${cropBaseCanvas.width}px`;
            cropViewportWrap.style.height = `${cropBaseCanvas.height}px`;

            const ctx = cropBaseCanvas.getContext('2d', { alpha: false });
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, cropBaseCanvas.width, cropBaseCanvas.height);

            await page.render({ canvasContext: ctx, viewport }).promise;

            // Update inputs and visual crop overlay
            updateNumericInputsFromPoints();
            updateVisualCropOverlayFromPoints();
        }

        cropPrevPageBtn?.addEventListener('click', async () => {
            if (currentPage > 1) {
                currentPage--;
                await renderPageCropStage();
            }
        });

        cropNextPageBtn?.addEventListener('click', async () => {
            if (currentPage < totalPages) {
                currentPage++;
                await renderPageCropStage();
            }
        });

        // --- Unit Conversions ---
        function ptToUnit(valPt, unit) {
            if (unit === 'mm') return (valPt * 25.4 / 72).toFixed(1);
            if (unit === 'in') return (valPt / 72).toFixed(2);
            return Math.round(valPt);
        }

        function unitToPt(valUnit, unit) {
            const num = parseFloat(valUnit) || 0;
            if (unit === 'mm') return num * 72 / 25.4;
            if (unit === 'in') return num * 72;
            return num;
        }

        // Switch active unit
        unitBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                activeUnit = btn.dataset.unit;
                unitBtns.forEach((b) => {
                    if (b.dataset.unit === activeUnit) {
                        b.className = 'unit-btn px-2.5 py-0.5 rounded-lg bg-white text-blue-600 shadow-2xs font-semibold';
                    } else {
                        b.className = 'unit-btn px-2.5 py-0.5 rounded-lg text-slate-600 hover:text-slate-900 font-semibold';
                    }
                });
                unitLabels.forEach((lbl) => (lbl.textContent = activeUnit));
                updateNumericInputsFromPoints();
            });
        });

        // --- Synchronize Numeric Inputs & Visuals ---
        function updateNumericInputsFromPoints() {
            marginTopInput.value = ptToUnit(marginsPt.top, activeUnit);
            marginBottomInput.value = ptToUnit(marginsPt.bottom, activeUnit);
            marginLeftInput.value = ptToUnit(marginsPt.left, activeUnit);
            marginRightInput.value = ptToUnit(marginsPt.right, activeUnit);

            // Update Dimension Readouts
            const origW = ptToUnit(pagePtWidth, activeUnit);
            const origH = ptToUnit(pagePtHeight, activeUnit);
            origSizeLabel.textContent = `${origW} \u00D7 ${origH} ${activeUnit}`;

            const croppedW = Math.max(0, pagePtWidth - marginsPt.left - marginsPt.right);
            const croppedH = Math.max(0, pagePtHeight - marginsPt.top - marginsPt.bottom);
            const cropWStr = ptToUnit(croppedW, activeUnit);
            const cropHStr = ptToUnit(croppedH, activeUnit);
            croppedSizeLabel.textContent = `${cropWStr} \u00D7 ${cropHStr} ${activeUnit}`;
        }

        function updateVisualCropOverlayFromPoints() {
            const cWidth = cropBaseCanvas.width;
            const cHeight = cropBaseCanvas.height;

            const boxLeft = Math.max(0, marginsPt.left * displayScale);
            const boxTop = Math.max(0, marginsPt.top * displayScale);
            const boxWidth = Math.max(20, cWidth - (marginsPt.left + marginsPt.right) * displayScale);
            const boxHeight = Math.max(20, cHeight - (marginsPt.top + marginsPt.bottom) * displayScale);

            activeCropBox.style.left = `${boxLeft}px`;
            activeCropBox.style.top = `${boxTop}px`;
            activeCropBox.style.width = `${boxWidth}px`;
            activeCropBox.style.height = `${boxHeight}px`;

            // Darkened Masks
            maskTop.style.height = `${boxTop}px`;
            maskBottom.style.height = `${Math.max(0, cHeight - (boxTop + boxHeight))}px`;

            maskLeft.style.top = `${boxTop}px`;
            maskLeft.style.height = `${boxHeight}px`;
            maskLeft.style.width = `${boxLeft}px`;

            maskRight.style.top = `${boxTop}px`;
            maskRight.style.height = `${boxHeight}px`;
            maskRight.style.left = `${boxLeft + boxWidth}px`;
            maskRight.style.width = `${Math.max(0, cWidth - (boxLeft + boxWidth))}px`;
        }

        function onNumericInputChanged(syncInputs = false) {
            const maxW = Math.max(0, pagePtWidth - 36);
            const maxH = Math.max(0, pagePtHeight - 36);

            const topPt = Math.max(0, unitToPt(marginTopInput.value, activeUnit));
            const bottomPt = Math.max(0, unitToPt(marginBottomInput.value, activeUnit));
            const leftPt = Math.max(0, unitToPt(marginLeftInput.value, activeUnit));
            const rightPt = Math.max(0, unitToPt(marginRightInput.value, activeUnit));

            marginsPt.top = Math.min(topPt, maxH);
            marginsPt.bottom = Math.min(bottomPt, Math.max(0, maxH - marginsPt.top));
            marginsPt.left = Math.min(leftPt, maxW);
            marginsPt.right = Math.min(rightPt, Math.max(0, maxW - marginsPt.left));

            invalidateResult();
            updateVisualCropOverlayFromPoints();
            if (syncInputs) {
                updateNumericInputsFromPoints();
            } else {
                const origW = ptToUnit(pagePtWidth, activeUnit);
                const origH = ptToUnit(pagePtHeight, activeUnit);
                origSizeLabel.textContent = `${origW} \u00D7 ${origH} ${activeUnit}`;
                const croppedW = Math.max(0, pagePtWidth - marginsPt.left - marginsPt.right);
                const croppedH = Math.max(0, pagePtHeight - marginsPt.top - marginsPt.bottom);
                croppedSizeLabel.textContent = `${ptToUnit(croppedW, activeUnit)} \u00D7 ${ptToUnit(croppedH, activeUnit)} ${activeUnit}`;
            }
        }

        [marginTopInput, marginBottomInput, marginLeftInput, marginRightInput].forEach((inp) => {
            // Preserve partial decimals like "0." / "1." while typing; normalize formatting on change/blur
            inp.addEventListener('input', () => onNumericInputChanged(false));
            inp.addEventListener('change', () => onNumericInputChanged(true));
            inp.addEventListener('blur', () => onNumericInputChanged(true));
        });

        // --- Quick Presets ---
        presetBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                invalidateResult();
                const preset = btn.dataset.preset;
                if (preset === 'reset') {
                    marginsPt.top = 0;
                    marginsPt.right = 0;
                    marginsPt.bottom = 0;
                    marginsPt.left = 0;
                } else if (preset === 'trim-half-inch') {
                    // 0.5 inch = 36 pt
                    marginsPt.top = 36;
                    marginsPt.right = 36;
                    marginsPt.bottom = 36;
                    marginsPt.left = 36;
                } else if (preset === 'trim-10mm') {
                    // 10 mm = 28.35 pt
                    const mmPt = 10 * 72 / 25.4;
                    marginsPt.top = mmPt;
                    marginsPt.right = mmPt;
                    marginsPt.bottom = mmPt;
                    marginsPt.left = mmPt;
                } else if (preset === 'center-80') {
                    // 10% on each edge
                    marginsPt.top = pagePtHeight * 0.10;
                    marginsPt.bottom = pagePtHeight * 0.10;
                    marginsPt.left = pagePtWidth * 0.10;
                    marginsPt.right = pagePtWidth * 0.10;
                }
                updateNumericInputsFromPoints();
                updateVisualCropOverlayFromPoints();
            });
        });

        // --- Interactive Mouse & Touch Dragging for Crop Box ---
        let isDragging = false;
        let dragMode = null; // 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e'
        let dragStartX = 0;
        let dragStartY = 0;
        let startBoxLeft = 0;
        let startBoxTop = 0;
        let startBoxWidth = 0;
        let startBoxHeight = 0;

        function startCropDrag(mode, clientX, clientY) {
            isDragging = true;
            dragMode = mode;
            dragStartX = clientX;
            dragStartY = clientY;

            startBoxLeft = marginsPt.left * displayScale;
            startBoxTop = marginsPt.top * displayScale;
            startBoxWidth = cropBaseCanvas.width - (marginsPt.left + marginsPt.right) * displayScale;
            startBoxHeight = cropBaseCanvas.height - (marginsPt.top + marginsPt.bottom) * displayScale;
        }

        activeCropBox?.addEventListener('pointerdown', (e) => {
            if (e.target.classList.contains('crop-handle')) return;
            e.preventDefault();
            startCropDrag('move', e.clientX, e.clientY);
            e.stopPropagation();
        });

        cropHandles.forEach((handle) => {
            handle.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                startCropDrag(handle.dataset.handle, e.clientX, e.clientY);
                e.stopPropagation();
            });
        });

        // Window Move & Up (Pointer Events support both Mouse and Touch)
        window.addEventListener('pointermove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            const cWidth = cropBaseCanvas.width;
            const cHeight = cropBaseCanvas.height;
            const minPx = 36 * displayScale;

            let newLeft = startBoxLeft;
            let newTop = startBoxTop;
            let newWidth = startBoxWidth;
            let newHeight = startBoxHeight;

            if (dragMode === 'move') {
                newLeft = Math.max(0, Math.min(startBoxLeft + dx, cWidth - startBoxWidth));
                newTop = Math.max(0, Math.min(startBoxTop + dy, cHeight - startBoxHeight));
            } else {
                // Resize corners and edges
                if (dragMode.includes('w')) {
                    const candidateLeft = Math.max(0, Math.min(startBoxLeft + dx, startBoxLeft + startBoxWidth - minPx));
                    newWidth = startBoxWidth + (startBoxLeft - candidateLeft);
                    newLeft = candidateLeft;
                }
                if (dragMode.includes('e')) {
                    newWidth = Math.max(minPx, Math.min(startBoxWidth + dx, cWidth - startBoxLeft));
                }
                if (dragMode.includes('n')) {
                    const candidateTop = Math.max(0, Math.min(startBoxTop + dy, startBoxTop + startBoxHeight - minPx));
                    newHeight = startBoxHeight + (startBoxTop - candidateTop);
                    newTop = candidateTop;
                }
                if (dragMode.includes('s')) {
                    newHeight = Math.max(minPx, Math.min(startBoxHeight + dy, cHeight - startBoxTop));
                }
            }

            // Convert back to marginsPt
            marginsPt.left = newLeft / displayScale;
            marginsPt.top = newTop / displayScale;
            marginsPt.right = (cWidth - (newLeft + newWidth)) / displayScale;
            marginsPt.bottom = (cHeight - (newTop + newHeight)) / displayScale;

            invalidateResult();
            updateVisualCropOverlayFromPoints();
            updateNumericInputsFromPoints();
        });

        ['pointerup', 'pointercancel'].forEach((evName) => {
            window.addEventListener(evName, () => {
                if (isDragging) {
                    isDragging = false;
                    dragMode = null;
                }
            });
        });

        // Scope Selector
        cropScopeSelect?.addEventListener('change', () => {
            invalidateResult();
            if (cropScopeSelect.value === 'custom') {
                cropCustomRangeInput.classList.remove('hidden');
                cropCustomRangeInput.focus();
            } else {
                cropCustomRangeInput.classList.add('hidden');
            }
        });

        // --- Non-Destructive Vector Crop Execution via pdf-lib ---
        applyCropBtn?.addEventListener('click', async () => {
            if (!originalArrayBuffer || !window.PDFLib) return;
            clearError();

            const scope = cropScopeSelect.value;
            let targetPages = [];

            if (scope === 'all') {
                for (let i = 1; i <= totalPages; i++) targetPages.push(i);
            } else if (scope === 'current') {
                targetPages = [currentPage];
            } else if (scope === 'odd') {
                for (let i = 1; i <= totalPages; i += 2) targetPages.push(i);
            } else if (scope === 'even') {
                for (let i = 2; i <= totalPages; i += 2) targetPages.push(i);
            } else if (scope === 'custom') {
                const parsed = PDFRender.parsePageRanges(cropCustomRangeInput.value, totalPages);
                if (!parsed.valid) {
                    showError(parsed.error || 'Please enter a valid page range.');
                    return;
                }
                targetPages = parsed.flatPages;
            }

            if (targetPages.length === 0) {
                showError('No pages matched the selected crop scope.');
                return;
            }

            applyCropBtn.disabled = true;
            applyCropBtn.innerHTML = `
                <div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                <span>Cropping ${targetPages.length} Pages...</span>
            `;

            try {
                const { PDFDocument } = window.PDFLib;
                const pdfDoc = await PDFDocument.load(originalArrayBuffer.slice(0));

                const mL = marginsPt.left;
                const mR = marginsPt.right;
                const mT = marginsPt.top;
                const mB = marginsPt.bottom;

                for (const pageNum of targetPages) {
                    const page = pdfDoc.getPage(pageNum - 1);
                    const box = PDFRender.getEffectivePageBox(page);
                    const curX = box.x;
                    const curY = box.y;
                    const curW = box.width;
                    const curH = box.height;
                    const rotation = box.rotation;

                    // Clamp per-page margins safely for heterogeneous PDF dimensions (minimum 36pt kept)
                    const maxVisualW = Math.max(0, box.visualWidth - 36);
                    const maxVisualH = Math.max(0, box.visualHeight - 36);
                    const pLeft = Math.min(mL, maxVisualW);
                    const pRight = Math.min(mR, Math.max(0, maxVisualW - pLeft));
                    const pTop = Math.min(mT, maxVisualH);
                    const pBottom = Math.min(mB, Math.max(0, maxVisualH - pTop));

                    let newX = curX;
                    let newY = curY;
                    let newW = curW;
                    let newH = curH;

                    // Account for clockwise /Rotate in PDF Y-up coordinates
                    if (rotation === 0) {
                        newX = curX + pLeft;
                        newY = curY + pBottom;
                        newW = Math.max(36, curW - pLeft - pRight);
                        newH = Math.max(36, curH - pTop - pBottom);
                    } else if (rotation === 90) {
                        // Visual Top maps to +X from curX; Visual Left maps to +Y from curY
                        newX = curX + pTop;
                        newY = curY + pLeft;
                        newW = Math.max(36, curW - pTop - pBottom);
                        newH = Math.max(36, curH - pLeft - pRight);
                    } else if (rotation === 180) {
                        newX = curX + pRight;
                        newY = curY + pTop;
                        newW = Math.max(36, curW - pLeft - pRight);
                        newH = Math.max(36, curH - pTop - pBottom);
                    } else if (rotation === 270) {
                        // Visual Bottom maps to +X from curX; Visual Right maps to +Y from curY
                        newX = curX + pBottom;
                        newY = curY + pRight;
                        newW = Math.max(36, curW - pTop - pBottom);
                        newH = Math.max(36, curH - pLeft - pRight);
                    }

                    // Apply updated boundary boxes
                    page.setCropBox(newX, newY, newW, newH);
                    page.setMediaBox(newX, newY, newW, newH);
                }

                lastCroppedPdfBytes = await pdfDoc.save();

                resultPanel.classList.remove('hidden');
                resultPanel.scrollIntoView({ behavior: 'smooth' });

                if (typeof lucide !== 'undefined') lucide.createIcons();
            } catch (err) {
                console.error('Cropping error:', err);
                showError('Failed to crop PDF: ' + err.message);
            } finally {
                applyCropBtn.disabled = false;
                applyCropBtn.innerHTML = `
                    <i data-lucide="crop" class="w-4 h-4"></i>
                    <span>Crop PDF Document</span>
                `;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });

        // Download
        downloadCroppedPdfBtn?.addEventListener('click', () => {
            if (!lastCroppedPdfBytes || !originalFile) return;
            const originalBase = originalFile.name.replace(/\.[^/.]+$/, '');
            const exportName = `${originalBase}-cropped.pdf`;
            PDFCore.downloadBlob(lastCroppedPdfBytes, exportName, 'application/pdf');
        });

        // Reset
        cropChangeFileBtn?.addEventListener('click', resetAll);
        cropResetBtn?.addEventListener('click', resetAll);

        async function resetAll() {
            if (pdfDocProxy) {
                await PDFRender.destroyDoc(pdfDocProxy);
                pdfDocProxy = null;
            }
            originalFile = null;
            originalArrayBuffer = null;
            lastCroppedPdfBytes = null;
            if (pdfFileInput) pdfFileInput.value = '';
            if (cropBaseCanvas) {
                cropBaseCanvas.width = 0;
                cropBaseCanvas.height = 0;
            }
            cropWorkspacePanel.classList.add('hidden');
            resultPanel.classList.add('hidden');
            uploadPanel.classList.remove('hidden');
        }
    });
})(window, document);
