/**
 * PDFToolKit - HTML & Plain Text to PDF Client-Side Controller
 * 100% In-Browser Execution via jsPDF, html2canvas & DOMPurify
 */

(function () {
    'use strict';

    // Mode tabs
    const modeTabs = document.querySelectorAll('.converter-mode-tab');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // Text Mode Elements
    const plainTextInput = document.getElementById('plain-text-input');
    const textStats = document.getElementById('text-stats');
    const loadSampleTxtBtn = document.getElementById('load-sample-txt-btn');
    const loadTxtFileBtn = document.getElementById('load-txt-file-btn');
    const txtFileInput = document.getElementById('txt-file-input');
    const textFontFamily = document.getElementById('text-font-family');
    const textFontSize = document.getElementById('text-font-size');
    const textLineSpacing = document.getElementById('text-line-spacing');
    const textPageSize = document.getElementById('text-page-size');
    const textOrientation = document.getElementById('text-orientation');
    const textMargin = document.getElementById('text-margin');

    // HTML Mode Elements
    const htmlSourceInput = document.getElementById('html-source-input');
    const htmlPreviewSandbox = document.getElementById('html-preview-sandbox');
    const loadSampleHtmlBtn = document.getElementById('load-sample-html-btn');
    const loadHtmlFileBtn = document.getElementById('load-html-file-btn');
    const htmlFileInput = document.getElementById('html-file-input');
    const htmlPageSize = document.getElementById('html-page-size');
    const htmlOrientation = document.getElementById('html-orientation');
    const htmlMargin = document.getElementById('html-margin');
    const htmlRenderScale = document.getElementById('html-render-scale');
    const isolatedIframe = document.getElementById('isolated-html-render-iframe');

    // Actions & Result
    const convertOutputFilename = document.getElementById('convert-output-filename');
    const convertSubmitBtn = document.getElementById('convert-submit-btn');
    const progressContainer = document.getElementById('convert-progress-container');
    const resultView = document.getElementById('result-view');
    const resultSummary = document.getElementById('result-summary');
    const downloadDocBtn = document.getElementById('download-doc-btn');
    const resetBtn = document.getElementById('convert-reset-btn');
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    const errorDismissBtn = document.getElementById('error-dismiss-btn');

    // State
    const progress = PDFCore.createProgress(progressContainer);
    let activeMode = 'text';
    let lastGeneratedBlob = null;
    let previewDebounce = null;

    function showError(msg) {
        if (!errorAlert || !errorMessage) return;
        errorMessage.textContent = msg;
        errorAlert.classList.remove('hidden');
    }

    function clearError() {
        if (errorAlert) errorAlert.classList.add('hidden');
    }

    if (errorDismissBtn) {
        errorDismissBtn.addEventListener('click', clearError);
    }

    // Switch Tabs
    modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.mode;
            activeMode = mode;

            modeTabs.forEach(t => {
                t.classList.remove('bg-blue-600', 'text-white');
                t.classList.add('bg-transparent', 'text-slate-600');
            });
            tab.classList.add('bg-blue-600', 'text-white');
            tab.classList.remove('bg-transparent', 'text-slate-600');

            tabPanels.forEach(p => p.classList.add('hidden'));
            const activePanel = document.getElementById(`tab-panel-${mode}`);
            if (activePanel) activePanel.classList.remove('hidden');

            if (resultView) {
                resultView.classList.add('hidden');
            }
            if (resultSummary) {
                resultSummary.textContent = '';
            }

            if (mode === 'html') {
                updateHtmlPreview();
            }
        });
    });

    // ----------------------------------------------------
    // TEXT MODE LOGIC
    // ----------------------------------------------------
    function updateTextStats() {
        if (!plainTextInput || !textStats) return;
        const text = plainTextInput.value;
        const charCount = text.length;
        const lineCount = text ? text.split('\n').length : 0;
        textStats.textContent = `${charCount} characters • ${lineCount} lines`;
    }

    if (plainTextInput) {
        plainTextInput.addEventListener('input', updateTextStats);
    }

    if (loadSampleTxtBtn) {
        loadSampleTxtBtn.addEventListener('click', () => {
            plainTextInput.value = `PDFToolKit Document Report\n===========================\n\nThis document was generated directly inside your web browser using client-side vector typography. Notice that all text remains sharp, selectable, and searchable, regardless of screen zoom level.\n\nKey Advantages of Client-Side Processing:\n1. 100% Privacy: Your confidential words and documents never touch a third-party server.\n2. Instant Processing: Zero bandwidth lag or upload delay; document compilation finishes in milliseconds.\n3. Automatic Pagination: Long articles, notes, and records flow automatically across clean printable pages with customizable margins and line spacing.\n\nSecurity & Compliance Overview:\nBrowser-based execution provides strict data isolation by design. Because files are never transferred over public internet connections to external compute clusters, organizations maintain compliance with data residency mandates and corporate non-disclosure policies. Operations are performed in local device memory, guaranteeing that sensitive financial, personal, and legal records stay strictly confidential.\n\nThank you for choosing PDFToolKit!`;
            updateTextStats();
        });
    }

    if (loadTxtFileBtn && txtFileInput) {
        loadTxtFileBtn.addEventListener('click', () => {
            txtFileInput.value = '';
            txtFileInput.click();
        });

        txtFileInput.addEventListener('change', () => {
            const file = txtFileInput.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                plainTextInput.value = e.target.result || '';
                updateTextStats();
            };
            reader.readAsText(file);
        });
    }

    // Generate PDF from Vector Text
    function generateTextPdf() {
        const text = plainTextInput?.value || '';
        if (!text.trim()) {
            throw new Error('Please enter some text to convert.');
        }

        const { jsPDF } = window.jspdf;
        const pageSize = textPageSize?.value || 'a4';
        const orientation = textOrientation?.value || 'portrait';
        const fontFamily = textFontFamily?.value || 'helvetica';
        const fontSize = parseInt(textFontSize?.value || '12', 10);
        const lineSpacingFactor = parseFloat(textLineSpacing?.value || '1.5');
        const margin = parseInt(textMargin?.value || '40', 10);

        // Dimensions in points (pt)
        const dimensions = {
            a4: { w: 595.28, h: 841.89 },
            letter: { w: 612.0, h: 792.0 },
        };

        const standard = dimensions[pageSize] || dimensions.a4;
        const pageW = orientation === 'landscape' ? Math.max(standard.w, standard.h) : Math.min(standard.w, standard.h);
        const pageH = orientation === 'landscape' ? Math.min(standard.w, standard.h) : Math.max(standard.w, standard.h);

        const doc = new jsPDF({
            orientation,
            unit: 'pt',
            format: [pageW, pageH],
        });

        doc.setFont(fontFamily, 'normal');
        doc.setFontSize(fontSize);

        const printableW = pageW - margin * 2;
        const lineHeight = fontSize * lineSpacingFactor;
        let cursorY = margin + fontSize;

        const paragraphs = text.split('\n');

        for (let i = 0; i < paragraphs.length; i++) {
            const para = paragraphs[i];

            if (para.trim() === '') {
                // Empty line
                cursorY += lineHeight;
                if (cursorY + lineHeight > pageH - margin) {
                    doc.addPage();
                    cursorY = margin + fontSize;
                }
                continue;
            }

            // Split paragraph into lines that fit printable width
            const lines = doc.splitTextToSize(para, printableW);

            for (let j = 0; j < lines.length; j++) {
                if (cursorY + lineHeight > pageH - margin) {
                    doc.addPage();
                    cursorY = margin + fontSize;
                }
                doc.text(lines[j], margin, cursorY);
                cursorY += lineHeight;
            }
        }

        const pageCount = doc.getNumberOfPages();
        const blob = doc.output('blob');
        return { blob, pageCount };
    }

    // ----------------------------------------------------
    // HTML MODE LOGIC
    // ----------------------------------------------------
    function updateHtmlPreview() {
        if (!htmlSourceInput || !htmlPreviewSandbox) return;
        const raw = htmlSourceInput.value;
        if (!raw.trim()) {
            htmlPreviewSandbox.innerHTML = '<p style="color: #94a3b8; font-style: italic;">Enter HTML in the editor or load a sample to see live preview...</p>';
            return;
        }

        // DOMPurify sanitization
        const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
        htmlPreviewSandbox.innerHTML = clean;
    }

    if (htmlSourceInput) {
        htmlSourceInput.addEventListener('input', () => {
            clearTimeout(previewDebounce);
            previewDebounce = setTimeout(updateHtmlPreview, 250);
        });
    }

    if (loadSampleHtmlBtn) {
        loadSampleHtmlBtn.addEventListener('click', () => {
            htmlSourceInput.value = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; color: #1e293b; padding: 20px; line-height: 1.5; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
    .title { font-size: 24px; font-weight: bold; color: #1e293b; }
    .invoice-id { color: #64748b; font-size: 14px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    .table th { background-color: #f1f5f9; text-align: left; padding: 10px; font-size: 12px; text-transform: uppercase; color: #475569; }
    .table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .total-box { margin-top: 25px; text-align: right; }
    .total-row { font-size: 18px; font-weight: bold; color: #2563eb; }
    .badge { background: #dbeafe; color: #1e40af; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">PDFToolKit Invoice</div>
      <div class="invoice-id">Invoice #INV-2026-0042 &bull; 100% In-Browser</div>
    </div>
    <div>
      <span class="badge">PAID</span>
    </div>
  </div>

  <table class="table">
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Client-Side PDF Document Processing</td>
        <td>1</td>
        <td>$0.00</td>
        <td>$0.00</td>
      </tr>
      <tr>
        <td>Unlimited Zero-Upload Privacy Guarantee</td>
        <td>1</td>
        <td>$0.00</td>
        <td>$0.00</td>
      </tr>
      <tr>
        <td>High-Speed In-Browser Conversion</td>
        <td>1</td>
        <td>$0.00</td>
        <td>$0.00</td>
      </tr>
    </tbody>
  </table>

  <div class="total-box">
    <p style="color: #64748b; font-size: 12px; margin: 0;">Total Amount Due</p>
    <div class="total-row">$0.00 (100% Free)</div>
  </div>
</body>
</html>`;
            updateHtmlPreview();
        });
    }

    if (loadHtmlFileBtn && htmlFileInput) {
        loadHtmlFileBtn.addEventListener('click', () => {
            htmlFileInput.value = '';
            htmlFileInput.click();
        });

        htmlFileInput.addEventListener('change', () => {
            const file = htmlFileInput.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                htmlSourceInput.value = e.target.result || '';
                updateHtmlPreview();
            };
            reader.readAsText(file);
        });
    }

    // Generate PDF from HTML with Tailwind v4 / oklch isolation
    async function generateHtmlPdf() {
        const raw = htmlSourceInput?.value || '';
        if (!raw.trim()) {
            throw new Error('Please enter some HTML code or load a sample document.');
        }

        // 1. Mandatory DOMPurify Sanitization
        const cleanHtml = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });

        // 2. Setup isolated offscreen iframe completely shielded from Tailwind CSS & oklch
        if (!isolatedIframe) {
            throw new Error('Render target iframe not found.');
        }

        const iframeDoc = isolatedIframe.contentDocument || isolatedIframe.contentWindow?.document;
        if (!iframeDoc) {
            throw new Error('Could not access render iframe document.');
        }

        iframeDoc.open();
        iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 24px;
      background-color: #ffffff;
      color: #111827;
      font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      width: 800px;
    }
  </style>
</head>
<body>${cleanHtml}</body>
</html>`);
        iframeDoc.close();

        // Small delay for DOM layout in iframe
        await new Promise(r => setTimeout(r, 60));

        const { jsPDF } = window.jspdf;
        const pageSize = htmlPageSize?.value || 'a4';
        const orientation = htmlOrientation?.value || 'portrait';
        const marginMm = parseInt(htmlMargin?.value || '15', 10);
        const scale = parseFloat(htmlRenderScale?.value || '2.0');

        const doc = new jsPDF({
            orientation,
            unit: 'mm',
            format: pageSize,
        });

        const pageWidthMm = doc.internal.pageSize.getWidth();
        const printableWidthMm = pageWidthMm - marginMm * 2;

        // Temporarily detach any <style> elements that contain Tailwind v4 oklch functions
        // so html2canvas never encounters unsupported color functions during document cloning
        const detachedStyles = [];
        document.querySelectorAll('style').forEach(styleEl => {
            if (styleEl.textContent && styleEl.textContent.includes('oklch')) {
                const parent = styleEl.parentNode;
                const next = styleEl.nextSibling;
                parent.removeChild(styleEl);
                detachedStyles.push({ el: styleEl, parent, next });
            }
        });

        try {
            await new Promise((resolve, reject) => {
                try {
                    doc.html(iframeDoc.body, {
                        x: marginMm,
                        y: marginMm,
                        width: printableWidthMm,
                        windowWidth: 800,
                        autoPaging: 'text',
                        html2canvas: {
                            scale: scale,
                            backgroundColor: '#ffffff',
                            useCORS: true,
                            logging: false,
                        },
                        callback: (renderedDoc) => {
                            resolve(renderedDoc);
                        },
                    });
                } catch (err) {
                    reject(err);
                }
            });
        } finally {
            // Restore any detached Tailwind styles immediately
            detachedStyles.forEach(({ el, parent, next }) => {
                try {
                    parent.insertBefore(el, next);
                } catch (e) {}
            });

            // Clean up iframe body immediately after rendering
            if (iframeDoc && iframeDoc.body) {
                iframeDoc.body.innerHTML = '';
            }
        }

        const pageCount = doc.getNumberOfPages();
        const blob = doc.output('blob');
        return { blob, pageCount };
    }

    // ----------------------------------------------------
    // MAIN CONVERSION SUBMIT
    // ----------------------------------------------------
    if (convertSubmitBtn) {
        convertSubmitBtn.addEventListener('click', async () => {
            clearError();
            if (resultView) resultView.classList.add('hidden');
            if (resultSummary) resultSummary.textContent = '';

            try {
                convertSubmitBtn.disabled = true;
                convertSubmitBtn.classList.add('opacity-75', 'cursor-not-allowed');

                progress.start('Compiling document into PDF...');

                let result;
                if (activeMode === 'text') {
                    progress.update(30, 'Formatting text typography...');
                    result = generateTextPdf();
                    progress.update(85, 'Finalizing vector PDF...');
                } else {
                    progress.update(25, 'Sanitizing HTML and rendering layout...');
                    result = await generateHtmlPdf();
                    progress.update(85, 'Building PDF pages...');
                }

                lastGeneratedBlob = result.blob;
                progress.complete('Conversion complete!');

                if (resultView && resultSummary) {
                    const modeLabel = activeMode === 'text' ? 'Vector Text' : 'Rich HTML';
                    resultSummary.textContent = `Generated ${result.pageCount}-page PDF from ${modeLabel} (${PDFCore.formatBytes(result.blob.size)}).`;
                    resultView.classList.remove('hidden');
                    resultView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } catch (err) {
                console.error('HTML/Text to PDF error:', err);
                showError(err.message || 'An error occurred while compiling the PDF.');
                progress.reset();
            } finally {
                convertSubmitBtn.disabled = false;
                convertSubmitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        });
    }

    // Download PDF Button
    if (downloadDocBtn) {
        downloadDocBtn.addEventListener('click', () => {
            if (!lastGeneratedBlob) return;
            const requested = convertOutputFilename?.value || 'document.pdf';
            const cleanName = PDFCore.sanitizeFilename(requested, 'pdf');
            PDFCore.downloadBlob(lastGeneratedBlob, cleanName, 'application/pdf');
        });
    }

    // Reset Workflow
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            lastGeneratedBlob = null;
            if (plainTextInput) plainTextInput.value = '';
            if (htmlSourceInput) htmlSourceInput.value = '';
            if (htmlPreviewSandbox) htmlPreviewSandbox.innerHTML = '';
            updateTextStats();
            progress.reset();
            resultView?.classList.add('hidden');
            clearError();
        });
    }

    // Initialize defaults
    updateTextStats();
    updateHtmlPreview();

})();
