/**
 * NoPayPDF - Add Watermark Controller
 * Text & Image Stamping with Live Synchronized Canvas Preview & Accurate Rotation Math
 * 100% Client-Side Processing via pdf-lib & PDF.js
 */

(function () {
    'use strict';

    // DOM Elements
    const dropzone = document.getElementById('watermark-dropzone');
    const fileInput = document.getElementById('watermark-file-input');
    const workspace = document.getElementById('watermark-workspace');
    const fileNameLabel = document.getElementById('file-name-label');
    const fileMetaLabel = document.getElementById('file-meta-label');
    const changeFileBtn = document.getElementById('change-file-btn');

    // Mode Tabs & Panels
    const typeTabs = document.querySelectorAll('.watermark-type-tab');
    const panelText = document.getElementById('panel-text-watermark');
    const panelImage = document.getElementById('panel-image-watermark');

    // Text Controls
    const wmTextInput = document.getElementById('wm-text-input');
    const wmFontFamily = document.getElementById('wm-font-family');
    const wmFontSize = document.getElementById('wm-font-size');
    const wmFontSizeLabel = document.getElementById('wm-font-size-label');
    const wmTextColor = document.getElementById('wm-text-color');
    const wmTextColorHex = document.getElementById('wm-text-color-hex');

    // Image Controls
    const wmImageInput = document.getElementById('wm-image-input');
    const wmImageScale = document.getElementById('wm-image-scale');
    const wmImageScaleLabel = document.getElementById('wm-image-scale-label');

    // Shared Controls
    const wmOpacity = document.getElementById('wm-opacity');
    const wmOpacityLabel = document.getElementById('wm-opacity-label');
    const wmRotation = document.getElementById('wm-rotation');
    const wmRotationLabel = document.getElementById('wm-rotation-label');
    const rotPresets = document.querySelectorAll('.btn-rot-preset');
    const anchorGridContainer = document.getElementById('anchor-grid-container');
    const anchorBtns = document.querySelectorAll('.btn-anchor');
    const customRangeContainer = document.getElementById('custom-range-container');
    const pageRangesInput = document.getElementById('wm-page-ranges-input');

    // Preview Canvases
    const previewPageCanvas = document.getElementById('preview-page-canvas');
    const previewWatermarkCanvas = document.getElementById('preview-watermark-canvas');

    // Actions & Result
    const submitBtn = document.getElementById('watermark-submit-btn');
    const progressContainer = document.getElementById('watermark-progress-container');
    const resultView = document.getElementById('result-view');
    const resultSummary = document.getElementById('result-summary');
    const downloadBtn = document.getElementById('download-watermarked-btn');
    const resetBtn = document.getElementById('watermark-reset-btn');
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    const errorDismissBtn = document.getElementById('error-dismiss-btn');

    // State
    const progress = PDFCore.createProgress(progressContainer);
    let currentFile = null;
    let currentBuffer = null;
    let currentPdfDoc = null;
    let totalPages = 0;
    let page1Viewport = null;
    let activeType = 'text'; // 'text' | 'image'
    let activeAnchor = 'center'; // 'center' | 'top-left' etc.
    let uploadedImageElement = null;
    let uploadedImageBytes = null;
    let uploadedImageMime = null;
    let watermarkedBlob = null;

    PDFRender.initPdfJsWorker();

    function showError(msg) {
        if (!errorAlert || !errorMessage) return;
        errorMessage.textContent = msg;
        errorAlert.classList.remove('hidden');
    }

    function clearError() {
        if (errorAlert) errorAlert.classList.add('hidden');
    }

    if (errorDismissBtn) errorDismissBtn.addEventListener('click', clearError);

    // Tab Switcher
    typeTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const type = tab.dataset.type;
            activeType = type;

            typeTabs.forEach((t) => {
                t.classList.remove('bg-blue-600', 'text-white', 'shadow-xs');
                t.classList.add('bg-transparent', 'text-slate-600');
            });
            tab.classList.add('bg-blue-600', 'text-white', 'shadow-xs');
            tab.classList.remove('bg-transparent', 'text-slate-600');

            if (type === 'text') {
                panelText.classList.remove('hidden');
                panelImage.classList.add('hidden');
            } else {
                panelText.classList.add('hidden');
                panelImage.classList.remove('hidden');
            }

            updateLivePreview();
        });
    });

    // Color Pickers Sync
    if (wmTextColor && wmTextColorHex) {
        wmTextColor.addEventListener('input', () => {
            wmTextColorHex.value = wmTextColor.value;
            updateLivePreview();
        });
        wmTextColorHex.addEventListener('input', () => {
            if (/^#[0-9A-Fa-f]{6}$/.test(wmTextColorHex.value)) {
                wmTextColor.value = wmTextColorHex.value;
                updateLivePreview();
            }
        });
    }

    // Sliders Label Updates
    if (wmFontSize) {
        wmFontSize.addEventListener('input', () => {
            if (wmFontSizeLabel) wmFontSizeLabel.textContent = `${wmFontSize.value} pt`;
            updateLivePreview();
        });
    }

    if (wmImageScale) {
        wmImageScale.addEventListener('input', () => {
            if (wmImageScaleLabel) wmImageScaleLabel.textContent = `${wmImageScale.value}% of page`;
            updateLivePreview();
        });
    }

    if (wmOpacity) {
        wmOpacity.addEventListener('input', () => {
            if (wmOpacityLabel) wmOpacityLabel.textContent = `${wmOpacity.value}%`;
            updateLivePreview();
        });
    }

    if (wmRotation) {
        wmRotation.addEventListener('input', () => {
            if (wmRotationLabel) wmRotationLabel.textContent = `${wmRotation.value}°`;
            updateLivePreview();
        });
    }

    rotPresets.forEach((btn) => {
        btn.addEventListener('click', () => {
            const deg = btn.dataset.deg;
            if (wmRotation) {
                wmRotation.value = deg;
                if (wmRotationLabel) wmRotationLabel.textContent = `${deg}°`;
                updateLivePreview();
            }
        });
    });

    // Placement Mode Radio
    document.querySelectorAll('input[name="wm-placement-mode"]').forEach((radio) => {
        radio.addEventListener('change', (e) => {
            if (anchorGridContainer) {
                if (e.target.value === 'single') {
                    anchorGridContainer.classList.remove('hidden');
                } else {
                    anchorGridContainer.classList.add('hidden');
                }
            }
            updateLivePreview();
        });
    });

    // Anchor Grid Clicks
    anchorBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            activeAnchor = btn.dataset.pos;
            anchorBtns.forEach((b) => {
                b.classList.remove('bg-blue-600', 'text-white');
                b.classList.add('bg-white', 'text-slate-700');
            });
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('bg-white', 'text-slate-700');
            updateLivePreview();
        });
    });

    // Page Target Radio
    document.querySelectorAll('input[name="wm-page-target"]').forEach((radio) => {
        radio.addEventListener('change', (e) => {
            if (customRangeContainer) {
                if (e.target.value === 'custom') {
                    customRangeContainer.classList.remove('hidden');
                } else {
                    customRangeContainer.classList.add('hidden');
                }
            }
        });
    });

    // Image Upload Handler
    if (wmImageInput) {
        wmImageInput.addEventListener('change', () => {
            const file = wmImageInput.files?.[0];
            if (!file) return;

            uploadedImageMime = file.type;
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    uploadedImageElement = img;
                    updateLivePreview();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);

            // Read array buffer for pdf-lib embedding
            const bufReader = new FileReader();
            bufReader.onload = (e) => {
                uploadedImageBytes = e.target.result;
            };
            bufReader.readAsArrayBuffer(file);
        });
    }

    if (wmTextInput) wmTextInput.addEventListener('input', updateLivePreview);
    if (wmFontFamily) wmFontFamily.addEventListener('change', updateLivePreview);

    // ----------------------------------------------------
    // LIVE SYNCHRONIZED PREVIEW
    // ----------------------------------------------------
    function updateLivePreview() {
        if (!previewWatermarkCanvas || !page1Viewport) return;

        const canvas = previewWatermarkCanvas;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const width = canvas.width;
        const height = canvas.height;
        const opacity = parseInt(wmOpacity?.value || '35', 10) / 100;
        const rotationDeg = parseInt(wmRotation?.value || '-45', 10);
        const rotationRad = (rotationDeg * Math.PI) / 180;
        const placement = document.querySelector('input[name="wm-placement-mode"]:checked')?.value || 'single';

        ctx.save();
        ctx.globalAlpha = opacity;

        // Coordinates helper for anchor positions
        function getAnchorCoords(anchor, w, h, pad = 30) {
            const map = {
                'top-left': { x: pad, y: pad },
                'top-center': { x: w / 2, y: pad },
                'top-right': { x: w - pad, y: pad },
                'middle-left': { x: pad, y: h / 2 },
                'center': { x: w / 2, y: h / 2 },
                'middle-right': { x: w - pad, y: h / 2 },
                'bottom-left': { x: pad, y: h - pad },
                'bottom-center': { x: w / 2, y: h - pad },
                'bottom-right': { x: w - pad, y: h - pad },
            };
            return map[anchor] || map['center'];
        }

        if (activeType === 'text') {
            const text = wmTextInput?.value || 'CONFIDENTIAL';
            const fontSizePt = parseInt(wmFontSize?.value || '48', 10);
            // Scale font size proportionally to preview canvas viewport
            const previewScale = width / page1Viewport.width;
            const fontPx = Math.max(10, fontSizePt * previewScale);
            const fontFamily = wmFontFamily?.value?.includes('Times') ? 'Times New Roman, serif' : (wmFontFamily?.value?.includes('Courier') ? 'Courier New, monospace' : 'Arial, sans-serif');
            const fontWeight = wmFontFamily?.value?.includes('Bold') ? 'bold' : 'normal';

            ctx.font = `${fontWeight} ${fontPx}px ${fontFamily}`;
            ctx.fillStyle = wmTextColor?.value || '#ef4444';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (placement === 'single') {
                const { x, y } = getAnchorCoords(activeAnchor, width, height, 40);
                ctx.translate(x, y);
                ctx.rotate(rotationRad);
                ctx.fillText(text, 0, 0);
            } else {
                // Tiled grid: 3 cols x 4 rows
                const cols = 3;
                const rows = 4;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const x = ((c + 0.5) / cols) * width;
                        const y = ((r + 0.5) / rows) * height;
                        ctx.save();
                        ctx.translate(x, y);
                        ctx.rotate(rotationRad);
                        ctx.fillText(text, 0, 0);
                        ctx.restore();
                    }
                }
            }
        } else if (activeType === 'image') {
            if (!uploadedImageElement) {
                // Placeholder logo box
                ctx.font = '12px sans-serif';
                ctx.fillStyle = '#64748b';
                ctx.textAlign = 'center';
                ctx.fillText('[Please upload an image logo]', width / 2, height / 2);
            } else {
                const scalePct = parseInt(wmImageScale?.value || '35', 10) / 100;
                const targetW = width * scalePct;
                const aspect = uploadedImageElement.width / uploadedImageElement.height;
                const targetH = targetW / aspect;

                if (placement === 'single') {
                    const { x, y } = getAnchorCoords(activeAnchor, width, height, 40);
                    ctx.translate(x, y);
                    ctx.rotate(rotationRad);
                    ctx.drawImage(uploadedImageElement, -targetW / 2, -targetH / 2, targetW, targetH);
                } else {
                    const cols = 3;
                    const rows = 4;
                    const tileW = targetW * 0.6;
                    const tileH = targetH * 0.6;
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            const x = ((c + 0.5) / cols) * width;
                            const y = ((r + 0.5) / rows) * height;
                            ctx.save();
                            ctx.translate(x, y);
                            ctx.rotate(rotationRad);
                            ctx.drawImage(uploadedImageElement, -tileW / 2, -tileH / 2, tileW, tileH);
                            ctx.restore();
                        }
                    }
                }
            }
        }

        ctx.restore();
    }

    // Ingest Selected PDF
    async function loadPdfFile(file) {
        clearError();
        if (resultView) resultView.classList.add('hidden');

        try {
            submitBtn.disabled = true;
            progress.start('Rendering document preview...');

            currentFile = file;
            currentBuffer = await PDFCore.readFileAsArrayBuffer(file);

            if (currentPdfDoc) {
                await PDFRender.destroyDoc(currentPdfDoc);
                currentPdfDoc = null;
            }

            const preview = await PDFRender.loadPreviewDoc(currentBuffer);
            currentPdfDoc = preview.pdfDoc;
            totalPages = preview.pageCount;

            fileNameLabel.textContent = file.name;
            fileMetaLabel.textContent = `${PDFCore.formatBytes(file.size)} • ${totalPages} page${totalPages === 1 ? '' : 's'}`;

            // Render Page 1 to preview canvas
            const page1 = await currentPdfDoc.getPage(1);
            const scale = 1.0;
            const viewport = page1.getViewport({ scale });
            page1Viewport = viewport;

            previewPageCanvas.width = Math.floor(viewport.width);
            previewPageCanvas.height = Math.floor(viewport.height);
            previewWatermarkCanvas.width = previewPageCanvas.width;
            previewWatermarkCanvas.height = previewPageCanvas.height;

            const ctx = previewPageCanvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, previewPageCanvas.width, previewPageCanvas.height);

            await page1.render({
                canvasContext: ctx,
                viewport,
            }).promise;

            dropzone.classList.add('hidden');
            workspace.classList.remove('hidden');

            updateLivePreview();
            progress.reset();
            submitBtn.disabled = false;
        } catch (err) {
            console.error('File load error:', err);
            showError('Unable to open this PDF. Please verify the file is not password-protected.');
            progress.reset();
            submitBtn.disabled = false;
        }
    }

    PDFCore.initDropzone({
        dropzoneEl: dropzone,
        inputEl: fileInput,
        multiple: false,
        onFilesAdded: (files) => {
            const file = files[0];
            if (file) loadPdfFile(file);
        },
        onError: (errs) => {
            showError(errs.join(' '));
        },
    });

    if (changeFileBtn) {
        changeFileBtn.addEventListener('click', () => {
            if (fileInput) {
                fileInput.value = '';
                fileInput.click();
            }
        });
    }

    // Hex Color Helper -> RGB Object (0..1)
    function hexToRgb01(hex) {
        const clean = hex.replace('#', '');
        const r = parseInt(clean.substring(0, 2), 16) / 255;
        const g = parseInt(clean.substring(2, 4), 16) / 255;
        const b = parseInt(clean.substring(4, 6), 16) / 255;
        return { r, g, b };
    }

    // ----------------------------------------------------
    // MAIN WATERMARK PDF-LIB STAMPING
    // ----------------------------------------------------
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (!currentBuffer || !currentFile) {
                showError('Please upload a PDF file first.');
                return;
            }

            if (activeType === 'image' && !uploadedImageBytes) {
                showError('Please select an image logo to apply.');
                return;
            }

            clearError();
            if (resultView) resultView.classList.add('hidden');

            try {
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

                progress.start('Stamping watermark onto PDF...');

                const { PDFDocument, rgb, degrees, StandardFonts } = window.PDFLib;
                const doc = await PDFDocument.load(currentBuffer);

                const pages = doc.getPages();
                const count = pages.length;

                // Determine target page indices (1-based)
                const targetSetting = document.querySelector('input[name="wm-page-target"]:checked')?.value || 'all';
                let targetPageSet = new Set();

                if (targetSetting === 'all') {
                    for (let i = 1; i <= count; i++) targetPageSet.add(i);
                } else {
                    const rangeStr = pageRangesInput?.value?.trim() || '';
                    if (!rangeStr) {
                        for (let i = 1; i <= count; i++) targetPageSet.add(i);
                    } else {
                        const parsed = PDFRender.parsePageRanges(rangeStr, count);
                        if (!parsed.valid || !parsed.flatPages || parsed.flatPages.length === 0) {
                            throw new Error(parsed.error || 'Invalid page range entered. Examples: 1, 3-5, 8');
                        }
                        parsed.flatPages.forEach((p) => targetPageSet.add(p));
                    }
                }

                // Prepare font or image
                let font = null;
                let embeddedImage = null;

                if (activeType === 'text') {
                    const fontMap = {
                        HelveticaBold: StandardFonts.HelveticaBold,
                        Helvetica: StandardFonts.Helvetica,
                        TimesRoman: StandardFonts.TimesRoman,
                        CourierBold: StandardFonts.CourierBold,
                    };
                    const chosen = fontMap[wmFontFamily?.value] || StandardFonts.HelveticaBold;
                    font = await doc.embedFont(chosen);
                } else if (activeType === 'image') {
                    if (uploadedImageMime === 'image/png') {
                        embeddedImage = await doc.embedPng(uploadedImageBytes);
                    } else if (uploadedImageMime === 'image/jpeg' || uploadedImageMime === 'image/jpg') {
                        embeddedImage = await doc.embedJpg(uploadedImageBytes);
                    } else {
                        // Transcode to PNG via canvas for WebP/GIF/BMP
                        const canvas = document.createElement('canvas');
                        canvas.width = uploadedImageElement.width;
                        canvas.height = uploadedImageElement.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(uploadedImageElement, 0, 0);
                        const pngDataUrl = canvas.toDataURL('image/png');
                        embeddedImage = await doc.embedPng(pngDataUrl);
                        canvas.width = 0;
                        canvas.height = 0;
                    }
                }

                const opacity = parseInt(wmOpacity?.value || '35', 10) / 100;
                const rotationDeg = parseInt(wmRotation?.value || '-45', 10);
                const rotationRad = (rotationDeg * Math.PI) / 180;
                const placement = document.querySelector('input[name="wm-placement-mode"]:checked')?.value || 'single';

                // Coordinates helper for PDF points (PDF coordinate system: 0,0 at bottom-left)
                function getPdfAnchorCoords(anchor, w, h, pad = 40) {
                    const map = {
                        'top-left': { cx: pad, cy: h - pad },
                        'top-center': { cx: w / 2, cy: h - pad },
                        'top-right': { cx: w - pad, cy: h - pad },
                        'middle-left': { cx: pad, cy: h / 2 },
                        'center': { cx: w / 2, cy: h / 2 },
                        'middle-right': { cx: w - pad, cy: h / 2 },
                        'bottom-left': { cx: pad, cy: pad },
                        'bottom-center': { cx: w / 2, cy: pad },
                        'bottom-right': { cx: w - pad, cy: pad },
                    };
                    return map[anchor] || map['center'];
                }

                // Process each page
                for (let i = 0; i < count; i++) {
                    const pageNum = i + 1;
                    if (!targetPageSet.has(pageNum)) continue;

                    const pct = Math.round(15 + (i / count) * 75);
                    progress.update(pct, `Stamping watermark on page ${pageNum} of ${count}...`);

                    const page = pages[i];
                    const { width, height } = page.getSize();

                    if (activeType === 'text') {
                        const text = wmTextInput?.value || 'CONFIDENTIAL';
                        const fontSizePt = parseInt(wmFontSize?.value || '48', 10);
                        const textWidth = font.widthOfTextAtSize(text, fontSizePt);
                        const textHeight = font.heightAtSize(fontSizePt);
                        const { r, g, b } = hexToRgb01(wmTextColor?.value || '#ef4444');

                        // Accurate rotated center offset calculation
                        // pdf-lib page.drawText rotates around (x, y)
                        // To rotate around center (cx, cy):
                        // dx = (W/2)*cos(θ) - (H/2)*sin(θ)
                        // dy = (W/2)*sin(θ) + (H/2)*cos(θ)
                        // x = cx - dx, y = cy - dy
                        function drawRotatedText(cx, cy) {
                            const halfW = textWidth / 2;
                            const halfH = textHeight / 2;
                            const dx = halfW * Math.cos(rotationRad) - halfH * Math.sin(rotationRad);
                            const dy = halfW * Math.sin(rotationRad) + halfH * Math.cos(rotationRad);

                            page.drawText(text, {
                                x: cx - dx,
                                y: cy - dy,
                                size: fontSizePt,
                                font,
                                color: rgb(r, g, b),
                                opacity,
                                rotate: degrees(rotationDeg),
                            });
                        }

                        if (placement === 'single') {
                            const { cx, cy } = getPdfAnchorCoords(activeAnchor, width, height, 50);
                            drawRotatedText(cx, cy);
                        } else {
                            // Tiled grid: 3 cols x 4 rows
                            const cols = 3;
                            const rows = 4;
                            for (let rIdx = 0; rIdx < rows; rIdx++) {
                                for (let cIdx = 0; cIdx < cols; cIdx++) {
                                    const cx = ((cIdx + 0.5) / cols) * width;
                                    const cy = ((rIdx + 0.5) / rows) * height;
                                    drawRotatedText(cx, cy);
                                }
                            }
                        }
                    } else if (activeType === 'image' && embeddedImage) {
                        const scalePct = parseInt(wmImageScale?.value || '35', 10) / 100;
                        const imgWidth = width * scalePct;
                        const aspect = embeddedImage.width / embeddedImage.height;
                        const imgHeight = imgWidth / aspect;

                        function drawRotatedImage(cx, cy, w, h) {
                            const halfW = w / 2;
                            const halfH = h / 2;
                            const dx = halfW * Math.cos(rotationRad) - halfH * Math.sin(rotationRad);
                            const dy = halfW * Math.sin(rotationRad) + halfH * Math.cos(rotationRad);

                            page.drawImage(embeddedImage, {
                                x: cx - dx,
                                y: cy - dy,
                                width: w,
                                height: h,
                                opacity,
                                rotate: degrees(rotationDeg),
                            });
                        }

                        if (placement === 'single') {
                            const { cx, cy } = getPdfAnchorCoords(activeAnchor, width, height, 50);
                            drawRotatedImage(cx, cy, imgWidth, imgHeight);
                        } else {
                            const cols = 3;
                            const rows = 4;
                            const tileW = imgWidth * 0.6;
                            const tileH = imgHeight * 0.6;
                            for (let rIdx = 0; rIdx < rows; rIdx++) {
                                for (let cIdx = 0; cIdx < cols; cIdx++) {
                                    const cx = ((cIdx + 0.5) / cols) * width;
                                    const cy = ((rIdx + 0.5) / rows) * height;
                                    drawRotatedImage(cx, cy, tileW, tileH);
                                }
                            }
                        }
                    }
                }

                progress.update(92, 'Saving watermarked document...');
                const pdfBytes = await doc.save();
                watermarkedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                progress.complete('Watermark applied successfully!');

                if (resultSummary) {
                    resultSummary.textContent = `Applied watermark across ${targetPageSet.size} page(s) (${PDFCore.formatBytes(watermarkedBlob.size)}).`;
                }

                if (resultView) {
                    resultView.classList.remove('hidden');
                    resultView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } catch (err) {
                console.error('Watermark error:', err);
                showError(err.message || 'An error occurred while stamping the watermark.');
                progress.reset();
            } finally {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        });
    }

    // Download Handler
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (!watermarkedBlob || !currentFile) return;
            const originalName = currentFile.name.replace(/\.[^/.]+$/, '');
            const downloadName = `${originalName}-watermarked.pdf`;
            PDFCore.downloadBlob(watermarkedBlob, downloadName);
        });
    }

    // Reset Handler
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            currentFile = null;
            currentBuffer = null;
            watermarkedBlob = null;
            uploadedImageElement = null;
            uploadedImageBytes = null;
            page1Viewport = null;

            if (currentPdfDoc) {
                await PDFRender.destroyDoc(currentPdfDoc);
                currentPdfDoc = null;
            }
            if (fileInput) fileInput.value = '';
            if (wmImageInput) wmImageInput.value = '';

            clearError();
            progress.reset();

            if (resultView) resultView.classList.add('hidden');
            if (workspace) workspace.classList.add('hidden');
            if (dropzone) dropzone.classList.remove('hidden');
        });
    }
})();
