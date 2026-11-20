/**
 * NoPayPDF - Word (DOCX) to PDF Client-Side Controller
 * 100% In-Browser Execution via Mammoth.js, DOMPurify, html2canvas & jsPDF
 */

(function () {
    'use strict';

    // UI Elements
    const dropzoneView = document.getElementById('dropzone-view');
    const docxDropzone = document.getElementById('docx-dropzone');
    const docxFileInput = document.getElementById('docx-file-input');
    const workspaceView = document.getElementById('workspace-view');
    const docFilenameEl = document.getElementById('doc-filename');
    const docMetaEl = document.getElementById('doc-meta');
    const changeDocBtn = document.getElementById('change-doc-btn');
    const docxRenderedContent = document.getElementById('docx-rendered-content');
    const pageSizeSelect = document.getElementById('page-size');
    const pageOrientationSelect = document.getElementById('page-orientation');
    const pageMarginsSelect = document.getElementById('page-margins');
    const outputFilenameInput = document.getElementById('output-filename');
    const convertBtn = document.getElementById('convert-btn');
    const progressContainer = document.getElementById('convert-progress-container');
    const resultView = document.getElementById('result-view');
    const resultSummary = document.getElementById('result-summary');
    const downloadDocBtn = document.getElementById('download-doc-btn');
    const resetBtn = document.getElementById('convert-reset-btn');
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    const errorDismissBtn = document.getElementById('error-dismiss-btn');
    const isolatedIframe = document.getElementById('isolated-docx-render-iframe');

    // State
    const progress = PDFCore.createProgress(progressContainer);
    let currentFile = null;
    let convertedHtml = '';
    let lastGeneratedBlob = null;

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

    // ----------------------------------------------------
    // Dropzone & File Selection
    // ----------------------------------------------------
    if (docxDropzone && docxFileInput) {
        docxDropzone.addEventListener('click', () => {
            docxFileInput.value = '';
            docxFileInput.click();
        });

        docxDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            docxDropzone.classList.add('border-blue-500', 'bg-blue-50/40');
        });

        docxDropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            docxDropzone.classList.remove('border-blue-500', 'bg-blue-50/40');
        });

        docxDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            docxDropzone.classList.remove('border-blue-500', 'bg-blue-50/40');
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                handleWordFile(files[0]);
            }
        });

        docxFileInput.addEventListener('change', () => {
            const files = docxFileInput.files;
            if (files && files.length > 0) {
                handleWordFile(files[0]);
            }
        });
    }

    if (changeDocBtn) {
        changeDocBtn.addEventListener('click', () => {
            if (docxFileInput) {
                docxFileInput.value = '';
                docxFileInput.click();
            }
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            currentFile = null;
            convertedHtml = '';
            lastGeneratedBlob = null;
            if (docxRenderedContent) docxRenderedContent.innerHTML = '';
            if (workspaceView) workspaceView.classList.add('hidden');
            if (resultView) resultView.classList.add('hidden');
            if (dropzoneView) dropzoneView.classList.remove('hidden');
            clearError();
        });
    }

    // ----------------------------------------------------
    // Word (.docx) Parsing via Mammoth.js
    // ----------------------------------------------------
    async function handleWordFile(file) {
        clearError();

        if (!file) return;

        const nameLower = file.name.toLowerCase();
        if (nameLower.endsWith('.doc') && !nameLower.endsWith('.docx')) {
            showError('Legacy Word 97-2003 binary format (.doc) detected. Please open the document in Microsoft Word, Google Docs, or LibreOffice and save it as .docx, or copy and paste the text into our HTML & Text to PDF tool.');
            return;
        }

        if (!nameLower.endsWith('.docx') && !nameLower.endsWith('.dotx')) {
            showError('Please select a valid Microsoft Word document (.docx or .dotx).');
            return;
        }

        // Verify mammoth is available
        if (typeof mammoth === 'undefined') {
            showError('Word parser library (Mammoth.js) is loading. Please check your internet connection or reload the page.');
            return;
        }

        currentFile = file;
        progress.start('Reading Word document...');

        try {
            const arrayBuffer = await file.arrayBuffer();
            progress.update(40, 'Parsing Word XML & styles...');

            const mammothResult = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
            let rawHtml = mammothResult.value;

            if (!rawHtml || !rawHtml.trim()) {
                rawHtml = '<p style="color: #64748b; font-style: italic;">(This Word document contains no readable text or inline elements.)</p>';
            }

            // Sanitize HTML with DOMPurify
            progress.update(70, 'Sanitizing document layout...');
            convertedHtml = typeof DOMPurify !== 'undefined'
                ? DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } })
                : rawHtml;

            // Display in Preview Canvas
            if (docxRenderedContent) {
                docxRenderedContent.innerHTML = convertedHtml;
                applyPreviewStyles(docxRenderedContent);
            }

            // Update Metadata
            if (docFilenameEl) docFilenameEl.textContent = file.name;
            if (docMetaEl) {
                const sizeStr = PDFCore.formatBytes(file.size);
                docMetaEl.textContent = `${sizeStr} • Microsoft Word (.docx)`;
            }

            // Set suggested output filename
            if (outputFilenameInput) {
                const base = file.name.replace(/\.[^/.]+$/, "");
                outputFilenameInput.value = PDFCore.sanitizeFilename(`${base}.pdf`);
            }

            // Transition UI to Workspace
            if (dropzoneView) dropzoneView.classList.add('hidden');
            if (workspaceView) workspaceView.classList.remove('hidden');
            if (resultView) resultView.classList.add('hidden');
            progress.complete('Document loaded ready for conversion');
            setTimeout(() => progress.reset(), 1000);

            // Re-render Lucide icons for any dynamic elements
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        } catch (err) {
            console.error('Failed to parse Word document:', err);
            progress.reset();
            showError(`Could not parse Word document: ${err.message || 'Corrupted or unsupported DOCX structure.'}`);
        }
    }

    function applyPreviewStyles(container) {
        // Apply clean typographic styling to Mammoth output elements
        const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach(h => {
            h.style.fontWeight = 'bold';
            h.style.marginTop = '1.2em';
            h.style.marginBottom = '0.5em';
            h.style.color = '#0f172a';
        });

        const paragraphs = container.querySelectorAll('p');
        paragraphs.forEach(p => {
            p.style.marginBottom = '0.75em';
            p.style.lineHeight = '1.6';
        });

        const tables = container.querySelectorAll('table');
        tables.forEach(t => {
            t.style.width = '100%';
            t.style.borderCollapse = 'collapse';
            t.style.marginTop = '1em';
            t.style.marginBottom = '1em';
            t.querySelectorAll('td, th').forEach(cell => {
                cell.style.border = '1px solid #cbd5e1';
                cell.style.padding = '6px 10px';
                cell.style.textAlign = 'left';
            });
            t.querySelectorAll('th').forEach(th => {
                th.style.backgroundColor = '#f1f5f9';
                th.style.fontWeight = 'bold';
            });
        });

        const images = container.querySelectorAll('img');
        images.forEach(img => {
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.margin = '1em 0';
        });

        const lists = container.querySelectorAll('ul, ol');
        lists.forEach(list => {
            list.style.paddingLeft = '1.5em';
            list.style.marginBottom = '0.75em';
        });
    }

    // ----------------------------------------------------
    // PDF Generation via Isolated Iframe & jsPDF
    // ----------------------------------------------------
    async function convertWordToPdf() {
        if (!convertedHtml) {
            showError('No converted Word content found. Please load a valid .docx file first.');
            return;
        }

        clearError();
        progress.start('Preparing document for PDF compilation...');

        if (!isolatedIframe) {
            showError('Render frame not initialized. Please refresh the page.');
            progress.reset();
            return;
        }

        const iframeDoc = isolatedIframe.contentDocument || isolatedIframe.contentWindow?.document;
        if (!iframeDoc) {
            showError('Could not access isolated render sandbox.');
            progress.reset();
            return;
        }

        const pageSize = pageSizeSelect?.value || 'a4';
        const orientation = pageOrientationSelect?.value || 'portrait';
        const marginChoice = pageMarginsSelect?.value || 'normal';

        let marginMm = 20;
        if (marginChoice === 'compact') marginMm = 10;
        if (marginChoice === 'wide') marginMm = 30;

        // Write isolated HTML shielded from external Tailwind v4 CSS
        iframeDoc.open();
        iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: ${marginMm}mm;
      background-color: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.6;
      width: 800px;
    }
    h1 { font-size: 22px; font-weight: bold; margin-top: 1.2em; margin-bottom: 0.5em; color: #0f172a; }
    h2 { font-size: 18px; font-weight: bold; margin-top: 1.1em; margin-bottom: 0.4em; color: #0f172a; }
    h3 { font-size: 15px; font-weight: bold; margin-top: 1.0em; margin-bottom: 0.3em; color: #0f172a; }
    p { margin-top: 0; margin-bottom: 0.75em; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; }
    table th, table td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 12px; }
    table th { background-color: #f1f5f9; font-weight: bold; text-align: left; }
    ul, ol { padding-left: 20px; margin: 0.5em 0; }
    li { margin-bottom: 0.25em; }
    img { max-width: 100%; height: auto; margin: 0.5em 0; }
    blockquote { border-left: 3px solid #3b82f6; margin-left: 0; padding-left: 12px; color: #475569; }
  </style>
</head>
<body>${convertedHtml}</body>
</html>`);
        iframeDoc.close();

        // Brief delay for iframe layout
        await new Promise(r => setTimeout(r, 80));

        progress.update(40, 'Rendering document pages...');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation,
            unit: 'mm',
            format: pageSize,
        });

        const pageWidthMm = doc.internal.pageSize.getWidth();
        const printableWidthMm = pageWidthMm - marginMm * 2;

        // Detach any style elements containing Tailwind v4 oklch functions during html2canvas render
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
                            scale: 2.0,
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
            // Restore any detached styles immediately
            detachedStyles.forEach(({ el, parent, next }) => {
                try {
                    parent.insertBefore(el, next);
                } catch (e) {}
            });

            // Clean up iframe body
            if (iframeDoc && iframeDoc.body) {
                iframeDoc.body.innerHTML = '';
            }
        }

        progress.update(85, 'Finalizing PDF output...');
        const pageCount = doc.getNumberOfPages();
        const blob = doc.output('blob');
        lastGeneratedBlob = blob;

        progress.complete('PDF generated successfully!');

        // Display Result View
        if (resultView) {
            resultView.classList.remove('hidden');
            if (resultSummary) {
                const formattedSize = PDFCore.formatBytes(blob.size);
                resultSummary.textContent = `${pageCount} ${pageCount === 1 ? 'page' : 'pages'} generated • ${formattedSize} • 100% Client-Side`;
            }
            resultView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    if (convertBtn) {
        convertBtn.addEventListener('click', async () => {
            convertBtn.disabled = true;
            try {
                await convertWordToPdf();
            } catch (err) {
                console.error('Word to PDF conversion failed:', err);
                showError(PDFCore.formatPdfError(err));
            } finally {
                convertBtn.disabled = false;
            }
        });
    }

    if (downloadDocBtn) {
        downloadDocBtn.addEventListener('click', () => {
            if (!lastGeneratedBlob) {
                showError('No generated PDF available to download.');
                return;
            }

            let filename = outputFilenameInput?.value?.trim() || 'document.pdf';
            if (!filename.toLowerCase().endsWith('.pdf')) {
                filename += '.pdf';
            }

            PDFCore.downloadBlob(lastGeneratedBlob, filename);
        });
    }

})();
