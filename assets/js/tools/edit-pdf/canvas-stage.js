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

                this.fabricCanvas.on('object:modified', () => this._saveFabricState());
                this.fabricCanvas.on('object:added', () => this._saveFabricState());
                this.fabricCanvas.on('object:removed', () => this._saveFabricState());
            }

            this._setupLinkDrawing();
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
                this.fabricCanvas.discardActiveObject();
                this.fabricCanvas.renderAll();
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
            const page = window.EditorState.getActivePage();
            if (page && this.fabricCanvas) {
                page.fabricJson = this.fabricCanvas.toJSON(['id', 'toolType', 'isWhiteout', 'isSignature']);
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

                // Auto-sample colors if not already sampled (only for blocks with raster image backgrounds)
                if (window.TextExtractor && pageState.textBlocks.length > 0 && !pageState.textBlocks[0].sampled) {
                    pageState.textBlocks.forEach(b => {
                        b.pageWidthPt = pageState.widthPt || 612;
                        b.sampled = true;
                    });
                    window.TextExtractor.sampleBlockColors(this.baseCanvas, pageState.textBlocks, this.currentScale, pageState.heightPt || 792);
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

                // Determine font family: Tier 1 uses exact PDF.js loadedName
                const hasCoverage = window.FontManager.checkEmbeddedCoverage(block.embeddedBytes, block.currentText);
                block.tier = hasCoverage ? 1 : 2;

                const cssFontFamily = block.tier === 1 && block.loadedName
                    ? `"${block.loadedName}", "${block.matched?.name || 'Liberation Sans'}", sans-serif`
                    : `"${block.matched?.name || 'Liberation Sans'}", sans-serif`;

                el.style.fontFamily = cssFontFamily;
                el.style.fontWeight = block.bold ? '700' : '400';
                el.style.fontStyle = block.italic ? 'italic' : 'normal';
                el.style.color = block.colorHex || '#1e293b';

                // Calibrate letter-spacing to match original PDF character advances
                let letterSpacingPx = 0;
                if (block.originalText && block.originalText.length > 1 && measureCtx) {
                    measureCtx.font = `${block.italic ? 'italic ' : ''}${block.bold ? '700 ' : '400 '}${fontSizePx}px ${cssFontFamily}`;
                    const measuredW = measureCtx.measureText(block.originalText).width;
                    if (measuredW > 0) {
                        letterSpacingPx = (widthPx - measuredW) / (block.originalText.length - 1);
                        letterSpacingPx = Math.max(-1.5, Math.min(4.0, letterSpacingPx));
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
                        : (block.hasVectorBg ? (block.vectorBgHex || '#ffffff') : '#ffffff');
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
                    this._openLinkConfig(link);
                });
                this.domLayer.appendChild(linkEl);
            }

            // C. Render AcroForm Fields
            for (const field of pageState.formFields) {
                const [fx, fy, fw, fh] = field.rect.map(v => v * scale);
                const fieldEl = document.createElement('div');
                fieldEl.className = 'form-field-hotspot';
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
                : (block.hasVectorBg ? (block.vectorBgHex || '#ffffff') : '#ffffff');
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
            fontPill.textContent = block.tier === 1 ? `Embedded: ${block.realName}` : `Matched: ${block.matched?.name || 'Liberation Sans'}`;
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
                input.blur();
            });
            quickBar.appendChild(revertBtn);

            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'text-quick-btn text-rose-700 bg-rose-50';
            deleteBtn.textContent = 'Delete';
            deleteBtn.title = 'Delete line (mask completely)';
            deleteBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                block.deleted = true;
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
                if (covered) {
                    block.tier = 1;
                    fontPill.className = 'text-quick-pill';
                    fontPill.textContent = `Embedded: ${block.realName}`;
                    input.style.fontFamily = `"${block.loadedName}", "${block.matched?.name || 'Liberation Sans'}", sans-serif`;
                } else {
                    block.tier = 2;
                    fontPill.className = 'text-quick-pill tier2';
                    fontPill.textContent = `Matched: ${block.matched?.name || 'Liberation Sans'}`;
                    input.style.fontFamily = `"${block.matched?.name || 'Liberation Sans'}", sans-serif`;
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
                this.fabricCanvas.loadFromJSON(pageState.fabricJson, () => {
                    this.fabricCanvas.renderAll();
                });
            } else {
                this.fabricCanvas.clear();
            }
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

            page.links.push({
                id: `link-${Date.now().toString(36)}`,
                rect,
                type,
                target,
            });
            page.hasEdits = true;
            window.EditorState.pushSnapshot('Add Link');
            this.renderPage(this.currentPdfProxy);
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
                left: 100,
                top: 100,
                fontSize: options.fontSize || 18,
                fill: options.fill || '#1e293b',
                fontFamily: options.fontFamily || 'Liberation Sans',
                ...options,
            });
            this.fabricCanvas.add(t);
            this.fabricCanvas.setActiveObject(t);
            this.fabricCanvas.renderAll();
        }

        addWhiteoutBox() {
            if (!this.fabricCanvas) return;
            const rect = new fabric.Rect({
                left: 120,
                top: 120,
                width: 150,
                height: 40,
                fill: '#ffffff',
                stroke: '#e2e8f0',
                strokeWidth: 1,
                isWhiteout: true,
            });
            this.fabricCanvas.add(rect);
            this.fabricCanvas.setActiveObject(rect);
            this.fabricCanvas.renderAll();
        }

        addShape(type = 'rect', options = {}) {
            if (!this.fabricCanvas) return;
            let shape;
            const base = {
                left: 150,
                top: 150,
                fill: options.fill || 'transparent',
                stroke: options.stroke || '#2563eb',
                strokeWidth: options.strokeWidth || 2,
            };

            if (type === 'rect') {
                shape = new fabric.Rect({ ...base, width: 120, height: 80 });
            } else if (type === 'circle') {
                shape = new fabric.Circle({ ...base, radius: 50 });
            } else if (type === 'line') {
                shape = new fabric.Line([50, 50, 200, 50], { ...base, strokeWidth: options.strokeWidth || 3 });
            }

            if (shape) {
                this.fabricCanvas.add(shape);
                this.fabricCanvas.setActiveObject(shape);
                this.fabricCanvas.renderAll();
            }
        }

        stampSignature(dataUrl) {
            if (!this.fabricCanvas || !dataUrl) return;
            fabric.Image.fromURL(dataUrl, (img) => {
                img.set({
                    left: 100,
                    top: 100,
                    scaleX: 0.6,
                    scaleY: 0.6,
                    isSignature: true,
                });
                this.fabricCanvas.add(img);
                this.fabricCanvas.setActiveObject(img);
                this.fabricCanvas.renderAll();
            });
        }

        stampImage(dataUrl) {
            if (!this.fabricCanvas || !dataUrl) return;
            fabric.Image.fromURL(dataUrl, (img) => {
                const maxDim = 300;
                let scale = 1.0;
                if (img.width > maxDim || img.height > maxDim) {
                    scale = maxDim / Math.max(img.width, img.height);
                }
                img.set({
                    left: 80,
                    top: 80,
                    scaleX: scale,
                    scaleY: scale,
                });
                this.fabricCanvas.add(img);
                this.fabricCanvas.setActiveObject(img);
                this.fabricCanvas.renderAll();
            });
        }
    }

    window.CanvasStage = new CanvasStageController();
})(window, document);
