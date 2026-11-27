/**
 * NoPayPDF - Page Numbers & Header/Footer Controller
 * Live Preview, Template Placeholders, WinAnsi Safety & 100% In-Browser Stamping via pdf-lib
 */

(function () {
    'use strict';

    // DOM Elements
    const dropzone = document.getElementById('page-numbers-dropzone');
    const fileInput = document.getElementById('page-numbers-file-input');
    const workspace = document.getElementById('page-numbers-workspace');
    const fileNameLabel = document.getElementById('file-name-label');
    const fileMetaLabel = document.getElementById('file-meta-label');
    const changeFileBtn = document.getElementById('change-file-btn');

    // Numbering Controls
    const enablePageNumbers = document.getElementById('enable-page-numbers');
    const pageNumbersOptions = document.getElementById('page-numbers-options');
    const pnPosition = document.getElementById('pn-position');
    const pnFormat = document.getElementById('pn-format');
    const customTemplateContainer = document.getElementById('custom-template-container');
    const pnCustomTemplate = document.getElementById('pn-custom-template');
    const pnStartNumber = document.getElementById('pn-start-number');
    const pnSkipFirstPage = document.getElementById('pn-skip-first-page');

    // Header & Footer Slots
    const hdrLeft = document.getElementById('hdr-left');
    const hdrCenter = document.getElementById('hdr-center');
    const hdrRight = document.getElementById('hdr-right');
    const ftrLeft = document.getElementById('ftr-left');
    const ftrCenter = document.getElementById('ftr-center');
    const ftrRight = document.getElementById('ftr-right');

    // Typography & Margins
    const pnFontFamily = document.getElementById('pn-font-family');
    const pnFontSize = document.getElementById('pn-font-size');
    const pnMargin = document.getElementById('pn-margin');
    const pnColor = document.getElementById('pn-color');
    const pnColorHex = document.getElementById('pn-color-hex');
    const customRangeContainer = document.getElementById('pn-custom-range-container');
    const pageRangesInput = document.getElementById('pn-page-ranges-input');

    // Preview Canvases
    const previewPageCanvas = document.getElementById('preview-page-canvas');
    const previewOverlayCanvas = document.getElementById('preview-overlay-canvas');

    // Actions & Result
    const submitBtn = document.getElementById('page-numbers-submit-btn');
    const progressContainer = document.getElementById('page-numbers-progress-container');
    const resultView = document.getElementById('result-view');
    const resultSummary = document.getElementById('result-summary');
    const downloadBtn = document.getElementById('download-numbered-btn');
    const resetBtn = document.getElementById('page-numbers-reset-btn');
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
    let numberedBlob = null;
    let loadSeq = 0;

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

    // Format Template Toggle
    if (pnFormat) {
        pnFormat.addEventListener('change', () => {
            if (customTemplateContainer) {
                if (pnFormat.value === 'custom') {
                    customTemplateContainer.classList.remove('hidden');
                } else {
                    customTemplateContainer.classList.add('hidden');
                }
            }
            updateLivePreview();
        });
    }

    // Numbering Enable Toggle
    if (enablePageNumbers) {
        enablePageNumbers.addEventListener('change', () => {
            if (pageNumbersOptions) {
                pageNumbersOptions.style.opacity = enablePageNumbers.checked ? '1' : '0.4';
                pageNumbersOptions.style.pointerEvents = enablePageNumbers.checked ? 'auto' : 'none';
            }
            updateLivePreview();
        });
    }

    // Color Pickers Sync
    if (pnColor && pnColorHex) {
        pnColor.addEventListener('input', () => {
            pnColorHex.value = pnColor.value;
            updateLivePreview();
        });
        pnColorHex.addEventListener('input', () => {
            if (/^#[0-9A-Fa-f]{6}$/.test(pnColorHex.value)) {
                pnColor.value = pnColorHex.value;
                updateLivePreview();
            }
        });
    }

    // Custom Page Range Radio
    document.querySelectorAll('input[name="pn-page-target"]').forEach((radio) => {
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

    // WinAnsi Safe String Filter
    function sanitizeWinAnsi(str) {
        if (!str) return '';
        return str
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2013\u2014]/g, '-')
            .replace(/\u2022/g, '*')
            .replace(/\u2026/g, '...')
            .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
    }

    // Dynamic Placeholder Replacer
    function resolveTemplate(template, n, total, filename) {
        if (!template) return '';
        const today = new Date().toISOString().split('T')[0];
        const baseName = filename ? filename.replace(/\.[^/.]+$/, '') : 'document';
        return template
            .replace(/\{n\}/g, String(n))
            .replace(/\{total\}/g, String(total))
            .replace(/\{date\}/g, today)
            .replace(/\{filename\}/g, baseName);
    }

    // Format Numbering String
    function getPageNumberString(formatChoice, n, total, filename) {
        switch (formatChoice) {
            case 'page-n-of-total':
                return `Page ${n} of ${total}`;
            case 'page-n':
                return `Page ${n}`;
            case 'n-of-total':
                return `${n} / ${total}`;
            case 'n-only':
                return `${n}`;
            case 'custom':
                return resolveTemplate(pnCustomTemplate?.value || '{n}', n, total, filename);
            default:
                return `Page ${n} of ${total}`;
        }
    }

    // ----------------------------------------------------
    // SHARED LAYOUT & LIVE SYNCHRONIZED PREVIEW
    // ----------------------------------------------------
    function computeSlotPlacements({
        pageWidth,
        pageHeight,
        margin,
        fontSize,
        hdrLeftText,
        hdrCenterText,
        hdrRightText,
        ftrLeftText,
        ftrCenterText,
        ftrRightText,
        numberText,
        numberPos,
    }) {
        const placements = [];
        const lineStep = Math.round(fontSize * 1.35);

        const pushItem = (text, align, zone, lineIdx) => {
            if (!text) return;
            placements.push({ text, align, zone, lineIdx });
        };

        pushItem(hdrLeftText, 'left', 'top', 0);
        pushItem(hdrCenterText, 'center', 'top', 0);
        pushItem(hdrRightText, 'right', 'top', 0);
        pushItem(ftrLeftText, 'left', 'bottom', 0);
        pushItem(ftrCenterText, 'center', 'bottom', 0);
        pushItem(ftrRightText, 'right', 'bottom', 0);

        if (numberText) {
            const isTop = numberPos.startsWith('top-');
            const zone = isTop ? 'top' : 'bottom';
            const align = numberPos.endsWith('-left') ? 'left' : (numberPos.endsWith('-right') ? 'right' : 'center');
            const hasConflict = placements.some((p) => p.zone === zone && p.align === align);
            pushItem(numberText, align, zone, hasConflict ? 1 : 0);
        }

        return placements.map((p) => {
            const xLeft = margin;
            const xCenter = pageWidth / 2;
            const xRight = Math.max(margin, pageWidth - margin);
            const x = p.align === 'left' ? xLeft : (p.align === 'right' ? xRight : xCenter);
            const offset = p.lineIdx * lineStep;
            const capH = fontSize * 0.75;
            const baselineTopY = margin + offset + capH;
            const baselineBottomY = Math.max(margin + capH, pageHeight - margin - offset);
            return {
                ...p,
                x,
                baselineY: p.zone === 'top' ? baselineTopY : baselineBottomY,
            };
        });
    }

    function updateLivePreview() {
        if (!previewOverlayCanvas || !page1Viewport) return;

        const canvas = previewOverlayCanvas;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const width = canvas.width;
        const height = canvas.height;
        const previewScale = width / page1Viewport.width;

        const rawSizePt = parseInt(pnFontSize?.value || '11', 10);
        const fontSizePt = Number.isFinite(rawSizePt) && rawSizePt >= 4 ? Math.min(72, rawSizePt) : 11;
        const fontPx = Math.max(8, fontSizePt * previewScale);
        const rawMarginPt = parseInt(pnMargin?.value || '30', 10);
        const marginPt = Number.isFinite(rawMarginPt) && rawMarginPt >= 0 ? Math.min(200, rawMarginPt) : 30;
        const marginPx = marginPt * previewScale;

        const fontFamily = pnFontFamily?.value?.includes('Times')
            ? 'Times New Roman, serif'
            : (pnFontFamily?.value?.includes('Courier') ? 'Courier New, monospace' : 'Arial, sans-serif');
        ctx.font = `${fontPx}px ${fontFamily}`;
        ctx.fillStyle = pnColor?.value || '#334155';

        const filename = currentFile?.name || 'document.pdf';
        const parsedStart = parseInt(pnStartNumber?.value || '1', 10);
        const startNumber = Number.isFinite(parsedStart) && parsedStart >= 1 ? parsedStart : 1;
        const skipFirst = pnSkipFirstPage?.checked || false;

        let p1NumberStr = '';
        if (enablePageNumbers?.checked && !skipFirst) {
            p1NumberStr = sanitizeWinAnsi(getPageNumberString(pnFormat?.value || 'page-n-of-total', startNumber, totalPages, filename));
        }

        const slots = computeSlotPlacements({
            pageWidth: width,
            pageHeight: height,
            margin: marginPx,
            fontSize: fontPx,
            hdrLeftText: sanitizeWinAnsi(resolveTemplate(hdrLeft?.value || '', startNumber, totalPages, filename)),
            hdrCenterText: sanitizeWinAnsi(resolveTemplate(hdrCenter?.value || '', startNumber, totalPages, filename)),
            hdrRightText: sanitizeWinAnsi(resolveTemplate(hdrRight?.value || '', startNumber, totalPages, filename)),
            ftrLeftText: sanitizeWinAnsi(resolveTemplate(ftrLeft?.value || '', startNumber, totalPages, filename)),
            ftrCenterText: sanitizeWinAnsi(resolveTemplate(ftrCenter?.value || '', startNumber, totalPages, filename)),
            ftrRightText: sanitizeWinAnsi(resolveTemplate(ftrRight?.value || '', startNumber, totalPages, filename)),
            numberText: p1NumberStr,
            numberPos: pnPosition?.value || 'bottom-center',
        });

        ctx.textBaseline = 'alphabetic';
        slots.forEach((slot) => {
            ctx.textAlign = slot.align;
            ctx.fillText(slot.text, slot.x, slot.baselineY);
        });
    }

    // Attach preview updates to all inputs
    [
        pnPosition, pnFormat, pnCustomTemplate, pnStartNumber, pnSkipFirstPage,
        hdrLeft, hdrCenter, hdrRight, ftrLeft, ftrCenter, ftrRight,
        pnFontFamily, pnFontSize, pnMargin
    ].forEach((el) => {
        if (el) {
            el.addEventListener('input', updateLivePreview);
            el.addEventListener('change', updateLivePreview);
        }
    });

    // Ingest Selected PDF (atomic against rapid replacements)
    async function loadPdfFile(file) {
        clearError();
        if (resultView) resultView.classList.add('hidden');
        const seq = ++loadSeq;
        let nextPreview = null;

        try {
            submitBtn.disabled = true;
            progress.start('Rendering document preview...');

            const nextBuffer = await PDFCore.readFileAsArrayBuffer(file);
            nextPreview = await PDFRender.loadPreviewDoc(nextBuffer);

            if (seq !== loadSeq) {
                await PDFRender.destroyDoc(nextPreview.pdfDoc);
                return;
            }

            if (currentPdfDoc) {
                await PDFRender.destroyDoc(currentPdfDoc);
                currentPdfDoc = null;
            }

            currentFile = file;
            currentBuffer = nextBuffer;
            currentPdfDoc = nextPreview.pdfDoc;
            totalPages = nextPreview.pageCount;
            numberedBlob = null;
            nextPreview = null;

            fileNameLabel.textContent = file.name;
            fileMetaLabel.textContent = `${PDFCore.formatBytes(file.size)} • ${totalPages} page${totalPages === 1 ? '' : 's'}`;

            // Render Page 1 to preview canvas
            const page1 = await currentPdfDoc.getPage(1);
            const scale = 1.0;
            const viewport = page1.getViewport({ scale });
            page1Viewport = viewport;

            previewPageCanvas.width = Math.floor(viewport.width);
            previewPageCanvas.height = Math.floor(viewport.height);
            previewOverlayCanvas.width = previewPageCanvas.width;
            previewOverlayCanvas.height = previewPageCanvas.height;

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
            if (nextPreview?.pdfDoc) {
                await PDFRender.destroyDoc(nextPreview.pdfDoc);
            }
            console.error('File load error:', err);
            showError('Unable to open this PDF document. Please verify the file is not password-protected.');
            progress.reset();
            submitBtn.disabled = !currentBuffer;
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

    function hexToRgb01(hex) {
        const clean = hex.replace('#', '');
        const r = parseInt(clean.substring(0, 2), 16) / 255;
        const g = parseInt(clean.substring(2, 4), 16) / 255;
        const b = parseInt(clean.substring(4, 6), 16) / 255;
        return { r, g, b };
    }

    // ----------------------------------------------------
    // MAIN PAGE NUMBERS & HEADER/FOOTER STAMPING
    // ----------------------------------------------------
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (!currentBuffer || !currentFile) {
                showError('Please upload a PDF file first.');
                return;
            }

            clearError();
            if (resultView) resultView.classList.add('hidden');

            try {
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

                progress.start('Stamping page numbers and headers...');

                const { PDFDocument, rgb, StandardFonts, degrees } = window.PDFLib;
                const doc = await PDFDocument.load(currentBuffer);

                const pages = doc.getPages();
                const count = pages.length;

                // Determine target page set
                const targetSetting = document.querySelector('input[name="pn-page-target"]:checked')?.value || 'all';
                let targetPageSet = new Set();

                if (targetSetting === 'all') {
                    for (let i = 1; i <= count; i++) targetPageSet.add(i);
                } else {
                    const rangeStr = pageRangesInput?.value?.trim() || '';
                    if (!rangeStr) {
                        throw new Error('Please enter custom page ranges (e.g. 2-10, 15).');
                    }
                    const parsed = PDFRender.parsePageRanges(rangeStr, count);
                    if (!parsed.valid || !parsed.flatPages || parsed.flatPages.length === 0) {
                        throw new Error(parsed.error || 'Invalid page range entered. Examples: 2-10, 15');
                    }
                    parsed.flatPages.forEach((p) => targetPageSet.add(p));
                }

                // Font & typography validation
                const fontMap = {
                    Helvetica: StandardFonts.Helvetica,
                    TimesRoman: StandardFonts.TimesRoman,
                    Courier: StandardFonts.Courier,
                };
                const chosenFont = fontMap[pnFontFamily?.value] || StandardFonts.Helvetica;
                const font = await doc.embedFont(chosenFont);

                const rawFontSize = parseInt(pnFontSize?.value || '11', 10);
                const fontSize = Number.isFinite(rawFontSize) && rawFontSize >= 4 ? Math.min(72, rawFontSize) : 11;
                const rawMargin = parseInt(pnMargin?.value || '30', 10);
                const margin = Number.isFinite(rawMargin) && rawMargin >= 0 ? Math.min(200, rawMargin) : 30;
                const { r, g, b } = hexToRgb01(pnColor?.value || '#334155');
                const fontColor = rgb(r, g, b);

                const filename = currentFile.name;
                const rawStartStr = (pnStartNumber?.value || '1').trim();
                const startNumber = Number(rawStartStr);
                if (!rawStartStr || !Number.isInteger(startNumber) || startNumber < 1) {
                    throw new Error('Starting page number must be a whole number of 1 or greater.');
                }

                const skipFirst = pnSkipFirstPage?.checked || false;
                const numbersEnabled = enablePageNumbers?.checked !== false;
                const numberPos = pnPosition?.value || 'bottom-center';
                const numberFormat = pnFormat?.value || 'page-n-of-total';

                // Stamp one visual slot via CropBox + /Rotate aware transform
                function stampSlot(page, pageBox, slot) {
                    const textWidth = font.widthOfTextAtSize(slot.text, fontSize);
                    const capH = fontSize * 0.75;
                    let vcx = pageBox.visualWidth / 2;
                    if (slot.align === 'left') {
                        vcx = Math.min(pageBox.visualWidth / 2, margin + textWidth / 2);
                    } else if (slot.align === 'right') {
                        vcx = Math.max(pageBox.visualWidth / 2, pageBox.visualWidth - margin - textWidth / 2);
                    }
                    const vcy = slot.baselineY - capH / 2;

                    const placement = PDFRender.visualCenterRectToPdfDraw(
                        vcx,
                        vcy,
                        textWidth,
                        capH,
                        0,
                        pageBox
                    );

                    page.drawText(slot.text, {
                        x: placement.x,
                        y: placement.y,
                        size: fontSize,
                        font,
                        color: fontColor,
                        rotate: degrees(placement.rotateDeg),
                    });
                }

                for (let i = 0; i < count; i++) {
                    const pageNum = i + 1;
                    if (!targetPageSet.has(pageNum)) continue;

                    const pct = Math.round(15 + (i / count) * 75);
                    progress.update(pct, `Paginating page ${pageNum} of ${count}...`);

                    const page = pages[i];
                    const pageBox = PDFRender.getEffectivePageBox(page);

                    // Calculate logical page number for this sheet
                    let currentNum = startNumber + i;
                    let shouldStampNumber = numbersEnabled;

                    if (skipFirst) {
                        if (pageNum === 1) {
                            shouldStampNumber = false;
                        } else {
                            currentNum = startNumber + (i - 1);
                        }
                    }

                    const numberText = shouldStampNumber
                        ? sanitizeWinAnsi(getPageNumberString(numberFormat, currentNum, count, filename))
                        : '';

                    const slots = computeSlotPlacements({
                        pageWidth: pageBox.visualWidth,
                        pageHeight: pageBox.visualHeight,
                        margin,
                        fontSize,
                        hdrLeftText: sanitizeWinAnsi(resolveTemplate(hdrLeft?.value || '', currentNum, count, filename)),
                        hdrCenterText: sanitizeWinAnsi(resolveTemplate(hdrCenter?.value || '', currentNum, count, filename)),
                        hdrRightText: sanitizeWinAnsi(resolveTemplate(hdrRight?.value || '', currentNum, count, filename)),
                        ftrLeftText: sanitizeWinAnsi(resolveTemplate(ftrLeft?.value || '', currentNum, count, filename)),
                        ftrCenterText: sanitizeWinAnsi(resolveTemplate(ftrCenter?.value || '', currentNum, count, filename)),
                        ftrRightText: sanitizeWinAnsi(resolveTemplate(ftrRight?.value || '', currentNum, count, filename)),
                        numberText,
                        numberPos,
                    });

                    slots.forEach((slot) => stampSlot(page, pageBox, slot));
                }

                progress.update(92, 'Generating finalized PDF document...');
                const pdfBytes = await doc.save();
                numberedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                progress.complete('Document numbered successfully!');

                if (resultSummary) {
                    resultSummary.textContent = `Applied formatting across ${targetPageSet.size} page(s) (${PDFCore.formatBytes(numberedBlob.size)}).`;
                }

                if (resultView) {
                    resultView.classList.remove('hidden');
                    resultView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } catch (err) {
                console.error('Page numbering error:', err);
                showError(err.message || 'An error occurred while numbering the document.');
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
            if (!numberedBlob || !currentFile) return;
            const originalName = currentFile.name.replace(/\.[^/.]+$/, '');
            const downloadName = `${originalName}-numbered.pdf`;
            PDFCore.downloadBlob(numberedBlob, downloadName);
        });
    }

    // Reset Handler
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            ++loadSeq;
            currentFile = null;
            currentBuffer = null;
            numberedBlob = null;
            page1Viewport = null;
            totalPages = 0;

            if (currentPdfDoc) {
                await PDFRender.destroyDoc(currentPdfDoc);
                currentPdfDoc = null;
            }
            if (fileInput) fileInput.value = '';
            if (hdrLeft) hdrLeft.value = '';
            if (hdrCenter) hdrCenter.value = '';
            if (hdrRight) hdrRight.value = '';
            if (ftrLeft) ftrLeft.value = '';
            if (ftrCenter) ftrCenter.value = '';
            if (ftrRight) ftrRight.value = '';
            if (pnCustomTemplate) pnCustomTemplate.value = '';
            if (pageRangesInput) pageRangesInput.value = '';
            if (pnStartNumber) pnStartNumber.value = '1';
            if (pnSkipFirstPage) pnSkipFirstPage.checked = false;
            if (enablePageNumbers) enablePageNumbers.checked = true;
            if (pageNumbersOptions) {
                pageNumbersOptions.style.opacity = '1';
                pageNumbersOptions.style.pointerEvents = 'auto';
            }
            if (pnPosition) pnPosition.value = 'bottom-center';
            if (pnFormat) pnFormat.value = 'page-n-of-total';
            if (pnFontFamily) pnFontFamily.value = 'Helvetica';
            if (pnFontSize) pnFontSize.value = '11';
            if (pnMargin) pnMargin.value = '30';
            if (pnColor) pnColor.value = '#334155';
            if (pnColorHex) pnColorHex.value = '#334155';
            if (customTemplateContainer) customTemplateContainer.classList.add('hidden');
            if (customRangeContainer) customRangeContainer.classList.add('hidden');
            const allRadio = document.querySelector('input[name="pn-page-target"][value="all"]');
            if (allRadio) allRadio.checked = true;

            [previewPageCanvas, previewOverlayCanvas].forEach((c) => {
                if (c) {
                    const cctx = c.getContext('2d');
                    cctx?.clearRect(0, 0, c.width, c.height);
                }
            });

            clearError();
            progress.reset();

            if (resultView) resultView.classList.add('hidden');
            if (workspace) workspace.classList.add('hidden');
            if (dropzone) dropzone.classList.remove('hidden');
        });
    }
})();
