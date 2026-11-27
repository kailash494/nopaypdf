/**
 * NoPayPDF - Sign & Annotate PDF Controller
 * Dual-canvas editor combining PDF.js locked background with Fabric.js interactive overlay.
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

        const editorPanel = document.getElementById('editor-panel');
        const docFilename = document.getElementById('doc-filename');
        const docMeta = document.getElementById('doc-meta');
        const resetEditorBtn = document.getElementById('reset-editor-btn');
        const exportPdfBtn = document.getElementById('export-pdf-btn');

        // Canvases
        const canvasContainerOuter = document.getElementById('canvas-container-outer');
        const pdfBaseCanvas = document.getElementById('pdf-base-canvas');
        const fabricOverlayCanvas = document.getElementById('fabric-overlay-canvas');

        // Navigation & Viewport
        const prevPageBtn = document.getElementById('prev-page-btn');
        const nextPageBtn = document.getElementById('next-page-btn');
        const currentPageNumEl = document.getElementById('current-page-num');
        const totalPageNumEl = document.getElementById('total-page-num');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomFitBtn = document.getElementById('zoom-fit-btn');
        const zoomLevelText = document.getElementById('zoom-level-text');
        const toggleThumbnailsBtn = document.getElementById('toggle-thumbnails-btn');
        const thumbnailDrawer = document.getElementById('thumbnail-drawer');
        const thumbnailStripItems = document.getElementById('thumbnail-strip-items');

        // Tool Selection & Formatting
        const toolBtns = document.querySelectorAll('.tool-btn');
        const colorPresetBtns = document.querySelectorAll('.color-preset-btn');
        const customColorPicker = document.getElementById('custom-color-picker');
        const textFontSizeSelect = document.getElementById('text-font-size');
        const textFontFamilySelect = document.getElementById('text-font-family');
        const penStrokeWidth = document.getElementById('pen-stroke-width');
        const strokeWidthLabel = document.getElementById('stroke-width-label');
        const fontSizeGroup = document.getElementById('font-size-group');
        const fontFamilyGroup = document.getElementById('font-family-group');
        const strokeWidthGroup = document.getElementById('stroke-width-group');

        // Quick Stamps
        const stampCheckBtn = document.getElementById('stamp-check-btn');
        const stampCrossBtn = document.getElementById('stamp-cross-btn');
        const stampDateBtn = document.getElementById('stamp-date-btn');
        const stampRectBtn = document.getElementById('stamp-rect-btn');

        // History & Actions
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        const deleteSelectedBtn = document.getElementById('delete-selected-btn');
        const clearPageBtn = document.getElementById('clear-page-btn');

        // Signatures Shelf & Modal
        const openSignatureModalBtn = document.getElementById('open-signature-modal-btn');
        const signatureModal = document.getElementById('signature-modal');
        const closeSignatureModalBtn = document.getElementById('close-signature-modal-btn');
        const cancelSigModalBtn = document.getElementById('cancel-sig-modal-btn');
        const applySignatureBtn = document.getElementById('apply-signature-btn');
        const signaturesShelf = document.getElementById('signatures-shelf');
        const signaturesShelfList = document.getElementById('signatures-shelf-list');

        // Signature Tabs
        const sigTabDrawBtn = document.getElementById('sig-tab-draw-btn');
        const sigTabTypeBtn = document.getElementById('sig-tab-type-btn');
        const sigTabUploadBtn = document.getElementById('sig-tab-upload-btn');
        const sigPaneDraw = document.getElementById('sig-pane-draw');
        const sigPaneType = document.getElementById('sig-pane-type');
        const sigPaneUpload = document.getElementById('sig-pane-upload');

        // Signature Draw
        const signatureDrawCanvas = document.getElementById('signature-draw-canvas');
        const sigDrawHint = document.getElementById('sig-draw-hint');
        const sigClearDrawBtn = document.getElementById('sig-clear-draw-btn');
        const sigInkBtns = document.querySelectorAll('.sig-ink-btn');

        // Signature Type
        const sigTypeInput = document.getElementById('sig-type-input');
        const sigFontChoices = document.querySelectorAll('.sig-font-choice');

        // Signature Upload
        const sigUploadBox = document.getElementById('sig-upload-box');
        const sigFileInput = document.getElementById('sig-file-input');
        const sigUploadPreviewWrap = document.getElementById('sig-upload-preview-wrap');
        const sigUploadPreviewImg = document.getElementById('sig-upload-preview-img');
        const sigUploadRemoveBtn = document.getElementById('sig-upload-remove-btn');

        // Progress & Result
        const exportProgressPanel = document.getElementById('export-progress-panel');
        const exportProgressBar = document.getElementById('export-progress-bar');
        const exportStatusTitle = document.getElementById('export-status-title');
        const exportStatusDesc = document.getElementById('export-status-desc');
        const resultPanel = document.getElementById('result-panel');
        const downloadSignedPdfBtn = document.getElementById('download-signed-pdf-btn');
        const continueEditingBtn = document.getElementById('continue-editing-btn');

        // --- Application State ---
        let originalFile = null;
        let originalArrayBuffer = null;
        let pdfDocProxy = null;
        let totalPages = 1;
        let currentPage = 1;
        let activeRenderedPageIdx = null;
        let zoomScale = 1.0;
        let currentNumericScale = 1.0;
        let fabricCanvas = null;
        let loadSeq = 0;
        let thumbAbortCtrl = null;
        const sigModalError = document.getElementById('sig-modal-error');

        // Multi-page state persistence: Map<pageIndex (0-based), fabricJSON>
        const pageAnnotations = new Map();
        const pageBaseDims = new Map();
        // Undo / Redo history stacks: Map<pageIndex, { undo: string[], redo: string[] }>
        const pageHistories = new Map();
        let isHistoryPushLocked = false;

        // Current tool settings
        let activeTool = 'select'; // 'select' | 'text' | 'draw' | 'highlight' | 'whiteout'
        let currentColor = '#000000';
        let currentFontSize = 16;
        let currentFontFamily = 'Arial, sans-serif';
        let currentStroke = 2;
        const savedSignatures = []; // Array of { id, dataUrl }

        // Signature modal state
        let sigMode = 'draw'; // 'draw' | 'type' | 'upload'
        let sigInkColor = '#000000';
        let sigDrawEmpty = true;
        let sigSelectedFont = "'Brush Script MT', cursive";
        let sigUploadedDataUrl = null;

        // Init PDF.js Worker
        PDFRender.initPdfJsWorker();

        // --- UI Feedback Helpers ---
        function showError(msg) {
            errorMessage.textContent = msg;
            errorAlert.classList.remove('hidden');
        }

        function clearError() {
            errorAlert.classList.add('hidden');
            errorMessage.textContent = '';
        }

        function showSigModalError(msg) {
            if (!sigModalError) return;
            sigModalError.textContent = msg;
            sigModalError.classList.remove('hidden');
        }

        function clearSigModalError() {
            if (!sigModalError) return;
            sigModalError.textContent = '';
            sigModalError.classList.add('hidden');
        }

        errorDismissBtn?.addEventListener('click', clearError);

        // --- Initialize Dropzone ---
        PDFCore.initDropzone({
            dropzoneEl: pdfDropzone,
            inputEl: pdfFileInput,
            accept: '.pdf,application/pdf',
            multiple: false,
            onFilesAdded: async (files) => {
                await loadPdfDocument(files[0]);
            },
            onError: (err) => showError(Array.isArray(err) ? err.join(' ') : err),
        });

        // --- Document Loader ---
        async function loadPdfDocument(file) {
            if (!file) return;
            clearError();
            const seq = ++loadSeq;
            let nextLoaded = null;

            try {
                const nextBuffer = await PDFCore.readFileAsArrayBuffer(file);
                nextLoaded = await PDFRender.loadPreviewDocument(nextBuffer);

                if (seq !== loadSeq) {
                    await PDFRender.destroyDoc(nextLoaded.pdfProxy);
                    return;
                }

                if (thumbAbortCtrl) {
                    thumbAbortCtrl.abort();
                    thumbAbortCtrl = null;
                }
                if (pdfDocProxy) {
                    await PDFRender.destroyDoc(pdfDocProxy);
                    pdfDocProxy = null;
                }

                originalFile = file;
                originalArrayBuffer = nextBuffer;
                pdfDocProxy = nextLoaded.pdfProxy;
                totalPages = nextLoaded.numPages;
                nextLoaded = null;

                // Reset state
                currentPage = 1;
                activeRenderedPageIdx = null;
                zoomScale = 1.0;
                currentNumericScale = 1.0;
                zoomLevelText.textContent = '100%';
                lastSignedPdfBytes = null;
                pageAnnotations.clear();
                pageBaseDims.clear();
                pageHistories.clear();
                savedSignatures.length = 0;
                if (signaturesShelfList) signaturesShelfList.innerHTML = '';
                if (signaturesShelf) signaturesShelf.classList.add('hidden');

                // Update UI Header
                docFilename.textContent = file.name;
                docMeta.textContent = `${totalPages} page${totalPages === 1 ? '' : 's'} • ${PDFCore.formatBytes(file.size)}`;
                totalPageNumEl.textContent = String(totalPages);
                currentPageNumEl.textContent = '1';

                // Switch Panels
                uploadPanel.classList.add('hidden');
                resultPanel.classList.add('hidden');
                editorPanel.classList.remove('hidden');

                // Initialize Fabric Canvas if not already done
                if (!fabricCanvas) {
                    initFabricCanvas();
                }

                // Render first page and generate thumbnails
                await renderCurrentPage();
                generateThumbnails();

                if (typeof lucide !== 'undefined') lucide.createIcons();
            } catch (err) {
                if (nextLoaded?.pdfProxy) {
                    await PDFRender.destroyDoc(nextLoaded.pdfProxy);
                }
                console.error('Error loading PDF:', err);
                showError(PDFCore.formatPdfError(err));
            }
        }

        // --- Fabric.js Initialization ---
        function initFabricCanvas() {
            fabricCanvas = new fabric.Canvas('fabric-overlay-canvas', {
                selection: true,
                preserveObjectStacking: true,
            });

            // Drawing brush defaults
            fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
            fabricCanvas.freeDrawingBrush.color = currentColor;
            fabricCanvas.freeDrawingBrush.width = currentStroke;

            // Setup history event listeners
            fabricCanvas.on('object:added', () => recordHistorySnapshot());
            fabricCanvas.on('object:modified', () => recordHistorySnapshot());
            fabricCanvas.on('object:removed', () => recordHistorySnapshot());

            // Handle Selection Events
            fabricCanvas.on('selection:created', onObjectSelected);
            fabricCanvas.on('selection:updated', onObjectSelected);
            fabricCanvas.on('selection:cleared', onSelectionCleared);

            // Keyboard shortcuts with modal and active-input guards
            document.addEventListener('keydown', (e) => {
                if (signatureModal && !signatureModal.classList.contains('hidden')) {
                    if (e.key === 'Escape') {
                        closeSigModal();
                    }
                    return;
                }
                if (e.target && e.target.closest('input, textarea, select, [contenteditable="true"]')) {
                    return;
                }
                if (!fabricCanvas) return;

                if (e.key === 'Delete' || e.key === 'Backspace') {
                    const activeObj = fabricCanvas.getActiveObject();
                    if (activeObj && !activeObj.isEditing) {
                        deleteSelectedObject();
                        e.preventDefault();
                    }
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                    if (e.shiftKey) {
                        redo();
                    } else {
                        undo();
                    }
                    e.preventDefault();
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                    redo();
                    e.preventDefault();
                }
            });
        }

        function onObjectSelected(e) {
            const obj = e.selected?.[0] || fabricCanvas.getActiveObject();
            if (!obj) return;

            if (obj.type === 'i-text') {
                if (obj.fontSize) textFontSizeSelect.value = String(obj.fontSize);
                if (obj.fill) updateColor(obj.fill, false);
            }
            deleteSelectedBtn.removeAttribute('disabled');
        }

        function onSelectionCleared() {
            deleteSelectedBtn.setAttribute('disabled', 'true');
        }

        function deleteSelectedObject() {
            if (!fabricCanvas) return;
            const objs = fabricCanvas.getActiveObjects();
            if (objs && objs.length > 0) {
                isHistoryPushLocked = true;
                objs.forEach((obj) => fabricCanvas.remove(obj));
                fabricCanvas.discardActiveObject();
                isHistoryPushLocked = false;
                recordHistorySnapshot();
                fabricCanvas.requestRenderAll();
            }
        }

        deleteSelectedBtn?.addEventListener('click', deleteSelectedObject);

        // --- Multi-Page Annotations Persistence ---
        function saveCurrentPageAnnotations() {
            if (!fabricCanvas || activeRenderedPageIdx === null) return;
            const json = fabricCanvas.toJSON();
            pageAnnotations.set(activeRenderedPageIdx, json);
        }

        async function restorePageAnnotations(pageIndex) {
            if (!fabricCanvas) return;
            isHistoryPushLocked = true;
            fabricCanvas.clear();

            if (pageAnnotations.has(pageIndex)) {
                const json = pageAnnotations.get(pageIndex);
                await new Promise((resolve) => {
                    fabricCanvas.loadFromJSON(json, () => {
                        fabricCanvas.renderAll();
                        resolve();
                    });
                });
            } else {
                fabricCanvas.renderAll();
            }

            isHistoryPushLocked = false;

            const history = getPageHistory(pageIndex);
            if (history.undo.length === 0) {
                history.undo.push(JSON.stringify(fabricCanvas.toJSON()));
            }
            updateUndoRedoButtons();
        }

        // --- History Management (Undo / Redo) ---
        function getPageHistory(pageIndex) {
            if (!pageHistories.has(pageIndex)) {
                pageHistories.set(pageIndex, { undo: [], redo: [] });
            }
            return pageHistories.get(pageIndex);
        }

        function recordHistorySnapshot() {
            if (isHistoryPushLocked || !fabricCanvas) return;
            const history = getPageHistory(currentPage - 1);
            const state = JSON.stringify(fabricCanvas.toJSON());
            history.undo.push(state);
            // Limit stack depth to 20 snapshots
            if (history.undo.length > 20) history.undo.shift();
            history.redo = []; // Clear redo stack on new action
            updateUndoRedoButtons();
        }

        function undo() {
            const history = getPageHistory(currentPage - 1);
            if (history.undo.length <= 1) return;

            isHistoryPushLocked = true;
            const currentState = history.undo.pop();
            history.redo.push(currentState);

            const previousState = history.undo[history.undo.length - 1];
            fabricCanvas.loadFromJSON(JSON.parse(previousState), () => {
                fabricCanvas.renderAll();
                isHistoryPushLocked = false;
                updateUndoRedoButtons();
            });
        }

        function redo() {
            const history = getPageHistory(currentPage - 1);
            if (history.redo.length === 0) return;

            isHistoryPushLocked = true;
            const nextState = history.redo.pop();
            history.undo.push(nextState);

            fabricCanvas.loadFromJSON(JSON.parse(nextState), () => {
                fabricCanvas.renderAll();
                isHistoryPushLocked = false;
                updateUndoRedoButtons();
            });
        }

        function updateUndoRedoButtons() {
            const history = getPageHistory(currentPage - 1);
            undoBtn.disabled = history.undo.length <= 1;
            redoBtn.disabled = history.redo.length === 0;
        }

        undoBtn?.addEventListener('click', undo);
        redoBtn?.addEventListener('click', redo);

        clearPageBtn?.addEventListener('click', () => {
            if (!fabricCanvas) return;
            if (fabricCanvas.getObjects().length === 0) return;
            fabricCanvas.clear();
            recordHistorySnapshot();
        });

        // --- Page Navigation & Rendering ---
        async function renderCurrentPage() {
            if (!pdfDocProxy) return;

            saveCurrentPageAnnotations();
            currentPageNumEl.textContent = String(currentPage);
            prevPageBtn.disabled = currentPage <= 1;
            nextPageBtn.disabled = currentPage >= totalPages;

            const page = await pdfDocProxy.getPage(currentPage);
            const intrinsicRotation = page.rotate || 0;
            const baseViewport = page.getViewport({ scale: 1.0, rotation: intrinsicRotation });
            const pageIndex = currentPage - 1;
            pageBaseDims.set(pageIndex, { width: baseViewport.width, height: baseViewport.height });

            // Fit or scale logic
            let effectiveScale = zoomScale;
            if (effectiveScale === 'fit') {
                const containerWidth = Math.max(240, canvasContainerOuter.parentElement.clientWidth - 48);
                effectiveScale = Math.max(0.4, Math.min(containerWidth / baseViewport.width, 1.8));
            }
            currentNumericScale = effectiveScale;

            const viewport = page.getViewport({ scale: effectiveScale, rotation: intrinsicRotation });

            // 1. Render Base PDF.js Canvas
            pdfBaseCanvas.width = Math.max(1, Math.floor(viewport.width));
            pdfBaseCanvas.height = Math.max(1, Math.floor(viewport.height));
            pdfBaseCanvas.style.width = `${pdfBaseCanvas.width}px`;
            pdfBaseCanvas.style.height = `${pdfBaseCanvas.height}px`;

            const ctx = pdfBaseCanvas.getContext('2d', { alpha: false });
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pdfBaseCanvas.width, pdfBaseCanvas.height);

            await page.render({ canvasContext: ctx, viewport }).promise;

            // 2. Synchronize Fabric.js Overlay Canvas in upright unscaled PDF point space
            canvasContainerOuter.style.width = `${pdfBaseCanvas.width}px`;
            canvasContainerOuter.style.height = `${pdfBaseCanvas.height}px`;

            fabricCanvas.setZoom(effectiveScale);
            fabricCanvas.setDimensions({
                width: pdfBaseCanvas.width,
                height: pdfBaseCanvas.height,
            });
            fabricCanvas.calcOffset();

            // 3. Restore Annotations for This Page
            activeRenderedPageIdx = pageIndex;
            await restorePageAnnotations(pageIndex);

            // Re-apply active tool to fabric
            setToolMode(activeTool);

            // Update active thumbnail highlight
            updateActiveThumbnail();
        }

        prevPageBtn?.addEventListener('click', async () => {
            if (currentPage > 1) {
                currentPage--;
                await renderCurrentPage();
            }
        });

        nextPageBtn?.addEventListener('click', async () => {
            if (currentPage < totalPages) {
                currentPage++;
                await renderCurrentPage();
            }
        });

        // --- Zoom Handlers ---
        zoomInBtn?.addEventListener('click', async () => {
            const scales = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
            const next = scales.find((s) => s > currentNumericScale + 0.01);
            if (next !== undefined) {
                zoomScale = next;
                zoomLevelText.textContent = `${Math.round(zoomScale * 100)}%`;
                await renderCurrentPage();
            }
        });

        zoomOutBtn?.addEventListener('click', async () => {
            const scales = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
            const prev = [...scales].reverse().find((s) => s < currentNumericScale - 0.01);
            if (prev !== undefined) {
                zoomScale = prev;
                zoomLevelText.textContent = `${Math.round(zoomScale * 100)}%`;
                await renderCurrentPage();
            }
        });

        zoomFitBtn?.addEventListener('click', async () => {
            zoomScale = 'fit';
            zoomLevelText.textContent = 'Fit';
            await renderCurrentPage();
        });

        // --- Thumbnail Strip ---
        toggleThumbnailsBtn?.addEventListener('click', () => {
            thumbnailDrawer.classList.toggle('hidden');
        });

        async function generateThumbnails() {
            if (thumbAbortCtrl) {
                thumbAbortCtrl.abort();
            }
            thumbAbortCtrl = new AbortController();
            const signal = thumbAbortCtrl.signal;

            thumbnailStripItems.innerHTML = '';
            for (let i = 1; i <= totalPages; i++) {
                const item = document.createElement('div');
                item.className = `p-2 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    i === currentPage ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`;
                item.dataset.page = String(i);

                const canvas = document.createElement('canvas');
                canvas.className = 'w-full rounded shadow-2xs block bg-white';
                item.appendChild(canvas);

                const label = document.createElement('span');
                label.className = 'text-[11px] font-semibold text-slate-600';
                label.textContent = `Page ${i}`;
                item.appendChild(label);

                item.addEventListener('click', async () => {
                    if (currentPage !== i) {
                        currentPage = i;
                        await renderCurrentPage();
                    }
                });

                thumbnailStripItems.appendChild(item);
            }

            await PDFRender.renderThumbnailsBatched(pdfDocProxy, thumbnailStripItems, {
                batchSize: 4,
                signal,
                maxWidth: 120,
                onPageRendered: (pageNum, renderedCanvas) => {
                    const card = thumbnailStripItems.querySelector(`[data-page="${pageNum}"]`);
                    const targetCanvas = card?.querySelector('canvas');
                    if (targetCanvas) {
                        targetCanvas.width = renderedCanvas.width;
                        targetCanvas.height = renderedCanvas.height;
                        targetCanvas.getContext('2d')?.drawImage(renderedCanvas, 0, 0);
                    }
                },
            });
        }

        function updateActiveThumbnail() {
            const items = thumbnailStripItems.querySelectorAll('[data-page]');
            items.forEach((it) => {
                const pageNum = parseInt(it.dataset.page, 10);
                if (pageNum === currentPage) {
                    it.className = 'p-2 rounded-xl border border-blue-600 bg-blue-50/50 transition-all cursor-pointer flex flex-col items-center gap-1.5';
                } else {
                    it.className = 'p-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition-all cursor-pointer flex flex-col items-center gap-1.5';
                }
            });
        }

        // --- Tool Selection Mode Switcher ---
        function setToolMode(mode) {
            activeTool = mode;
            toolBtns.forEach((btn) => {
                if (btn.dataset.tool === mode) {
                    btn.className = 'tool-btn px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors bg-blue-100 text-blue-700';
                } else {
                    btn.className = 'tool-btn px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors text-slate-600 hover:bg-slate-100';
                }
            });

            // Adjust sub-toolbar visibility based on tool
            if (mode === 'draw') {
                strokeWidthGroup.classList.remove('hidden');
                strokeWidthGroup.classList.add('flex');
            } else {
                strokeWidthGroup.classList.add('hidden');
                strokeWidthGroup.classList.remove('flex');
            }

            if (!fabricCanvas) return;

            if (mode === 'select') {
                fabricCanvas.isDrawingMode = false;
                fabricCanvas.selection = true;
                fabricCanvas.defaultCursor = 'default';
            } else if (mode === 'draw') {
                fabricCanvas.isDrawingMode = true;
                fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
                fabricCanvas.freeDrawingBrush.color = currentColor;
                fabricCanvas.freeDrawingBrush.width = currentStroke;
            } else if (mode === 'text') {
                fabricCanvas.isDrawingMode = false;
                fabricCanvas.selection = true;
                fabricCanvas.defaultCursor = 'text';
                addTextAtCenter();
            } else if (mode === 'highlight') {
                fabricCanvas.isDrawingMode = false;
                fabricCanvas.selection = true;
                fabricCanvas.defaultCursor = 'crosshair';
                addHighlightBox();
            } else if (mode === 'whiteout') {
                fabricCanvas.isDrawingMode = false;
                fabricCanvas.selection = true;
                fabricCanvas.defaultCursor = 'crosshair';
                addWhiteoutBox();
            }
        }

        toolBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                setToolMode(btn.dataset.tool);
            });
        });

        // --- Formatting Options ---
        function getSceneCenter() {
            const dims = pageBaseDims.get(currentPage - 1);
            if (dims) {
                return { left: dims.width / 2, top: dims.height / 2 };
            }
            const zoom = fabricCanvas?.getZoom() || 1;
            const c = fabricCanvas ? fabricCanvas.getCenter() : { left: 300, top: 400 };
            return { left: c.left / zoom, top: c.top / zoom };
        }

        function updateColor(hex, updateInput = true, recordHistory = true) {
            currentColor = hex;
            if (updateInput && customColorPicker) customColorPicker.value = hex;

            if (fabricCanvas) {
                if (fabricCanvas.isDrawingMode && fabricCanvas.freeDrawingBrush) {
                    fabricCanvas.freeDrawingBrush.color = hex;
                }
                const activeObj = fabricCanvas.getActiveObject();
                if (activeObj) {
                    if (activeObj.type === 'i-text') {
                        activeObj.set('fill', hex);
                    } else if (activeObj.type === 'rect' && activeObj.stroke) {
                        activeObj.set('stroke', hex);
                    } else if (activeObj.type === 'path' && activeObj.stroke) {
                        activeObj.set('stroke', hex);
                    }
                    fabricCanvas.requestRenderAll();
                    if (recordHistory) recordHistorySnapshot();
                }
            }

            colorPresetBtns.forEach((b) => {
                if (b.dataset.color.toLowerCase() === hex.toLowerCase()) {
                    b.classList.add('ring-2', 'ring-blue-500', 'ring-offset-1');
                } else {
                    b.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-1');
                }
            });
        }

        colorPresetBtns.forEach((btn) => {
            btn.addEventListener('click', () => updateColor(btn.dataset.color, true, true));
        });

        customColorPicker?.addEventListener('input', (e) => updateColor(e.target.value, false, false));
        customColorPicker?.addEventListener('change', (e) => updateColor(e.target.value, false, true));

        textFontSizeSelect?.addEventListener('change', (e) => {
            currentFontSize = parseInt(e.target.value, 10);
            const activeObj = fabricCanvas?.getActiveObject();
            if (activeObj && activeObj.type === 'i-text') {
                activeObj.set('fontSize', currentFontSize);
                fabricCanvas.requestRenderAll();
                recordHistorySnapshot();
            }
        });

        textFontFamilySelect?.addEventListener('change', (e) => {
            currentFontFamily = e.target.value;
            const activeObj = fabricCanvas?.getActiveObject();
            if (activeObj && activeObj.type === 'i-text') {
                activeObj.set('fontFamily', currentFontFamily);
                fabricCanvas.requestRenderAll();
                recordHistorySnapshot();
            }
        });

        penStrokeWidth?.addEventListener('input', (e) => {
            currentStroke = parseInt(e.target.value, 10);
            strokeWidthLabel.textContent = `${currentStroke}px`;
            if (fabricCanvas?.freeDrawingBrush) {
                fabricCanvas.freeDrawingBrush.width = currentStroke;
            }
        });

        // --- Annotation Creators (in unscaled upright PDF scene points) ---
        function addTextAtCenter() {
            if (!fabricCanvas) return;
            const center = getSceneCenter();
            const text = new fabric.IText('Type here...', {
                left: center.left - 60,
                top: center.top - 15,
                fontSize: currentFontSize,
                fill: currentColor,
                fontFamily: currentFontFamily,
                cornerColor: '#2563eb',
                cornerSize: 8,
                transparentCorners: false,
            });
            fabricCanvas.add(text);
            fabricCanvas.setActiveObject(text);
            text.enterEditing();
            text.selectAll();
            fabricCanvas.requestRenderAll();
            setToolMode('select');
        }

        function addHighlightBox() {
            if (!fabricCanvas) return;
            const center = getSceneCenter();
            const rect = new fabric.Rect({
                left: center.left - 75,
                top: center.top - 12,
                width: 150,
                height: 24,
                fill: '#fde047',
                opacity: 0.38,
                cornerColor: '#d97706',
                cornerSize: 8,
                transparentCorners: false,
            });
            fabricCanvas.add(rect);
            fabricCanvas.setActiveObject(rect);
            fabricCanvas.requestRenderAll();
            setToolMode('select');
        }

        function addWhiteoutBox() {
            if (!fabricCanvas) return;
            const center = getSceneCenter();
            const rect = new fabric.Rect({
                left: center.left - 80,
                top: center.top - 15,
                width: 160,
                height: 30,
                fill: '#ffffff',
                stroke: '#e2e8f0',
                strokeWidth: 1,
                cornerColor: '#64748b',
                cornerSize: 8,
                transparentCorners: false,
            });
            fabricCanvas.add(rect);
            fabricCanvas.setActiveObject(rect);
            fabricCanvas.requestRenderAll();
            setToolMode('select');
        }

        // Quick Stamps
        stampCheckBtn?.addEventListener('click', () => {
            if (!fabricCanvas) return;
            const center = getSceneCenter();
            const check = new fabric.IText('\u2713', {
                left: center.left - 12,
                top: center.top - 18,
                fontSize: 32,
                fill: '#16a34a',
                fontWeight: 'bold',
                fontFamily: 'sans-serif',
            });
            fabricCanvas.add(check);
            fabricCanvas.setActiveObject(check);
            fabricCanvas.requestRenderAll();
        });

        stampCrossBtn?.addEventListener('click', () => {
            if (!fabricCanvas) return;
            const center = getSceneCenter();
            const cross = new fabric.IText('\u2715', {
                left: center.left - 12,
                top: center.top - 18,
                fontSize: 28,
                fill: '#dc2626',
                fontWeight: 'bold',
                fontFamily: 'sans-serif',
            });
            fabricCanvas.add(cross);
            fabricCanvas.setActiveObject(cross);
            fabricCanvas.requestRenderAll();
        });

        stampDateBtn?.addEventListener('click', () => {
            if (!fabricCanvas) return;
            const center = getSceneCenter();
            const todayStr = new Date().toISOString().split('T')[0];
            const dateText = new fabric.IText(todayStr, {
                left: center.left - 45,
                top: center.top - 10,
                fontSize: 16,
                fill: currentColor,
                fontFamily: currentFontFamily,
            });
            fabricCanvas.add(dateText);
            fabricCanvas.setActiveObject(dateText);
            fabricCanvas.requestRenderAll();
        });

        stampRectBtn?.addEventListener('click', () => {
            if (!fabricCanvas) return;
            const center = getSceneCenter();
            const rect = new fabric.Rect({
                left: center.left - 75,
                top: center.top - 35,
                width: 150,
                height: 70,
                fill: 'transparent',
                stroke: currentColor,
                strokeWidth: 2,
                cornerColor: '#2563eb',
                cornerSize: 8,
                transparentCorners: false,
            });
            fabricCanvas.add(rect);
            fabricCanvas.setActiveObject(rect);
            fabricCanvas.requestRenderAll();
        });

        // --- Signature Studio Modal & Drawing ---
        let sigCtx = null;
        let isDrawingSig = false;

        function initSigDrawCanvas() {
            sigCtx = signatureDrawCanvas.getContext('2d');
            sigCtx.strokeStyle = sigInkColor;
            sigCtx.lineWidth = 3;
            sigCtx.lineCap = 'round';
            sigCtx.lineJoin = 'round';

            const startDraw = (x, y) => {
                clearSigModalError();
                isDrawingSig = true;
                sigDrawEmpty = false;
                sigDrawHint.classList.add('hidden');
                sigCtx.beginPath();
                sigCtx.moveTo(x, y);
            };

            const moveDraw = (x, y) => {
                if (!isDrawingSig) return;
                sigCtx.lineTo(x, y);
                sigCtx.stroke();
            };

            const endDraw = () => {
                isDrawingSig = false;
            };

            const toCanvasCoords = (clientX, clientY) => {
                const rect = signatureDrawCanvas.getBoundingClientRect();
                const scaleX = signatureDrawCanvas.width / (rect.width || 1);
                const scaleY = signatureDrawCanvas.height / (rect.height || 1);
                return {
                    x: (clientX - rect.left) * scaleX,
                    y: (clientY - rect.top) * scaleY,
                };
            };

            // Mouse events
            signatureDrawCanvas.addEventListener('mousedown', (e) => {
                const pt = toCanvasCoords(e.clientX, e.clientY);
                startDraw(pt.x, pt.y);
            });
            signatureDrawCanvas.addEventListener('mousemove', (e) => {
                const pt = toCanvasCoords(e.clientX, e.clientY);
                moveDraw(pt.x, pt.y);
            });
            window.addEventListener('mouseup', endDraw);

            // Touch events
            signatureDrawCanvas.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                const pt = toCanvasCoords(touch.clientX, touch.clientY);
                startDraw(pt.x, pt.y);
                e.preventDefault();
            }, { passive: false });

            signatureDrawCanvas.addEventListener('touchmove', (e) => {
                const touch = e.touches[0];
                const pt = toCanvasCoords(touch.clientX, touch.clientY);
                moveDraw(pt.x, pt.y);
                e.preventDefault();
            }, { passive: false });

            window.addEventListener('touchend', endDraw);
        }

        function clearSigDraw() {
            if (!sigCtx) return;
            sigCtx.clearRect(0, 0, signatureDrawCanvas.width, signatureDrawCanvas.height);
            sigDrawEmpty = true;
            sigDrawHint.classList.remove('hidden');
        }

        sigClearDrawBtn?.addEventListener('click', clearSigDraw);

        sigInkBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                sigInkColor = btn.dataset.ink;
                if (sigCtx) sigCtx.strokeStyle = sigInkColor;
                sigInkBtns.forEach((b) => b.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-1'));
                btn.classList.add('ring-2', 'ring-blue-500', 'ring-offset-1');
            });
        });

        // Tab Switching in Signature Studio
        function switchSigTab(mode) {
            clearSigModalError();
            sigMode = mode;
            const tabMap = [
                { btn: sigTabDrawBtn, pane: sigPaneDraw, key: 'draw' },
                { btn: sigTabTypeBtn, pane: sigPaneType, key: 'type' },
                { btn: sigTabUploadBtn, pane: sigPaneUpload, key: 'upload' },
            ];

            tabMap.forEach(({ btn, pane, key }) => {
                const active = key === mode;
                if (btn) {
                    btn.className = active
                        ? 'px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer'
                        : 'px-4 py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer';
                    btn.setAttribute('aria-selected', active ? 'true' : 'false');
                }
                if (pane) pane.classList.toggle('hidden', !active);
            });

            if (mode === 'type') {
                sigTypeInput.focus();
            }
        }

        sigTabDrawBtn?.addEventListener('click', () => switchSigTab('draw'));
        sigTabTypeBtn?.addEventListener('click', () => switchSigTab('type'));
        sigTabUploadBtn?.addEventListener('click', () => switchSigTab('upload'));

        // Type Signature text sync
        sigTypeInput?.addEventListener('input', (e) => {
            const val = e.target.value.trim() || 'Jane Doe';
            document.querySelectorAll('.sig-font-preview').forEach((el) => {
                el.textContent = val;
            });
        });

        sigFontChoices.forEach((btn) => {
            btn.addEventListener('click', () => {
                sigSelectedFont = btn.dataset.font;
                sigFontChoices.forEach((b) => {
                    b.className = 'sig-font-choice p-3 rounded-xl border border-slate-200 hover:border-slate-300 text-center font-bold text-lg select-none';
                });
                btn.className = 'sig-font-choice p-3 rounded-xl border-2 border-blue-600 bg-blue-50/50 text-center font-bold text-lg select-none';
            });
        });

        // Upload Signature image handling
        sigUploadBox?.addEventListener('click', () => sigFileInput.click());
        sigUploadBox?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                sigFileInput.click();
            }
        });
        sigFileInput?.addEventListener('change', (e) => {
            clearSigModalError();
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                sigUploadedDataUrl = evt.target.result;
                sigUploadPreviewImg.src = sigUploadedDataUrl;
                sigUploadBox.classList.add('hidden');
                sigUploadPreviewWrap.classList.remove('hidden');
            };
            reader.onerror = () => {
                showSigModalError('Could not read the selected image file. Please try another PNG or JPG.');
            };
            reader.readAsDataURL(file);
        });

        sigUploadRemoveBtn?.addEventListener('click', () => {
            sigUploadedDataUrl = null;
            sigFileInput.value = '';
            sigUploadPreviewWrap.classList.add('hidden');
            sigUploadBox.classList.remove('hidden');
        });

        // Open & Close Modal
        openSignatureModalBtn?.addEventListener('click', () => {
            clearSigModalError();
            signatureModal.classList.remove('hidden');
            if (!sigCtx) initSigDrawCanvas();
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });

        const closeSigModal = () => {
            clearSigModalError();
            signatureModal.classList.add('hidden');
        };
        closeSignatureModalBtn?.addEventListener('click', closeSigModal);
        cancelSigModalBtn?.addEventListener('click', closeSigModal);

        // Stamp Signature into Fabric (unscaled PDF scene coordinates)
        function stampSignatureDataUrl(dataUrl) {
            if (!fabricCanvas) return;
            fabric.Image.fromURL(dataUrl, (img) => {
                if (!img) return;
                const center = getSceneCenter();
                const targetWidth = 140;
                const safeImgWidth = img.width || targetWidth;
                const safeImgHeight = img.height || 50;
                const scale = targetWidth / safeImgWidth;
                img.set({
                    left: center.left - targetWidth / 2,
                    top: center.top - (safeImgHeight * scale) / 2,
                    scaleX: scale,
                    scaleY: scale,
                    cornerColor: '#2563eb',
                    cornerSize: 8,
                    transparentCorners: false,
                });
                fabricCanvas.add(img);
                fabricCanvas.setActiveObject(img);
                fabricCanvas.requestRenderAll();
                setToolMode('select');
            });
        }

        // Add to "My Signatures" Shelf
        function addSavedSignature(dataUrl) {
            savedSignatures.push(dataUrl);
            signaturesShelf.classList.remove('hidden');

            const item = document.createElement('div');
            item.className = 'group relative p-1.5 rounded-xl border border-slate-200 hover:border-blue-500 bg-white shadow-2xs cursor-pointer flex items-center justify-center h-12 w-28 shrink-0 transition-all';
            
            const img = document.createElement('img');
            img.src = dataUrl;
            img.alt = 'Saved Signature';
            img.className = 'max-h-full max-w-full object-contain';
            item.appendChild(img);

            item.addEventListener('click', () => {
                stampSignatureDataUrl(dataUrl);
            });

            signaturesShelfList.appendChild(item);
        }

        applySignatureBtn?.addEventListener('click', () => {
            clearSigModalError();
            let signatureDataUrl = null;

            if (sigMode === 'draw') {
                if (sigDrawEmpty) {
                    showSigModalError('Please draw your signature before applying.');
                    return;
                }
                signatureDataUrl = signatureDrawCanvas.toDataURL('image/png');
            } else if (sigMode === 'type') {
                const text = sigTypeInput.value.trim() || 'Jane Doe';
                // Render typed signature on offscreen canvas with auto-shrink to prevent horizontal clipping
                const offCanvas = document.createElement('canvas');
                offCanvas.width = 400;
                offCanvas.height = 120;
                const offCtx = offCanvas.getContext('2d');
                offCtx.fillStyle = sigInkColor;
                let fontSize = 42;
                offCtx.font = `italic ${fontSize}px ${sigSelectedFont}`;
                while (fontSize > 16 && offCtx.measureText(text).width > 360) {
                    fontSize -= 2;
                    offCtx.font = `italic ${fontSize}px ${sigSelectedFont}`;
                }
                offCtx.textAlign = 'center';
                offCtx.textBaseline = 'middle';
                offCtx.fillText(text, 200, 60);
                signatureDataUrl = offCanvas.toDataURL('image/png');
            } else if (sigMode === 'upload') {
                if (!sigUploadedDataUrl) {
                    showSigModalError('Please upload a PNG or JPG signature image before applying.');
                    return;
                }
                signatureDataUrl = sigUploadedDataUrl;
            }

            if (signatureDataUrl) {
                addSavedSignature(signatureDataUrl);
                stampSignatureDataUrl(signatureDataUrl);
                closeSigModal();
            }
        });

        // --- High-DPI Vector-Preserving Export Pipeline ---
        let lastSignedPdfBytes = null;

        exportPdfBtn?.addEventListener('click', async () => {
            if (!originalArrayBuffer || !window.PDFLib) return;
            clearError();

            saveCurrentPageAnnotations();

            exportPdfBtn.disabled = true;
            exportPdfBtn.classList.add('opacity-75', 'cursor-not-allowed');
            exportProgressPanel.classList.remove('hidden');
            resultPanel.classList.add('hidden');
            exportProgressBar.style.width = '10%';
            exportStatusTitle.textContent = 'Loading Document...';
            exportStatusDesc.textContent = 'Preparing vector document pages for annotation stamping...';

            try {
                const { PDFDocument, degrees } = window.PDFLib;
                const pdfDoc = await PDFDocument.load(originalArrayBuffer.slice(0));
                const totalDocPages = pdfDoc.getPageCount();

                // Process pages sequentially
                for (let pageIdx = 0; pageIdx < totalDocPages; pageIdx++) {
                    const progressPercent = Math.round(10 + ((pageIdx + 1) / totalDocPages) * 75);
                    exportProgressBar.style.width = `${progressPercent}%`;
                    exportStatusTitle.textContent = `Processing Page ${pageIdx + 1} of ${totalDocPages}...`;

                    const json = pageAnnotations.get(pageIdx);
                    if (!json || !json.objects || json.objects.length === 0) {
                        continue; // Page was not annotated, leave 100% original vectors untouched
                    }

                    const page = pdfDoc.getPage(pageIdx);
                    const pageBox = PDFRender.getEffectivePageBox(page);
                    let baseDims = pageBaseDims.get(pageIdx);
                    if (!baseDims) {
                        baseDims = { width: pageBox.visualWidth, height: pageBox.visualHeight };
                    }

                    // Render offscreen fabric static canvas at unscaled upright page dimensions + 2.5x multiplier
                    const staticCanvasEl = document.createElement('canvas');
                    const staticCanvas = new fabric.StaticCanvas(staticCanvasEl, {
                        width: Math.max(1, Math.round(baseDims.width)),
                        height: Math.max(1, Math.round(baseDims.height)),
                    });

                    await new Promise((resolve) => {
                        staticCanvas.loadFromJSON(json, () => {
                            staticCanvas.renderAll();
                            resolve();
                        });
                    });

                    // Export transparent overlay at 2.5x multiplier for razor-sharp clarity
                    const overlayPngDataUrl = staticCanvas.toDataURL({
                        format: 'png',
                        multiplier: 2.5,
                    });

                    // Embed PNG into pdf-lib & align against CropBox + /Rotate
                    const embeddedImage = await pdfDoc.embedPng(overlayPngDataUrl);
                    const placement = PDFRender.visualCenterRectToPdfDraw(
                        pageBox.visualWidth / 2,
                        pageBox.visualHeight / 2,
                        pageBox.visualWidth,
                        pageBox.visualHeight,
                        0,
                        pageBox
                    );

                    page.drawImage(embeddedImage, {
                        x: placement.x,
                        y: placement.y,
                        width: pageBox.visualWidth,
                        height: pageBox.visualHeight,
                        rotate: degrees(placement.rotateDeg),
                    });

                    staticCanvas.dispose();
                    staticCanvasEl.width = 0;
                    staticCanvasEl.height = 0;
                }

                exportProgressBar.style.width = '95%';
                exportStatusTitle.textContent = 'Finalizing Document...';
                exportStatusDesc.textContent = 'Saving high-resolution signed document...';

                lastSignedPdfBytes = await pdfDoc.save();

                exportProgressBar.style.width = '100%';
                exportProgressPanel.classList.add('hidden');
                resultPanel.classList.remove('hidden');

                if (typeof lucide !== 'undefined') lucide.createIcons();
            } catch (err) {
                console.error('Export error:', err);
                exportProgressPanel.classList.add('hidden');
                showError('Failed to export signed PDF: ' + err.message);
            } finally {
                exportPdfBtn.disabled = false;
                exportPdfBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        });

        // Download signed file
        downloadSignedPdfBtn?.addEventListener('click', () => {
            if (!lastSignedPdfBytes || !originalFile) return;
            const originalBase = originalFile.name.replace(/\.[^/.]+$/, '');
            const exportName = `${originalBase}-signed.pdf`;
            PDFCore.downloadBlob(lastSignedPdfBytes, exportName, 'application/pdf');
        });

        continueEditingBtn?.addEventListener('click', () => {
            resultPanel.classList.add('hidden');
        });

        // Reset
        resetEditorBtn?.addEventListener('click', async () => {
            ++loadSeq;
            if (thumbAbortCtrl) {
                thumbAbortCtrl.abort();
                thumbAbortCtrl = null;
            }
            if (pdfDocProxy) {
                await PDFRender.destroyDoc(pdfDocProxy);
                pdfDocProxy = null;
            }
            originalFile = null;
            originalArrayBuffer = null;
            activeRenderedPageIdx = null;
            lastSignedPdfBytes = null;
            zoomScale = 1.0;
            currentNumericScale = 1.0;
            zoomLevelText.textContent = '100%';
            savedSignatures.length = 0;
            if (signaturesShelfList) signaturesShelfList.innerHTML = '';
            if (signaturesShelf) signaturesShelf.classList.add('hidden');
            pageAnnotations.clear();
            pageBaseDims.clear();
            pageHistories.clear();
            if (pdfFileInput) pdfFileInput.value = '';
            if (fabricCanvas) fabricCanvas.clear();
            clearError();
            editorPanel.classList.add('hidden');
            resultPanel.classList.add('hidden');
            uploadPanel.classList.remove('hidden');
        });
    });
})(window, document);
