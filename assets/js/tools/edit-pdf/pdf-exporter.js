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

                // Apply Existing-Text Edits (Mask & Redraw)
                await this._applyTextEdits(pdfDoc, targetPage, pageState);

                // Stamp Fabric.js Layer (Shapes, Images, Signatures, Whiteout)
                await this._stampFabricLayer(pdfDoc, targetPage, pageState);

                // Stamp Vector Highlight Annotations with Multiply Blending
                this._stampHighlightAnnotations(pdfDoc, targetPage, pageState);

                // Stamp Added Vector Text Boxes with Embedded TrueType Fonts
                await this._stampAddedVectorText(pdfDoc, targetPage, pageState);

                // Add Native Links
                this._attachNativeLinks(pdfDoc, targetPage, pageState, createdPages);

                // Add AcroForm Fields
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
                    // Fallback: Draw tight vector background cover rectangle ONLY if stream removal didn't succeed and background is not transparent
                    if (b.bgHex && b.bgHex !== 'transparent') {
                        const pad = 0.8;
                        const ascentRatio = b.ascentRatio || 0.85;
                        const descentRatio = b.descentRatio || -0.20;

                        const rectX = Math.max(0, b.pdfX - pad);
                        const rectY = Math.max(0, baselineY - (b.fontSizePt * Math.abs(descentRatio)) - pad);
                        const rectW = b.pdfWidth + (pad * 2);
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

                // Draw replacement text if not deleted using 2-Tier font embedding
                if (b.modified && !b.deleted && b.currentText) {
                    const embedResult = await window.FontManager.embedFontForBlock(pdfDoc, b, b.currentText);
                    const font = embedResult.font;

                    // Calibrate export font size if horizontal scaling or width ratio requires subtle metric alignment
                    let exportFontSize = b.fontSizePt;
                    if (b.widthRatio && b.widthRatio > 0.85 && b.widthRatio < 1.15) {
                        exportFontSize = Math.round(b.fontSizePt * (1.0 + (b.widthRatio - 1.0) * 0.35) * 100) / 100;
                    }

                    pdfPage.drawText(b.currentText, {
                        x: b.pdfX,
                        y: baselineY,
                        size: exportFontSize,
                        font,
                        color: hexToRgb(b.colorHex || '#1e293b'),
                    });
                }
            }
        },

        async _stampFabricLayer(pdfDoc, pdfPage, pageState) {
            const json = pageState.fabricJson;
            if (!json || !json.objects || json.objects.length === 0) {
                return;
            }

            const pageWidth = pdfPage.getWidth();
            const pageHeight = pdfPage.getHeight();

            // Offscreen static canvas at 2.5x high-DPI
            const staticCanvasEl = document.createElement('canvas');
            const staticCanvas = new fabric.StaticCanvas(staticCanvasEl, {
                width: pageWidth,
                height: pageHeight,
            });

            await new Promise((resolve) => {
                staticCanvas.loadFromJSON(json, () => {
                    // Temporarily hide added text objects and highlight annotations
                    // so vector text and vector multiply rectangles are exported cleanly without double-rendering
                    const objs = staticCanvas.getObjects();
                    for (const o of objs) {
                        if (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox') {
                            o.visible = false;
                        }
                        if (o.isAnnotation && o.annotType === 'highlight') {
                            o.visible = false;
                        }
                    }
                    staticCanvas.renderAll();
                    resolve();
                });
            });

            const pngDataUrl = staticCanvas.toDataURL({
                format: 'png',
                multiplier: 2.5,
            });

            // Restore visibility right after capturing overlay PNG
            const objs = staticCanvas.getObjects();
            for (const o of objs) {
                if (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox' || (o.isAnnotation && o.annotType === 'highlight')) {
                    o.visible = true;
                }
            }
            staticCanvas.renderAll();

            const embeddedPng = await pdfDoc.embedPng(pngDataUrl);
            pdfPage.drawImage(embeddedPng, {
                x: 0,
                y: 0,
                width: pageWidth,
                height: pageHeight,
            });

            // Zero out offscreen canvas
            staticCanvasEl.width = 0;
            staticCanvasEl.height = 0;
        },

        _stampHighlightAnnotations(pdfDoc, pdfPage, pageState) {
            const json = pageState.fabricJson;
            if (!json || !json.objects || json.objects.length === 0) return;

            const scale = pageState.scale || 1.0;
            const pageHeight = pdfPage.getHeight();

            for (const o of json.objects) {
                if (!o.isAnnotation || o.annotType !== 'highlight') continue;

                const oLeft = (o.left || 0) / scale;
                const oTop = (o.top || 0) / scale;
                const pdfWidth = ((o.width || 0) * (o.scaleX || 1)) / scale;
                const pdfHeight = ((o.height || 0) * (o.scaleY || 1)) / scale;

                const angleDeg = o.angle || 0;
                const alpha = (angleDeg * Math.PI) / 180;
                // Transform Fabric rotated top-left corner to PDF bottom-left pivot for pdf-lib
                const blScreenX = oLeft - pdfHeight * Math.sin(alpha);
                const blScreenY = oTop + pdfHeight * Math.cos(alpha);
                const pdfX = blScreenX;
                const pdfY = pageHeight - blScreenY;

                const color = hexToRgb(o.fill || '#fef08a');
                const drawOptions = {
                    x: pdfX,
                    y: pdfY,
                    width: pdfWidth,
                    height: pdfHeight,
                    color,
                    opacity: o.opacity !== undefined ? o.opacity : 0.35,
                };

                if (window.PDFLib && window.PDFLib.BlendMode && window.PDFLib.BlendMode.Multiply) {
                    drawOptions.blendMode = window.PDFLib.BlendMode.Multiply;
                }

                if (angleDeg) {
                    drawOptions.rotate = window.PDFLib.degrees(-angleDeg);
                }

                pdfPage.drawRectangle(drawOptions);
            }
        },

        async _stampAddedVectorText(pdfDoc, pdfPage, pageState) {
            const json = pageState.fabricJson;
            if (!json || !json.objects || json.objects.length === 0) return;

            const scale = pageState.scale || 1.0;
            const pageHeight = pdfPage.getHeight();

            for (const o of json.objects) {
                if (o.type !== 'i-text' && o.type !== 'text' && o.type !== 'textbox') continue;
                if (!o.text || !o.text.trim()) continue;

                const fontSizePt = (o.fontSize * (o.scaleY || 1)) / scale;
                const leftPt = (o.left || 0) / scale;
                const topPt = (o.top || 0) / scale;
                const angleDeg = o.angle || 0;
                const alpha = (angleDeg * Math.PI) / 180;

                const blockStub = {
                    fontFamily: o.fontFamily || 'Liberation Sans',
                    bold: o.fontWeight === 'bold' || o.fontWeight === 700 || o.fontWeight === '700',
                    italic: o.fontStyle === 'italic',
                };

                let font;
                try {
                    const embedRes = await window.FontManager.embedFontForBlock(pdfDoc, blockStub, o.text);
                    font = embedRes.font;
                } catch (e) {
                    font = await pdfDoc.embedStandardFont(window.PDFLib.StandardFonts.Helvetica);
                }

                // Draw optional vector background highlight box behind added text
                const bgHex = o.textBackgroundColor || o.backgroundColor || '';
                if (bgHex && bgHex !== 'transparent') {
                    let textWidthPt = fontSizePt * o.text.length * 0.55;
                    try {
                        textWidthPt = font.widthOfTextAtSize(o.text, fontSizePt);
                    } catch (e) {}
                    const bgW = Math.max(((o.width || 0) * (o.scaleX || 1)) / scale, textWidthPt + 4);
                    const bgH = fontSizePt * 1.18;
                    const bgBlX = leftPt - bgH * Math.sin(alpha);
                    const bgBlY = topPt + bgH * Math.cos(alpha);
                    const bgOpts = {
                        x: bgBlX,
                        y: pageHeight - bgBlY,
                        width: bgW,
                        height: bgH,
                        color: hexToRgb(bgHex),
                    };
                    if (angleDeg) bgOpts.rotate = window.PDFLib.degrees(-angleDeg);
                    pdfPage.drawRectangle(bgOpts);
                }

                // Rotated baseline origin matching Fabric top-left rotation
                const ascentPt = fontSizePt * 0.82;
                const baseScreenX = leftPt - ascentPt * Math.sin(alpha);
                const baseScreenY = topPt + ascentPt * Math.cos(alpha);
                const baselineY = pageHeight - baseScreenY;

                const hex = o.fill || '#1e293b';
                const rgbColor = hexToRgb(hex);

                const drawOptions = {
                    x: baseScreenX,
                    y: baselineY,
                    size: fontSizePt,
                    font,
                    color: rgbColor,
                };

                if (angleDeg) {
                    drawOptions.rotate = window.PDFLib.degrees(-angleDeg);
                }

                pdfPage.drawText(o.text, drawOptions);
            }
        },

        _attachNativeLinks(pdfDoc, pdfPage, pageState, createdPages) {
            const links = pageState.links || [];
            if (links.length === 0) return;

            const pageHeight = pdfPage.getHeight();

            for (const link of links) {
                const [lx, ly, lw, lh] = link.rect;
                // Convert viewport (top-left) to PDF (bottom-left) points
                const pdfX = lx;
                const pdfY = pageHeight - ly - lh;
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
            const pageHeight = pdfPage.getHeight();

            for (const f of fields) {
                const [fx, fy, fw, fh] = f.rect;
                const x = fx;
                const y = pageHeight - fy - fh;
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
