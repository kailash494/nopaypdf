/**
 * NoPayPDF - Canvas Stage Module (window.CanvasStage)
 *
 * Orchestrates the 3-Layer Synchronized Page Stack:
 * Layer 1: PDF.js Base Canvas (High-DPI)
 * Layer 2: Interactive DOM Overlay (Existing-Text, Links, Forms)
 * Layer 3: Fabric.js Vector Canvas (Annotations, Whiteout, Signatures, Shapes)
 * 100% Client-Side. Permissive MIT / Apache 2.0 compatible.
 */

(function (window, document) {
    'use strict';

    class CanvasStageController {
        constructor() {
            this.container = null;
            this.baseCanvas = null;
            this.domLayer = null;
            this.fabricCanvasEl = null;
            this.fabricCanvas = null;
            this.currentPdfProxy = null;
            this.currentScale = 1.0;
            this.activeTool = 'text-edit'; // 'text-edit'|'add-text'|'links'|'forms'|'whiteout'|'annotate'|'shapes'|'draw'|'images'|'sign'
            this.selectedBlock = null;
            this.selectedFormField = null;
            this.selectedLink = null;
            this.isDrawingLink = false;
            this.linkDrawStart = null;
            this.placementMode = null;
            this.formPlacementType = null;
            this._isRestoring = false;
            this._onPlacementMove = null;
            this._onPlacementClick = null;
        }

        init(containerEl, baseCanvasEl, domLayerEl, fabricCanvasEl) {
            this.container = containerEl;
            this.baseCanvas = baseCanvasEl;
            this.domLayer = domLayerEl;
            this.fabricCanvasEl = fabricCanvasEl;

            // Initialize Fabric.js
            if (window.fabric && !this.fabricCanvas) {
                this.fabricCanvas = new fabric.Canvas(this.fabricCanvasEl, {
                    selection: true,
                    preserveObjectStacking: true,
                    fireRightClick: true,
                    stopContextMenu: true,
                });

                this.fabricCanvas.on('object:modified', () => {
                    if (!this._isRestoring) {
                        this._saveFabricState();
                        window.EditorState.pushSnapshot('Modify Object');
                    }
                    this._updateFloatingBar();
                });

                this.fabricCanvas.on('object:added', () => {
                    if (!this._isRestoring) {
                        this._saveFabricState();
                    }
                });

                this.fabricCanvas.on('object:removed', () => {
                    if (!this._isRestoring) {
                        this._saveFabricState();
                    }
                });

                this.fabricCanvas.on('path:created', (e) => {
                    if (!this._isRestoring) {
                        if (e.path) e.path.set({ lockUniScaling: true });
                        this._saveFabricState();
                        window.EditorState.pushSnapshot('Freehand Drawing');
                    }
                });

                this.fabricCanvas.on('selection:created', () => this._onFabricSelection());
                this.fabricCanvas.on('selection:updated', () => this._onFabricSelection());
                this.fabricCanvas.on('selection:cleared', () => this._onFabricSelectionCleared());
                this.fabricCanvas.on('object:moving', () => this._hideFloatingBar());
                this.fabricCanvas.on('object:scaling', () => this._hideFloatingBar());
                this.fabricCanvas.on('object:rotating', () => this._hideFloatingBar());

                this.fabricCanvas.on('mouse:down', (opt) => {
                    if (this.activeTool === 'add-text') {
                        if (opt.target) return;
                        const pointer = this.fabricCanvas.getPointer(opt.e);
                        const fontSize = parseInt(document.getElementById('sub-font-size')?.value || '18', 10);
                        const fill = document.getElementById('sub-text-color')?.value || '#1e293b';

                        const t = new fabric.IText('New Text', {
                            left: pointer.x,
                            top: pointer.y,
                            fontSize: fontSize,
                            fill: fill,
                            fontFamily: 'Liberation Sans',
                            lockUniScaling: true,
                            cornerSize: 8,
                            transparentCorners: false,
                        });
                        this.fabricCanvas.add(t);
                        this.fabricCanvas.setActiveObject(t);
                        t.enterEditing();
                        t.selectAll();
                        this.fabricCanvas.renderAll();
                        this._saveFabricState();
                        window.EditorState.pushSnapshot('Add Text');
                        this._updateFloatingBar();
                        this.setTool('text-edit');
                        const toolBtns = document.querySelectorAll('.tool-btn');
                        toolBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === 'text-edit'));
                    }
                });
            }

            this._setupFloatingBarEvents();
            this._setupLinkDrawing();
            this._setupDomLayerClickDismiss();
        }

        setTool(tool) {
            this.activeTool = tool;
            this._updatePointerEvents();

            if (!this.fabricCanvas) return;

            // Configure Fabric based on tool
            this.fabricCanvas.isDrawingMode = (tool === 'draw');
            if (tool === 'draw') {
                this.fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(this.fabricCanvas);
                this.fabricCanvas.freeDrawingBrush.width = 3;
                this.fabricCanvas.freeDrawingBrush.color = '#2563eb';
            }

            if (tool === 'text-edit') {
                this.fabricCanvas.defaultCursor = 'default';
                this.fabricCanvas.discardActiveObject();
                this.fabricCanvas.renderAll();
                this._hideFloatingBar();
            } else if (tool === 'add-text') {
                this.fabricCanvas.defaultCursor = 'crosshair';
                this.fabricCanvas.discardActiveObject();
                this.fabricCanvas.renderAll();
                this._hideFloatingBar();
            } else {
                this.fabricCanvas.defaultCursor = 'default';
            }
        }

        _updatePointerEvents() {
            const isDomTool = ['text-edit', 'links', 'forms'].includes(this.activeTool);
            const fabricWrap = this.container.querySelector('.stage-layer-fabric-wrap');

            if (fabricWrap) {
                if (isDomTool) {
                    fabricWrap.classList.remove('interactive');
                    this.domLayer.style.pointerEvents = 'auto';
                } else {
                    fabricWrap.classList.add('interactive');
                    this.domLayer.style.pointerEvents = 'none';
                }
            }
        }

        _saveFabricState() {
            if (this._isRestoring) return;
            const page = window.EditorState.getActivePage();
            if (page && this.fabricCanvas) {
                page.fabricJson = this.fabricCanvas.toJSON(['id', 'toolType', 'isWhiteout', 'isSignature', 'lockUniScaling']);
                page.hasEdits = true;
            }
        }

        /**
         * Render active page at the specified scale.
         * @param {Object} pdfProxy PDFDocumentProxy from PDF.js
         * @param {number} scale
         */
        async renderPage(pdfProxy, scale = null) {
            this.currentPdfProxy = pdfProxy;
            const pageState = window.EditorState.getActivePage();
            if (!pageState) return;

            if (scale) this.currentScale = scale;

            const widthPt = pageState.widthPt || 612;
            const heightPt = pageState.heightPt || 792;
            const viewportWidth = Math.round(widthPt * this.currentScale);
            const viewportHeight = Math.round(heightPt * this.currentScale);

            // 1. Resize Stage Container
            this.container.style.width = `${viewportWidth}px`;
            this.container.style.height = `${viewportHeight}px`;

            // 2. Render Layer 1: Base PDF.js Canvas
            await this._renderBaseCanvas(pageState, viewportWidth, viewportHeight);

            // 3. Render Layer 2: Interactive DOM Overlay
            this._renderDomLayer(pageState, viewportWidth, viewportHeight);

            // 4. Render Layer 3: Fabric.js Canvas
            this._renderFabricLayer(pageState, viewportWidth, viewportHeight);

            this._updatePointerEvents();
        }

        async _renderBaseCanvas(pageState, viewportWidth, viewportHeight) {
            const dpr = window.devicePixelRatio || 1;
            this.baseCanvas.width = viewportWidth * dpr;
            this.baseCanvas.height = viewportHeight * dpr;
            this.baseCanvas.style.width = `${viewportWidth}px`;
            this.baseCanvas.style.height = `${viewportHeight}px`;

            const ctx = this.baseCanvas.getContext('2d');
            ctx.scale(dpr, dpr);

            if (pageState.sourcePageIndex === null || !this.currentPdfProxy) {
                // Blank inserted page: fill crisp white
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, viewportWidth, viewportHeight);
                return;
            }

            try {
                const pdfPage = await this.currentPdfProxy.getPage(pageState.sourcePageIndex + 1);
                const viewport = pdfPage.getViewport({
                    scale: this.currentScale,
                    rotation: pageState.rotation || 0,
                });

                await pdfPage.render({
                    canvasContext: ctx,
                    viewport,
                }).promise;

                // Auto-sample authoritative background & text colors from clean rendered baseCanvas using official viewport
                if (window.TextExtractor && pageState.textBlocks.length > 0 && !pageState.textBlocks[0].sampled) {
                    pageState.textBlocks.forEach(b => {
                        b.pageWidthPt = pageState.widthPt || 612;
                        b.sampled = true;
                    });
                    window.TextExtractor.sampleBlockColors(this.baseCanvas, pageState.textBlocks, viewport);
                }
            } catch (err) {
                console.error('Base canvas render error:', err);
            }
        }

        getMeasureContext() {
            if (!this._measureCtx) {
                const c = document.createElement('canvas');
                this._measureCtx = c.getContext('2d');
            }
            return this._measureCtx;
        }

        _checkUnicodeSafe(loadedName, originalText, expectedWidthPx, measureCtx) {
            if (!loadedName || !originalText || !measureCtx) return false;
            try {
                if (document.fonts && typeof document.fonts.check === 'function') {
                    if (!document.fonts.check(`16px "${loadedName}"`)) {
                        return false;
                    }
                }
                measureCtx.font = `16px "${loadedName}"`;
                const measured16 = measureCtx.measureText(originalText).width;
                if (!measured16 || measured16 <= 0) return false;

                measureCtx.font = '16px "Liberation Sans", sans-serif';
                const measuredSans = measureCtx.measureText(originalText).width;
                if (measuredSans > 0) {
                    const ratio = measured16 / measuredSans;
                    if (ratio < 0.4 || ratio > 2.2) return false;
                }
                return true;
            } catch (e) {
                return false;
            }
        }

        _renderDomLayer(pageState, viewportWidth, viewportHeight) {
            this.domLayer.innerHTML = '';
            const scale = this.currentScale;
            const pageHeightPt = pageState.heightPt;
            const measureCtx = this.getMeasureContext();

            // A. Render Text Hitboxes
            for (const block of pageState.textBlocks) {
                const baselineY = (pageHeightPt - (block.baselinePdfY !== undefined ? block.baselinePdfY : block.pdfY)) * scale;
                const ascentRatio = block.ascentRatio || 0.85;
                const descentRatio = block.descentRatio || -0.20;
                const fontSizePx = block.fontSizePt * scale;

                const topPx = baselineY - (fontSizePx * ascentRatio);
                const leftPx = block.pdfX * scale;

                // Determine font family: Tier 1 uses exact PDF.js loadedName
                const hasCoverage = window.FontManager.checkEmbeddedCoverage(block.embeddedBytes, block.currentText);
                block.tier = hasCoverage ? 1 : 2;

                const matchedName = block.matched?.name || 'Liberation Sans';
                const isUnicodeSafe = this._checkUnicodeSafe(block.loadedName, block.originalText, (block.origPdfWidth || block.pdfWidth) * scale, measureCtx);
                block.isUnicodeSafe = isUnicodeSafe;

                let cssFontFamily;
                if (block.fontFamily && window.FontManager && typeof window.FontManager.getCssFamily === 'function') {
                    cssFontFamily = `"${window.FontManager.getCssFamily(block.fontFamily)}", "Liberation Sans", sans-serif`;
                } else if ((block.tier === 1 || isUnicodeSafe) && block.loadedName) {
                    // Native hybrid stack: exact original glyphs for existing characters, matched fallback for new characters
                    cssFontFamily = `"${block.loadedName}", "${matchedName}", "Liberation Sans", sans-serif`;
                } else {
                    cssFontFamily = `"${matchedName}", "Liberation Sans", sans-serif`;
                }

                let currentPdfW = block.pdfWidth;
                if (block.modified && block.currentText && measureCtx) {
                    measureCtx.font = `${block.italic ? 'italic ' : ''}${block.bold ? '700 ' : '400 '}${fontSizePx}px ${cssFontFamily}`;
                    const measuredW = measureCtx.measureText(block.currentText).width;
                    if (measuredW > 0) {
                        currentPdfW = Math.max(block.origPdfWidth || block.pdfWidth, measuredW / scale);
                        block.pdfWidth = currentPdfW;
                    }
                }
                const widthPx = Math.max(8, currentPdfW * scale);
                const heightPx = Math.max(10, fontSizePx * (ascentRatio + Math.abs(descentRatio)));

                const el = document.createElement('div');
                el.className = 'text-hitbox';
                el.dataset.id = block.id;
                el.style.left = `${leftPx}px`;
                el.style.top = `${topPx}px`;
                el.style.width = `${widthPx}px`;
                el.style.height = `${heightPx}px`;
                el.style.fontSize = `${fontSizePx}px`;

                el.style.fontFamily = cssFontFamily;
                el.style.fontWeight = block.bold ? '700' : '400';
                el.style.fontStyle = block.italic ? 'italic' : 'normal';
                el.style.color = block.colorHex || '#1e293b';

                // Calibrate letter-spacing to match original PDF character advances
                let letterSpacingPx = 0;
                const expectedOrigPx = (block.origPdfWidth || block.pdfWidth) * scale;
                if (block.originalText && block.originalText.length > 1 && measureCtx) {
                    measureCtx.font = `${block.italic ? 'italic ' : ''}${block.bold ? '700 ' : '400 '}${fontSizePx}px ${cssFontFamily}`;
                    const measuredW = measureCtx.measureText(block.originalText).width;
                    if (measuredW > 0) {
                        letterSpacingPx = (expectedOrigPx - measuredW) / (block.originalText.length - 1);
                        letterSpacingPx = Math.max(-2.0, Math.min(3.5, letterSpacingPx));
                        block.widthRatio = expectedOrigPx / measuredW;
                    }
                }
                block.letterSpacingPx = letterSpacingPx;
                el.style.letterSpacing = `${letterSpacingPx.toFixed(2)}px`;

                if (block.deleted) {
                    el.classList.add('deleted');
                    el.textContent = block.currentText;
                } else if (block.modified) {
                    el.classList.add('modified');
                    const effectiveBg = (block.bgHex && block.bgHex !== 'transparent')
                        ? block.bgHex
                        : (block.autoBgHex || '#ffffff');
                    el.style.backgroundColor = effectiveBg;
                    el.textContent = block.currentText;
                } else {
                    el.textContent = ''; // Transparent overlay over original crisp PDF.js canvas
                }

                // Click to edit
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._activateTextEdit(block, el);
                });

                this.domLayer.appendChild(el);
            }

            // B. Render Native Links
            for (const link of pageState.links) {
                const [lx, ly, lw, lh] = link.rect.map(v => v * scale);
                const linkEl = document.createElement('div');
                linkEl.className = 'link-hotspot';
                if (this.selectedLink && this.selectedLink.id === link.id) {
                    linkEl.classList.add('selected');
                }
                linkEl.style.left = `${lx}px`;
                linkEl.style.top = `${ly}px`;
                linkEl.style.width = `${lw}px`;
                linkEl.style.height = `${lh}px`;

                const badge = document.createElement('span');
                badge.className = 'link-badge';
                badge.textContent = link.type === 'page' ? `Jump: P.${link.target}` : (link.target || 'URL');
                linkEl.appendChild(badge);

                linkEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectedLink = link;
                    this.selectedFormField = null;
                    if (this.fabricCanvas) this.fabricCanvas.discardActiveObject();
                    document.querySelectorAll('.link-hotspot').forEach(el => el.classList.remove('selected'));
                    document.querySelectorAll('.form-field-hotspot').forEach(el => el.classList.remove('selected'));
                    linkEl.classList.add('selected');
                    this._updateFloatingBar();
                });

                linkEl.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    this._openLinkConfig(link);
                });

                this.domLayer.appendChild(linkEl);
            }

            // C. Render AcroForm Fields
            for (const field of pageState.formFields) {
                const [fx, fy, fw, fh] = field.rect.map(v => v * scale);
                const fieldEl = document.createElement('div');
                fieldEl.className = 'form-field-hotspot';
                if (this.selectedFormField && this.selectedFormField.id === field.id) {
                    fieldEl.classList.add('selected');
                }
                fieldEl.style.left = `${fx}px`;
                fieldEl.style.top = `${fy}px`;
                fieldEl.style.width = `${fw}px`;
                fieldEl.style.height = `${fh}px`;

                const label = document.createElement('span');
                label.className = 'form-field-badge';
                label.textContent = `${field.type.toUpperCase()}: ${field.name}`;
                fieldEl.appendChild(label);

                fieldEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectedFormField = field;
                    this.selectedLink = null;
                    if (this.fabricCanvas) this.fabricCanvas.discardActiveObject();
                    document.querySelectorAll('.link-hotspot').forEach(el => el.classList.remove('selected'));
                    document.querySelectorAll('.form-field-hotspot').forEach(el => el.classList.remove('selected'));
                    fieldEl.classList.add('selected');
                    this._updateFloatingBar();
                });

                fieldEl.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    this._openFormFieldConfig(field);
                });

                this.domLayer.appendChild(fieldEl);
            }
        }

        _activateTextEdit(block, el) {
            this.selectedBlock = block;
            el.classList.add('editing');
            el.innerHTML = '';
            const effectiveBg = (block.bgHex && block.bgHex !== 'transparent')
                ? block.bgHex
                : (block.autoBgHex || '#ffffff');
            el.style.backgroundColor = effectiveBg;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'text-inline-input';
            input.value = block.currentText;
            input.style.color = block.colorHex || '#1e293b';
            input.style.fontFamily = el.style.fontFamily;
            input.style.fontSize = el.style.fontSize;
            input.style.fontWeight = el.style.fontWeight;
            input.style.fontStyle = el.style.fontStyle;
            input.style.letterSpacing = el.style.letterSpacing;

            // Create Floating Quick-Action Bar above active text box
            const quickBar = document.createElement('div');
            quickBar.className = 'text-quick-bar';

            const fontPill = document.createElement('span');
            fontPill.className = `text-quick-pill ${block.tier === 1 ? '' : 'tier2'}`;
            const displayName = block.baseFontName || block.realName || 'Original';
            fontPill.textContent = block.tier === 1 ? `Original: ${displayName}` : `Matched: ${block.matched?.name || 'Liberation Sans'}`;
            quickBar.appendChild(fontPill);

            // Revert Button
            const revertBtn = document.createElement('button');
            revertBtn.type = 'button';
            revertBtn.className = 'text-quick-btn text-slate-700 bg-slate-100 hover:bg-slate-200';
            revertBtn.textContent = 'Revert';
            revertBtn.title = 'Revert to original PDF text';
            revertBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = block.originalText;
                block.currentText = block.originalText;
                block.modified = false;
                const page = window.EditorState.getActivePage();
                if (page) page.hasEdits = true;
                window.EditorState.pushSnapshot(`Revert Line: "${block.originalText}"`);
                input.blur();
            });
            quickBar.appendChild(revertBtn);

            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'text-quick-btn text-rose-700 bg-rose-50 text-quick-btn-danger';
            deleteBtn.textContent = 'Delete';
            deleteBtn.title = 'Delete line (mask completely)';
            deleteBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                block.deleted = true;
                const page = window.EditorState.getActivePage();
                if (page) page.hasEdits = true;
                window.EditorState.pushSnapshot(`Delete Line: "${block.originalText}"`);
                input.blur();
            });
            quickBar.appendChild(deleteBtn);

            el.appendChild(quickBar);
            el.appendChild(input);
            input.focus();
            input.select();

            // Real-time subset coverage check and dynamic width expansion on typing
            input.addEventListener('input', () => {
                const val = input.value;
                const covered = window.FontManager.checkEmbeddedCoverage(block.embeddedBytes, val);
                const matchedName = block.matched?.name || 'Liberation Sans';
                if (covered) {
                    block.tier = 1;
                    fontPill.className = 'text-quick-pill';
                    fontPill.textContent = `Original: ${displayName}`;
                    input.style.fontFamily = `"${block.loadedName}", "${matchedName}", "Liberation Sans", sans-serif`;
                } else {
                    block.tier = 2;
                    fontPill.className = 'text-quick-pill tier2';
                    fontPill.textContent = `Matched: ${matchedName}`;
                    if (block.isUnicodeSafe && block.loadedName) {
                        input.style.fontFamily = `"${block.loadedName}", "${matchedName}", "Liberation Sans", sans-serif`;
                    } else {
                        input.style.fontFamily = `"${matchedName}", "Liberation Sans", sans-serif`;
                    }
                    window.FontManager.loadWebFont(block.matched);
                }

                // Dynamically expand element width if typed text exceeds original width
                const measureCtx = this.getMeasureContext();
                if (measureCtx) {
                    measureCtx.font = `${block.italic ? 'italic ' : ''}${block.bold ? '700 ' : '400 '}${block.fontSizePt * this.currentScale}px ${input.style.fontFamily}`;
                    const measuredW = measureCtx.measureText(val).width;
                    const origW = Math.max(8, (block.origPdfWidth || block.pdfWidth) * this.currentScale);
                    const newW = Math.max(origW, measuredW + 8);
                    el.style.width = `${newW}px`;
                }
            });

            const finishEdit = () => {
                const newVal = input.value;
                if (newVal !== block.currentText) {
                    block.currentText = newVal;
                    block.modified = true;
                    const measureCtx = this.getMeasureContext();
                    if (measureCtx) {
                        measureCtx.font = `${block.italic ? 'italic ' : ''}${block.bold ? '700 ' : '400 '}${block.fontSizePt * this.currentScale}px ${el.style.fontFamily}`;
                        const measuredW = measureCtx.measureText(newVal).width;
                        if (measuredW > 0) {
                            block.pdfWidth = Math.max(block.origPdfWidth || block.pdfWidth, measuredW / this.currentScale);
                        }
                    }
                    const page = window.EditorState.getActivePage();
                    if (page) page.hasEdits = true;
                    window.EditorState.pushSnapshot(`Edit Text: "${newVal}"`);
                }
                el.classList.remove('editing');
                this.renderPage(this.currentPdfProxy);
                this._syncContextSubToolbar(block);
            };

            input.addEventListener('blur', finishEdit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                } else if (e.key === 'Escape') {
                    input.value = block.currentText;
                    input.blur();
                }
            });

            this._syncContextSubToolbar(block);
        }

        _syncContextSubToolbar(block) {
            const event = new CustomEvent('editor:block-selected', { detail: { block } });
            window.dispatchEvent(event);
        }

        _renderFabricLayer(pageState, viewportWidth, viewportHeight) {
            if (!this.fabricCanvas) return;

            this.fabricCanvas.setWidth(viewportWidth);
            this.fabricCanvas.setHeight(viewportHeight);

            if (pageState.fabricJson) {
                this._isRestoring = true;
                this.fabricCanvas.loadFromJSON(pageState.fabricJson, () => {
                    this._isRestoring = false;
                    this.fabricCanvas.renderAll();
                    this._updateFloatingBar();
                });
            } else {
                this._isRestoring = true;
                this.fabricCanvas.clear();
                this._isRestoring = false;
                this._hideFloatingBar();
            }
        }

        _setupDomLayerClickDismiss() {
            if (!this.domLayer) return;
            this.domLayer.addEventListener('click', (e) => {
                if (e.target === this.domLayer) {
                    this.selectedLink = null;
                    this.selectedFormField = null;
                    document.querySelectorAll('.link-hotspot').forEach(el => el.classList.remove('selected'));
                    document.querySelectorAll('.form-field-hotspot').forEach(el => el.classList.remove('selected'));
                    this._hideFloatingBar();
                }
            });
        }

        _setupFloatingBarEvents() {
            const dupBtn = document.getElementById('floating-btn-duplicate');
            const delBtn = document.getElementById('floating-btn-delete');
            const fwdBtn = document.getElementById('floating-btn-forward');
            const bwdBtn = document.getElementById('floating-btn-backward');

            if (dupBtn && !dupBtn._bound) {
                dupBtn._bound = true;
                dupBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.duplicateActiveObject();
                });
            }

            if (delBtn && !delBtn._bound) {
                delBtn._bound = true;
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteActiveObject();
                });
            }

            if (fwdBtn && !fwdBtn._bound) {
                fwdBtn._bound = true;
                fwdBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.bringActiveObjectForward();
                });
            }

            if (bwdBtn && !bwdBtn._bound) {
                bwdBtn._bound = true;
                bwdBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.sendActiveObjectBackward();
                });
            }
        }

        _onFabricSelection() {
            this.selectedLink = null;
            this.selectedFormField = null;
            document.querySelectorAll('.link-hotspot').forEach(el => el.classList.remove('selected'));
            document.querySelectorAll('.form-field-hotspot').forEach(el => el.classList.remove('selected'));
            this._updateFloatingBar();
        }

        _onFabricSelectionCleared() {
            if (!this.selectedLink && !this.selectedFormField) {
                this._hideFloatingBar();
            }
        }

        _updateFloatingBar() {
            const bar = document.getElementById('floating-object-bar');
            if (!bar) return;

            let targetRect = null;
            let badgeText = 'Object';
            let canReorder = false;

            const activeObj = this.fabricCanvas ? this.fabricCanvas.getActiveObject() : null;

            if (activeObj) {
                canReorder = true;
                const bound = activeObj.getBoundingRect(true);
                targetRect = {
                    left: bound.left,
                    top: bound.top,
                    width: bound.width,
                    height: bound.height,
                };
                if (activeObj.isSignature) badgeText = 'Signature';
                else if (activeObj.isWhiteout) badgeText = 'Whiteout';
                else if (activeObj.type === 'i-text' || activeObj.type === 'text') badgeText = 'Text';
                else if (activeObj.type === 'image') badgeText = 'Image';
                else if (['rect', 'circle', 'line'].includes(activeObj.type)) badgeText = 'Shape';
                else badgeText = 'Object';
            } else if (this.selectedLink) {
                const [lx, ly, lw, lh] = this.selectedLink.rect.map(v => v * this.currentScale);
                targetRect = { left: lx, top: ly, width: lw, height: lh };
                badgeText = 'Link';
            } else if (this.selectedFormField) {
                const [fx, fy, fw, fh] = this.selectedFormField.rect.map(v => v * this.currentScale);
                targetRect = { left: fx, top: fy, width: fw, height: fh };
                badgeText = this.selectedFormField.type === 'checkbox' ? 'Checkbox' :
                            this.selectedFormField.type === 'dropdown' ? 'Dropdown' : 'Text Field';
            }

            if (!targetRect) {
                this._hideFloatingBar();
                return;
            }

            const badge = document.getElementById('floating-obj-badge');
            if (badge) badge.textContent = badgeText;

            const fwdBtn = document.getElementById('floating-btn-forward');
            const bwdBtn = document.getElementById('floating-btn-backward');
            if (fwdBtn) fwdBtn.style.display = canReorder ? 'inline-flex' : 'none';
            if (bwdBtn) bwdBtn.style.display = canReorder ? 'inline-flex' : 'none';

            bar.classList.remove('hidden');

            const barW = bar.offsetWidth || 160;
            const barH = bar.offsetHeight || 32;

            const stageW = (this.container && this.container.offsetWidth) || (this.baseCanvas ? this.baseCanvas.width : 600);

            // Center horizontally above object
            let left = targetRect.left + (targetRect.width / 2) - (barW / 2);
            left = Math.max(8, Math.min(stageW - barW - 8, left));

            // Position 8px above target
            let top = targetRect.top - barH - 8;
            if (top < 8) {
                // Flip below if not enough room above
                top = targetRect.top + targetRect.height + 8;
            }

            bar.style.left = `${left}px`;
            bar.style.top = `${top}px`;
        }

        _hideFloatingBar() {
            const bar = document.getElementById('floating-object-bar');
            if (bar) bar.classList.add('hidden');
        }

        duplicateActiveObject() {
            const activeObj = this.fabricCanvas ? this.fabricCanvas.getActiveObject() : null;
            if (activeObj) {
                activeObj.clone((cloned) => {
                    cloned.set({
                        left: activeObj.left + 16,
                        top: activeObj.top + 16,
                        evented: true,
                        lockUniScaling: true,
                    });
                    if (activeObj.isWhiteout) cloned.isWhiteout = true;
                    if (activeObj.isSignature) cloned.isSignature = true;

                    this.fabricCanvas.add(cloned);
                    this.fabricCanvas.setActiveObject(cloned);
                    this.fabricCanvas.renderAll();
                    this._saveFabricState();
                    window.EditorState.pushSnapshot('Duplicate Object');
                    this._updateFloatingBar();
                });
                return;
            }

            if (this.selectedLink) {
                const page = window.EditorState.getActivePage();
                if (!page) return;
                const orig = this.selectedLink;
                const clonedLink = {
                    id: `link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                    rect: [orig.rect[0] + 16, orig.rect[1] + 16, orig.rect[2], orig.rect[3]],
                    type: orig.type,
                    target: orig.target,
                };
                page.links.push(clonedLink);
                page.hasEdits = true;
                this.selectedLink = clonedLink;
                window.EditorState.pushSnapshot('Duplicate Link');
                this.renderPage(this.currentPdfProxy);
                return;
            }

            if (this.selectedFormField) {
                const page = window.EditorState.getActivePage();
                if (!page) return;
                const orig = this.selectedFormField;
                const clonedField = {
                    id: `field-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                    type: orig.type,
                    name: `${orig.name}_copy`,
                    rect: [orig.rect[0] + 16, orig.rect[1] + 16, orig.rect[2], orig.rect[3]],
                    options: orig.options ? [...orig.options] : [],
                };
                page.formFields.push(clonedField);
                page.hasEdits = true;
                this.selectedFormField = clonedField;
                window.EditorState.pushSnapshot('Duplicate Form Field');
                this.renderPage(this.currentPdfProxy);
                return;
            }
        }

        deleteActiveObject() {
            const activeObj = this.fabricCanvas ? this.fabricCanvas.getActiveObject() : null;
            if (activeObj) {
                this.fabricCanvas.remove(activeObj);
                this.fabricCanvas.discardActiveObject();
                this.fabricCanvas.renderAll();
                this._saveFabricState();
                window.EditorState.pushSnapshot('Delete Object');
                this._hideFloatingBar();
                return;
            }

            if (this.selectedLink) {
                const page = window.EditorState.getActivePage();
                if (page) {
                    page.links = page.links.filter(l => l.id !== this.selectedLink.id);
                    page.hasEdits = true;
                    this.selectedLink = null;
                    window.EditorState.pushSnapshot('Delete Link');
                    this.renderPage(this.currentPdfProxy);
                    this._hideFloatingBar();
                }
                return;
            }

            if (this.selectedFormField) {
                const page = window.EditorState.getActivePage();
                if (page) {
                    page.formFields = page.formFields.filter(f => f.id !== this.selectedFormField.id);
                    page.hasEdits = true;
                    this.selectedFormField = null;
                    window.EditorState.pushSnapshot('Delete Form Field');
                    this.renderPage(this.currentPdfProxy);
                    this._hideFloatingBar();
                }
                return;
            }
        }

        bringActiveObjectForward() {
            const activeObj = this.fabricCanvas ? this.fabricCanvas.getActiveObject() : null;
            if (activeObj) {
                this.fabricCanvas.bringForward(activeObj);
                this.fabricCanvas.renderAll();
                this._saveFabricState();
                window.EditorState.pushSnapshot('Bring Forward');
            }
        }

        sendActiveObjectBackward() {
            const activeObj = this.fabricCanvas ? this.fabricCanvas.getActiveObject() : null;
            if (activeObj) {
                this.fabricCanvas.sendBackwards(activeObj);
                this.fabricCanvas.renderAll();
                this._saveFabricState();
                window.EditorState.pushSnapshot('Send Backward');
            }
        }

        startPlacement(type, dataUrl) {
            this.cancelPlacement();
            this.placementMode = { type, dataUrl };

            const ghost = document.getElementById('placement-ghost-preview');
            const ghostImg = document.getElementById('placement-ghost-img');
            const ghostBox = document.getElementById('placement-ghost-box');

            if (!ghost || !ghostImg) return;

            ghostImg.src = dataUrl;
            ghostImg.classList.remove('hidden');
            if (ghostBox) ghostBox.classList.add('hidden');
            ghost.classList.remove('hidden');

            const maxW = (type === 'signature' ? 180 : 220) * this.currentScale;
            ghostImg.style.maxWidth = `${maxW}px`;
            ghostImg.style.maxHeight = `${maxW}px`;

            this._onPlacementMove = (e) => {
                if (!this.placementMode) return;
                const rect = this.container.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                ghost.style.left = `${x}px`;
                ghost.style.top = `${y}px`;
            };

            this._onPlacementClick = (e) => {
                if (!this.placementMode) return;
                const rect = this.container.getBoundingClientRect();
                if (
                    e.clientX < rect.left || e.clientX > rect.right ||
                    e.clientY < rect.top || e.clientY > rect.bottom
                ) {
                    return;
                }

                const clickX = (e.clientX - rect.left) / this.currentScale;
                const clickY = (e.clientY - rect.top) / this.currentScale;

                const currentType = this.placementMode.type;
                const currentDataUrl = this.placementMode.dataUrl;

                fabric.Image.fromURL(currentDataUrl, (img) => {
                    const targetMaxDim = currentType === 'signature' ? 180 : 220;
                    let scale = 1.0;
                    if (img.width > targetMaxDim || img.height > targetMaxDim) {
                        scale = targetMaxDim / Math.max(img.width, img.height);
                    }
                    img.set({
                        scaleX: scale,
                        scaleY: scale,
                        lockUniScaling: true,
                        cornerSize: 8,
                        transparentCorners: false,
                        isSignature: currentType === 'signature',
                    });
                    const w = img.getScaledWidth();
                    const h = img.getScaledHeight();
                    img.set({
                        left: clickX - (w / 2),
                        top: clickY - (h / 2),
                    });

                    this.fabricCanvas.add(img);
                    this.fabricCanvas.setActiveObject(img);
                    this.fabricCanvas.renderAll();
                    this._saveFabricState();
                    window.EditorState.pushSnapshot(currentType === 'signature' ? 'Add Signature' : 'Add Image');

                    this.cancelPlacement();
                    this._updateFloatingBar();
                });
            };

            window.addEventListener('pointermove', this._onPlacementMove);
            setTimeout(() => {
                if (this.placementMode) {
                    window.addEventListener('click', this._onPlacementClick, { once: true });
                }
            }, 50);
        }

        cancelPlacement() {
            if (!this.placementMode && !this.formPlacementType) return;
            this.placementMode = null;
            this.formPlacementType = null;

            const ghost = document.getElementById('placement-ghost-preview');
            const ghostImg = document.getElementById('placement-ghost-img');
            const ghostBox = document.getElementById('placement-ghost-box');
            if (ghost) ghost.classList.add('hidden');
            if (ghostImg) {
                ghostImg.classList.add('hidden');
                ghostImg.src = '';
            }
            if (ghostBox) ghostBox.classList.add('hidden');

            if (this._onPlacementMove) {
                window.removeEventListener('pointermove', this._onPlacementMove);
                this._onPlacementMove = null;
            }
            if (this._onPlacementClick) {
                window.removeEventListener('click', this._onPlacementClick);
                this._onPlacementClick = null;
            }
        }

        startFormPlacement(type = 'text') {
            this.cancelPlacement();
            this.formPlacementType = type;

            const ghost = document.getElementById('placement-ghost-preview');
            const ghostImg = document.getElementById('placement-ghost-img');
            const ghostBox = document.getElementById('placement-ghost-box');

            if (!ghost || !ghostBox) return;

            if (ghostImg) ghostImg.classList.add('hidden');
            ghostBox.classList.remove('hidden');
            ghost.classList.remove('hidden');

            const isCheckbox = type === 'checkbox';
            const w = (isCheckbox ? 24 : 140) * this.currentScale;
            const h = (isCheckbox ? 24 : 28) * this.currentScale;
            ghostBox.style.width = `${w}px`;
            ghostBox.style.height = `${h}px`;

            this._onPlacementMove = (e) => {
                if (!this.formPlacementType) return;
                const rect = this.container.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                ghost.style.left = `${x}px`;
                ghost.style.top = `${y}px`;
            };

            this._onPlacementClick = (e) => {
                if (!this.formPlacementType) return;
                const rect = this.container.getBoundingClientRect();
                if (
                    e.clientX < rect.left || e.clientX > rect.right ||
                    e.clientY < rect.top || e.clientY > rect.bottom
                ) {
                    return;
                }

                const clickX = (e.clientX - rect.left) / this.currentScale;
                const clickY = (e.clientY - rect.top) / this.currentScale;

                const formType = this.formPlacementType;
                const isCb = formType === 'checkbox';
                const fw = isCb ? 24 : 140;
                const fh = isCb ? 24 : 28;

                const page = window.EditorState.getActivePage();
                if (page) {
                    const newField = {
                        id: `ff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                        type: formType,
                        name: `${formType}_${page.formFields.length + 1}`,
                        rect: [clickX - (fw / 2), clickY - (fh / 2), fw, fh],
                        defaultValue: '',
                        checked: false,
                        options: formType === 'dropdown' ? ['Option A', 'Option B', 'Option C'] : [],
                    };
                    page.formFields.push(newField);
                    page.hasEdits = true;
                    this.selectedFormField = newField;
                    window.EditorState.pushSnapshot(`Add ${formType} field`);
                    this.renderPage(this.currentPdfProxy);
                    this._updateFloatingBar();
                }

                this.cancelPlacement();
                this.setTool('text-edit');
                const toolBtns = document.querySelectorAll('.tool-btn');
                toolBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === 'text-edit'));
            };

            window.addEventListener('pointermove', this._onPlacementMove);
            setTimeout(() => {
                if (this.formPlacementType) {
                    window.addEventListener('click', this._onPlacementClick, { once: true });
                }
            }, 50);
        }

        addFormField(type = 'text', rect = null, options = {}) {
            const page = window.EditorState.getActivePage();
            if (!page) return null;
            const isCb = type === 'checkbox';
            const defaultRect = rect || [100, 100, isCb ? 24 : 140, isCb ? 24 : 28];
            const newField = {
                id: `ff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                type,
                name: options.name || `${type}_${page.formFields.length + 1}`,
                rect: defaultRect,
                defaultValue: options.defaultValue || '',
                checked: !!options.checked,
                options: options.options || (type === 'dropdown' ? ['Option A', 'Option B', 'Option C'] : []),
            };
            page.formFields.push(newField);
            page.hasEdits = true;
            this.selectedFormField = newField;
            window.EditorState.pushSnapshot(`Add ${type} field`);
            this.renderPage(this.currentPdfProxy);
            this._updateFloatingBar();
            return newField;
        }

        _setupLinkDrawing() {
            this.domLayer.addEventListener('mousedown', (e) => {
                if (this.activeTool !== 'links') return;
                const rect = this.domLayer.getBoundingClientRect();
                this.isDrawingLink = true;
                this.linkDrawStart = {
                    x: (e.clientX - rect.left) / this.currentScale,
                    y: (e.clientY - rect.top) / this.currentScale,
                };
            });

            window.addEventListener('mouseup', (e) => {
                if (!this.isDrawingLink || this.activeTool !== 'links') return;
                this.isDrawingLink = false;
                const rect = this.domLayer.getBoundingClientRect();
                const endX = (e.clientX - rect.left) / this.currentScale;
                const endY = (e.clientY - rect.top) / this.currentScale;

                const x = Math.min(this.linkDrawStart.x, endX);
                const y = Math.min(this.linkDrawStart.y, endY);
                const w = Math.abs(endX - this.linkDrawStart.x);
                const h = Math.abs(endY - this.linkDrawStart.y);

                if (w > 15 && h > 10) {
                    this._createLinkPrompt([x, y, w, h]);
                }
            });
        }

        _createLinkPrompt(rect) {
            const url = prompt('Enter link URL (e.g. https://example.com) or page number (e.g. #2):', 'https://');
            if (!url) return;

            const page = window.EditorState.getActivePage();
            if (!page) return;

            const isPage = url.startsWith('#') || /^\d+$/.test(url);
            const target = isPage ? url.replace('#', '') : url;
            const type = isPage ? 'page' : 'url';

            const newLink = {
                id: `link-${Date.now().toString(36)}`,
                rect,
                type,
                target,
            };
            page.links.push(newLink);
            page.hasEdits = true;
            this.selectedLink = newLink;
            window.EditorState.pushSnapshot('Add Link');
            this.renderPage(this.currentPdfProxy);
            this._updateFloatingBar();
        }

        _openLinkConfig(link) {
            if (confirm(`Link target: ${link.target}\nClick OK to change or Cancel to delete.`)) {
                const newTarget = prompt('New target (URL or page number):', link.target);
                if (newTarget) {
                    link.target = newTarget;
                    link.type = newTarget.startsWith('#') || /^\d+$/.test(newTarget) ? 'page' : 'url';
                    window.EditorState.pushSnapshot('Update Link');
                    this.renderPage(this.currentPdfProxy);
                }
            } else {
                const page = window.EditorState.getActivePage();
                page.links = page.links.filter(l => l.id !== link.id);
                window.EditorState.pushSnapshot('Delete Link');
                this.renderPage(this.currentPdfProxy);
            }
        }

        _openFormFieldConfig(field) {
            const newName = prompt(`Configure ${field.type.toUpperCase()} field name:`, field.name);
            if (newName) {
                field.name = newName;
                window.EditorState.pushSnapshot('Configure Form Field');
                this.renderPage(this.currentPdfProxy);
            }
        }

        // ====================================================
        // Fabric Object Helpers
        // ====================================================

        addFabricText(text = 'New Text', options = {}) {
            if (!this.fabricCanvas) return;
            const t = new fabric.IText(text, {
                left: options.left !== undefined ? options.left : 100,
                top: options.top !== undefined ? options.top : 100,
                fontSize: options.fontSize || 18,
                fill: options.fill || '#1e293b',
                fontFamily: options.fontFamily || 'Liberation Sans',
                lockUniScaling: true,
                cornerSize: 8,
                transparentCorners: false,
                ...options,
            });
            this.fabricCanvas.add(t);
            this.fabricCanvas.setActiveObject(t);
            this.fabricCanvas.renderAll();
            this._saveFabricState();
            window.EditorState.pushSnapshot('Add Text');
            this._updateFloatingBar();
            return t;
        }

        addWhiteoutBox(options = {}) {
            if (!this.fabricCanvas) return;
            const rect = new fabric.Rect({
                left: options.left !== undefined ? options.left : 120,
                top: options.top !== undefined ? options.top : 120,
                width: options.width || 150,
                height: options.height || 40,
                fill: '#ffffff',
                stroke: '#e2e8f0',
                strokeWidth: 1,
                lockUniScaling: true,
                cornerSize: 8,
                transparentCorners: false,
                isWhiteout: true,
                ...options,
            });
            this.fabricCanvas.add(rect);
            this.fabricCanvas.setActiveObject(rect);
            this.fabricCanvas.renderAll();
            this._saveFabricState();
            window.EditorState.pushSnapshot('Add Whiteout');
            this._updateFloatingBar();
            return rect;
        }

        addShape(type = 'rect', options = {}) {
            if (!this.fabricCanvas) return;
            let shape;
            const base = {
                left: options.left !== undefined ? options.left : 150,
                top: options.top !== undefined ? options.top : 150,
                fill: options.fill || 'transparent',
                stroke: options.stroke || '#2563eb',
                strokeWidth: options.strokeWidth || 2,
                lockUniScaling: true,
                cornerSize: 8,
                transparentCorners: false,
                ...options,
            };

            if (type === 'rect') {
                shape = new fabric.Rect({ ...base, width: options.width || 120, height: options.height || 80 });
            } else if (type === 'circle') {
                shape = new fabric.Circle({ ...base, radius: options.radius || 50 });
            } else if (type === 'line') {
                shape = new fabric.Line([50, 50, 200, 50], { ...base, strokeWidth: options.strokeWidth || 3 });
            }

            if (shape) {
                this.fabricCanvas.add(shape);
                this.fabricCanvas.setActiveObject(shape);
                this.fabricCanvas.renderAll();
                this._saveFabricState();
                window.EditorState.pushSnapshot('Add Shape');
                this._updateFloatingBar();
            }
            return shape;
        }

        stampSignature(dataUrl, coords = null) {
            if (!this.fabricCanvas || !dataUrl) return;
            fabric.Image.fromURL(dataUrl, (img) => {
                const targetDim = 180;
                let scale = 0.6;
                if (img.width > targetDim || img.height > targetDim) {
                    scale = targetDim / Math.max(img.width, img.height);
                }
                const left = coords ? coords.x : 100;
                const top = coords ? coords.y : 100;
                img.set({
                    left,
                    top,
                    scaleX: scale,
                    scaleY: scale,
                    lockUniScaling: true,
                    cornerSize: 8,
                    transparentCorners: false,
                    isSignature: true,
                });
                this.fabricCanvas.add(img);
                this.fabricCanvas.setActiveObject(img);
                this.fabricCanvas.renderAll();
                this._saveFabricState();
                window.EditorState.pushSnapshot('Add Signature');
                this._updateFloatingBar();
            });
        }

        stampImage(dataUrl, coords = null) {
            if (!this.fabricCanvas || !dataUrl) return;
            fabric.Image.fromURL(dataUrl, (img) => {
                const maxDim = 220;
                let scale = 1.0;
                if (img.width > maxDim || img.height > maxDim) {
                    scale = maxDim / Math.max(img.width, img.height);
                }
                const left = coords ? coords.x : 80;
                const top = coords ? coords.y : 80;
                img.set({
                    left,
                    top,
                    scaleX: scale,
                    scaleY: scale,
                    lockUniScaling: true,
                    cornerSize: 8,
                    transparentCorners: false,
                });
                this.fabricCanvas.add(img);
                this.fabricCanvas.setActiveObject(img);
                this.fabricCanvas.renderAll();
                this._saveFabricState();
                window.EditorState.pushSnapshot('Add Image');
                this._updateFloatingBar();
            });
        }
    }

    window.CanvasStage = new CanvasStageController();
})(window, document);
