/**
 * NoPayPDF - PDF Exporter Module (window.PdfExporter)
 *
 * Hybrid vector-preserving PDF export pipeline:
 * 1. Vector page assembly & fontkit TrueType subsetting
 * 2. Selective text masking & redrawing
 * 3. High-DPI Fabric overlay stamping (2.5x multiplier)
 * 4. Genuine native PDF /Link annotation dictionaries
 * 5. Native AcroForm fields (TextField, CheckBox, Dropdown)
 * 6. Optional irreversible redaction ("Flatten Edited Pages")
 * 100% Client-Side. Permissive MIT / Apache 2.0 compatible.
 */

(function (window) {
    'use strict';

    function hexToRgb(hex = '#000000') {
        if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
            return window.PDFLib.rgb(1, 1, 1);
        }
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        if (c.length !== 6) return window.PDFLib.rgb(1, 1, 1);
        const num = parseInt(c, 16);
        if (isNaN(num)) return window.PDFLib.rgb(1, 1, 1);
        const r = ((num >> 16) & 255) / 255;
        const g = ((num >> 8) & 255) / 255;
        const b = (num & 255) / 255;
        return window.PDFLib.rgb(r, g, b);
    }

    /**
     * Resolve effective visible PDF box (intersection of MediaBox and CropBox matching PDF.js page.view).
     */
    function getEffectivePageBox(pdfPage) {
        const media = typeof pdfPage.getMediaBox === 'function'
            ? pdfPage.getMediaBox()
            : { x: 0, y: 0, width: pdfPage.getWidth(), height: pdfPage.getHeight() };
        const crop = typeof pdfPage.getCropBox === 'function' ? pdfPage.getCropBox() : null;
        if (!crop) return media;
        const x1 = Math.max(media.x, crop.x);
        const y1 = Math.max(media.y, crop.y);
        const x2 = Math.min(media.x + media.width, crop.x + crop.width);
        const y2 = Math.min(media.y + media.height, crop.y + crop.height);
        if (x2 > x1 && y2 > y1) {
            return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
        }
        return media;
    }

    /**
     * Convert Fabric unscaled top-left object coordinates (including angle rotation) into PDF bottom-left coords.
     */
    function fabricRectToPdfParams(o, pageBox) {
        const oLeft = o.left || 0;
        const oTop = o.top || 0;
        const pdfWidth = (o.width || 0) * (o.scaleX || 1);
        const pdfHeight = (o.height || 0) * (o.scaleY || 1);
        const angleDeg = o.angle || 0;
        const alpha = (angleDeg * Math.PI) / 180;
        const blScreenX = oLeft - pdfHeight * Math.sin(alpha);
        const blScreenY = oTop + pdfHeight * Math.cos(alpha);
        return {
            x: pageBox.x + blScreenX,
            y: pageBox.y + pageBox.height - blScreenY,
            width: pdfWidth,
            height: pdfHeight,
            angleDeg,
        };
    }

    const PdfExporter = {
        /**
         * Export the edited PDF document.
         * @param {Object} options { flattenForms: boolean, flattenEditedPages: boolean, onProgress: function }
         * @returns {Promise<Uint8Array>}
         */
        async exportPdf(options = {}) {
            const {
                flattenForms = false,
                flattenEditedPages = false,
                onProgress = () => {},
            } = options;

            const state = window.EditorState;
            const { PDFDocument, PDFName, PDFString } = window.PDFLib;

            onProgress(10, 'Initializing Document Assembler...');

            // 1. Create target document
            const pdfDoc = await PDFDocument.create();
            if (window.fontkit && typeof pdfDoc.registerFontkit === 'function') {
                pdfDoc.registerFontkit(window.fontkit);
            }

            // Load source document for page copying
            let sourceDoc = null;
            if (state.originalArrayBuffer) {
                sourceDoc = await PDFDocument.load(state.originalArrayBuffer.slice(0), { ignoreEncryption: true });
            }

            const totalPages = state.pages.length;
            const createdPages = [];

            // 2. Assemble Pages
            for (let i = 0; i < totalPages; i++) {
                onProgress(15 + Math.round((i / totalPages) * 35), `Assembling Page ${i + 1} of ${totalPages}...`);
                const pageState = state.pages[i];

                let targetPage;
                if (pageState.sourcePageIndex !== null && sourceDoc) {
                    const [copied] = await pdfDoc.copyPages(sourceDoc, [pageState.sourcePageIndex]);
                    targetPage = pdfDoc.addPage(copied);
                } else {
                    targetPage = pdfDoc.addPage([pageState.widthPt || 612, pageState.heightPt || 792]);
                }
                createdPages.push(targetPage);

                // Layer 1: Existing-Text Edits (Content Stream Rewrite / Tight Mask & Redraw)
                await this._applyTextEdits(pdfDoc, targetPage, pageState);

                // Layer 2: Crisp Vector Whiteout Cover Boxes
                this._stampWhiteoutVectors(targetPage, pageState);

                // Layer 3: High-DPI Fabric.js Layer (Shapes, Arrows, Images, Signatures, Freehand Ink)
                await this._stampFabricLayer(pdfDoc, targetPage, pageState);

                // Layer 4: Vector Highlight Annotations with Multiply Blending
                this._stampHighlightAnnotations(pdfDoc, targetPage, pageState);

                // Layer 5: Added Vector Text Boxes with Embedded TrueType Fonts
                await this._stampAddedVectorText(pdfDoc, targetPage, pageState);

                // Layer 6: Native Links & AcroForm Fields
                this._attachNativeLinks(pdfDoc, targetPage, pageState, createdPages);
                this._createAcroFormFields(pdfDoc, targetPage, pageState);
            }

            // Handle Form Flattening
            if (flattenForms) {
                onProgress(75, 'Flattening Form Fields...');
                try {
                    const form = pdfDoc.getForm();
                    form.flatten();
                } catch (e) {
                    console.warn('Form flattening skipped:', e);
                }
            }

            // Handle Irreversible Redaction ("Flatten Edited Pages")
            let outDoc = pdfDoc;
            if (flattenEditedPages) {
                onProgress(82, 'Applying Irreversible Redaction Flattening...');
                outDoc = await this._flattenRedactedPages(pdfDoc, state.pages);
            }

            onProgress(95, 'Finalizing Vector PDF Byte Stream...');
            const finalBytes = await outDoc.save();
            onProgress(100, 'Export Complete!');
            return finalBytes;
        },

        async _applyTextEdits(pdfDoc, pdfPage, pageState) {
            const blocks = pageState.textBlocks || [];
            const hasEdits = blocks.some(b => b.modified || b.deleted);
            if (!hasEdits) return;

            // 1. Surgical Content Stream Rewriting / Removal
            let removedBlockIds = new Set();
            let inPlaceRewrittenBlockIds = new Set();
            if (window.ContentStreamEditor && typeof window.ContentStreamEditor.rewriteOrRemoveTextRuns === 'function') {
                try {
                    const result = await window.ContentStreamEditor.rewriteOrRemoveTextRuns(pdfDoc, pdfPage, pageState);
                    removedBlockIds = result.removedBlockIds || new Set();
                    inPlaceRewrittenBlockIds = result.inPlaceRewrittenBlockIds || new Set();
                } catch (err) {
                    console.warn('Content stream text rewriting failed, using vector mask fallback:', err);
                }
            } else if (window.ContentStreamEditor && typeof window.ContentStreamEditor.removeEditedTextRuns === 'function') {
                try {
                    const result = await window.ContentStreamEditor.removeEditedTextRuns(pdfDoc, pdfPage, pageState);
                    if (result instanceof Set) {
                        removedBlockIds = result;
                        inPlaceRewrittenBlockIds = result.inPlaceRewrittenBlockIds || new Set();
                    } else if (result) {
                        removedBlockIds = result.removedBlockIds || new Set();
                        inPlaceRewrittenBlockIds = result.inPlaceRewrittenBlockIds || new Set();
                    }
                } catch (err) {
                    console.warn('Content stream text removal failed, using vector mask fallback:', err);
                }
            }

            // 2. Process Blocks:
            // - inPlaceRewritten: Native stream already rewritten with original /F# font, size, & color. Zero cover rect, zero stamped text!
            // - removed: Stream operator removed. Zero cover rect, stamp replacement text using matched font.
            // - fallback (neither): Draw vector background cover rectangle, then stamp replacement text.
            for (const b of blocks) {
                if (!b.modified && !b.deleted) {
                    continue; // Leave 100% original vectors untouched
                }

                const baselineY = b.baselinePdfY !== undefined ? b.baselinePdfY : b.pdfY;
                const wasInPlaceRewritten = inPlaceRewrittenBlockIds.has(b.id);
                const wasStreamRemoved = removedBlockIds.has(b.id);

                if (wasInPlaceRewritten) {
                    // Native in-place rewriting succeeded!
                    // ZERO cover rectangle, ZERO stamped fallback text! The original font, weight, and graphics state are 100% preserved natively.
                    continue;
                }

                if (!wasStreamRemoved) {
                    // Fallback: Draw tight vector background cover rectangle sized strictly to original text bounds
                    if (b.bgHex && b.bgHex !== 'transparent') {
                        const pad = 0.8;
                        const ascentRatio = b.ascentRatio || 0.85;
                        const descentRatio = b.descentRatio || -0.20;
                        const origMaskW = b.origPdfWidth || b.pdfWidth || 10;

                        const rectX = b.pdfX - pad;
                        const rectY = baselineY - (b.fontSizePt * Math.abs(descentRatio)) - pad;
                        const rectW = origMaskW + (pad * 2);
                        const rectH = (b.fontSizePt * (ascentRatio + Math.abs(descentRatio))) + (pad * 2);

                        const coverColor = (b.bgHex && b.bgHex.startsWith('#')) ? b.bgHex : (b.autoBgHex || '#ffffff');
                        pdfPage.drawRectangle({
                            x: rectX,
                            y: rectY,
                            width: rectW,
                            height: rectH,
                            color: hexToRgb(coverColor),
                        });
                    }
                }

                // Draw replacement text if not deleted using 2-Tier font embedding at exact point size
                if (b.modified && !b.deleted && b.currentText) {
                    const embedResult = await window.FontManager.embedFontForBlock(pdfDoc, b, b.currentText);
                    const font = embedResult.font;

                    pdfPage.drawText(b.currentText, {
                        x: b.pdfX,
                        y: baselineY,
                        size: b.fontSizePt,
                        font,
                        color: hexToRgb(b.colorHex || '#1e293b'),
                    });
                }
            }
        },

        _stampWhiteoutVectors(pdfPage, pageState) {
            const json = pageState.fabricJson;
            if (!json || !json.objects || json.objects.length === 0) return;

            const pageBox = getEffectivePageBox(pdfPage);
            for (const o of json.objects) {
                if (!o.isWhiteout) continue;
                const geom = fabricRectToPdfParams(o, pageBox);
                if (geom.width <= 0 || geom.height <= 0) continue;

                const drawOpts = {
                    x: geom.x,
                    y: geom.y,
                    width: geom.width,
                    height: geom.height,
                    color: hexToRgb(o.fill || '#ffffff'),
                    opacity: o.opacity !== undefined ? o.opacity : 1,
                };
                if (geom.angleDeg) {
                    drawOpts.rotate = window.PDFLib.degrees(-geom.angleDeg);
                }
                pdfPage.drawRectangle(drawOpts);
            }
        },

        async _stampFabricLayer(pdfDoc, pdfPage, pageState) {
            const json = pageState.fabricJson;
            if (!json || !json.objects || json.objects.length === 0) {
                return;
            }

            const isVectorExportedObject = (o) =>
                o.type === 'i-text' ||
                o.type === 'text' ||
                o.type === 'textbox' ||
                Boolean(o.isWhiteout) ||
                (Boolean(o.isAnnotation) && o.annotType === 'highlight');

            const hasRasterizable = json.objects.some(o => !isVectorExportedObject(o));
            if (!hasRasterizable) {
                return;
            }

            const pageBox = getEffectivePageBox(pdfPage);
            const pageWidth = pageBox.width;
            const pageHeight = pageBox.height;

            // Offscreen static canvas with fixed 1x backing store scaled cleanly by 3x multiplier
            const staticCanvasEl = document.createElement('canvas');
            const staticCanvas = new fabric.StaticCanvas(staticCanvasEl, {
                width: pageWidth,
                height: pageHeight,
                enableRetinaScaling: false,
            });

            await new Promise((resolve) => {
                staticCanvas.loadFromJSON(json, () => {
                    const objs = staticCanvas.getObjects();
                    for (const o of objs) {
                        if (isVectorExportedObject(o)) {
                            o.visible = false;
                        }
                    }
                    staticCanvas.renderAll();
                    resolve();
                });
            });

            const pngDataUrl = staticCanvas.toDataURL({
                format: 'png',
                multiplier: 3,
            });

            const objs = staticCanvas.getObjects();
            for (const o of objs) {
                if (isVectorExportedObject(o)) {
                    o.visible = true;
                }
            }
            staticCanvas.renderAll();

            const embeddedPng = await pdfDoc.embedPng(pngDataUrl);
            pdfPage.drawImage(embeddedPng, {
                x: pageBox.x,
                y: pageBox.y,
                width: pageWidth,
                height: pageHeight,
            });

            staticCanvasEl.width = 0;
            staticCanvasEl.height = 0;
        },

        _stampHighlightAnnotations(pdfDoc, pdfPage, pageState) {
            const json = pageState.fabricJson;
            if (!json || !json.objects || json.objects.length === 0) return;

            const pageBox = getEffectivePageBox(pdfPage);

            for (const o of json.objects) {
                if (!o.isAnnotation || o.annotType !== 'highlight') continue;

                const geom = fabricRectToPdfParams(o, pageBox);
                const color = hexToRgb(o.fill || '#fef08a');
                const drawOptions = {
                    x: geom.x,
                    y: geom.y,
                    width: geom.width,
                    height: geom.height,
                    color,
                    opacity: o.opacity !== undefined ? o.opacity : 0.28,
                };

                if (window.PDFLib && window.PDFLib.BlendMode && window.PDFLib.BlendMode.Multiply) {
                    drawOptions.blendMode = window.PDFLib.BlendMode.Multiply;
                }

                if (geom.angleDeg) {
                    drawOptions.rotate = window.PDFLib.degrees(-geom.angleDeg);
                }

                pdfPage.drawRectangle(drawOptions);
            }
        },

        async _stampAddedVectorText(pdfDoc, pdfPage, pageState) {
            const json = pageState.fabricJson;
            if (!json || !json.objects || json.objects.length === 0) return;

            const pageBox = getEffectivePageBox(pdfPage);
            const originX = pageBox.x;
            const originY = pageBox.y;
            const pageHeight = pageBox.height;

            for (const o of json.objects) {
                if (o.type !== 'i-text' && o.type !== 'text' && o.type !== 'textbox') continue;
                if (!o.text || !o.text.trim()) continue;

                // fabricJson stores coordinates in unscaled PDF scene points regardless of editor zoom
                const fontSizePt = (o.fontSize || 16) * (o.scaleY || 1);
                const leftPt = o.left || 0;
                const topPt = o.top || 0;
                const angleDeg = o.angle || 0;
                const alpha = (angleDeg * Math.PI) / 180;
                const lineStepPt = fontSizePt * 1.13 * (o.lineHeight || 1.16);
                const lines = String(o.text).replace(/\r\n/g, '\n').split('\n');

                const blockStub = {
                    fontFamily: o.fontFamily || 'Liberation Sans',
                    bold: o.fontWeight === 'bold' || Number(o.fontWeight) >= 600,
                    italic: o.fontStyle === 'italic',
                };

                let font;
                try {
                    const embedRes = await window.FontManager.embedFontForBlock(pdfDoc, blockStub, o.text);
                    font = embedRes.font;
                } catch (e) {
                    font = await pdfDoc.embedStandardFont(window.PDFLib.StandardFonts.Helvetica);
                }

                // Draw optional vector background highlight box covering all lines behind added text
                const bgHex = o.textBackgroundColor || o.backgroundColor || '';
                if (bgHex && bgHex !== 'transparent') {
                    let maxLineWidthPt = 0;
                    for (const lineStr of lines) {
                        if (!lineStr) continue;
                        let lw = fontSizePt * lineStr.length * 0.55;
                        try {
                            lw = font.widthOfTextAtSize(lineStr, fontSizePt);
                        } catch (e) {}
                        if (lw > maxLineWidthPt) maxLineWidthPt = lw;
                    }
                    const bgW = Math.max((o.width || 0) * (o.scaleX || 1), maxLineWidthPt + 4);
                    const bgH = lines.length === 1
                        ? fontSizePt * 1.15
                        : ((lines.length - 1) * lineStepPt) + (fontSizePt * 1.15);
                    const bgBlX = originX + leftPt - bgH * Math.sin(alpha);
                    const bgBlY = topPt + bgH * Math.cos(alpha);
                    const bgOpts = {
                        x: bgBlX,
                        y: originY + pageHeight - bgBlY,
                        width: bgW,
                        height: bgH,
                        color: hexToRgb(bgHex),
                    };
                    if (angleDeg) bgOpts.rotate = window.PDFLib.degrees(-angleDeg);
                    pdfPage.drawRectangle(bgOpts);
                }

                // Fabric 5.3.1 baseline offset below o.top = fontSize * 1.13 * (1 - 0.222) ~= 0.879 * fontSize
                const firstBaselineOffsetPt = fontSizePt * 0.879;
                const rgbColor = hexToRgb(o.fill || '#1e293b');
                const opacity = o.opacity !== undefined ? o.opacity : 1;

                for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                    const lineText = lines[lineIdx];
                    if (!lineText) continue;

                    const offsetFromTopPt = firstBaselineOffsetPt + (lineIdx * lineStepPt);
                    const baseScreenX = originX + leftPt - offsetFromTopPt * Math.sin(alpha);
                    const baseScreenY = topPt + offsetFromTopPt * Math.cos(alpha);
                    const baselineY = originY + pageHeight - baseScreenY;

                    const drawOptions = {
                        x: baseScreenX,
                        y: baselineY,
                        size: fontSizePt,
                        font,
                        color: rgbColor,
                        opacity,
                    };

                    if (angleDeg) {
                        drawOptions.rotate = window.PDFLib.degrees(-angleDeg);
                    }

                    pdfPage.drawText(lineText, drawOptions);
                }
            }
        },

        _attachNativeLinks(pdfDoc, pdfPage, pageState, createdPages) {
            const links = pageState.links || [];
            if (links.length === 0) return;

            const pageBox = getEffectivePageBox(pdfPage);

            for (const link of links) {
                const [lx, ly, lw, lh] = link.rect;
                // Convert viewport (top-left) to PDF user space (bottom-left + CropBox origin)
                const pdfX = pageBox.x + lx;
                const pdfY = pageBox.y + pageBox.height - ly - lh;
                const rect = [pdfX, pdfY, pdfX + lw, pdfY + lh];

                let annot = null;

                if (link.type === 'page') {
                    const targetPageIdx = Math.max(0, parseInt(link.target, 10) - 1);
                    const targetPage = createdPages[targetPageIdx] || pdfPage;
                    annot = pdfDoc.context.obj({
                        Type: 'Annot',
                        Subtype: 'Link',
                        Rect: rect,
                        Border: [0, 0, 0],
                        Dest: [targetPage.ref, 'XYZ', null, null, null],
                    });
                } else {
                    // URL link (Validate scheme)
                    let url = (link.target || '').trim();
                    if (!/^(https?|mailto):/i.test(url)) {
                        url = 'https://' + url;
                    }
                    annot = pdfDoc.context.obj({
                        Type: 'Annot',
                        Subtype: 'Link',
                        Rect: rect,
                        Border: [0, 0, 0],
                        A: {
                            Type: 'Action',
                            S: 'URI',
                            URI: window.PDFLib.PDFString.of(url),
                        },
                    });
                }

                if (annot) {
                    const annotRef = pdfDoc.context.register(annot);
                    let annots = pdfPage.node.lookup(window.PDFLib.PDFName.of('Annots'));
                    if (!annots || typeof annots.push !== 'function') {
                        annots = pdfDoc.context.obj([]);
                        pdfPage.node.set(window.PDFLib.PDFName.of('Annots'), annots);
                    }
                    annots.push(annotRef);
                }
            }
        },

        _createAcroFormFields(pdfDoc, pdfPage, pageState) {
            const fields = pageState.formFields || [];
            if (fields.length === 0) return;

            const form = pdfDoc.getForm();
            const pageBox = getEffectivePageBox(pdfPage);

            for (const f of fields) {
                const [fx, fy, fw, fh] = f.rect;
                const x = pageBox.x + fx;
                const y = pageBox.y + pageBox.height - fy - fh;
                const width = fw;
                const height = fh;

                try {
                    if (f.type === 'text') {
                        const tf = form.createTextField(f.name);
                        tf.setText(f.defaultValue || '');
                        tf.addToPage(pdfPage, { x, y, width, height });
                    } else if (f.type === 'textarea') {
                        const tf = form.createTextField(f.name);
                        tf.enableMultiline();
                        tf.setText(f.defaultValue || '');
                        tf.addToPage(pdfPage, { x, y, width, height });
                    } else if (f.type === 'checkbox') {
                        const cb = form.createCheckBox(f.name);
                        if (f.checked) cb.check();
                        cb.addToPage(pdfPage, { x, y, width, height });
                    } else if (f.type === 'dropdown') {
                        const dd = form.createDropdown(f.name);
                        const opts = Array.isArray(f.options) && f.options.length > 0 ? f.options : ['Option 1', 'Option 2'];
                        dd.addOptions(opts);
                        if (f.defaultValue && opts.includes(f.defaultValue)) {
                            dd.select(f.defaultValue);
                        }
                        dd.addToPage(pdfPage, { x, y, width, height });
                    }
                } catch (err) {
                    console.warn(`Could not create AcroForm field ${f.name}:`, err);
                }
            }
        },

        async _flattenRedactedPages(pdfDoc, pagesState) {
            // Save intermediate bytes with masks and fabric overlays
            const intermediateBytes = await pdfDoc.save();
            const previewResult = await window.PDFRender.loadPreviewDocument(intermediateBytes);

            const { PDFDocument } = window.PDFLib;
            const finalDoc = await PDFDocument.create();

            for (let i = 0; i < pagesState.length; i++) {
                const pState = pagesState[i];
                const hasModifiedText = (pState.textBlocks || []).some(b => b.modified || b.deleted);
                const hasWhiteout = (pState.fabricJson?.objects || []).some(o => o.isWhiteout);

                if (!hasModifiedText && !hasWhiteout) {
                    // Page is untouched: copy vector page directly
                    const [copied] = await finalDoc.copyPages(pdfDoc, [i]);
                    finalDoc.addPage(copied);
                } else {
                    // Page had redactions/edits: render clean rasterized image page, completely purging underlying text operators
                    const pdfPageProxy = await previewResult.pdfProxy.getPage(i + 1);
                    const scale = 2.5; // High-DPI for crispness
                    const viewport = pdfPageProxy.getViewport({ scale });
                    const offCanvas = document.createElement('canvas');
                    offCanvas.width = viewport.width;
                    offCanvas.height = viewport.height;
                    const ctx = offCanvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, viewport.width, viewport.height);

                    await pdfPageProxy.render({
                        canvasContext: ctx,
                        viewport,
                    }).promise;

                    const jpegDataUrl = offCanvas.toDataURL('image/jpeg', 0.92);
                    const embeddedJpg = await finalDoc.embedJpg(jpegDataUrl);

                    const newPage = finalDoc.addPage([pState.widthPt || 612, pState.heightPt || 792]);
                    newPage.drawImage(embeddedJpg, {
                        x: 0,
                        y: 0,
                        width: newPage.getWidth(),
                        height: newPage.getHeight(),
                    });

                    offCanvas.width = 0;
                    offCanvas.height = 0;
                }
            }

            return finalDoc;
        },
    };

    window.PdfExporter = PdfExporter;
})(window);
