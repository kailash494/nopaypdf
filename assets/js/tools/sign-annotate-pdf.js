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
        let zoomScale = 1.0;
        let fabricCanvas = null;

        // Multi-page state persistence: Map<pageIndex (0-based), fabricJSON>
        const pageAnnotations = new Map();
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
                    maxSizeBytes: 80 * 1024 * 1024,
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

                // Reset state
                currentPage = 1;
                zoomScale = 1.0;
                pageAnnotations.clear();
                pageHistories.clear();

                // Update UI Header
                docFilename.textContent = file.name;
                docMeta.textContent = `${totalPages} page${totalPages === 1 ? '' : 's'} \u2022 ${PDFCore.formatBytes(file.size)}`;
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

            // Text editing keyboard shortcut protection
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    const activeObj = fabricCanvas.getActiveObject();
                    // Do not delete if currently editing text inside an IText instance
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
            const activeObj = fabricCanvas.getActiveObject();
            if (activeObj) {
                fabricCanvas.remove(activeObj);
                fabricCanvas.discardActiveObject();
                fabricCanvas.requestRenderAll();
            }
        }

        deleteSelectedBtn?.addEventListener('click', deleteSelectedObject);

        // --- Multi-Page Annotations Persistence ---
        function saveCurrentPageAnnotations() {
            if (!fabricCanvas) return;
            const pageIndex = currentPage - 1;
            const json = fabricCanvas.toJSON();
            pageAnnotations.set(pageIndex, json);
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
            if (confirm('Clear all annotations on this page?')) {
                fabricCanvas.clear();
                recordHistorySnapshot();
            }
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

            // Fit or scale logic
            let effectiveScale = zoomScale;
            if (effectiveScale === 'fit') {
                const containerWidth = canvasContainerOuter.parentElement.clientWidth - 48;
                effectiveScale = Math.min(containerWidth / baseViewport.width, 1.8);
            }

            const viewport = page.getViewport({ scale: effectiveScale, rotation: intrinsicRotation });

            // 1. Render Base PDF.js Canvas
            pdfBaseCanvas.width = Math.floor(viewport.width);
            pdfBaseCanvas.height = Math.floor(viewport.height);
            pdfBaseCanvas.style.width = `${Math.floor(viewport.width)}px`;
            pdfBaseCanvas.style.height = `${Math.floor(viewport.height)}px`;

            const ctx = pdfBaseCanvas.getContext('2d', { alpha: false });
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pdfBaseCanvas.width, pdfBaseCanvas.height);

            await page.render({ canvasContext: ctx, viewport }).promise;

            // 2. Synchronize Fabric.js Overlay Canvas
            canvasContainerOuter.style.width = `${pdfBaseCanvas.width}px`;
            canvasContainerOuter.style.height = `${pdfBaseCanvas.height}px`;

            fabricCanvas.setWidth(pdfBaseCanvas.width);
            fabricCanvas.setHeight(pdfBaseCanvas.height);
            fabricCanvas.calcOffset();

            // 3. Restore Annotations for This Page
            await restorePageAnnotations(currentPage - 1);

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
            const scales = [0.75, 1.0, 1.25, 1.5, 2.0];
            const currentIdx = scales.indexOf(typeof zoomScale === 'number' ? zoomScale : 1.0);
            if (currentIdx < scales.length - 1) {
                zoomScale = scales[currentIdx + 1];
                zoomLevelText.textContent = `${Math.round(zoomScale * 100)}%`;
                await renderCurrentPage();
            }
        });

        zoomOutBtn?.addEventListener('click', async () => {
            const scales = [0.75, 1.0, 1.25, 1.5, 2.0];
            const currentIdx = scales.indexOf(typeof zoomScale === 'number' ? zoomScale : 1.0);
            if (currentIdx > 0) {
                zoomScale = scales[currentIdx - 1];
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

                // Render low-res thumbnail
                PDFRender.renderPageToCanvas(pdfDocProxy, i, {
                    maxWidth: 120,
                    targetCanvas: canvas,
                }).catch(() => {});
            }
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
        function updateColor(hex, updateInput = true) {
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
                    }
                    fabricCanvas.requestRenderAll();
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
            btn.addEventListener('click', () => updateColor(btn.dataset.color));
        });

        customColorPicker?.addEventListener('input', (e) => updateColor(e.target.value));

        textFontSizeSelect?.addEventListener('change', (e) => {
            currentFontSize = parseInt(e.target.value, 10);
            const activeObj = fabricCanvas?.getActiveObject();
            if (activeObj && activeObj.type === 'i-text') {
                activeObj.set('fontSize', currentFontSize);
                fabricCanvas.requestRenderAll();
            }
        });

        textFontFamilySelect?.addEventListener('change', (e) => {
            currentFontFamily = e.target.value;
            const activeObj = fabricCanvas?.getActiveObject();
            if (activeObj && activeObj.type === 'i-text') {
                activeObj.set('fontFamily', currentFontFamily);
                fabricCanvas.requestRenderAll();
            }
        });

        penStrokeWidth?.addEventListener('input', (e) => {
            currentStroke = parseInt(e.target.value, 10);
            strokeWidthLabel.textContent = `${currentStroke}px`;
            if (fabricCanvas?.freeDrawingBrush) {
                fabricCanvas.freeDrawingBrush.width = currentStroke;
            }
        });

        // --- Annotation Creators ---
        function addTextAtCenter() {
            if (!fabricCanvas) return;
            const center = fabricCanvas.getCenter();
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
            const center = fabricCanvas.getCenter();
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
            const center = fabricCanvas.getCenter();
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
            const center = fabricCanvas.getCenter();
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
            const center = fabricCanvas.getCenter();
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
            const center = fabricCanvas.getCenter();
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
            const center = fabricCanvas.getCenter();
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

            // Mouse events
            signatureDrawCanvas.addEventListener('mousedown', (e) => {
                const rect = signatureDrawCanvas.getBoundingClientRect();
                startDraw(e.clientX - rect.left, e.clientY - rect.top);
            });
            signatureDrawCanvas.addEventListener('mousemove', (e) => {
                const rect = signatureDrawCanvas.getBoundingClientRect();
                moveDraw(e.clientX - rect.left, e.clientY - rect.top);
            });
            window.addEventListener('mouseup', endDraw);

            // Touch events
            signatureDrawCanvas.addEventListener('touchstart', (e) => {
                const rect = signatureDrawCanvas.getBoundingClientRect();
                const touch = e.touches[0];
                startDraw(touch.clientX - rect.left, touch.clientY - rect.top);
                e.preventDefault();
            }, { passive: false });

            signatureDrawCanvas.addEventListener('touchmove', (e) => {
                const rect = signatureDrawCanvas.getBoundingClientRect();
                const touch = e.touches[0];
                moveDraw(touch.clientX - rect.left, touch.clientY - rect.top);
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
            sigMode = mode;
            [sigTabDrawBtn, sigTabTypeBtn, sigTabUploadBtn].forEach((btn) => {
                btn.className = 'px-4 py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer';
            });

            sigPaneDraw.classList.add('hidden');
            sigPaneType.classList.add('hidden');
            sigPaneUpload.classList.add('hidden');

            if (mode === 'draw') {
                sigTabDrawBtn.className = 'px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer';
                sigPaneDraw.classList.remove('hidden');
            } else if (mode === 'type') {
                sigTabTypeBtn.className = 'px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer';
                sigPaneType.classList.remove('hidden');
                sigTypeInput.focus();
            } else if (mode === 'upload') {
                sigTabUploadBtn.className = 'px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer';
                sigPaneUpload.classList.remove('hidden');
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
        sigFileInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                sigUploadedDataUrl = evt.target.result;
                sigUploadPreviewImg.src = sigUploadedDataUrl;
                sigUploadBox.classList.add('hidden');
                sigUploadPreviewWrap.classList.remove('hidden');
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
            signatureModal.classList.remove('hidden');
            if (!sigCtx) initSigDrawCanvas();
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });

        const closeSigModal = () => signatureModal.classList.add('hidden');
        closeSignatureModalBtn?.addEventListener('click', closeSigModal);
        cancelSigModalBtn?.addEventListener('click', closeSigModal);

        // Stamp Signature into Fabric
        function stampSignatureDataUrl(dataUrl) {
            if (!fabricCanvas) return;
            fabric.Image.fromURL(dataUrl, (img) => {
                const center = fabricCanvas.getCenter();
                // Scale signature to an aesthetically balanced width (around 160px)
                const targetWidth = 160;
                const scale = targetWidth / img.width;
                img.set({
                    left: center.left - targetWidth / 2,
                    top: center.top - (img.height * scale) / 2,
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
            let signatureDataUrl = null;

            if (sigMode === 'draw') {
                if (sigDrawEmpty) {
                    alert('Please draw your signature before applying.');
                    return;
                }
                signatureDataUrl = signatureDrawCanvas.toDataURL('image/png');
            } else if (sigMode === 'type') {
                const text = sigTypeInput.value.trim() || 'Jane Doe';
                // Render typed signature on offscreen canvas
                const offCanvas = document.createElement('canvas');
                offCanvas.width = 400;
                offCanvas.height = 120;
                const offCtx = offCanvas.getContext('2d');
                offCtx.fillStyle = sigInkColor;
                offCtx.font = `italic 42px ${sigSelectedFont}`;
                offCtx.textAlign = 'center';
                offCtx.textBaseline = 'middle';
                offCtx.fillText(text, 200, 60);
                signatureDataUrl = offCanvas.toDataURL('image/png');
            } else if (sigMode === 'upload') {
                if (!sigUploadedDataUrl) {
                    alert('Please upload an image signature.');
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

            // Check if there are any annotations on any page
            let totalAnnotations = 0;
            pageAnnotations.forEach((json) => {
                if (json?.objects?.length > 0) totalAnnotations += json.objects.length;
            });

            if (totalAnnotations === 0) {
                if (!confirm('No signatures or annotations were added. Do you want to export the original PDF?')) {
                    return;
                }
            }

            exportProgressPanel.classList.remove('hidden');
            resultPanel.classList.add('hidden');
            exportProgressBar.style.width = '10%';
            exportStatusTitle.textContent = 'Loading Document...';
            exportStatusDesc.textContent = 'Preparing vector document pages for annotation stamping...';

            try {
                const { PDFDocument } = window.PDFLib;
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
                    const pageWidth = page.getWidth();
                    const pageHeight = page.getHeight();

                    // Render offscreen fabric static canvas at 2.5x high-DPI
                    const staticCanvasEl = document.createElement('canvas');
                    const staticCanvas = new fabric.StaticCanvas(staticCanvasEl, {
                        width: fabricCanvas.width,
                        height: fabricCanvas.height,
                    });

                    await new Promise((resolve) => {
                        staticCanvas.loadFromJSON(json, () => {
                            staticCanvas.renderAll();
                            resolve();
                        });
                    });

                    // Export transparent overlay at 2.5x multiplier for razor-sharp vector clarity
                    const overlayPngDataUrl = staticCanvas.toDataURL({
                        format: 'png',
                        multiplier: 2.5,
                    });

                    // Embed PNG into pdf-lib
                    const embeddedImage = await pdfDoc.embedPng(overlayPngDataUrl);

                    // Draw image over the page
                    page.drawImage(embeddedImage, {
                        x: 0,
                        y: 0,
                        width: pageWidth,
                        height: pageHeight,
                    });

                    // Zero out offscreen canvas memory
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
        resetEditorBtn?.addEventListener('click', () => {
            if (confirm('Upload another PDF? Any unsaved edits will be discarded.')) {
                originalFile = null;
                originalArrayBuffer = null;
                pdfDocProxy = null;
                pageAnnotations.clear();
                pageHistories.clear();
                if (fabricCanvas) fabricCanvas.clear();
                editorPanel.classList.add('hidden');
                resultPanel.classList.add('hidden');
                uploadPanel.classList.remove('hidden');
            }
        });
    });
})(window, document);
