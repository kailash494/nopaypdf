/**
 * NoPayPDF - Full In-Browser PDF Editor Master Controller (main.js)
 *
 * Coordinates dropzone, toolbar state, thumbnails, modals, keyboard shortcuts,
 * and export pipeline.
 * 100% Client-Side. Permissive MIT / Apache 2.0 compatible.
 */

(function (window, document) {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        // --- Core DOM Elements ---
        const dropzone = document.getElementById('editor-dropzone');
        const fileInput = document.getElementById('editor-file-input');
        const errorAlert = document.getElementById('error-alert');
        const errorMessage = document.getElementById('error-message');
        const errorDismissBtn = document.getElementById('error-dismiss-btn');
        const scannedBanner = document.getElementById('scanned-banner');

        const heroSection = document.getElementById('tool-hero-section');
        const workspaceSection = document.getElementById('editor-workspace-section');
        const docTitleEl = document.getElementById('editor-doc-title');
        const docMetaEl = document.getElementById('editor-doc-meta');

        // Stage & Layers
        const stageStack = document.getElementById('stage-stack');
        const stageBaseCanvas = document.getElementById('stage-base-canvas');
        const stageTextLayer = document.getElementById('stage-text-layer');
        const stageLinksLayer = document.getElementById('stage-links-layer');
        const stageFormsLayer = document.getElementById('stage-forms-layer');
        const stageFabricCanvas = document.getElementById('stage-fabric-canvas');

        // Thumbnail Rail
        const thumbnailRailList = document.getElementById('thumbnail-rail-list');
        const toggleRailBtn = document.getElementById('toggle-rail-btn');
        const reopenRailBtn = document.getElementById('reopen-rail-btn');
        const thumbnailRail = document.getElementById('thumbnail-rail');
        const addBlankPageBtn = document.getElementById('add-blank-page-btn');
        const deletePageBtn = document.getElementById('delete-page-btn');

        // Non-Blocking Toast & Confirmation Dialog Helpers
        let toastTimer = null;
        function showAppToast(message, type = 'info') {
            const toastEl = document.getElementById('app-toast');
            if (!toastEl || !message) return;
            toastEl.textContent = message;
            toastEl.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 transition-all ' +
                (type === 'error' ? 'bg-rose-600 text-white' : type === 'warning' ? 'bg-amber-600 text-white' : 'bg-slate-900 text-white');
            toastEl.classList.remove('hidden');
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = setTimeout(() => {
                toastEl.classList.add('hidden');
            }, 3400);
        }

        function showAppConfirm(title, message, confirmLabel, onConfirm) {
            const modal = document.getElementById('app-confirm-modal');
            const titleEl = document.getElementById('app-confirm-title');
            const msgEl = document.getElementById('app-confirm-message');
            const okBtn = document.getElementById('app-confirm-ok');
            const cancelBtn = document.getElementById('app-confirm-cancel');
            if (!modal || !okBtn || !cancelBtn) return;

            if (titleEl) titleEl.textContent = title || 'Confirm Action';
            if (msgEl) msgEl.textContent = message || '';
            okBtn.textContent = confirmLabel || 'Confirm';
            modal.classList.remove('hidden');

            const cleanup = () => {
                modal.classList.add('hidden');
                okBtn.onclick = null;
                cancelBtn.onclick = null;
            };
            cancelBtn.onclick = cleanup;
            okBtn.onclick = async () => {
                cleanup();
                if (typeof onConfirm === 'function') {
                    await onConfirm();
                }
            };
        }

        window.addEventListener('editor:toast', (e) => {
            if (e.detail && e.detail.message) {
                showAppToast(e.detail.message, e.detail.type || 'info');
            }
        });

        // Toolbar Buttons
        const toolBtns = document.querySelectorAll('.editor-tool-btn');
        const undoBtn = document.getElementById('btn-undo');
        const redoBtn = document.getElementById('btn-redo');
        const zoomSelect = document.getElementById('zoom-select');
        const applyChangesBtn = document.getElementById('btn-apply-changes');
        const resetEditorBtn = document.getElementById('btn-reset-editor');

        // Contextual Sub-Toolbar Elements
        const subToolbar = document.getElementById('context-sub-toolbar');
        const fontSelect = document.getElementById('sub-font-select');
        const fontSizeInput = document.getElementById('sub-font-size');
        const boldBtn = document.getElementById('sub-bold-btn');
        const italicBtn = document.getElementById('sub-italic-btn');
        const textColorInput = document.getElementById('sub-text-color');
        const bgColorInput = document.getElementById('sub-bg-color');
        const deleteBlockBtn = document.getElementById('sub-delete-btn');
        const resetBlockBtn = document.getElementById('sub-reset-btn');

        // Find & Replace Drawer
        const findDrawer = document.getElementById('find-replace-drawer');
        const findInput = document.getElementById('find-query-input');
        const replaceInput = document.getElementById('replace-query-input');
        const findCountLabel = document.getElementById('find-count-label');
        const btnFindNext = document.getElementById('btn-find-next');
        const btnReplaceOne = document.getElementById('btn-replace-one');
        const btnReplaceAll = document.getElementById('btn-replace-all');
        const btnCloseFind = document.getElementById('btn-close-find');

        // Modals
        const exportModal = document.getElementById('export-modal');
        const exportFilenameInput = document.getElementById('export-filename-input');
        const optFlattenForms = document.getElementById('opt-flatten-forms');
        const optFlattenRedact = document.getElementById('opt-flatten-redact');
        const btnConfirmExport = document.getElementById('btn-confirm-export');
        const btnCloseExportModal = document.getElementById('btn-close-export-modal');
        const exportProgressWrap = document.getElementById('export-progress-wrap');
        const exportProgressBar = document.getElementById('export-progress-bar');
        const exportProgressText = document.getElementById('export-progress-text');
        const exportResultWrap = document.getElementById('export-result-wrap');
        const btnDownloadExported = document.getElementById('btn-download-exported');

        // Signatures Modal
        const sigModal = document.getElementById('signature-modal');
        const btnCloseSigModal = document.getElementById('btn-close-sig-modal');
        const sigTabDrawBtn = document.getElementById('sig-tab-draw-btn');
        const sigTabTypeBtn = document.getElementById('sig-tab-type-btn');
        const sigTabUploadBtn = document.getElementById('sig-tab-upload-btn');
        const sigPaneDraw = document.getElementById('sig-pane-draw');
        const sigPaneType = document.getElementById('sig-pane-type');
        const sigPaneUpload = document.getElementById('sig-pane-upload');
        const sigDrawCanvas = document.getElementById('sig-draw-canvas');
        const btnClearSigDraw = document.getElementById('btn-clear-sig-draw');
        const sigTypeInput = document.getElementById('sig-type-input');
        const btnApplySignature = document.getElementById('btn-apply-signature');
        const sigUploadDropzone = document.getElementById('sig-upload-dropzone');
        const sigUploadFileInput = document.getElementById('sig-upload-file-input');
        const sigUploadPreviewWrap = document.getElementById('sig-upload-preview-wrap');
        const sigUploadCanvas = document.getElementById('sig-upload-canvas');
        const sigRemoveBgToggle = document.getElementById('sig-remove-bg-toggle');
        const btnClearSigUpload = document.getElementById('btn-clear-sig-upload');

        // Sub-Toolbars
        const annotateSubToolbar = document.getElementById('annotate-sub-toolbar');
        const whiteoutSubToolbar = document.getElementById('whiteout-sub-toolbar');
        const shapesSubToolbar = document.getElementById('shapes-sub-toolbar');
        const drawSubToolbar = document.getElementById('draw-sub-toolbar');
        const formsSubToolbar = document.getElementById('forms-sub-toolbar');

        // Hidden Image Input
        const hiddenImgInput = document.getElementById('hidden-image-input');

        // Internal State
        let currentPdfProxy = null;
        let lastExportedBytes = null;
        let activeFindMatches = [];
        let activeFindIndex = 0;

        // Initialize Stage
        window.CanvasStage.init(stageStack, stageBaseCanvas, stageTextLayer, stageLinksLayer, stageFormsLayer, stageFabricCanvas);

        // ====================================================
        // File Dropzone & Loading
        // ====================================================

        function showError(msg) {
            if (!errorAlert || !errorMessage) return;
            errorMessage.textContent = msg;
            errorAlert.classList.remove('hidden');
        }

        function clearError() {
            if (errorAlert) errorAlert.classList.add('hidden');
        }

        errorDismissBtn?.addEventListener('click', clearError);

        window.PDFCore.initDropzone({
            dropzoneEl: dropzone,
            inputEl: fileInput,
            accept: '.pdf,application/pdf',
            multiple: false,
            onFilesAdded: async (files) => {
                if (!files || files.length === 0) return;
                clearError();
                const file = files[0];

                try {
                    const buffer = await file.arrayBuffer();
                    await loadPdfDocument(file.name, buffer);
                } catch (err) {
                    console.error('File load error:', err);
                    showError('Could not open PDF: ' + err.message);
                }
            },
            onError: (errs) => {
                showError(errs.join(' '));
            },
        });

        async function loadPdfDocument(fileName, arrayBuffer) {
            clearError();
            currentPdfProxy = null;

            // Pre-extract embedded font streams using PDFLib
            const embeddedFontsMap = window.FontManager && typeof window.FontManager.extractEmbeddedFonts === 'function'
                ? await window.FontManager.extractEmbeddedFonts(arrayBuffer)
                : null;

            // Load via PDFRender without detaching original buffer
            const preview = await window.PDFRender.loadPreviewDocument(arrayBuffer);
            currentPdfProxy = preview.pdfProxy;

            // Gather page metadata
            const pagesMeta = [];
            const allPagesBlocks = [];

            for (let i = 1; i <= currentPdfProxy.numPages; i++) {
                const page = await currentPdfProxy.getPage(i);
                const unscaled = page.getViewport({ scale: 1.0, rotation: page.rotate || 0 });
                pagesMeta.push({
                    sourcePageIndex: i - 1,
                    widthPt: unscaled.width,
                    heightPt: unscaled.height,
                    rotation: page.rotate || 0,
                });

                // Extract text for each page
                const textResult = await window.TextExtractor.extractPageText(page, i - 1, embeddedFontsMap);
                allPagesBlocks.push(textResult.blocks);
            }

            // Check if scanned document (0 text characters)
            if (window.TextExtractor.isScannedPdf(allPagesBlocks)) {
                if (scannedBanner) scannedBanner.classList.remove('hidden');
            } else {
                if (scannedBanner) scannedBanner.classList.add('hidden');
            }

            // Initialize EditorState with extracted blocks
            window.EditorState.initializePages(pagesMeta, fileName, arrayBuffer, allPagesBlocks);

            // Update UI headers
            if (docTitleEl) docTitleEl.textContent = fileName;
            if (docMetaEl) docMetaEl.textContent = `${currentPdfProxy.numPages} pages • 100% Client-Side`;
            if (exportFilenameInput) {
                const baseName = fileName.replace(/\.[^/.]+$/, '');
                exportFilenameInput.value = `${baseName}-edited.pdf`;
            }

            // Transition UI from Hero to Full Workspace
            if (heroSection) heroSection.classList.add('hidden');
            if (workspaceSection) workspaceSection.classList.remove('hidden');

            // Preload local @font-face families eagerly before rendering stage text
            await window.FontManager?.preloadLocalFonts?.();

            renderThumbnailRail();
            await renderCurrentPage();
            updateHistoryButtons();

            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        async function renderCurrentPage() {
            if (!currentPdfProxy) return;
            const zoomVal = parseFloat(zoomSelect?.value || '1.0');
            await window.CanvasStage.renderPage(currentPdfProxy, zoomVal);
            highlightActiveThumbnail();
        }

        // ====================================================
        // Thumbnail Rail
        // ====================================================

        async function renderThumbnailRail() {
            if (!thumbnailRailList) return;
            thumbnailRailList.innerHTML = '';

            const pages = window.EditorState.pages;
            for (let i = 0; i < pages.length; i++) {
                const p = pages[i];
                const card = document.createElement('div');
                card.className = `thumbnail-rail-card p-2 text-center select-none ${i === window.EditorState.activePageIndex ? 'active' : ''}`;
                card.dataset.index = i;

                const thumbCanvas = document.createElement('canvas');
                thumbCanvas.className = 'w-full rounded shadow-xs bg-white pointer-events-none';
                thumbCanvas.width = 120;
                thumbCanvas.height = 150;

                const label = document.createElement('span');
                label.className = 'text-[11px] font-bold text-slate-500 mt-1 block';
                label.textContent = `Page ${i + 1}`;

                card.appendChild(thumbCanvas);
                card.appendChild(label);

                card.addEventListener('click', async () => {
                    window.EditorState.setActivePageIndex(i);
                    await renderCurrentPage();
                });

                thumbnailRailList.appendChild(card);

                // Render thumbnail async
                renderMiniThumbnail(p, thumbCanvas);
            }
        }

        async function renderMiniThumbnail(pageState, canvas) {
            if (pageState.sourcePageIndex === null || !currentPdfProxy) {
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.strokeStyle = '#e2e8f0';
                ctx.strokeRect(0, 0, canvas.width, canvas.height);
                return;
            }

            try {
                const page = await currentPdfProxy.getPage(pageState.sourcePageIndex + 1);
                const unscaled = page.getViewport({ scale: 1.0 });
                const scale = 120 / unscaled.width;
                const viewport = page.getViewport({ scale });
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;
            } catch (e) {}
        }

        function highlightActiveThumbnail() {
            const cards = thumbnailRailList?.querySelectorAll('.thumbnail-rail-card');
            cards?.forEach((c, idx) => {
                if (idx === window.EditorState.activePageIndex) {
                    c.classList.add('active');
                } else {
                    c.classList.remove('active');
                }
            });
        }

        toggleRailBtn?.addEventListener('click', () => {
            thumbnailRail?.classList.add('hidden');
            reopenRailBtn?.classList.remove('hidden');
            window.CanvasStage?.syncCanvasOffset();
        });

        reopenRailBtn?.addEventListener('click', () => {
            thumbnailRail?.classList.remove('hidden');
            reopenRailBtn?.classList.add('hidden');
            window.CanvasStage?.syncCanvasOffset();
        });

        addBlankPageBtn?.addEventListener('click', async () => {
            window.EditorState.insertBlankPage();
            renderThumbnailRail();
            await renderCurrentPage();
        });

        deletePageBtn?.addEventListener('click', () => {
            const pageNum = window.EditorState.activePageIndex + 1;
            showAppConfirm(
                'Delete Page',
                `Remove Page ${pageNum} from this document? You can undo this step with Ctrl+Z.`,
                'Delete Page',
                async () => {
                    if (window.EditorState.deletePage()) {
                        renderThumbnailRail();
                        await renderCurrentPage();
                    }
                }
            );
        });

        function hideAllSubToolbars() {
            window.NoPayColorPicker?.close();
            window.CanvasStage?.closePropertiesPopover();
            subToolbar?.classList.add('hidden');
            annotateSubToolbar?.classList.add('hidden');
            whiteoutSubToolbar?.classList.add('hidden');
            shapesSubToolbar?.classList.add('hidden');
            drawSubToolbar?.classList.add('hidden');
            formsSubToolbar?.classList.add('hidden');
        }

        // ====================================================
        // Toolbar State & Tool Dispatch
        // ====================================================

        toolBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                toolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Commit any active inline Fabric text editing before switching tools
                const activeObj = window.CanvasStage?.fabricCanvas?.getActiveObject();
                if (activeObj && activeObj.isEditing) {
                    activeObj.exitEditing();
                }

                // Cancel any pending form / ghost placement
                window.CanvasStage.cancelPlacement();

                // Toggle sub-toolbars based on active tool
                hideAllSubToolbars();

                if (tool === 'text-edit') {
                    if (window.CanvasStage.selectedBlock || window.CanvasStage.activeFabricTextBox) {
                        subToolbar?.classList.remove('hidden');
                    }
                } else if (tool === 'add-text') {
                    subToolbar?.classList.remove('hidden');
                    const bgWrap = document.getElementById('sub-bg-color-wrap');
                    if (bgWrap) bgWrap.style.display = '';
                    const bgBinding = window.NoPayColorPicker?.bindings?.get('sub-bg-color');
                    if (bgBinding) {
                        bgBinding.clearMode = 'transparent';
                        bgBinding.clearLabel = 'Transparent';
                        window.NoPayColorPicker.syncVisualState(bgBinding);
                    }
                    const resetBtn = document.getElementById('sub-reset-btn');
                    if (resetBtn) resetBtn.style.display = 'none';
                    const fontTierPill = document.getElementById('sub-font-tier-pill');
                    if (fontTierPill) {
                        fontTierPill.classList.remove('hidden');
                        fontTierPill.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0';
                        fontTierPill.textContent = 'Add Text Mode';
                    }
                } else if (tool === 'annotate') {
                    annotateSubToolbar?.classList.remove('hidden');
                } else if (tool === 'whiteout') {
                    whiteoutSubToolbar?.classList.remove('hidden');
                } else if (tool === 'shapes') {
                    shapesSubToolbar?.classList.remove('hidden');
                } else if (tool === 'draw') {
                    drawSubToolbar?.classList.remove('hidden');
                } else if (tool === 'forms') {
                    formsSubToolbar?.classList.remove('hidden');
                    const activeFormTypeBtn = formsSubToolbar?.querySelector('.form-type-btn.active');
                    const activeFormType = activeFormTypeBtn?.dataset.type || 'text';
                    const fieldNameVal = document.getElementById('form-field-name-input')?.value;
                    window.CanvasStage.startFormPlacement(activeFormType, fieldNameVal);
                }

                window.CanvasStage.setTool(tool);
                window.CanvasStage.syncCanvasOffset();

                if (tool === 'images') {
                    hiddenImgInput?.click();
                } else if (tool === 'sign') {
                    openSigModal();
                }
            });
        });

        // Unified Shape Style Updater (handles standard Shapes & Group Arrows)
        function updateSelectedShapeStyle({ stroke, strokeWidth, fill }) {
            const activeObj = window.CanvasStage?.fabricCanvas?.getActiveObject();
            if (!activeObj || activeObj.isWhiteout || activeObj.isSignature || activeObj.isAnnotation || activeObj.type === 'i-text' || activeObj.type === 'text') {
                return;
            }
            if (activeObj.isArrow && activeObj.type === 'group') {
                const items = activeObj.getObjects();
                const line = items.find(i => i.type === 'line');
                const tri = items.find(i => i.type === 'triangle');
                if (stroke !== undefined) {
                    if (line) line.set('stroke', stroke);
                    if (tri) tri.set('fill', stroke);
                }
                if (strokeWidth !== undefined) {
                    if (line) line.set('strokeWidth', strokeWidth);
                    if (tri) {
                        const headLen = Math.max(12, Math.min(36, strokeWidth * 4.5));
                        tri.set({ width: headLen * 0.9, height: headLen });
                    }
                    activeObj.shapeStrokeWidth = strokeWidth;
                }
                if (typeof activeObj.addWithUpdate === 'function') {
                    activeObj.addWithUpdate();
                }
            } else {
                if (stroke !== undefined) activeObj.set('stroke', stroke);
                if (strokeWidth !== undefined) activeObj.set('strokeWidth', strokeWidth);
                if (fill !== undefined) activeObj.set('fill', fill);
            }
            activeObj.setCoords();
            window.CanvasStage?.fabricCanvas?.renderAll();
            window.CanvasStage?._saveFabricState();
        }

        // Annotate Sub-Toolbar wiring
        const annotTypeBtns = document.querySelectorAll('.annot-type-btn');
        annotTypeBtns.forEach(b => {
            b.addEventListener('click', () => {
                annotTypeBtns.forEach(btn => {
                    btn.classList.remove('active', 'bg-white', 'text-blue-600', 'shadow-xs');
                    btn.classList.add('text-slate-600', 'hover:text-slate-900');
                });
                b.classList.add('active', 'bg-white', 'text-blue-600', 'shadow-xs');
                b.classList.remove('text-slate-600', 'hover:text-slate-900');
                window.CanvasStage.annotateType = b.dataset.type || 'highlight';
            });
        });

        // Whiteout Sub-Toolbar wiring
        const whiteoutFillColor = document.getElementById('whiteout-fill-color');
        const btnAddWhiteoutBox = document.getElementById('btn-add-whiteout-box');

        function updateActiveWhiteoutFill(color) {
            const activeObj = window.CanvasStage?.fabricCanvas?.getActiveObject();
            if (activeObj && activeObj.isWhiteout) {
                activeObj.set({
                    fill: color,
                    stroke: null,
                    strokeWidth: 0,
                });
                window.CanvasStage?.fabricCanvas?.renderAll();
                window.CanvasStage?._saveFabricState();
                window.EditorState.pushSnapshot('Change Whiteout Color');
            }
        }

        btnAddWhiteoutBox?.addEventListener('click', () => {
            window.CanvasStage.addWhiteoutBox();
        });

        // Shapes Sub-Toolbar wiring
        const shapeTypeBtns = document.querySelectorAll('.shape-type-btn');
        shapeTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                shapeTypeBtns.forEach(b => {
                    b.classList.remove('active', 'bg-white', 'text-blue-600', 'shadow-xs');
                    b.classList.add('text-slate-600', 'hover:text-slate-900');
                });
                btn.classList.add('active', 'bg-white', 'text-blue-600', 'shadow-xs');
                btn.classList.remove('text-slate-600', 'hover:text-slate-900');
                window.CanvasStage.shapeType = btn.dataset.type || 'rect';
            });
        });

        const shapeStrokeWidth = document.getElementById('shape-stroke-width');
        shapeStrokeWidth?.addEventListener('change', () => {
            const w = parseInt(shapeStrokeWidth.value || '2', 10);
            window.CanvasStage.shapeStrokeWidth = w;
            updateSelectedShapeStyle({ strokeWidth: w });
        });

        const shapeFillColor = document.getElementById('shape-fill-color');
        const shapeFillTransparent = document.getElementById('shape-fill-transparent');

        // Draw Sub-Toolbar wiring
        const drawBrushColor = document.getElementById('draw-brush-color');
        const drawBrushSize = document.getElementById('draw-brush-size');

        drawBrushSize?.addEventListener('change', () => {
            if (window.CanvasStage?.fabricCanvas?.freeDrawingBrush) {
                window.CanvasStage.fabricCanvas.freeDrawingBrush.width = parseInt(drawBrushSize.value || '3', 10);
            }
        });

        // Unified Rich Color Pickers (20 Swatches + Custom Wheel + #HEX) across ALL 6 tools
        if (window.NoPayColorPicker) {
            window.NoPayColorPicker.bind({
                triggerBtn: 'sub-text-color-trigger',
                inputEl: 'sub-text-color',
                onChange: (color) => {
                    if (window.CanvasStage.selectedBlock) {
                        window.CanvasStage.selectedBlock.colorHex = color;
                        window.CanvasStage.selectedBlock.modified = true;
                        renderCurrentPage();
                    } else if (window.CanvasStage.activeFabricTextBox) {
                        window.CanvasStage.activeFabricTextBox.set('fill', color);
                        window.CanvasStage.fabricCanvas.renderAll();
                        window.CanvasStage._saveFabricState();
                    }
                },
            });

            window.NoPayColorPicker.bind({
                triggerBtn: 'sub-bg-color-trigger',
                inputEl: 'sub-bg-color',
                clearMode: 'auto',
                clearLabel: 'Auto',
                isClearFn: () => {
                    if (window.CanvasStage?.selectedBlock) {
                        const b = window.CanvasStage.selectedBlock;
                        return !b.bgHex || b.bgHex === (b.autoBgHex || '#ffffff');
                    }
                    if (window.CanvasStage?.activeFabricTextBox) {
                        return !window.CanvasStage.activeFabricTextBox.textBackgroundColor;
                    }
                    return !window.CanvasStage?.addTextBgColor || window.CanvasStage.addTextBgColor === 'transparent';
                },
                onChange: (color) => {
                    if (window.CanvasStage.selectedBlock) {
                        window.CanvasStage.selectedBlock.bgHex = color;
                        window.CanvasStage.selectedBlock.modified = true;
                        renderCurrentPage();
                    } else if (window.CanvasStage.activeFabricTextBox) {
                        window.CanvasStage.activeFabricTextBox.set('textBackgroundColor', color);
                        window.CanvasStage.addTextBgColor = color;
                        window.CanvasStage.fabricCanvas.renderAll();
                        window.CanvasStage._saveFabricState();
                    } else {
                        window.CanvasStage.addTextBgColor = color;
                    }
                },
                onClear: () => {
                    if (window.CanvasStage.selectedBlock) {
                        const b = window.CanvasStage.selectedBlock;
                        b.bgHex = b.autoBgHex || '#ffffff';
                        if (bgColorInput) bgColorInput.value = (b.bgHex && b.bgHex.startsWith('#')) ? b.bgHex : '#ffffff';
                        b.modified = true;
                        renderCurrentPage();
                    } else if (window.CanvasStage.activeFabricTextBox) {
                        window.CanvasStage.activeFabricTextBox.set('textBackgroundColor', '');
                        window.CanvasStage.addTextBgColor = 'transparent';
                        window.CanvasStage.fabricCanvas.renderAll();
                        window.CanvasStage._saveFabricState();
                    } else {
                        window.CanvasStage.addTextBgColor = 'transparent';
                    }
                },
            });

            window.NoPayColorPicker.bind({
                triggerBtn: 'annot-color-trigger',
                inputEl: 'annot-color-picker',
                onChange: (color) => {
                    window.CanvasStage.annotateColor = color;
                    const activeObj = window.CanvasStage?.fabricCanvas?.getActiveObject();
                    if (activeObj && activeObj.isAnnotation) {
                        activeObj.set('fill', color);
                        window.CanvasStage.fabricCanvas.renderAll();
                        window.CanvasStage._saveFabricState();
                    }
                },
            });

            window.NoPayColorPicker.bind({
                triggerBtn: 'whiteout-color-trigger',
                inputEl: 'whiteout-fill-color',
                onChange: (color) => {
                    updateActiveWhiteoutFill(color);
                },
            });

            window.NoPayColorPicker.bind({
                triggerBtn: 'shape-stroke-trigger',
                inputEl: 'shape-stroke-color',
                onChange: (color) => {
                    window.CanvasStage.shapeStrokeColor = color;
                    updateSelectedShapeStyle({ stroke: color });
                },
            });

            window.NoPayColorPicker.bind({
                triggerBtn: 'shape-fill-trigger',
                inputEl: 'shape-fill-color',
                clearMode: 'nofill',
                clearLabel: 'No Fill',
                isClearFn: () => Boolean(shapeFillTransparent?.checked),
                onChange: (color) => {
                    window.CanvasStage.shapeFillColor = color;
                    window.CanvasStage.shapeFillTransparent = false;
                    if (shapeFillTransparent) shapeFillTransparent.checked = false;
                    updateSelectedShapeStyle({ fill: color });
                },
                onClear: () => {
                    window.CanvasStage.shapeFillTransparent = true;
                    if (shapeFillTransparent) shapeFillTransparent.checked = true;
                    updateSelectedShapeStyle({ fill: 'transparent' });
                },
            });

            window.NoPayColorPicker.bind({
                triggerBtn: 'draw-color-trigger',
                inputEl: 'draw-brush-color',
                onChange: (color) => {
                    if (window.CanvasStage?.fabricCanvas?.freeDrawingBrush) {
                        window.CanvasStage.fabricCanvas.freeDrawingBrush.color = color;
                    }
                    const activeObj = window.CanvasStage?.fabricCanvas?.getActiveObject();
                    if (activeObj && activeObj.type === 'path') {
                        activeObj.set('stroke', color);
                        window.CanvasStage.fabricCanvas.renderAll();
                        window.CanvasStage._saveFabricState();
                    }
                },
            });
        }

        // Forms Sub-Toolbar wiring
        const formTypeBtns = document.querySelectorAll('.form-type-btn');
        const formFieldNameInput = document.getElementById('form-field-name-input');

        formTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                formTypeBtns.forEach(b => {
                    b.classList.remove('active', 'bg-white', 'text-blue-600', 'shadow-xs');
                    b.classList.add('text-slate-600', 'hover:text-slate-900');
                });
                btn.classList.add('active', 'bg-white', 'text-blue-600', 'shadow-xs');
                btn.classList.remove('text-slate-600', 'hover:text-slate-900');
                const formType = btn.dataset.type || 'text';
                window.CanvasStage.startFormPlacement(formType, formFieldNameInput?.value);
            });
        });

        formFieldNameInput?.addEventListener('input', () => {
            const activeBtn = formsSubToolbar?.querySelector('.form-type-btn.active');
            const formType = activeBtn?.dataset.type || 'text';
            window.CanvasStage.startFormPlacement(formType, formFieldNameInput.value);
        });

        hiddenImgInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                window.CanvasStage.startPlacement('image', evt.target.result);
                hiddenImgInput.value = '';
            };
            reader.readAsDataURL(file);
        });

        function createFormFieldPrompt(forcedType) {
            let normType = forcedType;
            if (!normType) {
                const activeBtn = formsSubToolbar?.querySelector('.form-type-btn.active');
                normType = activeBtn?.dataset.type || 'text';
            }
            window.CanvasStage.startFormPlacement(normType, formFieldNameInput?.value);
        }

        // ====================================================
        // Contextual Sub-Toolbar & Block Editing
        // ====================================================

        window.addEventListener('editor:block-selected', (e) => {
            const block = e.detail?.block;
            if (!block) {
                subToolbar?.classList.add('hidden');
                window.CanvasStage?.syncCanvasOffset();
                return;
            }

            subToolbar?.classList.remove('hidden');
            const bgWrap = document.getElementById('sub-bg-color-wrap');
            if (bgWrap) bgWrap.style.display = '';
            const bgBinding = window.NoPayColorPicker?.bindings?.get('sub-bg-color');
            if (bgBinding) {
                bgBinding.clearMode = 'auto';
                bgBinding.clearLabel = 'Auto';
            }
            const resetBtn = document.getElementById('sub-reset-btn');
            if (resetBtn) resetBtn.style.display = '';
            const fontTierPill = document.getElementById('sub-font-tier-pill');
            if (fontTierPill) {
                fontTierPill.classList.remove('hidden');
                const displayName = block.baseFontName || block.realName || 'Original';
                if (block.tier === 1) {
                    fontTierPill.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0';
                    fontTierPill.textContent = `Original: ${displayName}`;
                } else {
                    fontTierPill.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 shrink-0';
                    fontTierPill.textContent = `Matched: ${block.matched?.name || 'Liberation Sans'}`;
                }
            }

            if (fontSelect) {
                const selectedKey = block.fontFamily || (block.tier === 1 ? 'original' : (block.matched?.local || 'sans'));
                fontSelect.value = selectedKey;
            }
            if (fontSizeInput) fontSizeInput.value = (Math.round((block.fontSizePt || 12) * 100) / 100).toString();
            if (boldBtn) {
                boldBtn.classList.toggle('active', Boolean(block.bold));
            }
            if (italicBtn) {
                italicBtn.classList.toggle('active', Boolean(block.italic));
            }
            if (textColorInput) {
                textColorInput.value = block.colorHex || '#1e293b';
                window.NoPayColorPicker?.syncVisualState('sub-text-color');
            }
            if (bgColorInput) {
                bgColorInput.value = (block.bgHex && block.bgHex.startsWith('#')) ? block.bgHex : (block.autoBgHex || '#ffffff');
                window.NoPayColorPicker?.syncVisualState('sub-bg-color');
            }
            window.CanvasStage?.syncCanvasOffset();
        });

        function getFontFamilyFromSelectKey(key) {
            switch (key) {
                case 'carlito': return 'Carlito';
                case 'roboto': return 'Roboto';
                case 'opensans': return 'Open Sans';
                case 'lato': return 'Lato';
                case 'serif': return 'Liberation Serif';
                case 'mono': return 'Liberation Mono';
                case 'sans':
                default: return 'Liberation Sans';
            }
        }

        fontSelect?.addEventListener('change', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.fontFamily = fontSelect.value;
                window.CanvasStage.selectedBlock.modified = true;
                window.EditorState.pushSnapshot('Change Font Family');
                renderCurrentPage();
            } else if (window.CanvasStage.activeFabricTextBox) {
                const fam = getFontFamilyFromSelectKey(fontSelect.value);
                window.CanvasStage.activeFabricTextBox.set('fontFamily', fam);
                window.CanvasStage.fabricCanvas.renderAll();
                window.CanvasStage._saveFabricState();
                window.EditorState.pushSnapshot('Change Font Family');
            }
        });

        fontSizeInput?.addEventListener('input', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.fontSizePt = parseFloat(fontSizeInput.value) || 12;
                window.CanvasStage.selectedBlock.modified = true;
                renderCurrentPage();
            } else if (window.CanvasStage.activeFabricTextBox) {
                const sz = parseFloat(fontSizeInput.value) || 16;
                window.CanvasStage.activeFabricTextBox.set('fontSize', sz);
                window.CanvasStage.fabricCanvas.renderAll();
                window.CanvasStage._saveFabricState();
            }
        });

        boldBtn?.addEventListener('click', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.bold = !window.CanvasStage.selectedBlock.bold;
                window.CanvasStage.selectedBlock.modified = true;
                boldBtn.classList.toggle('active', window.CanvasStage.selectedBlock.bold);
                window.EditorState.pushSnapshot('Toggle Bold');
                renderCurrentPage();
            } else if (window.CanvasStage.activeFabricTextBox) {
                const isB = window.CanvasStage.activeFabricTextBox.fontWeight === 'bold' || window.CanvasStage.activeFabricTextBox.fontWeight === 700 || window.CanvasStage.activeFabricTextBox.fontWeight === '700';
                window.CanvasStage.activeFabricTextBox.set('fontWeight', isB ? 'normal' : 'bold');
                boldBtn.classList.toggle('active', !isB);
                window.CanvasStage.fabricCanvas.renderAll();
                window.CanvasStage._saveFabricState();
                window.EditorState.pushSnapshot('Toggle Bold');
            }
        });

        italicBtn?.addEventListener('click', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.italic = !window.CanvasStage.selectedBlock.italic;
                window.CanvasStage.selectedBlock.modified = true;
                italicBtn.classList.toggle('active', window.CanvasStage.selectedBlock.italic);
                window.EditorState.pushSnapshot('Toggle Italic');
                renderCurrentPage();
            } else if (window.CanvasStage.activeFabricTextBox) {
                const isI = window.CanvasStage.activeFabricTextBox.fontStyle === 'italic';
                window.CanvasStage.activeFabricTextBox.set('fontStyle', isI ? 'normal' : 'italic');
                italicBtn.classList.toggle('active', !isI);
                window.CanvasStage.fabricCanvas.renderAll();
                window.CanvasStage._saveFabricState();
                window.EditorState.pushSnapshot('Toggle Italic');
            }
        });

        textColorInput?.addEventListener('change', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.colorHex = textColorInput.value;
                window.CanvasStage.selectedBlock.modified = true;
                renderCurrentPage();
            } else if (window.CanvasStage.activeFabricTextBox) {
                window.CanvasStage.activeFabricTextBox.set('fill', textColorInput.value);
                window.CanvasStage.fabricCanvas.renderAll();
                window.CanvasStage._saveFabricState();
            }
        });

        bgColorInput?.addEventListener('change', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.bgHex = bgColorInput.value;
                window.CanvasStage.selectedBlock.modified = true;
                renderCurrentPage();
            } else if (window.CanvasStage.activeFabricTextBox) {
                window.CanvasStage.activeFabricTextBox.set('textBackgroundColor', bgColorInput.value);
                window.CanvasStage.addTextBgColor = bgColorInput.value;
                window.CanvasStage.fabricCanvas.renderAll();
                window.CanvasStage._saveFabricState();
            }
        });

        deleteBlockBtn?.addEventListener('click', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.deleted = true;
                window.EditorState.pushSnapshot('Delete Text Block');
                renderCurrentPage();
            } else if (window.CanvasStage.activeFabricTextBox) {
                window.CanvasStage.fabricCanvas.remove(window.CanvasStage.activeFabricTextBox);
                window.CanvasStage.activeFabricTextBox = null;
                window.CanvasStage.fabricCanvas.renderAll();
                window.CanvasStage._saveFabricState();
                window.CanvasStage._hideFloatingBar();
                subToolbar?.classList.add('hidden');
                window.EditorState.pushSnapshot('Delete Added Text');
            }
        });

        resetBlockBtn?.addEventListener('click', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.currentText = window.CanvasStage.selectedBlock.originalText;
                window.CanvasStage.selectedBlock.modified = false;
                window.CanvasStage.selectedBlock.deleted = false;
                window.EditorState.pushSnapshot('Reset Original Text');
                renderCurrentPage();
            }
        });

        // ====================================================
        // History & Undo / Redo
        // ====================================================

        function updateHistoryButtons() {
            if (undoBtn) undoBtn.disabled = !window.EditorState.canUndo();
            if (redoBtn) redoBtn.disabled = !window.EditorState.canRedo();
            if (undoBtn) undoBtn.classList.toggle('opacity-40', !window.EditorState.canUndo());
            if (redoBtn) redoBtn.classList.toggle('opacity-40', !window.EditorState.canRedo());
        }

        window.EditorState.subscribe((event) => {
            updateHistoryButtons();
            if (event === 'render-required') {
                renderCurrentPage();
            }
        });

        undoBtn?.addEventListener('click', () => window.EditorState.undo());
        redoBtn?.addEventListener('click', () => window.EditorState.redo());

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
            const activeFabricObj = window.CanvasStage?.fabricCanvas?.getActiveObject();
            const isFabricEditing = activeFabricObj && activeFabricObj.isEditing;

            if (e.key === 'Escape') {
                window.CanvasStage?.cancelPlacement();
                if (activeFabricObj) {
                    if (isFabricEditing) activeFabricObj.exitEditing();
                    window.CanvasStage?.fabricCanvas?.discardActiveObject();
                    window.CanvasStage?.fabricCanvas?.renderAll();
                    window.CanvasStage?._hideFloatingBar();
                }
                if (document.activeElement && document.activeElement !== document.body && typeof document.activeElement.blur === 'function') {
                    document.activeElement.blur();
                }
                if (window.CanvasStage?.selectedLink || window.CanvasStage?.selectedFormField) {
                    window.CanvasStage.selectedLink = null;
                    window.CanvasStage.selectedFormField = null;
                    document.querySelectorAll('.link-hotspot').forEach(el => el.classList.remove('selected'));
                    document.querySelectorAll('.form-field-hotspot').forEach(el => el.classList.remove('selected'));
                    window.CanvasStage?._hideFloatingBar();
                }
                hideAllSubToolbars();
                findDrawer?.classList.add('hidden');
                closeSigModal();
                toolBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === 'text-edit'));
                window.CanvasStage?.setTool('text-edit');
                window.CanvasStage?.syncCanvasOffset();
                return;
            }

            if (isTyping || isFabricEditing) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                if (e.shiftKey) {
                    window.EditorState.redo();
                } else {
                    window.EditorState.undo();
                }
                e.preventDefault();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                window.EditorState.redo();
                e.preventDefault();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
                if (activeFabricObj || window.CanvasStage?.selectedLink || window.CanvasStage?.selectedFormField) {
                    window.CanvasStage?.duplicateActiveObject();
                    e.preventDefault();
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (activeFabricObj || window.CanvasStage?.selectedLink || window.CanvasStage?.selectedFormField) {
                    window.CanvasStage?.deleteActiveObject();
                    e.preventDefault();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                findDrawer?.classList.remove('hidden');
                findInput?.focus();
                e.preventDefault();
            }
        });

        // Zoom Control
        zoomSelect?.addEventListener('change', () => {
            renderCurrentPage();
        });

        // ====================================================
        // Find & Replace Drawer
        // ====================================================

        function updateFindMatches() {
            const query = findInput?.value || '';
            activeFindMatches = window.EditorState.findMatches(query);
            activeFindIndex = 0;
            if (findCountLabel) {
                findCountLabel.textContent = activeFindMatches.length === 0
                    ? '0 found'
                    : `${activeFindIndex + 1} of ${activeFindMatches.length}`;
            }
        }

        findInput?.addEventListener('input', updateFindMatches);

        btnFindNext?.addEventListener('click', () => {
            if (activeFindMatches.length === 0) return;
            activeFindIndex = (activeFindIndex + 1) % activeFindMatches.length;
            const match = activeFindMatches[activeFindIndex];
            if (findCountLabel) {
                findCountLabel.textContent = `${activeFindIndex + 1} of ${activeFindMatches.length}`;
            }
            window.EditorState.setActivePageIndex(match.pageIndex);
            renderCurrentPage();
        });

        btnReplaceOne?.addEventListener('click', () => {
            if (activeFindMatches.length === 0) return;
            const match = activeFindMatches[activeFindIndex];
            const rep = replaceInput?.value || '';
            window.EditorState.replaceOne(match, rep);
            updateFindMatches();
            renderCurrentPage();
        });

        btnReplaceAll?.addEventListener('click', () => {
            const query = findInput?.value || '';
            const rep = replaceInput?.value || '';
            const count = window.EditorState.replaceAll(query, rep);
            showAppToast(`Replaced ${count} occurrence(s) across all pages.`);
            updateFindMatches();
            renderCurrentPage();
        });

        btnCloseFind?.addEventListener('click', () => {
            findDrawer?.classList.add('hidden');
        });

        // ====================================================
        // Signatures Studio Modal
        // ====================================================

        let sigCtx = null;
        let isDrawingSig = false;

        function openSigModal() {
            sigModal?.classList.remove('hidden');
            if (sigDrawCanvas && !sigCtx) {
                sigCtx = sigDrawCanvas.getContext('2d');
                sigCtx.lineWidth = 2.5;
                sigCtx.lineCap = 'round';
                sigCtx.lineJoin = 'round';
                sigCtx.strokeStyle = '#1e293b';

                sigDrawCanvas.addEventListener('mousedown', (e) => {
                    const rect = sigDrawCanvas.getBoundingClientRect();
                    isDrawingSig = true;
                    sigCtx.beginPath();
                    sigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                });

                sigDrawCanvas.addEventListener('mousemove', (e) => {
                    if (!isDrawingSig) return;
                    const rect = sigDrawCanvas.getBoundingClientRect();
                    sigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                    sigCtx.stroke();
                });

                window.addEventListener('mouseup', () => {
                    isDrawingSig = false;
                });
            }
        }

        function closeSigModal() {
            sigModal?.classList.add('hidden');
        }

        btnCloseSigModal?.addEventListener('click', closeSigModal);
        btnClearSigDraw?.addEventListener('click', () => {
            if (sigCtx && sigDrawCanvas) {
                sigCtx.clearRect(0, 0, sigDrawCanvas.width, sigDrawCanvas.height);
            }
        });

        function selectSigTab(activeTab) {
            const tabs = [
                { btn: sigTabDrawBtn, pane: sigPaneDraw, id: 'draw' },
                { btn: sigTabTypeBtn, pane: sigPaneType, id: 'type' },
                { btn: sigTabUploadBtn, pane: sigPaneUpload, id: 'upload' },
            ];
            tabs.forEach(t => {
                const isActive = t.id === activeTab;
                if (t.btn) {
                    t.btn.className = isActive
                        ? 'px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-bold text-xs'
                        : 'px-4 py-2 border-b-2 border-transparent text-slate-500 font-bold text-xs';
                }
                if (t.pane) {
                    t.pane.classList.toggle('hidden', !isActive);
                }
            });
        }

        sigTabDrawBtn?.addEventListener('click', () => selectSigTab('draw'));
        sigTabTypeBtn?.addEventListener('click', () => selectSigTab('type'));
        sigTabUploadBtn?.addEventListener('click', () => selectSigTab('upload'));

        // Upload Picture Signature Logic
        let currentUploadedSigImg = null;

        function processSignatureUpload(img, removeBg = true) {
            if (!sigUploadCanvas || !img) return;
            const maxW = 500;
            const maxH = 200;
            let w = img.width;
            let h = img.height;
            if (w > maxW || h > maxH) {
                const ratio = Math.min(maxW / w, maxH / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            sigUploadCanvas.width = w;
            sigUploadCanvas.height = h;
            const ctx = sigUploadCanvas.getContext('2d', { willReadFrequently: true });
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);

            if (removeBg) {
                const imgData = ctx.getImageData(0, 0, w, h);
                const d = imgData.data;
                for (let i = 0; i < d.length; i += 4) {
                    const r = d[i], g = d[i + 1], b = d[i + 2];
                    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                    if (lum > 220) {
                        d[i + 3] = 0; // Pure background
                    } else if (lum > 175) {
                        const factor = (220 - lum) / 45;
                        d[i + 3] = Math.round(d[i + 3] * factor);
                    } else {
                        d[i] = Math.round(r * 0.4);
                        d[i + 1] = Math.round(g * 0.4);
                        d[i + 2] = Math.round(b * 0.4);
                    }
                }
                ctx.putImageData(imgData, 0, 0);
            }

            sigUploadDropzone?.classList.add('hidden');
            sigUploadPreviewWrap?.classList.remove('hidden');
        }

        function handleSigUploadFile(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    currentUploadedSigImg = img;
                    processSignatureUpload(img, sigRemoveBgToggle ? sigRemoveBgToggle.checked : true);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        sigUploadDropzone?.addEventListener('click', () => {
            sigUploadFileInput?.click();
        });

        sigUploadDropzone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            sigUploadDropzone.classList.add('border-blue-500', 'bg-blue-50/50');
        });

        sigUploadDropzone?.addEventListener('dragleave', () => {
            sigUploadDropzone.classList.remove('border-blue-500', 'bg-blue-50/50');
        });

        sigUploadDropzone?.addEventListener('drop', (e) => {
            e.preventDefault();
            sigUploadDropzone.classList.remove('border-blue-500', 'bg-blue-50/50');
            const file = e.dataTransfer?.files?.[0];
            if (file) handleSigUploadFile(file);
        });

        sigUploadFileInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) handleSigUploadFile(file);
        });

        sigRemoveBgToggle?.addEventListener('change', () => {
            if (currentUploadedSigImg) {
                processSignatureUpload(currentUploadedSigImg, sigRemoveBgToggle.checked);
            }
        });

        btnClearSigUpload?.addEventListener('click', () => {
            currentUploadedSigImg = null;
            if (sigUploadFileInput) sigUploadFileInput.value = '';
            sigUploadPreviewWrap?.classList.add('hidden');
            sigUploadDropzone?.classList.remove('hidden');
            if (sigUploadCanvas) {
                const ctx = sigUploadCanvas.getContext('2d');
                ctx.clearRect(0, 0, sigUploadCanvas.width, sigUploadCanvas.height);
            }
        });

        btnApplySignature?.addEventListener('click', () => {
            let dataUrl = null;
            if (!sigPaneDraw?.classList.contains('hidden') && sigDrawCanvas) {
                dataUrl = sigDrawCanvas.toDataURL('image/png');
            } else if (!sigPaneType?.classList.contains('hidden')) {
                const text = sigTypeInput?.value || 'Signature';
                const off = document.createElement('canvas');
                off.width = 400;
                off.height = 120;
                const c = off.getContext('2d');
                c.font = '36px "Brush Script MT", cursive';
                c.fillStyle = '#1e293b';
                c.textAlign = 'center';
                c.textBaseline = 'middle';
                c.fillText(text, 200, 60);
                dataUrl = off.toDataURL('image/png');
            } else if (!sigPaneUpload?.classList.contains('hidden') && sigUploadCanvas) {
                dataUrl = sigUploadCanvas.toDataURL('image/png');
            }

            if (dataUrl) {
                closeSigModal();
                window.CanvasStage.startPlacement('signature', dataUrl);
            }
        });

        // ====================================================
        // Export Modal & Download
        // ====================================================

        applyChangesBtn?.addEventListener('click', () => {
            exportModal?.classList.remove('hidden');
            exportProgressWrap?.classList.add('hidden');
            exportResultWrap?.classList.add('hidden');
            btnConfirmExport.disabled = false;
        });

        btnCloseExportModal?.addEventListener('click', () => {
            exportModal?.classList.add('hidden');
        });

        btnConfirmExport?.addEventListener('click', async () => {
            btnConfirmExport.disabled = true;
            exportProgressWrap?.classList.remove('hidden');
            exportResultWrap?.classList.add('hidden');

            try {
                lastExportedBytes = await window.PdfExporter.exportPdf({
                    flattenForms: optFlattenForms?.checked || false,
                    flattenEditedPages: optFlattenRedact?.checked || false,
                    onProgress: (pct, msg) => {
                        if (exportProgressBar) exportProgressBar.style.width = `${pct}%`;
                        if (exportProgressText) exportProgressText.textContent = msg;
                    },
                });

                exportProgressWrap?.classList.add('hidden');
                exportResultWrap?.classList.remove('hidden');
            } catch (err) {
                console.error('Export error:', err);
                showAppToast('Export failed: ' + err.message, 'error');
                btnConfirmExport.disabled = false;
                exportProgressWrap?.classList.add('hidden');
            }
        });

        btnDownloadExported?.addEventListener('click', () => {
            if (!lastExportedBytes) return;
            const fname = exportFilenameInput?.value || 'document-edited.pdf';
            window.PDFCore.downloadBlob(lastExportedBytes, fname, 'application/pdf');
        });

        resetEditorBtn?.addEventListener('click', () => {
            showAppConfirm(
                'Open New PDF',
                'Discard all unsaved edits and return to upload?',
                'Discard & Reset',
                () => {
                    window.EditorState.reset();
                    if (workspaceSection) workspaceSection.classList.add('hidden');
                    if (heroSection) heroSection.classList.remove('hidden');
                    if (fileInput) fileInput.value = '';
                }
            );
        });
    });
})(window, document);
