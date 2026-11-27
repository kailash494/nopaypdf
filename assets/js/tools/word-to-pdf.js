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

    const DOCX_PREVIEW_AND_RENDER_CSS = `
        h1 { font-size: 22px; font-weight: bold; margin-top: 1.2em; margin-bottom: 0.5em; color: #0f172a; }
        h2 { font-size: 18px; font-weight: bold; margin-top: 1.1em; margin-bottom: 0.4em; color: #0f172a; }
        h3 { font-size: 15px; font-weight: bold; margin-top: 1.0em; margin-bottom: 0.3em; color: #0f172a; }
        p { margin-top: 0; margin-bottom: 0.75em; line-height: 1.6; }
        table { width: 100%; border-collapse: collapse; margin: 1em 0; }
        table th, table td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 12px; }
        table th { background-color: #f1f5f9; font-weight: bold; text-align: left; }
        ul, ol { padding-left: 20px; margin: 0.5em 0; }
        li { margin-bottom: 0.25em; }
        img { max-width: 100%; height: auto; margin: 0.5em 0; }
        blockquote { border-left: 3px solid #3b82f6; margin-left: 0; padding-left: 12px; color: #475569; }
    `;

    // ----------------------------------------------------
    // Dropzone & File Selection (Keyboard + Drag + Size Guard via PDFCore)
    // ----------------------------------------------------
    if (docxDropzone && docxFileInput) {
        PDFCore.initDropzone({
            dropzoneEl: docxDropzone,
            inputEl: docxFileInput,
            accept: '.docx,.dotx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.wordprocessingml.template,application/msword',
            multiple: false,
            ariaLabel: 'Upload Word (.docx) document',
            onFilesAdded: (files) => {
                if (files && files[0]) handleWordFile(files[0]);
            },
            onError: (errors) => {
                if (errors && errors.length > 0) showError(errors[0]);
            },
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
            if (docxFileInput) docxFileInput.value = '';
            if (docxRenderedContent) docxRenderedContent.innerHTML = '';
            if (outputFilenameInput) outputFilenameInput.value = 'document.pdf';
            if (workspaceView) workspaceView.classList.add('hidden');
            if (resultView) resultView.classList.add('hidden');
            if (dropzoneView) dropzoneView.classList.remove('hidden');
            progress.reset();
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
            showError('Legacy Word 97-2003 binary format (.doc) detected. Please open the document and save it as .docx first, or paste the text into our HTML & Text to PDF tool.');
            return;
        }

        if (!nameLower.endsWith('.docx') && !nameLower.endsWith('.dotx')) {
            showError('Please select a valid Microsoft Word document (.docx or .dotx).');
            return;
        }

        if (typeof mammoth === 'undefined') {
            showError('Word parser library (Mammoth.js) is loading. Please check your internet connection or reload the page.');
            return;
        }

        if (typeof window.DOMPurify === 'undefined') {
            showError('HTML sanitizer library (DOMPurify) is unavailable. Please reload the page to convert Word documents safely.');
            return;
        }

        currentFile = file;
        lastGeneratedBlob = null;
        progress.start('Reading Word document...');

        try {
            const arrayBuffer = await file.arrayBuffer();
            progress.update(40, 'Parsing Word XML & styles...');

            const mammothResult = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
            let rawHtml = mammothResult.value;

            if (!rawHtml || !rawHtml.trim()) {
                rawHtml = '<p style="color: #64748b; font-style: italic;">(This Word document contains no readable text or inline elements.)</p>';
            }

            // Mandatory DOMPurify Sanitization
            progress.update(70, 'Sanitizing document layout...');
            convertedHtml = window.DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });

            // Display inside isolated sandboxed preview iframe
            if (docxRenderedContent) {
                PDFCore.renderIsolatedPreview(
                    docxRenderedContent,
                    convertedHtml,
                    DOCX_PREVIEW_AND_RENDER_CSS,
                    'Word Document Preview'
                );
            }

            // Update Metadata
            if (docFilenameEl) docFilenameEl.textContent = file.name;
            if (docMetaEl) {
                const sizeStr = PDFCore.formatBytes(file.size);
                docMetaEl.textContent = `${sizeStr} • Microsoft Word (.docx)`;
            }

            // Set suggested output filename
            if (outputFilenameInput) {
                const base = file.name.replace(/\.[^/.]+$/, '');
                outputFilenameInput.value = PDFCore.sanitizeFilename(`${base}.pdf`);
            }

            // Transition UI to Workspace
            if (dropzoneView) dropzoneView.classList.add('hidden');
            if (workspaceView) workspaceView.classList.remove('hidden');
            if (resultView) resultView.classList.add('hidden');
            progress.complete('Document loaded ready for conversion');
            setTimeout(() => progress.reset(), 1000);

            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        } catch (err) {
            console.error('Failed to parse Word document:', err);
            progress.reset();
            showError(`Could not parse Word document: ${err.message || 'Corrupted or unsupported DOCX structure.'}`);
        }
    }

    // ----------------------------------------------------
    // PDF Generation via Isolated Iframe & html2canvas -> jsPDF
    // ----------------------------------------------------
    async function convertWordToPdf() {
        if (!convertedHtml) {
            throw new Error('No converted Word content found. Please load a valid .docx file first.');
        }

        clearError();
        progress.start('Preparing document for PDF compilation...');

        const pageSize = pageSizeSelect?.value || 'a4';
        const orientation = pageOrientationSelect?.value || 'portrait';
        const marginChoice = pageMarginsSelect?.value || 'normal';

        let marginMm = 20;
        if (marginChoice === 'compact') marginMm = 10;
        if (marginChoice === 'wide') marginMm = 30;

        progress.update(40, 'Rendering document pages...');
        const { blob, pageCount } = await PDFCore.renderIsolatedHtmlToPdf({
            iframeEl: isolatedIframe,
            sanitizedHtml: convertedHtml,
            baseCss: DOCX_PREVIEW_AND_RENDER_CSS,
            pageSize,
            orientation,
            marginMm,
            scale: 2.0,
            renderWidthPx: 800,
        });

        progress.update(85, 'Finalizing PDF output...');
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
                progress.reset();
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

            const rawName = (outputFilenameInput?.value || '').trim() || 'document.pdf';
            const cleanName = PDFCore.sanitizeFilename(rawName, 'pdf');
            PDFCore.downloadBlob(lastGeneratedBlob, cleanName, 'application/pdf');
        });
    }

})();
