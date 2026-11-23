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

                // Stamp Fabric.js Layer
                await this._stampFabricLayer(pdfDoc, targetPage, pageState);

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

            // 1. Surgical Content Stream Removal
            let removedBlockIds = new Set();
            if (window.ContentStreamEditor && typeof window.ContentStreamEditor.removeEditedTextRuns === 'function') {
                try {
                    removedBlockIds = await window.ContentStreamEditor.removeEditedTextRuns(pdfDoc, pdfPage, pageState);
                } catch (err) {
                    console.warn('Content stream text removal failed, using vector mask fallback:', err);
                }
            }

            // 2. Process Blocks: Zero-cover stamping for stream-removed blocks, vector mask fallback otherwise
            for (const b of blocks) {
                if (!b.modified && !b.deleted) {
                    continue; // Leave 100% original vectors untouched
                }

                const baselineY = b.baselinePdfY !== undefined ? b.baselinePdfY : b.pdfY;
                const wasStreamRemoved = removedBlockIds.has(b.id);

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
                    staticCanvas.renderAll();
                    resolve();
                });
            });

            const pngDataUrl = staticCanvas.toDataURL({
                format: 'png',
                multiplier: 2.5,
            });

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
