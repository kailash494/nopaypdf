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
            this.textLayer = null;
            this.linksLayer = null;
            this.formsLayer = null;
            this.fabricWrap = null;
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
            this.annotateType = 'highlight'; // 'highlight'|'underline'|'strike'
            this.annotateColor = '#fef08a';
            this.isDrawingAnnot = false;
            this.annotDrawStart = null;
            this.shapeType = 'rect'; // 'rect'|'circle'|'line'|'arrow'
            this.shapeStrokeColor = '#2563eb';
            this.shapeStrokeWidth = 2;
            this.shapeFillColor = '#ffffff';
            this.shapeFillTransparent = true;
            this.isDrawingShape = false;
            this.shapeDrawStart = null;
            this.isDrawingWhiteout = false;
            this.whiteoutDrawStart = null;
            this.activeFabricTextBox = null;
            this.addTextBgColor = 'transparent';
            this._hadActiveBeforeMouseDown = false;
            this._wasClickingHandleOnBefore = false;
            this._suppressMouseUpCreate = false;
            this._suppressLinkCreate = false;
            this._popoverContext = null;
        }

        _installCustomRotationControl() {
            if (!window.fabric || !window.fabric.Object || window.fabric.Object.__nopayMtrInstalled) return;
            window.fabric.Object.__nopayMtrInstalled = true;

            const renderMtrKnob = function(ctx, left, top, styleOverride, fabricObject) {
                const size = 20;
                const r = size / 2;
                ctx.save();
                ctx.translate(left, top);
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetY = 1;
                ctx.fill();
                ctx.shadowColor = 'transparent';
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#2563eb';
                ctx.stroke();

                // Crisp circular rotate arrow icon inside knob
                ctx.beginPath();
                ctx.arc(0, 0, 5.2, -Math.PI * 0.75, Math.PI * 0.55);
                ctx.lineWidth = 1.5;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#2563eb';
                ctx.stroke();

                // Arrow tip at end of arc (~100 deg)
                ctx.beginPath();
                ctx.moveTo(2.5, 4.8);
                ctx.lineTo(-0.5, 5.5);
                ctx.lineTo(0.8, 2.7);
                ctx.closePath();
                ctx.fillStyle = '#2563eb';
                ctx.fill();
                ctx.restore();
            };

            const existingMtr = fabric.Object.prototype.controls && fabric.Object.prototype.controls.mtr;
            const mtrControl = existingMtr || new fabric.Control({
                x: 0,
                y: -0.5,
                cursorStyleHandler: fabric.controlsUtils.rotationStyleHandler,
                actionHandler: fabric.controlsUtils.rotationWithSnapping,
                actionName: 'rotate',
            });
            mtrControl.offsetY = -28;
            mtrControl.withConnection = true;
            mtrControl.sizeX = 24;
            mtrControl.sizeY = 24;
            mtrControl.touchSizeX = 28;
            mtrControl.touchSizeY = 28;
            mtrControl.render = renderMtrKnob;

            if (fabric.Object.prototype.controls) {
                fabric.Object.prototype.controls.mtr = mtrControl;
            }
            if (fabric.IText && fabric.IText.prototype.controls) {
                fabric.IText.prototype.controls.mtr = mtrControl;
            }
            if (fabric.Textbox && fabric.Textbox.prototype.controls) {
                fabric.Textbox.prototype.controls.mtr = mtrControl;
            }
        }

        _configureObjectControls(obj) {
            if (!obj || typeof obj.set !== 'function') return obj;
            obj.set({
                lockRotation: false,
                hasControls: true,
                hasBorders: true,
                hasRotatingPoint: true,
                transparentCorners: false,
                cornerSize: 10,
                cornerColor: '#ffffff',
                cornerStrokeColor: '#2563eb',
                borderColor: '#2563eb',
                cornerStyle: 'circle',
                rotatingPointOffset: 28,
            });
            if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
                obj.set({
                    objectCaching: false,
                    padding: Math.max(4, obj.padding || 4),
                });
            }
            if (typeof obj.setControlsVisibility === 'function') {
                obj.setControlsVisibility({ mtr: true });
            }
            if (typeof obj.setCoords === 'function') {
                obj.setCoords();
            }
            return obj;
        }

        _isPropertiesPopoverOpen() {
            const pop = document.getElementById('inline-properties-popover');
            return Boolean(pop && !pop.classList.contains('hidden'));
        }

        _hasActiveInteraction() {
            const activeObj = this.fabricCanvas ? this.fabricCanvas.getActiveObject() : null;
            const domEditing = Boolean(document.querySelector('.text-hitbox.editing'));
            const colorOpen = Boolean(window.NoPayColorPicker && window.NoPayColorPicker.isOpen());
            const fontOpen = Boolean(window.NoPayFontPicker && window.NoPayFontPicker.isOpen());
            return Boolean(
                activeObj ||
                (this.activeFabricTextBox && this.activeFabricTextBox.isEditing) ||
                domEditing ||
                this.selectedLink ||
                this.selectedFormField ||
                this._isPropertiesPopoverOpen() ||
                colorOpen ||
                fontOpen
            );
        }

        _exitActiveInteraction() {
            let changed = false;
            if (window.NoPayColorPicker && window.NoPayColorPicker.isOpen()) {
                window.NoPayColorPicker.close();
                changed = true;
            }
            if (window.NoPayFontPicker && window.NoPayFontPicker.isOpen()) {
                window.NoPayFontPicker.close();
                changed = true;
            }
            if (this._isPropertiesPopoverOpen()) {
                this.closePropertiesPopover();
                changed = true;
            }

            const activeObj = this.fabricCanvas ? this.fabricCanvas.getActiveObject() : null;
            if (activeObj) {
                if (activeObj.isEditing && typeof activeObj.exitEditing === 'function') {
                    activeObj.exitEditing();
                }
                this.fabricCanvas.discardActiveObject();
                this.fabricCanvas.renderAll();
                changed = true;
            } else if (this.activeFabricTextBox && this.activeFabricTextBox.isEditing) {
                this.activeFabricTextBox.exitEditing();
                this.fabricCanvas.discardActiveObject();
                this.fabricCanvas.renderAll();
                changed = true;
            }
            this.activeFabricTextBox = null;

            const activeDomInput = document.querySelector('.text-hitbox.editing .text-inline-input');
            if (activeDomInput) {
                activeDomInput.blur();
                changed = true;
            }
            if (this.selectedBlock) {
                this.selectedBlock = null;
                this._syncContextSubToolbar(null);
                changed = true;
            }

            if (this.selectedLink || this.selectedFormField) {
                this.selectedLink = null;
                this.selectedFormField = null;
                document.querySelectorAll('.link-hotspot').forEach(el => el.classList.remove('selected'));
                document.querySelectorAll('.form-field-hotspot').forEach(el => el.classList.remove('selected'));
                changed = true;
            }

            this._hideFloatingBar();
            return changed;
        }

        init(containerEl, baseCanvasEl, textLayerEl, linksLayerEl, formsLayerEl, fabricCanvasEl) {
            this.container = containerEl;
            this.baseCanvas = baseCanvasEl;
            this.textLayer = textLayerEl || (this.container ? this.container.querySelector('#stage-text-layer') : document.getElementById('stage-text-layer'));
            this.linksLayer = linksLayerEl || (this.container ? this.container.querySelector('#stage-links-layer') : document.getElementById('stage-links-layer'));
            this.formsLayer = formsLayerEl || (this.container ? this.container.querySelector('#stage-forms-layer') : document.getElementById('stage-forms-layer'));
            this.fabricCanvasEl = fabricCanvasEl || (this.container ? this.container.querySelector('#stage-fabric-canvas') : document.getElementById('stage-fabric-canvas'));
            this.fabricWrap = this.container ? (this.container.querySelector('#stage-fabric-wrap') || this.container.querySelector('.stage-layer-fabric-wrap')) : document.getElementById('stage-fabric-wrap');

            // Idempotent patch for Fabric 5.3.1 'alphabetical' CanvasTextBaseline typo
            if (window.fabric && window.fabric.Text && window.fabric.Text.prototype._setTextStyles && !window.fabric.Text.prototype._setTextStyles.__patched) {
                const origSetTextStyles = window.fabric.Text.prototype._setTextStyles;
                window.fabric.Text.prototype._setTextStyles = function(ctx, charStyle, forMeasuring) {
                    origSetTextStyles.call(this, ctx, charStyle, forMeasuring);
                    ctx.textBaseline = 'alphabetic';
                };
                window.fabric.Text.prototype._setTextStyles.__patched = true;
            }

            // Ensure Fabric IText hidden textarea always has id, name, and aria-label for zero DevTools form accessibility issues
            if (window.fabric && window.fabric.IText && window.fabric.IText.prototype.initHiddenTextarea && !window.fabric.IText.prototype.initHiddenTextarea.__patched) {
                const origInitHidden = window.fabric.IText.prototype.initHiddenTextarea;
                let hiddenTaSeq = 0;
                window.fabric.IText.prototype.initHiddenTextarea = function() {
                    origInitHidden.apply(this, arguments);
                    if (this.hiddenTextarea) {
                        hiddenTaSeq += 1;
                        if (!this.hiddenTextarea.id) {
                            this.hiddenTextarea.id = `fabric-itext-input-${hiddenTaSeq}`;
                        }
                        if (!this.hiddenTextarea.name) {
                            this.hiddenTextarea.name = this.hiddenTextarea.id;
                        }
                        if (!this.hiddenTextarea.getAttribute('aria-label')) {
                            this.hiddenTextarea.setAttribute('aria-label', 'Canvas text editor input');
                        }
                    }
                };
                window.fabric.IText.prototype.initHiddenTextarea.__patched = true;
            }

            // Initialize Fabric.js with HiDPI Retina scaling and crisp custom mtr handle
            if (window.fabric && !this.fabricCanvas) {
                window.fabric.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
                this._installCustomRotationControl();

                this.fabricCanvas = new fabric.Canvas(this.fabricCanvasEl, {
                    selection: true,
                    preserveObjectStacking: true,
                    fireRightClick: true,
                    stopContextMenu: true,
                    enableRetinaScaling: true,
                });

                window.FontManager?.preloadLocalFonts?.();

                this.fabricCanvas.on('object:modified', (opt) => {
                    if (opt && opt.target && opt.target._skipNextObjectModified) {
                        opt.target._skipNextObjectModified = false;
                        return;
                    }
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
                        if (e.path) {
                            e.path.set({ lockUniScaling: true });
                            this._configureObjectControls(e.path);
                        }
                        this._saveFabricState();
                        window.EditorState.pushSnapshot('Freehand Drawing');
                    }
                });

                this.fabricCanvas.on('selection:created', () => this._onFabricSelection());
                this.fabricCanvas.on('selection:updated', () => this._onFabricSelection());
                this.fabricCanvas.on('selection:cleared', () => this._onFabricSelectionCleared());
                this.fabricCanvas.on('object:moving', () => {
                    this._hideFloatingBar();
                });
                this.fabricCanvas.on('object:scaling', () => {
                    this._hideFloatingBar();
                });
                this.fabricCanvas.on('object:rotating', () => {
                    this._hideFloatingBar();
                });

                this.fabricCanvas.on('mouse:down:before', (opt) => {
                    const activeObj = this.fabricCanvas.getActiveObject();
                    this._hadActiveBeforeMouseDown = this._hasActiveInteraction();
                    this._wasClickingHandleOnBefore = false;
                    if (activeObj && opt && opt.e) {
                        if (typeof activeObj._findTargetCorner === 'function') {
                            const vptPt = this.fabricCanvas.getPointer(opt.e, true);
                            if (activeObj._findTargetCorner(vptPt)) {
                                this._wasClickingHandleOnBefore = true;
                            }
                        }
                    }
                });

                this.fabricCanvas.on('mouse:down', (opt) => {
                    this._suppressMouseUpCreate = false;
                    const hitTarget = Boolean(opt.target || opt.transform || this._wasClickingHandleOnBefore);

                    // Universal 2-Click Exit-Before-Create Rule on empty canvas click
                    if (!hitTarget && this._hadActiveBeforeMouseDown) {
                        this._hadActiveBeforeMouseDown = false;
                        this._suppressMouseUpCreate = true;
                        this._exitActiveInteraction();
                        return;
                    }

                    const pointer = (opt.e && typeof opt.e.clientX === 'number')
                        ? this.clientToCanvasPoint(opt.e.clientX, opt.e.clientY)
                        : this.fabricCanvas.getPointer(opt.e);

                    if (this.activeTool === 'add-text') {
                        // If clicking an existing added text box (or handle), edit/manipulate immediately
                        if (opt.target && (opt.target.type === 'i-text' || opt.target.type === 'text')) {
                            this.fabricCanvas.setActiveObject(opt.target);
                            if (!opt.transform) {
                                opt.target.enterEditing();
                            }
                            this._updateFloatingBar();
                            return;
                        }
                        if (hitTarget) return;

                        const pageState = window.EditorState.getActivePage();
                        const pageW = (pageState && pageState.widthPt) || 612;
                        const pageH = (pageState && pageState.heightPt) || 792;

                        // Inherit font style, size, ink color, weight from nearest page text (or pre-chosen Add Text font)
                        const nearestStyle = this.getNearestTextBlockStyle(pointer.x, pointer.y);
                        const chosenFontFamily = this.preferredAddTextFontFamily || nearestStyle.fontFamily;

                        // Subtle horizontal row-baseline alignment only when clicking very close to an existing row
                        const targetTop = (nearestStyle.snappedBoxTop !== null && Math.abs(nearestStyle.dyToNearest) <= 6)
                            ? nearestStyle.snappedBoxTop
                            : pointer.y;

                        // Anchor cleanly within scene bounds without jumping open-space clicks
                        const clampedLeft = Math.max(8, Math.min(pageW - 36, pointer.x));
                        const clampedTop = Math.max(8, Math.min(pageH - 24, targetTop));

                        const initBg = (this.addTextBgColor && this.addTextBgColor !== 'transparent')
                            ? this.addTextBgColor
                            : '';

                        const t = new fabric.IText('', {
                            left: clampedLeft,
                            top: clampedTop,
                            fontSize: nearestStyle.fontSize,
                            fill: nearestStyle.fill,
                            textBackgroundColor: initBg,
                            fontFamily: chosenFontFamily,
                            fontWeight: nearestStyle.bold ? 'bold' : 'normal',
                            fontStyle: nearestStyle.italic ? 'italic' : 'normal',
                            lockUniScaling: true,
                            editingBorderColor: '#2563eb',
                            objectCaching: false,
                            padding: 4,
                        });
                        this._configureObjectControls(t);
                        t._isPendingNewText = true;
                        t._textBeforeEdit = '';

                        t.on('editing:entered', () => {
                            t._textBeforeEdit = t.text || '';
                        });

                        t.on('changed', () => {
                            this.fabricCanvas.renderAll();
                            this._updateFloatingBar();
                        });

                        t.on('editing:exited', () => {
                            if (!t.text || t.text.trim() === '') {
                                this._isRestoring = true;
                                this.fabricCanvas.remove(t);
                                this._isRestoring = false;
                                if (this.activeFabricTextBox === t) {
                                    this.activeFabricTextBox = null;
                                }
                                this._saveFabricState();
                                this._hideFloatingBar();
                                return;
                            }
                            if (t._isPendingNewText) {
                                t._isPendingNewText = false;
                                t._skipNextObjectModified = true;
                                this._saveFabricState();
                                window.EditorState.pushSnapshot('Add Text');
                            } else if (t.text !== t._textBeforeEdit) {
                                t._skipNextObjectModified = true;
                                this._saveFabricState();
                                window.EditorState.pushSnapshot('Edit Added Text');
                            }
                        });

                        this._isRestoring = true;
                        this.fabricCanvas.add(t);
                        this._isRestoring = false;
                        this.activeFabricTextBox = t;
                        this.fabricCanvas.setActiveObject(t);
                        t.enterEditing();
                        if (t.hiddenTextarea) {
                            t.hiddenTextarea.focus();
                        }
                        this.fabricCanvas.renderAll();
                        this._updateFloatingBar();
                        return;
                    }

                    if (this.activeTool === 'annotate') {
                        if (hitTarget) return;
                        this.isDrawingAnnot = true;
                        this.annotDrawStart = pointer;
                        return;
                    }

                    if (this.activeTool === 'whiteout') {
                        if (hitTarget) return;
                        this.isDrawingWhiteout = true;
                        this.whiteoutDrawStart = pointer;
                        return;
                    }

                    if (this.activeTool === 'shapes') {
                        if (hitTarget) return;
                        this.isDrawingShape = true;
                        this.shapeDrawStart = pointer;
                        return;
                    }
                });

                this.fabricCanvas.on('mouse:move', () => {
                    // Cursor tracking handled explicitly per placement tool
                });

                this.fabricCanvas.on('mouse:up', (opt) => {
                    if (this._suppressMouseUpCreate) {
                        this._suppressMouseUpCreate = false;
                        this.isDrawingAnnot = false;
                        this.isDrawingWhiteout = false;
                        this.isDrawingShape = false;
                        this.annotDrawStart = null;
                        this.whiteoutDrawStart = null;
                        this.shapeDrawStart = null;
                        return;
                    }
                    const endPointer = (opt.e && typeof opt.e.clientX === 'number')
                        ? this.clientToCanvasPoint(opt.e.clientX, opt.e.clientY)
                        : this.fabricCanvas.getPointer(opt.e);

                    if (this.activeTool === 'annotate' && this.isDrawingAnnot && this.annotDrawStart) {
                        this.isDrawingAnnot = false;
                        const x = Math.min(this.annotDrawStart.x, endPointer.x);
                        const y = Math.min(this.annotDrawStart.y, endPointer.y);
                        const w = Math.abs(endPointer.x - this.annotDrawStart.x);
                        const h = Math.abs(endPointer.y - this.annotDrawStart.y);
                        this.annotDrawStart = null;

                        if (this.annotateType === 'underline' || this.annotateType === 'strike') {
                            if (w > 10) {
                                this.addAnnotation(this.annotateType, [x, y, w, h], this.annotateColor);
                            }
                        } else if (w > 10 && h > 4) {
                            this.addAnnotation(this.annotateType, [x, y, w, h], this.annotateColor);
                        }
                    }

                    if (this.activeTool === 'whiteout' && this.isDrawingWhiteout && this.whiteoutDrawStart) {
                        this.isDrawingWhiteout = false;
                        const x = Math.min(this.whiteoutDrawStart.x, endPointer.x);
                        const y = Math.min(this.whiteoutDrawStart.y, endPointer.y);
                        const w = Math.abs(endPointer.x - this.whiteoutDrawStart.x);
                        const h = Math.abs(endPointer.y - this.whiteoutDrawStart.y);
                        this.whiteoutDrawStart = null;

                        if (w > 5 && h > 5) {
                            this.addWhiteoutBox({ left: x, top: y, width: w, height: h });
                        } else {
                            this.addWhiteoutBox({ left: x, top: y, width: 140, height: 32 });
                        }
                    }

                    if (this.activeTool === 'shapes' && this.isDrawingShape && this.shapeDrawStart) {
                        this.isDrawingShape = false;
                        let x1 = this.shapeDrawStart.x;
                        let y1 = this.shapeDrawStart.y;
                        let x2 = endPointer.x;
                        let y2 = endPointer.y;
                        this.shapeDrawStart = null;

                        if (this.shapeType === 'line' || this.shapeType === 'arrow') {
                            const dist = Math.hypot(x2 - x1, y2 - y1);
                            if (dist <= 5) {
                                x2 = x1 + 120;
                                y2 = y1;
                            } else if (opt.e && opt.e.shiftKey) {
                                const angle = Math.atan2(y2 - y1, x2 - x1);
                                const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
                                x2 = x1 + Math.cos(snapped) * dist;
                                y2 = y1 + Math.sin(snapped) * dist;
                            } else if (Math.abs(y2 - y1) < 8) {
                                y2 = y1;
                            }
                            this.addShape(this.shapeType, { x1, y1, x2, y2 });
                        } else {
                            const x = Math.min(x1, x2);
                            const y = Math.min(y1, y2);
                            const w = Math.abs(x2 - x1);
                            const h = Math.abs(y2 - y1);

                            if (w > 5 || h > 5) {
                                this.addShape(this.shapeType, {
                                    left: x,
                                    top: y,
                                    width: Math.max(15, w),
                                    height: Math.max(10, h),
                                    radius: Math.max(w, h) / 2,
                                });
                            } else {
                                this.addShape(this.shapeType, { left: x, top: y });
                            }
                        }
                    }
                });
            }

            if (!this._viewportOffsetBound) {
                this._viewportOffsetBound = true;
                window.addEventListener('resize', () => this.syncCanvasOffset());
                const scrollViewport = document.querySelector('.editor-viewport-container');
                if (scrollViewport) {
                    scrollViewport.addEventListener('scroll', () => {
                        this.syncCanvasOffset();
                    }, { passive: true });
                }
            }

            this._setupFloatingBarEvents();
            this._setupLinkDrawing();
            this._setupClickDismiss();
            this._applyLayerPointerEvents(this.activeTool);
        }

        /**
         * Recompute Fabric.js canvas offset immediately after DOM or viewport changes.
         */
        syncCanvasOffset() {
            if (this.fabricCanvas && typeof this.fabricCanvas.calcOffset === 'function') {
                this.fabricCanvas.calcOffset();
            }
        }

        /**
         * Single source-of-truth coordinate converter from DOM client pixels to Fabric scene coordinates.
         * @param {number} clientX
         * @param {number} clientY
         * @returns {{ x: number, y: number }}
         */
        clientToCanvasPoint(clientX, clientY) {
            const upperCanvas = this.fabricCanvas?.upperCanvasEl || this.fabricCanvasEl || this.baseCanvas || this.container;
            if (!upperCanvas) return { x: clientX, y: clientY };
            const rect = upperCanvas.getBoundingClientRect();
            const canvasW = this.fabricCanvas ? this.fabricCanvas.getWidth() : (rect.width || 1);
            const canvasH = this.fabricCanvas ? this.fabricCanvas.getHeight() : (rect.height || 1);
            const vx = rect.width > 0 ? (clientX - rect.left) * (canvasW / rect.width) : (clientX - rect.left);
            const vy = rect.height > 0 ? (clientY - rect.top) * (canvasH / rect.height) : (clientY - rect.top);
            const vpt = (this.fabricCanvas && this.fabricCanvas.viewportTransform) || [1, 0, 0, 1, 0, 0];
            const zoomX = vpt[0] || this.currentScale || 1;
            const zoomY = vpt[3] || this.currentScale || 1;
            return {
                x: (vx - (vpt[4] || 0)) / zoomX,
                y: (vy - (vpt[5] || 0)) / zoomY,
            };
        }

        setTool(tool) {
            const prevTool = this.activeTool;
            this.activeTool = tool;
            this.closePropertiesPopover();
            if (window.NoPayColorPicker) {
                window.NoPayColorPicker.close();
            }
            if (window.NoPayFontPicker) {
                window.NoPayFontPicker.close();
            }
            if (tool !== 'add-text') {
                this.preferredAddTextFontFamily = null;
            }
            if (prevTool !== tool) {
                this.selectedBlock = null;
                this.selectedLink = null;
                this.selectedFormField = null;
                this.activeFabricTextBox = null;
                document.querySelectorAll('.link-hotspot').forEach(el => el.classList.remove('selected'));
                document.querySelectorAll('.form-field-hotspot').forEach(el => el.classList.remove('selected'));
                if (this.fabricCanvas) {
                    const activeObj = this.fabricCanvas.getActiveObject();
                    if (activeObj && activeObj.isEditing && typeof activeObj.exitEditing === 'function') {
                        activeObj.exitEditing();
                    }
                    this.fabricCanvas.discardActiveObject();
                    this.fabricCanvas.renderAll();
                }
                this._hideFloatingBar();
            }

            if (tool !== 'draw' && this.fabricCanvas) {
                this.fabricCanvas.isDrawingMode = false;
            }
            if (tool !== 'shapes') {
                this.isDrawingShape = false;
                this.shapeDrawStart = null;
            }
            if (tool !== 'whiteout') {
                this.isDrawingWhiteout = false;
                this.whiteoutDrawStart = null;
            }
            if (tool !== 'annotate') {
                this.isDrawingAnnot = false;
                this.annotDrawStart = null;
            }
            if (tool !== 'images' && tool !== 'sign' && tool !== 'forms') {
                this.cancelPlacement();
            }

            if (this.fabricCanvas) {
                // Configure Fabric based on tool
                this.fabricCanvas.isDrawingMode = (tool === 'draw');
                if (tool === 'draw') {
                    this.fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(this.fabricCanvas);
                    const sizeVal = parseInt(document.getElementById('draw-brush-size')?.value || '3', 10);
                    const colorVal = document.getElementById('draw-brush-color')?.value || '#2563eb';
                    this.fabricCanvas.freeDrawingBrush.width = sizeVal;
                    this.fabricCanvas.freeDrawingBrush.color = colorVal;
                }

                if (tool === 'text-edit') {
                    this.fabricCanvas.defaultCursor = 'default';
                } else if (tool === 'add-text' || tool === 'annotate' || tool === 'whiteout' || tool === 'shapes' || tool === 'links') {
                    this.fabricCanvas.defaultCursor = 'crosshair';
                } else {
                    this.fabricCanvas.defaultCursor = 'default';
                }
            }

            this._applyLayerPointerEvents(tool);
        }

        _applyLayerPointerEvents(toolName) {
            const tool = toolName || this.activeTool || 'text-edit';

            // Base PDF canvas is ALWAYS pointer-events: none
            if (this.baseCanvas) {
                this.baseCanvas.style.pointerEvents = 'none';
                this.baseCanvas.style.zIndex = '10';
            }

            if (tool === 'text-edit') {
                // Edit Text mode: Text layer is ON TOP (z-index 40)
                if (this.textLayer) {
                    this.textLayer.style.zIndex = '40';
                    this.textLayer.style.pointerEvents = 'none'; // container transparent to clicks
                    this.textLayer.querySelectorAll('.text-hitbox').forEach(el => {
                        el.style.pointerEvents = 'auto';
                    });
                }
                if (this.linksLayer) {
                    this.linksLayer.style.zIndex = '20';
                    this.linksLayer.style.pointerEvents = 'none';
                    this.linksLayer.querySelectorAll('.link-hotspot').forEach(el => {
                        el.style.pointerEvents = 'none';
                    });
                }
                if (this.formsLayer) {
                    this.formsLayer.style.zIndex = '20';
                    this.formsLayer.style.pointerEvents = 'none';
                    this.formsLayer.querySelectorAll('.form-field-hotspot').forEach(el => {
                        el.style.pointerEvents = 'none';
                    });
                }
                if (this.fabricWrap) {
                    this.fabricWrap.style.zIndex = '30';
                    this.fabricWrap.style.pointerEvents = 'auto'; // Allows interacting with added Fabric objects without blocking .text-hitbox (z-index 40)
                }
                if (this.fabricCanvas) {
                    this.fabricCanvas.isDrawingMode = false;
                    const activeObj = this.fabricCanvas.getActiveObject();
                    if (activeObj && !activeObj.isEditing && activeObj !== this.activeFabricTextBox) {
                        this.fabricCanvas.discardActiveObject();
                    }
                    this.fabricCanvas.defaultCursor = 'default';
                    this.fabricCanvas.renderAll();
                }
            } else if (tool === 'links') {
                // Links mode: Links layer is ON TOP (z-index 40)
                if (this.linksLayer) {
                    this.linksLayer.style.zIndex = '40';
                    this.linksLayer.style.pointerEvents = 'auto';
                    this.linksLayer.querySelectorAll('.link-hotspot').forEach(el => {
                        el.style.pointerEvents = 'auto';
                    });
                }
                if (this.textLayer) {
                    this.textLayer.style.zIndex = '20';
                    this.textLayer.style.pointerEvents = 'none';
                    this.textLayer.querySelectorAll('.text-hitbox').forEach(el => {
                        el.style.pointerEvents = 'none';
                    });
                }
                if (this.formsLayer) {
                    this.formsLayer.style.zIndex = '20';
                    this.formsLayer.style.pointerEvents = 'none';
                    this.formsLayer.querySelectorAll('.form-field-hotspot').forEach(el => {
                        el.style.pointerEvents = 'none';
                    });
                }
                if (this.fabricWrap) {
                    this.fabricWrap.style.zIndex = '30';
                    this.fabricWrap.style.pointerEvents = 'none';
                }
                if (this.fabricCanvas) {
                    this.fabricCanvas.isDrawingMode = false;
                    this.fabricCanvas.discardActiveObject();
                    this.fabricCanvas.renderAll();
                }
            } else if (tool === 'forms') {
                // Forms mode: Forms layer is ON TOP (z-index 40)
                if (this.formsLayer) {
                    this.formsLayer.style.zIndex = '40';
                    this.formsLayer.style.pointerEvents = 'auto';
                    this.formsLayer.querySelectorAll('.form-field-hotspot').forEach(el => {
                        el.style.pointerEvents = 'auto';
                    });
                }
                if (this.textLayer) {
                    this.textLayer.style.zIndex = '20';
                    this.textLayer.style.pointerEvents = 'none';
                    this.textLayer.querySelectorAll('.text-hitbox').forEach(el => {
                        el.style.pointerEvents = 'none';
                    });
                }
                if (this.linksLayer) {
                    this.linksLayer.style.zIndex = '20';
                    this.linksLayer.style.pointerEvents = 'none';
                    this.linksLayer.querySelectorAll('.link-hotspot').forEach(el => {
                        el.style.pointerEvents = 'none';
                    });
                }
                if (this.fabricWrap) {
                    this.fabricWrap.style.zIndex = '30';
                    this.fabricWrap.style.pointerEvents = 'none';
                }
                if (this.fabricCanvas) {
                    this.fabricCanvas.isDrawingMode = false;
                    this.fabricCanvas.discardActiveObject();
                    this.fabricCanvas.renderAll();
                }
            } else {
                // Fabric Tools: add-text, images, sign, annotate, whiteout, shapes, draw
                if (this.fabricWrap) {
                    this.fabricWrap.style.zIndex = '40';
                    this.fabricWrap.style.pointerEvents = 'auto';
                }
                if (this.textLayer) {
                    this.textLayer.style.zIndex = '20';
                    this.textLayer.style.pointerEvents = 'none';
                    this.textLayer.querySelectorAll('.text-hitbox').forEach(el => {
                        el.style.pointerEvents = 'none';
                    });
                }
                if (this.linksLayer) {
                    this.linksLayer.style.zIndex = '20';
                    this.linksLayer.style.pointerEvents = 'none';
                    this.linksLayer.querySelectorAll('.link-hotspot').forEach(el => {
                        el.style.pointerEvents = 'none';
                    });
                }
                if (this.formsLayer) {
                    this.formsLayer.style.zIndex = '20';
                    this.formsLayer.style.pointerEvents = 'none';
                    this.formsLayer.querySelectorAll('.form-field-hotspot').forEach(el => {
                        el.style.pointerEvents = 'none';
                    });
                }
            }
            this.syncCanvasOffset();
        }

        _saveFabricState() {
            if (this._isRestoring) return;
            const page = window.EditorState.getActivePage();
            if (page && this.fabricCanvas) {
                page.fabricJson = this.fabricCanvas.toJSON([
                    'id', 'toolType', 'isWhiteout', 'isSignature', 'isAnnotation',
                    'annotType', 'isArrow', 'shapeStrokeWidth', 'textBackgroundColor',
                    'lockUniScaling', 'angle', 'opacity', 'fill', 'stroke', 'strokeWidth'
                ]);
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

            // 1. Resize Stage Container and all Synchronized Layers
            this.container.style.width = `${viewportWidth}px`;
            this.container.style.height = `${viewportHeight}px`;

            if (this.textLayer) {
                this.textLayer.style.width = `${viewportWidth}px`;
                this.textLayer.style.height = `${viewportHeight}px`;
            }
            if (this.linksLayer) {
                this.linksLayer.style.width = `${viewportWidth}px`;
                this.linksLayer.style.height = `${viewportHeight}px`;
            }
            if (this.formsLayer) {
                this.formsLayer.style.width = `${viewportWidth}px`;
                this.formsLayer.style.height = `${viewportHeight}px`;
            }
            if (this.fabricWrap) {
                this.fabricWrap.style.width = `${viewportWidth}px`;
                this.fabricWrap.style.height = `${viewportHeight}px`;
            }

            // 2. Render Layer 1: Base PDF.js Canvas
            await this._renderBaseCanvas(pageState, viewportWidth, viewportHeight);

            // 3. Render Layer 2: Dedicated Interactive Overlays (Text, Links, Forms)
            this._renderDomLayers(pageState, viewportWidth, viewportHeight);

            // 4. Render Layer 3: Fabric.js Canvas
            this._renderFabricLayer(pageState, viewportWidth, viewportHeight);

            this._applyLayerPointerEvents();
            this.syncCanvasOffset();
        }

        async _renderBaseCanvas(pageState, viewportWidth, viewportHeight) {
            if (this._currentRenderTask) {
                try {
                    this._currentRenderTask.cancel();
                } catch (e) {}
                this._currentRenderTask = null;
            }

            const dpr = window.devicePixelRatio || 1;
            this.baseCanvas.width = viewportWidth * dpr;
            this.baseCanvas.height = viewportHeight * dpr;
            this.baseCanvas.style.width = `${viewportWidth}px`;
            this.baseCanvas.style.height = `${viewportHeight}px`;

            const ctx = this.baseCanvas.getContext('2d', { willReadFrequently: true });
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

                const renderTask = pdfPage.render({
                    canvasContext: ctx,
                    viewport,
                });
                this._currentRenderTask = renderTask;
                await renderTask.promise;
                this._currentRenderTask = null;

                // Auto-sample authoritative background & text colors from clean rendered baseCanvas using official viewport
                if (window.TextExtractor && pageState.textBlocks.length > 0 && !pageState.textBlocks[0].sampled) {
                    pageState.textBlocks.forEach(b => {
                        b.pageWidthPt = pageState.widthPt || 612;
                        b.sampled = true;
                    });
                    window.TextExtractor.sampleBlockColors(this.baseCanvas, pageState.textBlocks, viewport);
                }
            } catch (err) {
                if (err && (err.name === 'RenderingCancelledException' || err.message?.includes('cancelled') || (typeof err === 'object' && Object.keys(err).length === 0))) {
                    return; // Normal cancellation when new render task supersedes
                }
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

        _renderDomLayers(pageState, viewportWidth, viewportHeight) {
            if (this.textLayer) this.textLayer.innerHTML = '';
            if (this.linksLayer) this.linksLayer.innerHTML = '';
            if (this.formsLayer) this.formsLayer.innerHTML = '';
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

                // Calibrate subtle letter-spacing on static display for unedited text; modified/custom-font lines use natural metrics
                let letterSpacingPx = 0;
                const isCustomOrModified = Boolean(block.modified || (block.fontFamily && block.fontFamily !== 'original'));
                if (block.fontFamily && block.fontFamily !== 'original') {
                    window.FontManager?.ensureFontLoaded?.(block.fontFamily, {
                        bold: Boolean(block.bold),
                        italic: Boolean(block.italic),
                        silent: true,
                    });
                }
                const expectedOrigPx = (block.origPdfWidth || block.pdfWidth) * scale;
                if (!isCustomOrModified && block.originalText && block.originalText.length > 1 && measureCtx) {
                    measureCtx.font = `${block.italic ? 'italic ' : ''}${block.bold ? '700 ' : '400 '}${fontSizePx}px ${cssFontFamily}`;
                    const measuredW = measureCtx.measureText(block.originalText).width;
                    if (measuredW > 0) {
                        letterSpacingPx = (expectedOrigPx - measuredW) / (block.originalText.length - 1);
                        letterSpacingPx = Math.max(-0.35, Math.min(2.5, letterSpacingPx));
                        block.widthRatio = expectedOrigPx / measuredW;
                    }
                }
                block.letterSpacingPx = letterSpacingPx;
                el.style.letterSpacing = isCustomOrModified ? 'normal' : `${letterSpacingPx.toFixed(2)}px`;
                el.style.transform = 'none';

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

                if (this.textLayer) this.textLayer.appendChild(el);
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

                if (this.linksLayer) this.linksLayer.appendChild(linkEl);
            }

            // C. Render Realistic Fillable AcroForm Fields (Zoom-Proportional Typography & Geometry)
            const scaledFontPx = Math.max(8, Math.round(11 * scale));
            const scaledCheckPx = Math.max(9, Math.round(13 * scale));
            const scaledCaretPx = Math.max(7, Math.round(10 * scale));
            const scaledPadX = Math.max(3, Math.round(6 * scale));
            const scaledRadiusPx = Math.max(2, Math.round(4 * scale));

            for (const field of pageState.formFields) {
                const [fx, fy, fw, fh] = field.rect.map(v => v * scale);
                const fieldEl = document.createElement('div');
                fieldEl.className = 'form-field-hotspot';
                if (field.type === 'checkbox') {
                    fieldEl.classList.add('form-field-checkbox');
                }
                if (this.selectedFormField && this.selectedFormField.id === field.id) {
                    fieldEl.classList.add('selected');
                }
                fieldEl.dataset.fieldId = field.id;
                fieldEl.style.left = `${fx}px`;
                fieldEl.style.top = `${fy}px`;
                fieldEl.style.width = `${fw}px`;
                fieldEl.style.height = `${fh}px`;
                fieldEl.style.borderRadius = `${field.type === 'checkbox' ? Math.max(2, Math.round(3 * scale)) : scaledRadiusPx}px`;
                if (field.type !== 'checkbox') {
                    fieldEl.style.padding = `0 ${scaledPadX}px`;
                }

                if (field.type === 'checkbox') {
                    const mark = document.createElement('span');
                    mark.className = 'form-field-checkbox-mark';
                    mark.style.fontSize = `${scaledCheckPx}px`;
                    mark.textContent = field.checked ? '✓' : '';
                    fieldEl.appendChild(mark);
                } else if (field.type === 'dropdown') {
                    const opts = Array.isArray(field.options) && field.options.length > 0 ? field.options : ['Option A', 'Option B'];
                    const previewText = field.defaultValue || opts[0] || field.name || 'Select...';
                    const textSpan = document.createElement('span');
                    textSpan.className = 'form-field-text-preview';
                    textSpan.style.fontSize = `${scaledFontPx}px`;
                    textSpan.textContent = previewText;
                    const caret = document.createElement('span');
                    caret.className = 'form-field-dropdown-caret';
                    caret.style.fontSize = `${scaledCaretPx}px`;
                    caret.style.marginLeft = `${Math.max(2, Math.round(4 * scale))}px`;
                    caret.textContent = '▾';
                    fieldEl.appendChild(textSpan);
                    fieldEl.appendChild(caret);
                } else {
                    const hasDefault = Boolean(field.defaultValue && field.defaultValue.trim());
                    const textSpan = document.createElement('span');
                    textSpan.className = `form-field-text-preview ${hasDefault ? '' : 'is-placeholder'}`;
                    textSpan.style.fontSize = `${scaledFontPx}px`;
                    textSpan.textContent = hasDefault ? field.defaultValue : (field.name || 'Text field');
                    fieldEl.appendChild(textSpan);
                }

                fieldEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const wasSelected = this.selectedFormField && this.selectedFormField.id === field.id;
                    this.selectedFormField = field;
                    this.selectedLink = null;
                    if (this.fabricCanvas) this.fabricCanvas.discardActiveObject();
                    document.querySelectorAll('.link-hotspot').forEach(el => el.classList.remove('selected'));
                    document.querySelectorAll('.form-field-hotspot').forEach(el => el.classList.remove('selected'));
                    fieldEl.classList.add('selected');

                    // Clicking an unselected or selected checkbox toggles default checked preview cleanly
                    // without tearing down the DOM element (preserving immediate dblclick).
                    if (field.type === 'checkbox' && (e.detail === 1 || wasSelected)) {
                        if (e.detail === 1) {
                            field.checked = !field.checked;
                            const mark = fieldEl.querySelector('.form-field-checkbox-mark');
                            if (mark) mark.textContent = field.checked ? '✓' : '';
                            pageState.hasEdits = true;
                            window.EditorState.pushSnapshot(`Toggle Checkbox ${field.name}`);
                        }
                    }

                    this._updateFloatingBar();
                });

                fieldEl.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    this.selectedFormField = field;
                    document.querySelectorAll('.form-field-hotspot').forEach(el => el.classList.remove('selected'));
                    fieldEl.classList.add('selected');
                    this._openFormFieldConfig(field);
                });

                if (this.formsLayer) this.formsLayer.appendChild(fieldEl);
            }
        }

        _measureInlineTextWidth(textVal, styleSource, block) {
            const fontSizePx = (block?.fontSizePt || 12) * this.currentScale;
            let canvasW = 0;
            const measureCtx = this.getMeasureContext();
            if (measureCtx) {
                measureCtx.font = `${block?.italic ? 'italic ' : ''}${block?.bold ? '700 ' : '400 '}${fontSizePx}px ${styleSource.style.fontFamily}`;
                canvasW = measureCtx.measureText(textVal || '').width;
            }

            let domW = 0;
            try {
                if (!this._domMeasureSpan) {
                    const span = document.createElement('span');
                    span.setAttribute('aria-hidden', 'true');
                    span.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;white-space:pre;pointer-events:none;line-height:1;letter-spacing:normal;margin:0;padding:0;';
                    document.body.appendChild(span);
                    this._domMeasureSpan = span;
                }
                const s = this._domMeasureSpan;
                s.style.fontFamily = styleSource.style.fontFamily;
                s.style.fontSize = styleSource.style.fontSize || `${fontSizePx}px`;
                s.style.fontWeight = styleSource.style.fontWeight || '400';
                s.style.fontStyle = styleSource.style.fontStyle || 'normal';
                s.textContent = textVal || '';
                domW = s.getBoundingClientRect().width;
            } catch (e) {}

            return Math.max(canvasW, domW);
        }

        _activateTextEdit(block, el) {
            this.selectedBlock = block;
            el.classList.add('editing');
            el.style.letterSpacing = 'normal';
            el.style.transform = 'none';
            el.innerHTML = '';
            const effectiveBg = (block.bgHex && block.bgHex !== 'transparent')
                ? block.bgHex
                : (block.autoBgHex || '#ffffff');
            el.style.backgroundColor = effectiveBg;

            const fontSizePx = (block.fontSizePt || 12) * this.currentScale;
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `inline-edit-${block.id}`;
            input.name = `inline-edit-${block.id}`;
            input.className = 'text-inline-input';
            input.setAttribute('aria-label', `Edit text: ${block.originalText || 'line'}`);
            input.value = block.currentText;
            input.style.color = block.colorHex || '#1e293b';
            input.style.fontFamily = el.style.fontFamily;
            input.style.fontSize = el.style.fontSize;
            input.style.fontWeight = el.style.fontWeight;
            input.style.fontStyle = el.style.fontStyle;
            input.style.letterSpacing = 'normal';
            input.style.transform = 'none';

            const updateExpandedWidth = (textVal) => {
                const textW = this._measureInlineTextWidth(textVal, input, block);
                const origW = Math.max(8, (block.origPdfWidth || block.pdfWidth) * this.currentScale);
                const headroom = Math.max(24, fontSizePx * 1.25);
                const newW = Math.max(origW, textW + headroom);
                el.style.width = `${newW}px`;
                input.style.width = `${newW}px`;
            };

            const resetScrollLeft = () => {
                if (input.scrollWidth <= input.clientWidth + 4 || document.activeElement !== input) {
                    input.scrollLeft = 0;
                }
            };

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
            updateExpandedWidth(input.value);
            input.focus();
            input.select();
            input.scrollLeft = 0;
            requestAnimationFrame(() => {
                updateExpandedWidth(input.value);
                input.scrollLeft = 0;
            });

            // Real-time subset coverage check and dynamic width expansion on typing
            input.addEventListener('input', () => {
                const val = input.value;
                const covered = window.FontManager.checkEmbeddedCoverage(block.embeddedBytes, val);
                const matchedName = block.matched?.name || 'Liberation Sans';
                if (block.fontFamily && block.fontFamily !== 'original' && window.FontManager?.getCssFamily) {
                    const customFam = window.FontManager.getCssFamily(block.fontFamily);
                    block.tier = 2;
                    fontPill.className = 'text-quick-pill tier2';
                    fontPill.textContent = `Font: ${customFam}`;
                    input.style.fontFamily = `"${customFam}", "Liberation Sans", sans-serif`;
                } else if (covered) {
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

                updateExpandedWidth(val);
                resetScrollLeft();
                requestAnimationFrame(resetScrollLeft);
            });

            ['keyup', 'click', 'focus'].forEach(evt => {
                input.addEventListener(evt, resetScrollLeft);
            });

            const finishEdit = () => {
                input.scrollLeft = 0;
                const newVal = input.value;
                if (newVal !== block.currentText) {
                    block.currentText = newVal;
                    block.modified = true;
                    const textW = this._measureInlineTextWidth(newVal, input, block);
                    if (textW > 0) {
                        block.pdfWidth = Math.max(block.origPdfWidth || block.pdfWidth, textW / this.currentScale);
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
            this.fabricCanvas.setZoom(this.currentScale);

            if (pageState.fabricJson) {
                this._isRestoring = true;
                this.fabricCanvas.loadFromJSON(pageState.fabricJson, () => {
                    this._isRestoring = false;
                    this.fabricCanvas.getObjects().forEach(obj => {
                        this._configureObjectControls(obj);
                    });
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

        _setupClickDismiss() {
            const dismissHandler = (e) => {
                if (e.target && e.target.closest && e.target.closest('#inline-properties-popover, #nopay-color-popover, #nopay-font-popover, #floating-object-bar')) {
                    return;
                }
                if (e.target === this.textLayer || e.target === this.linksLayer || e.target === this.formsLayer || e.target === this.container) {
                    this.closePropertiesPopover();
                    this.selectedLink = null;
                    this.selectedFormField = null;
                    document.querySelectorAll('.link-hotspot').forEach(el => el.classList.remove('selected'));
                    document.querySelectorAll('.form-field-hotspot').forEach(el => el.classList.remove('selected'));
                    this._hideFloatingBar();
                }
            };
            if (this.textLayer) this.textLayer.addEventListener('click', dismissHandler);
            if (this.linksLayer) this.linksLayer.addEventListener('click', dismissHandler);
            if (this.formsLayer) this.formsLayer.addEventListener('click', dismissHandler);
            if (this.container) this.container.addEventListener('click', dismissHandler);
        }

        _setupFloatingBarEvents() {
            const propBtn = document.getElementById('floating-btn-properties');
            const dupBtn = document.getElementById('floating-btn-duplicate');
            const delBtn = document.getElementById('floating-btn-delete');
            const fwdBtn = document.getElementById('floating-btn-forward');
            const bwdBtn = document.getElementById('floating-btn-backward');
            const rotLBtn = document.getElementById('floating-btn-rotate-left');
            const rotRBtn = document.getElementById('floating-btn-rotate-right');

            if (propBtn && !propBtn._bound) {
                propBtn._bound = true;
                propBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.selectedLink) this._openLinkConfig(this.selectedLink);
                    else if (this.selectedFormField) this._openFormFieldConfig(this.selectedFormField);
                });
            }

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

            if (rotLBtn && !rotLBtn._bound) {
                rotLBtn._bound = true;
                rotLBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.rotateActiveObject(-90);
                });
            }

            if (rotRBtn && !rotRBtn._bound) {
                rotRBtn._bound = true;
                rotRBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.rotateActiveObject(90);
                });
            }
        }

        rotateActiveObject(deltaDegrees) {
            const activeObj = this.fabricCanvas ? this.fabricCanvas.getActiveObject() : null;
            if (activeObj) {
                const currentAngle = activeObj.angle || 0;
                const newAngle = (currentAngle + deltaDegrees + 360) % 360;
                activeObj.set('angle', newAngle);
                activeObj.setCoords();
                this.fabricCanvas.renderAll();
                this._saveFabricState();
                window.EditorState.pushSnapshot(`Rotate ${deltaDegrees > 0 ? '+90°' : '-90°'}`);
                this._updateFloatingBar();
            }
        }

        _onFabricSelection() {
            this.selectedLink = null;
            this.selectedFormField = null;
            document.querySelectorAll('.link-hotspot').forEach(el => el.classList.remove('selected'));
            document.querySelectorAll('.form-field-hotspot').forEach(el => el.classList.remove('selected'));

            const activeObj = this.fabricCanvas ? this.fabricCanvas.getActiveObject() : null;
            const subToolbar = document.getElementById('context-sub-toolbar');

            if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text')) {
                this.activeFabricTextBox = activeObj;
                if (subToolbar) {
                    subToolbar.classList.remove('hidden');
                    const bgWrap = document.getElementById('sub-bg-color-wrap');
                    if (bgWrap) bgWrap.style.display = '';
                    const resetBtn = document.getElementById('sub-reset-btn');
                    if (resetBtn) resetBtn.style.display = 'none';

                    const fontTierPill = document.getElementById('sub-font-tier-pill');
                    if (fontTierPill) {
                        fontTierPill.classList.remove('hidden');
                        fontTierPill.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0';
                        fontTierPill.textContent = 'Added Vector Text';
                    }

                    const fontSelect = document.getElementById('sub-font-select');
                    const resolvedFontKey = (activeObj.fontFamily && window.FontManager?.resolveFontKey)
                        ? window.FontManager.resolveFontKey(activeObj.fontFamily)
                        : 'sans';
                    if (fontSelect) {
                        fontSelect.value = resolvedFontKey === 'original' ? 'sans' : resolvedFontKey;
                    }
                    window.NoPayFontPicker?.setAllowOriginal(false);
                    window.NoPayFontPicker?.setValue(resolvedFontKey === 'original' ? 'sans' : resolvedFontKey, { load: false });

                    const fontSizeInput = document.getElementById('sub-font-size');
                    if (fontSizeInput) fontSizeInput.value = (Math.round((activeObj.fontSize || 16) * 10) / 10).toString();

                    const textColorInput = document.getElementById('sub-text-color');
                    if (textColorInput && activeObj.fill) {
                        textColorInput.value = activeObj.fill;
                        window.NoPayColorPicker?.syncVisualState('sub-text-color');
                    }

                    const bgColorInput = document.getElementById('sub-bg-color');
                    if (bgColorInput) {
                        bgColorInput.value = activeObj.textBackgroundColor || '#ffffff';
                        const bgBinding = window.NoPayColorPicker?.bindings?.get('sub-bg-color');
                        if (bgBinding) {
                            bgBinding.clearMode = 'transparent';
                            bgBinding.clearLabel = 'Transparent';
                        }
                        window.NoPayColorPicker?.syncVisualState('sub-bg-color');
                    }

                    const boldBtn = document.getElementById('sub-bold-btn');
                    if (boldBtn) boldBtn.classList.toggle('active', activeObj.fontWeight === 'bold' || activeObj.fontWeight === 700 || activeObj.fontWeight === '700');

                    const italicBtn = document.getElementById('sub-italic-btn');
                    if (italicBtn) italicBtn.classList.toggle('active', activeObj.fontStyle === 'italic');
                }
            } else {
                this.activeFabricTextBox = null;
                if (this.activeTool !== 'add-text' && !this.selectedBlock) {
                    subToolbar?.classList.add('hidden');
                }
            }

            this._updateFloatingBar();
        }

        _onFabricSelectionCleared() {
            this.activeFabricTextBox = null;
            if (this.activeTool !== 'add-text' && !this.selectedBlock) {
                const subToolbar = document.getElementById('context-sub-toolbar');
                subToolbar?.classList.add('hidden');
            }
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
                const bound = activeObj.getBoundingRect(false);
                targetRect = {
                    left: bound.left,
                    top: bound.top,
                    width: bound.width,
                    height: bound.height,
                };
                if (activeObj.isSignature) badgeText = 'Signature';
                else if (activeObj.isWhiteout) badgeText = 'Whiteout';
                else if (activeObj.isAnnotation) {
                    badgeText = activeObj.annotType === 'underline' ? 'Underline' :
                                activeObj.annotType === 'strike' ? 'Strikethrough' : 'Highlight';
                }
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

            const propBtn = document.getElementById('floating-btn-properties');
            if (propBtn) {
                propBtn.classList.toggle('hidden', !(this.selectedLink || this.selectedFormField));
            }

            const fwdBtn = document.getElementById('floating-btn-forward');
            const bwdBtn = document.getElementById('floating-btn-backward');
            if (fwdBtn) fwdBtn.style.display = canReorder ? 'inline-flex' : 'none';
            if (bwdBtn) bwdBtn.style.display = canReorder ? 'inline-flex' : 'none';

            const rotLBtn = document.getElementById('floating-btn-rotate-left');
            const rotRBtn = document.getElementById('floating-btn-rotate-right');
            const rotDiv = document.getElementById('floating-divider-rotate');
            if (rotLBtn) rotLBtn.style.display = activeObj ? 'inline-flex' : 'none';
            if (rotRBtn) rotRBtn.style.display = activeObj ? 'inline-flex' : 'none';
            if (rotDiv) rotDiv.style.display = activeObj ? 'block' : 'none';

            bar.classList.remove('hidden');

            const barW = bar.offsetWidth || 180;
            const barH = bar.offsetHeight || 32;

            const stageW = (this.container && this.container.offsetWidth) || (this.baseCanvas ? this.baseCanvas.width : 600);

            // Center horizontally above object
            let left = targetRect.left + (targetRect.width / 2) - (barW / 2);
            left = Math.max(8, Math.min(stageW - barW - 8, left));

            // Keep >= 48px vertical clearance above selection box so Fabric's mtr rotation knob (-28px) has clean daylight
            const aboveOffset = activeObj ? 48 : 10;
            let top = targetRect.top - barH - aboveOffset;

            const mtr = activeObj && activeObj.oCoords ? activeObj.oCoords.mtr : null;
            const overlapsMtr = (testLeft, testTop) => {
                if (!mtr) return false;
                const pad = 16;
                return !(
                    testLeft + barW <= mtr.x - pad ||
                    testLeft >= mtr.x + pad ||
                    testTop + barH <= mtr.y - pad ||
                    testTop >= mtr.y + pad
                );
            };

            if (top < 8 || overlapsMtr(left, top)) {
                const mtrIsBelow = mtr && mtr.y > (targetRect.top + targetRect.height / 2);
                const belowOffset = mtrIsBelow ? 44 : 14;
                top = targetRect.top + targetRect.height + belowOffset;
            }

            bar.style.left = `${Math.round(left)}px`;
            bar.style.top = `${Math.round(top)}px`;
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
                    if (activeObj.isArrow) cloned.isArrow = true;
                    if (activeObj.shapeStrokeWidth !== undefined) cloned.shapeStrokeWidth = activeObj.shapeStrokeWidth;
                    if (activeObj.textBackgroundColor) cloned.textBackgroundColor = activeObj.textBackgroundColor;
                    if (activeObj.isAnnotation) {
                        cloned.isAnnotation = true;
                        cloned.annotType = activeObj.annotType;
                    }
                    this._configureObjectControls(cloned);

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
                    name: this._generateUniqueFormFieldName(orig.name, orig.type),
                    rect: [orig.rect[0] + 16, orig.rect[1] + 16, orig.rect[2], orig.rect[3]],
                    defaultValue: orig.defaultValue || '',
                    checked: Boolean(orig.checked),
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
            const targetTool = type === 'signature' ? 'sign' : 'images';
            if (this.activeTool !== targetTool) {
                this.setTool(targetTool);
            }
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

                const pt = this.clientToCanvasPoint(e.clientX, e.clientY);
                const clickX = pt.x;
                const clickY = pt.y;

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
                        isSignature: currentType === 'signature',
                    });
                    this._configureObjectControls(img);
                    const w = img.getScaledWidth();
                    const h = img.getScaledHeight();
                    img.set({
                        left: clickX - (w / 2),
                        top: clickY - (h / 2),
                    });
                    img.setCoords();

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
                if (this.placementMode && this._onPlacementClick) {
                    window.addEventListener('click', this._onPlacementClick);
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

        _generateUniqueFormFieldName(baseName = '', formType = 'text') {
            const pages = window.EditorState?.pages || [];
            const used = new Set();
            for (const p of pages) {
                for (const f of (p.formFields || [])) {
                    if (f && f.name) used.add(f.name);
                }
            }
            const cleaned = (baseName || '').trim();
            if (cleaned) {
                if (!used.has(cleaned)) return cleaned;
                let idx = 2;
                while (used.has(`${cleaned}_${idx}`)) idx++;
                return `${cleaned}_${idx}`;
            }
            const activePage = window.EditorState?.getActivePage();
            let idx = (activePage?.formFields?.length || 0) + 1;
            while (used.has(`${formType}_${idx}`)) idx++;
            return `${formType}_${idx}`;
        }

        startFormPlacement(type = 'text', customName = '') {
            this.cancelPlacement();
            this._exitActiveInteraction();
            this.formPlacementType = type;
            this.customFormName = (customName || '').trim();

            const ghost = document.getElementById('placement-ghost-preview');
            const ghostImg = document.getElementById('placement-ghost-img');
            const ghostBox = document.getElementById('placement-ghost-box');

            if (!ghost || !ghostBox) return;

            if (ghostImg) ghostImg.classList.add('hidden');
            ghostBox.classList.remove('hidden');
            ghost.classList.remove('hidden');

            const isCheckbox = type === 'checkbox';
            const w = (isCheckbox ? 18 : 140) * this.currentScale;
            const h = (isCheckbox ? 18 : 28) * this.currentScale;
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
                if (e.target && e.target.closest && e.target.closest('.form-field-hotspot, #inline-properties-popover, #nopay-color-popover, #nopay-font-popover, #floating-object-bar')) {
                    return;
                }
                const rect = this.container.getBoundingClientRect();
                if (
                    e.clientX < rect.left || e.clientX > rect.right ||
                    e.clientY < rect.top || e.clientY > rect.bottom
                ) {
                    return;
                }

                // 2-Click Exit-Before-Create guard for active selection/popover
                if (this._hasActiveInteraction()) {
                    this._exitActiveInteraction();
                    return;
                }

                const pt = this.clientToCanvasPoint(e.clientX, e.clientY);
                const clickX = pt.x;
                const clickY = pt.y;

                const formType = this.formPlacementType;
                const customFieldName = this.customFormName;
                const isCb = formType === 'checkbox';
                const fw = isCb ? 18 : 140;
                const fh = isCb ? 18 : 28;

                const page = window.EditorState.getActivePage();
                if (page) {
                    const uniqueName = this._generateUniqueFormFieldName(customFieldName, formType);
                    const newField = {
                        id: `ff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                        type: formType,
                        name: uniqueName,
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
            };

            window.addEventListener('pointermove', this._onPlacementMove);
            setTimeout(() => {
                if (this.formPlacementType && this._onPlacementClick) {
                    window.addEventListener('click', this._onPlacementClick);
                }
            }, 50);
        }

        addFormField(type = 'text', rect = null, options = {}) {
            const page = window.EditorState.getActivePage();
            if (!page) return null;
            const isCb = type === 'checkbox';
            const defaultRect = rect || [100, 100, isCb ? 18 : 140, isCb ? 18 : 28];
            const uniqueName = this._generateUniqueFormFieldName(options.name, type);
            const newField = {
                id: `ff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                type,
                name: uniqueName,
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
            if (!this.linksLayer) return;
            this.linksLayer.addEventListener('mousedown', (e) => {
                if (this.activeTool !== 'links') return;
                if (e.target && e.target.closest && e.target.closest('.link-hotspot, #inline-properties-popover, #nopay-color-popover, #nopay-font-popover, #floating-object-bar')) {
                    return;
                }
                // 2-Click Exit-Before-Create guard
                if (this._hasActiveInteraction()) {
                    this._exitActiveInteraction();
                    this._suppressLinkCreate = true;
                    this.isDrawingLink = false;
                    return;
                }
                this._suppressLinkCreate = false;
                const pt = this.clientToCanvasPoint(e.clientX, e.clientY);
                this.isDrawingLink = true;
                this.linkDrawStart = { x: pt.x, y: pt.y };
            });

            window.addEventListener('mouseup', (e) => {
                if (this._suppressLinkCreate) {
                    this._suppressLinkCreate = false;
                    this.isDrawingLink = false;
                    return;
                }
                if (!this.isDrawingLink || this.activeTool !== 'links' || !this.linksLayer) return;
                this.isDrawingLink = false;
                const endPt = this.clientToCanvasPoint(e.clientX, e.clientY);

                const x = Math.min(this.linkDrawStart.x, endPt.x);
                const y = Math.min(this.linkDrawStart.y, endPt.y);
                const w = Math.abs(endPt.x - this.linkDrawStart.x);
                const h = Math.abs(endPt.y - this.linkDrawStart.y);

                if (w > 15 && h > 10) {
                    this._createLinkPrompt([x, y, w, h]);
                }
            });
        }

        _setupPropertiesPopover() {
            const pop = document.getElementById('inline-properties-popover');
            if (!pop || pop._bound) return;
            pop._bound = true;

            ['mousedown', 'pointerdown', 'click'].forEach(evtName => {
                pop.addEventListener(evtName, (e) => e.stopPropagation());
            });

            const closeBtn = document.getElementById('prop-close-btn');
            const applyBtn = document.getElementById('prop-apply-btn');
            const delBtn = document.getElementById('prop-delete-btn');

            const applyChanges = (shouldClose = false) => {
                const ctx = this._popoverContext;
                if (!ctx) return;
                const page = window.EditorState.getActivePage();
                if (!page) return;

                if (ctx.kind === 'form') {
                    const f = ctx.item;
                    const nameInput = document.getElementById('prop-field-name');
                    const defInput = document.getElementById('prop-field-default');
                    const chkInput = document.getElementById('prop-field-checked');
                    const optInput = document.getElementById('prop-field-options');

                    const nextName = (nameInput?.value || '').trim();
                    if (nextName) f.name = nextName;
                    if (f.type === 'text' || f.type === 'textarea') {
                        f.defaultValue = defInput?.value || '';
                    } else if (f.type === 'checkbox') {
                        f.checked = Boolean(chkInput?.checked);
                    } else if (f.type === 'dropdown') {
                        const rawOpts = (optInput?.value || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                        if (rawOpts.length > 0) f.options = rawOpts;
                        f.defaultValue = defInput?.value?.trim() || f.options[0] || '';
                    }
                    page.hasEdits = true;
                    window.EditorState.pushSnapshot(`Configure Form Field ${f.name}`);
                    this.renderPage(this.currentPdfProxy);
                } else if (ctx.kind === 'link') {
                    const link = ctx.item;
                    const typeSel = document.getElementById('prop-link-type');
                    const targetInput = document.getElementById('prop-link-target');
                    const rawTarget = (targetInput?.value || '').trim();
                    if (rawTarget) {
                        const isPage = (typeSel?.value === 'page') || rawTarget.startsWith('#') || /^\d+$/.test(rawTarget);
                        link.type = isPage ? 'page' : 'url';
                        link.target = isPage ? rawTarget.replace(/^#/, '') : rawTarget;
                        page.hasEdits = true;
                        window.EditorState.pushSnapshot('Update Link');
                        this.renderPage(this.currentPdfProxy);
                    }
                }
                if (shouldClose) {
                    this.closePropertiesPopover();
                }
            };

            closeBtn?.addEventListener('click', () => this.closePropertiesPopover());
            applyBtn?.addEventListener('click', () => applyChanges(true));

            pop.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    applyChanges(true);
                } else if (e.key === 'Escape') {
                    e.stopPropagation();
                    this.closePropertiesPopover();
                }
            });

            delBtn?.addEventListener('click', () => {
                const ctx = this._popoverContext;
                const page = window.EditorState.getActivePage();
                if (!ctx || !page) return;
                if (ctx.kind === 'form') {
                    page.formFields = page.formFields.filter(f => f.id !== ctx.item.id);
                    if (this.selectedFormField && this.selectedFormField.id === ctx.item.id) {
                        this.selectedFormField = null;
                    }
                    window.EditorState.pushSnapshot('Delete Form Field');
                } else if (ctx.kind === 'link') {
                    page.links = page.links.filter(l => l.id !== ctx.item.id);
                    if (this.selectedLink && this.selectedLink.id === ctx.item.id) {
                        this.selectedLink = null;
                    }
                    window.EditorState.pushSnapshot('Delete Link');
                }
                page.hasEdits = true;
                this.closePropertiesPopover();
                this.renderPage(this.currentPdfProxy);
                this._hideFloatingBar();
            });
        }

        _positionPropertiesPopover(rect) {
            const pop = document.getElementById('inline-properties-popover');
            if (!pop || !this.container) return;
            const stageRect = this.container.getBoundingClientRect();
            const [rx, ry, rw, rh] = rect.map(v => v * this.currentScale);
            const popW = pop.offsetWidth || 260;
            const popH = pop.offsetHeight || 220;

            let left = stageRect.left + rx;
            left = Math.max(8, Math.min(window.innerWidth - popW - 8, left));

            let top = stageRect.top + ry + rh + 10;
            if (top + popH > window.innerHeight - 8) {
                top = Math.max(8, stageRect.top + ry - popH - 10);
            }

            pop.style.left = `${Math.round(left)}px`;
            pop.style.top = `${Math.round(top)}px`;
        }

        closePropertiesPopover() {
            const pop = document.getElementById('inline-properties-popover');
            if (pop) pop.classList.add('hidden');
            this._popoverContext = null;
        }

        _createLinkPrompt(rect) {
            const page = window.EditorState.getActivePage();
            if (!page) return null;

            const newLink = {
                id: `link-${Date.now().toString(36)}`,
                rect,
                type: 'url',
                target: 'https://',
            };
            page.links.push(newLink);
            page.hasEdits = true;
            this.selectedLink = newLink;
            window.EditorState.pushSnapshot('Add Link');
            this.renderPage(this.currentPdfProxy).then(() => {
                this._openLinkConfig(newLink);
            });
            this._updateFloatingBar();
            return newLink;
        }

        _openLinkConfig(link) {
            this._setupPropertiesPopover();
            const pop = document.getElementById('inline-properties-popover');
            if (!pop || !link) return;

            this._popoverContext = { kind: 'link', item: link };
            document.getElementById('prop-popover-title').textContent = 'Link Properties';
            document.getElementById('prop-form-fields')?.classList.add('hidden');
            document.getElementById('prop-link-fields')?.classList.remove('hidden');

            const typeSel = document.getElementById('prop-link-type');
            const targetInput = document.getElementById('prop-link-target');
            if (typeSel) typeSel.value = link.type === 'page' ? 'page' : 'url';
            if (targetInput) targetInput.value = link.target || 'https://';

            pop.classList.remove('hidden');
            this._positionPropertiesPopover(link.rect);
            targetInput?.focus();
            targetInput?.select();
        }

        _openFormFieldConfig(field) {
            this._setupPropertiesPopover();
            const pop = document.getElementById('inline-properties-popover');
            if (!pop || !field) return;

            this._popoverContext = { kind: 'form', item: field };
            const titleLabel = field.type === 'checkbox' ? 'Checkbox Properties' :
                               field.type === 'dropdown' ? 'Dropdown Properties' : 'Text Field Properties';
            document.getElementById('prop-popover-title').textContent = titleLabel;
            document.getElementById('prop-link-fields')?.classList.add('hidden');
            document.getElementById('prop-form-fields')?.classList.remove('hidden');

            const nameInput = document.getElementById('prop-field-name');
            const defWrap = document.getElementById('prop-default-wrap');
            const defInput = document.getElementById('prop-field-default');
            const chkWrap = document.getElementById('prop-checked-wrap');
            const chkInput = document.getElementById('prop-field-checked');
            const optWrap = document.getElementById('prop-options-wrap');
            const optInput = document.getElementById('prop-field-options');

            if (nameInput) nameInput.value = field.name || '';
            if (field.type === 'checkbox') {
                defWrap?.classList.add('hidden');
                chkWrap?.classList.remove('hidden');
                optWrap?.classList.add('hidden');
                if (chkInput) chkInput.checked = Boolean(field.checked);
            } else if (field.type === 'dropdown') {
                defWrap?.classList.remove('hidden');
                chkWrap?.classList.add('hidden');
                optWrap?.classList.remove('hidden');
                if (defInput) defInput.value = field.defaultValue || '';
                if (optInput) optInput.value = Array.isArray(field.options) ? field.options.join(', ') : '';
            } else {
                defWrap?.classList.remove('hidden');
                chkWrap?.classList.add('hidden');
                optWrap?.classList.add('hidden');
                if (defInput) defInput.value = field.defaultValue || '';
            }

            pop.classList.remove('hidden');
            this._positionPropertiesPopover(field.rect);
            nameInput?.focus();
            nameInput?.select();
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
                textBackgroundColor: options.textBackgroundColor || '',
                fontFamily: options.fontFamily || 'Liberation Sans',
                lockUniScaling: true,
                objectCaching: false,
                ...options,
            });
            this._configureObjectControls(t);
            this.fabricCanvas.add(t);
            this.activeFabricTextBox = t;
            this.fabricCanvas.setActiveObject(t);
            this.fabricCanvas.renderAll();
            this._saveFabricState();
            window.EditorState.pushSnapshot('Add Text');
            this._updateFloatingBar();
            return t;
        }

        getNearestTextBlockStyle(clickPtX, clickPtY) {
            const defaultStyle = {
                fontFamily: 'Liberation Sans',
                fontSize: 16,
                fill: '#1e293b',
                bold: false,
                italic: false,
                snappedBoxTop: null,
                dyToNearest: Infinity,
            };

            const pageState = window.EditorState.getActivePage();
            if (!pageState || !pageState.textBlocks || pageState.textBlocks.length === 0) {
                return defaultStyle;
            }

            // Compare in unscaled PDF scene points matching clientToCanvasPoint()
            const pageHeightPt = pageState.heightPt || 792;

            let closestBlock = null;
            let minDistance = Infinity;
            let closestBoxTop = null;
            let closestDy = Infinity;

            for (const b of pageState.textBlocks) {
                const baselineY = pageHeightPt - (b.baselinePdfY !== undefined ? b.baselinePdfY : b.pdfY);
                const ascentRatio = b.ascentRatio || 0.85;
                const descentRatio = b.descentRatio || -0.20;
                const fontSizePt = b.fontSizePt || 12;
                const boxTop = baselineY - (fontSizePt * ascentRatio);
                const boxLeft = b.pdfX;
                const boxWidth = b.origPdfWidth || b.pdfWidth || 50;
                const boxHeight = fontSizePt * (ascentRatio + Math.abs(descentRatio));

                const centerX = boxLeft + (boxWidth / 2);
                const centerY = boxTop + (boxHeight / 2);

                const dx = Math.abs(centerX - clickPtX);
                const dy = Math.abs(centerY - clickPtY);

                // Prioritize lines in the same horizontal band
                const weight = dy < 25 ? (dy * 1.5 + dx * 0.5) : Math.sqrt(dx * dx + dy * dy);

                if (weight < minDistance) {
                    minDistance = weight;
                    closestBlock = b;
                    closestBoxTop = boxTop;
                    closestDy = dy;
                }
            }

            if (!closestBlock) return defaultStyle;

            const rawFamily = closestBlock.fontFamily
                ? window.FontManager.getCssFamily(closestBlock.fontFamily)
                : (closestBlock.matched?.cssName || closestBlock.matched?.name || 'Liberation Sans');
            const rawPt = closestBlock.fontSizePt || 14;
            const clampedSize = Math.max(6, Math.min(96, Math.round(rawPt * 2) / 2));
            const color = closestBlock.colorHex || '#1e293b';
            const bold = Boolean(closestBlock.bold || closestBlock.isBold);
            const italic = Boolean(closestBlock.italic || closestBlock.isItalic);

            return {
                fontFamily: rawFamily,
                fontSize: clampedSize,
                fill: color,
                bold,
                italic,
                snappedBoxTop: closestBoxTop,
                dyToNearest: closestDy,
            };
        }

        addWhiteoutBox(coordsOrOptions = {}, fillColor = null) {
            if (!this.fabricCanvas) return;
            let left = 120, top = 120, width = 150, height = 40, fill = fillColor;
            let lockUniScaling = true;

            if (Array.isArray(coordsOrOptions)) {
                [left, top, width, height] = coordsOrOptions;
            } else if (typeof coordsOrOptions === 'object' && coordsOrOptions !== null) {
                if (coordsOrOptions.left !== undefined) left = coordsOrOptions.left;
                if (coordsOrOptions.top !== undefined) top = coordsOrOptions.top;
                if (coordsOrOptions.width !== undefined) width = coordsOrOptions.width;
                if (coordsOrOptions.height !== undefined) height = coordsOrOptions.height;
                if (coordsOrOptions.fill !== undefined) fill = coordsOrOptions.fill;
                if (coordsOrOptions.lockUniScaling !== undefined) lockUniScaling = coordsOrOptions.lockUniScaling;
            }

            const colorInput = document.getElementById('whiteout-fill-color');
            const defaultFill = colorInput ? colorInput.value : '#ffffff';
            fill = fill || defaultFill || '#ffffff';

            const rect = new fabric.Rect({
                left,
                top,
                width: Math.max(10, width),
                height: Math.max(8, height),
                fill: fill,
                stroke: null,
                strokeWidth: 0,
                lockUniScaling: lockUniScaling,
                isWhiteout: true,
            });
            this._configureObjectControls(rect);
            this.fabricCanvas.add(rect);
            this.fabricCanvas.setActiveObject(rect);
            this.fabricCanvas.renderAll();
            this._saveFabricState();
            window.EditorState.pushSnapshot('Add Whiteout');
            this._updateFloatingBar();
            return rect;
        }

        addAnnotation(type = 'highlight', rect = null, color = null) {
            if (!this.fabricCanvas) return;
            const chosenColor = color || this.annotateColor || '#fef08a';
            const defaultRect = rect || [100, 100, 180, 24];
            const [x, y, w, h] = defaultRect;

            let annotObj;
            if (type === 'underline') {
                // Anchor underline cleanly right under the baseline of dragged line or closest overlapping text block
                let ulTop = h > 5 ? (y + h - 2) : y;
                const pageState = window.EditorState.getActivePage();
                if (pageState && Array.isArray(pageState.textBlocks) && pageState.textBlocks.length > 0) {
                    const pageH = pageState.heightPt || 792;
                    const midY = y + h / 2;
                    let bestDist = Infinity;
                    let snappedBaselineY = null;
                    for (const b of pageState.textBlocks) {
                        const bw = b.origPdfWidth || b.pdfWidth || 40;
                        const horizOverlap = (x <= b.pdfX + bw + 8) && (x + w >= b.pdfX - 8);
                        if (!horizOverlap) continue;
                        const baselineY = pageH - (b.baselinePdfY !== undefined ? b.baselinePdfY : b.pdfY);
                        const d = Math.abs(baselineY - (h > 5 ? (y + h) : midY));
                        if (d < 16 && d < bestDist) {
                            bestDist = d;
                            snappedBaselineY = baselineY + 1.5;
                        }
                    }
                    if (snappedBaselineY !== null) {
                        ulTop = snappedBaselineY;
                    }
                }

                annotObj = new fabric.Rect({
                    left: x,
                    top: ulTop,
                    width: Math.max(10, w),
                    height: 2.5,
                    angle: 0,
                    fill: chosenColor,
                    opacity: 0.92,
                    padding: 8,
                    perPixelTargetFind: false,
                    lockUniScaling: false,
                    isAnnotation: true,
                    annotType: 'underline',
                });
            } else if (type === 'strike') {
                annotObj = new fabric.Rect({
                    left: x,
                    top: h > 4 ? (y + (h / 2) - 1.5) : y,
                    width: Math.max(10, w),
                    height: 2.5,
                    angle: 0,
                    fill: chosenColor,
                    opacity: 0.92,
                    padding: 8,
                    perPixelTargetFind: false,
                    lockUniScaling: false,
                    isAnnotation: true,
                    annotType: 'strike',
                });
            } else {
                // Single crisp Highlight Rect rendered directly on Fabric canvas (zero DOM duplication)
                annotObj = new fabric.Rect({
                    left: x,
                    top: y,
                    width: Math.max(10, w),
                    height: Math.max(10, h),
                    fill: chosenColor,
                    opacity: 0.28,
                    lockUniScaling: false,
                    isAnnotation: true,
                    annotType: 'highlight',
                });
            }

            this._configureObjectControls(annotObj);
            this.fabricCanvas.add(annotObj);
            this.fabricCanvas.setActiveObject(annotObj);
            this.fabricCanvas.renderAll();
            this._saveFabricState();
            const typeLabel = type === 'underline' ? 'Underline' : type === 'strike' ? 'Strikethrough' : 'Highlight';
            window.EditorState.pushSnapshot(`Add ${typeLabel}`);
            this._updateFloatingBar();
            return annotObj;
        }

        addShape(type = 'rect', options = {}) {
            if (!this.fabricCanvas) return;
            let shape;
            const strokeColor = options.stroke || this.shapeStrokeColor || document.getElementById('shape-stroke-color')?.value || '#2563eb';
            const strokeWidth = options.strokeWidth !== undefined ? options.strokeWidth : (parseInt(document.getElementById('shape-stroke-width')?.value || '2', 10));
            const isTransparent = options.fillTransparent !== undefined ? options.fillTransparent : (document.getElementById('shape-fill-transparent')?.checked ?? true);
            const fillColor = isTransparent ? 'transparent' : (options.fill || document.getElementById('shape-fill-color')?.value || '#ffffff');

            const base = {
                left: options.left !== undefined ? options.left : 150,
                top: options.top !== undefined ? options.top : 150,
                fill: fillColor,
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                lockUniScaling: true,
                ...options,
            };

            const w = options.width !== undefined ? options.width : 120;
            const h = options.height !== undefined ? options.height : ((type === 'line' || type === 'arrow') ? 0 : 80);

            if (type === 'rect') {
                shape = new fabric.Rect({ ...base, width: w, height: h });
            } else if (type === 'circle') {
                shape = new fabric.Circle({ ...base, radius: options.radius || Math.max(w, h) / 2 });
            } else if (type === 'line') {
                const x1 = options.x1 !== undefined ? options.x1 : base.left;
                const y1 = options.y1 !== undefined ? options.y1 : base.top;
                const x2 = options.x2 !== undefined ? options.x2 : (x1 + w);
                const y2 = options.y2 !== undefined ? options.y2 : (y1 + h);
                shape = new fabric.Line([x1, y1, x2, y2], {
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    strokeLineCap: 'round',
                    lockUniScaling: true,
                    perPixelTargetFind: false,
                    padding: 8,
                });
            } else if (type === 'arrow') {
                const x1 = options.x1 !== undefined ? options.x1 : base.left;
                const y1 = options.y1 !== undefined ? options.y1 : base.top;
                const x2 = options.x2 !== undefined ? options.x2 : (x1 + w);
                const y2 = options.y2 !== undefined ? options.y2 : (y1 + h);
                const dx = x2 - x1;
                const dy = y2 - y1;
                const dist = Math.hypot(dx, dy) || 1;
                const theta = Math.atan2(dy, dx);
                const headLen = Math.max(12, Math.min(36, strokeWidth * 4.5));
                const headWidth = headLen * 0.9;
                const shaftTrim = Math.min(dist * 0.65, headLen * 0.72);
                const shaftEndX = x2 - Math.cos(theta) * shaftTrim;
                const shaftEndY = y2 - Math.sin(theta) * shaftTrim;

                const line = new fabric.Line([x1, y1, shaftEndX, shaftEndY], {
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    strokeLineCap: 'butt',
                });
                const triangle = new fabric.Triangle({
                    left: x2,
                    top: y2,
                    originX: 'center',
                    originY: 'top',
                    angle: (theta * 180 / Math.PI) + 90,
                    width: headWidth,
                    height: headLen,
                    fill: strokeColor,
                    strokeWidth: 0,
                });
                shape = new fabric.Group([line, triangle], {
                    isArrow: true,
                    shapeStrokeWidth: strokeWidth,
                    lockUniScaling: true,
                    perPixelTargetFind: false,
                    padding: 8,
                });
            }

            if (shape) {
                this._configureObjectControls(shape);
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
                    isSignature: true,
                });
                this._configureObjectControls(img);
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
                });
                this._configureObjectControls(img);
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
