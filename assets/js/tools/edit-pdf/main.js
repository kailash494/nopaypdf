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
        const stageDomLayer = document.getElementById('stage-dom-layer');
        const stageFabricCanvas = document.getElementById('stage-fabric-canvas');

        // Thumbnail Rail
        const thumbnailRailList = document.getElementById('thumbnail-rail-list');
        const toggleRailBtn = document.getElementById('toggle-rail-btn');
        const thumbnailRail = document.getElementById('thumbnail-rail');
        const addBlankPageBtn = document.getElementById('add-blank-page-btn');
        const deletePageBtn = document.getElementById('delete-page-btn');

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

        // Hidden Image Input
        const hiddenImgInput = document.getElementById('hidden-image-input');

        // Internal State
        let currentPdfProxy = null;
        let lastExportedBytes = null;
        let activeFindMatches = [];
        let activeFindIndex = 0;

        // Initialize Stage
        window.CanvasStage.init(stageStack, stageBaseCanvas, stageDomLayer, stageFabricCanvas);

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

            // Initialize EditorState
            window.EditorState.initializePages(pagesMeta, fileName, arrayBuffer);
            // Attach extracted blocks
            window.EditorState.pages.forEach((p, idx) => {
                p.textBlocks = allPagesBlocks[idx] || [];
            });

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
            thumbnailRail?.classList.toggle('hidden');
        });

        addBlankPageBtn?.addEventListener('click', async () => {
            window.EditorState.insertBlankPage();
            renderThumbnailRail();
            await renderCurrentPage();
        });

        deletePageBtn?.addEventListener('click', async () => {
            if (confirm(`Delete Page ${window.EditorState.activePageIndex + 1}?`)) {
                if (window.EditorState.deletePage()) {
                    renderThumbnailRail();
                    await renderCurrentPage();
                }
            }
        });

        // ====================================================
        // Toolbar State & Tool Dispatch
        // ====================================================

        toolBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                toolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                window.CanvasStage.setTool(tool);

                if (tool === 'add-text') {
                    window.CanvasStage.addFabricText('New Text', {
                        fontSize: parseInt(fontSizeInput?.value || '18', 10),
                        fill: textColorInput?.value || '#1e293b',
                    });
                } else if (tool === 'whiteout') {
                    window.CanvasStage.addWhiteoutBox();
                } else if (tool === 'shapes') {
                    window.CanvasStage.addShape('rect');
                } else if (tool === 'images') {
                    hiddenImgInput?.click();
                } else if (tool === 'sign') {
                    openSigModal();
                } else if (tool === 'forms') {
                    createFormFieldPrompt();
                }
            });
        });

        hiddenImgInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                window.CanvasStage.stampImage(evt.target.result);
                hiddenImgInput.value = '';
            };
            reader.readAsDataURL(file);
        });

        function createFormFieldPrompt() {
            const type = prompt('Choose Form Field Type: "text", "textarea", "checkbox", or "dropdown"', 'text');
            if (!type) return;
            const normType = type.toLowerCase().trim();
            if (!['text', 'textarea', 'checkbox', 'dropdown'].includes(normType)) {
                alert('Invalid field type. Choose text, textarea, checkbox, or dropdown.');
                return;
            }

            const name = prompt('Enter unique field name (e.g. fullName):', `field_${Date.now().toString(36)}`);
            if (!name) return;

            const page = window.EditorState.getActivePage();
            if (!page) return;

            page.formFields.push({
                id: `ff-${Date.now().toString(36)}`,
                type: normType,
                name,
                rect: [100, 100, normType === 'checkbox' ? 24 : 160, normType === 'checkbox' ? 24 : 32],
                defaultValue: '',
                checked: false,
                options: normType === 'dropdown' ? ['Option A', 'Option B', 'Option C'] : [],
            });
            page.hasEdits = true;
            window.EditorState.pushSnapshot(`Add ${normType} field`);
            renderCurrentPage();
        }

        // ====================================================
        // Contextual Sub-Toolbar & Block Editing
        // ====================================================

        window.addEventListener('editor:block-selected', (e) => {
            const block = e.detail?.block;
            if (!block) {
                subToolbar?.classList.add('hidden');
                return;
            }

            subToolbar?.classList.remove('hidden');
            const fontTierPill = document.getElementById('sub-font-tier-pill');
            if (fontTierPill) {
                fontTierPill.classList.remove('hidden');
                if (block.tier === 1) {
                    fontTierPill.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200';
                    fontTierPill.textContent = `Embedded: ${block.realName}`;
                } else {
                    fontTierPill.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200';
                    fontTierPill.textContent = `Matched: ${block.matched?.name || 'Liberation Sans'}`;
                }
            }

            if (fontSelect) fontSelect.value = block.tier === 1 ? 'original' : (block.matched?.local || 'sans');
            if (fontSizeInput) fontSizeInput.value = Math.round(block.fontSizePt || 12);
            if (boldBtn) {
                boldBtn.classList.toggle('active', Boolean(block.bold));
            }
            if (italicBtn) {
                italicBtn.classList.toggle('active', Boolean(block.italic));
            }
            if (textColorInput) textColorInput.value = block.colorHex || '#1e293b';
            if (bgColorInput) bgColorInput.value = block.bgHex || '#ffffff';
        });

        fontSelect?.addEventListener('change', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.fontFamily = fontSelect.value;
                window.CanvasStage.selectedBlock.modified = true;
                window.EditorState.pushSnapshot('Change Font Family');
                renderCurrentPage();
            }
        });

        fontSizeInput?.addEventListener('input', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.fontSizePt = parseFloat(fontSizeInput.value) || 12;
                window.CanvasStage.selectedBlock.modified = true;
                renderCurrentPage();
            }
        });

        boldBtn?.addEventListener('click', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.bold = !window.CanvasStage.selectedBlock.bold;
                window.CanvasStage.selectedBlock.modified = true;
                boldBtn.classList.toggle('active', window.CanvasStage.selectedBlock.bold);
                window.EditorState.pushSnapshot('Toggle Bold');
                renderCurrentPage();
            }
        });

        italicBtn?.addEventListener('click', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.italic = !window.CanvasStage.selectedBlock.italic;
                window.CanvasStage.selectedBlock.modified = true;
                italicBtn.classList.toggle('active', window.CanvasStage.selectedBlock.italic);
                window.EditorState.pushSnapshot('Toggle Italic');
                renderCurrentPage();
            }
        });

        textColorInput?.addEventListener('input', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.colorHex = textColorInput.value;
                window.CanvasStage.selectedBlock.modified = true;
                renderCurrentPage();
            }
        });

        bgColorInput?.addEventListener('input', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.bgHex = bgColorInput.value;
                window.CanvasStage.selectedBlock.modified = true;
                renderCurrentPage();
            }
        });

        deleteBlockBtn?.addEventListener('click', () => {
            if (window.CanvasStage.selectedBlock) {
                window.CanvasStage.selectedBlock.deleted = true;
                window.EditorState.pushSnapshot('Delete Text Block');
                renderCurrentPage();
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
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

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
            alert(`Replaced ${count} occurrence(s) across all pages.`);
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

        sigTabDrawBtn?.addEventListener('click', () => {
            sigTabDrawBtn.className = 'px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-bold text-xs';
            sigTabTypeBtn.className = 'px-4 py-2 border-b-2 border-transparent text-slate-500 font-bold text-xs';
            sigPaneDraw?.classList.remove('hidden');
            sigPaneType?.classList.add('hidden');
        });

        sigTabTypeBtn?.addEventListener('click', () => {
            sigTabTypeBtn.className = 'px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-bold text-xs';
            sigTabDrawBtn.className = 'px-4 py-2 border-b-2 border-transparent text-slate-500 font-bold text-xs';
            sigPaneType?.classList.remove('hidden');
            sigPaneDraw?.classList.add('hidden');
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
            }

            if (dataUrl) {
                window.CanvasStage.stampSignature(dataUrl);
                closeSigModal();
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
                alert('Export failed: ' + err.message);
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
            if (confirm('Discard all unsaved edits and open another PDF?')) {
                window.EditorState.reset();
                if (workspaceSection) workspaceSection.classList.add('hidden');
                if (heroSection) heroSection.classList.remove('hidden');
                if (fileInput) fileInput.value = '';
            }
        });
    });
})(window, document);
