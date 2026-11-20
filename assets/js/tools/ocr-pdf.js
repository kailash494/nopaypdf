/**
 * NoPayPDF - OCR PDF Controller
 * Client-side optical character recognition via Tesseract.js (v5.1.1) WebAssembly engine.
 * Generates searchable PDFs with invisible text layers and downloadable plain text (.txt).
 * Permissive MIT/Apache 2.0 implementation.
 */

(function (window, document) {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        // --- DOM Elements ---
        const uploadPanel = document.getElementById('upload-panel');
        const pdfDropzone = document.getElementById('pdf-dropzone');
        const pdfFileInput = document.getElementById('pdf-file-input');
        const errorAlert = document.getElementById('error-alert');
        const errorMessage = document.getElementById('error-message');
        const errorDismissBtn = document.getElementById('error-dismiss-btn');

        const ocrConfigPanel = document.getElementById('ocr-config-panel');
        const docFilename = document.getElementById('doc-filename');
        const docMeta = document.getElementById('doc-meta');
        const ocrChangeFileBtn = document.getElementById('ocr-change-file-btn');
        const longDocTip = document.getElementById('long-doc-tip');
        const longDocPageCount = document.getElementById('long-doc-page-count');

        // Settings
        const ocrLanguageSelect = document.getElementById('ocr-language-select');
        const ocrDpiSelect = document.getElementById('ocr-dpi-select');
        const ocrScopeRadios = document.querySelectorAll('input[name="ocr-scope"]');
        const ocrCustomRangeInput = document.getElementById('ocr-custom-range-input');
        const startOcrBtn = document.getElementById('start-ocr-btn');

        // Progress
        const ocrProgressPanel = document.getElementById('ocr-progress-panel');
        const ocrProgressBar = document.getElementById('ocr-progress-bar');
        const ocrProgressTitle = document.getElementById('ocr-progress-title');
        const ocrProgressDesc = document.getElementById('ocr-progress-desc');
        const cancelOcrBtn = document.getElementById('cancel-ocr-btn');

        // Results
        const ocrResultPanel = document.getElementById('ocr-result-panel');
        const ocrResultSummary = document.getElementById('ocr-result-summary');
        const nonLatinNotice = document.getElementById('non-latin-notice');
        const extractedTextArea = document.getElementById('extracted-text-area');
        const copyTextBtn = document.getElementById('copy-text-btn');
        const copyBtnText = document.getElementById('copy-btn-text');
        const downloadSearchablePdfBtn = document.getElementById('download-searchable-pdf-btn');
        const downloadTextBtn = document.getElementById('download-text-btn');
        const ocrResetBtn = document.getElementById('ocr-reset-btn');

        // --- Application State ---
        let originalFile = null;
        let originalArrayBuffer = null;
        let pdfDocProxy = null;
        let totalPages = 1;

        let activeWorker = null;
        let isCancelled = false;

        let lastSearchablePdfBytes = null;
        let lastFullExtractedText = '';

        // Init PDF.js
        PDFRender.initPdfJsWorker();

        function showError(msg) {
            errorMessage.textContent = msg;
            errorAlert.classList.remove('hidden');
        }

        function clearError() {
            errorAlert.classList.add('hidden');
            errorMessage.textContent = '';
        }

        errorDismissBtn?.addEventListener('click', clearError);

        // --- Initialize Dropzone ---
        PDFCore.initDropzone({
            dropzoneEl: pdfDropzone,
            inputEl: pdfFileInput,
            accept: '.pdf,application/pdf',
            multiple: false,
            onFilesAdded: async (files) => {
                const validation = PDFCore.validateFiles(files, {
                    acceptExtensions: ['pdf'],
                    maxFiles: 1,
                    maxSizeBytes: 80 * 1024 * 1024,
                });

                if (validation.errors.length > 0) {
                    showError(validation.errors[0]);
                    return;
                }

                await loadPdfDocument(validation.valid[0]);
            },
            onError: (err) => showError(err),
        });

        // --- Load Document ---
        async function loadPdfDocument(file) {
            clearError();
            originalFile = file;

            try {
                originalArrayBuffer = await PDFCore.readFileAsArrayBuffer(file);
                const loaded = await PDFRender.loadPreviewDoc(originalArrayBuffer);
                pdfDocProxy = loaded.pdfProxy;
                totalPages = loaded.numPages;

                docFilename.textContent = file.name;
                docMeta.textContent = `${totalPages} page${totalPages === 1 ? '' : 's'} \u2022 ${PDFCore.formatBytes(file.size)}`;

                // Show speed advisory if document has many pages
                if (totalPages > 15) {
                    longDocPageCount.textContent = String(totalPages);
                    longDocTip.classList.remove('hidden');
                } else {
                    longDocTip.classList.add('hidden');
                }

                uploadPanel.classList.add('hidden');
                ocrResultPanel.classList.add('hidden');
                ocrConfigPanel.classList.remove('hidden');

                if (typeof lucide !== 'undefined') lucide.createIcons();
            } catch (err) {
                console.error('Error loading PDF:', err);
                showError(PDFCore.formatPdfError(err));
            }
        }

        // Scope Switcher
        ocrScopeRadios.forEach((radio) => {
            radio.addEventListener('change', () => {
                if (radio.value === 'custom') {
                    ocrCustomRangeInput.classList.remove('hidden');
                    ocrCustomRangeInput.focus();
                } else {
                    ocrCustomRangeInput.classList.add('hidden');
                }
            });
        });

        // Cancellation Handler
        cancelOcrBtn?.addEventListener('click', async () => {
            isCancelled = true;
            ocrProgressTitle.textContent = 'Cancelling OCR...';
            if (activeWorker) {
                try {
                    await activeWorker.terminate();
                } catch (e) {}
                activeWorker = null;
            }
            ocrProgressPanel.classList.add('hidden');
            startOcrBtn.disabled = false;
        });

        // Cleanup worker on window unload
        window.addEventListener('beforeunload', () => {
            if (activeWorker) {
                activeWorker.terminate().catch(() => {});
            }
        });

        // Helper to extract words with bounding boxes from Tesseract result
        function extractWordsFromResult(resultData) {
            if (Array.isArray(resultData.words) && resultData.words.length > 0) {
                return resultData.words;
            }

            // Fallback hierarchy flattening: blocks -> paragraphs -> lines -> words
            const flattened = [];
            if (Array.isArray(resultData.blocks)) {
                for (const block of resultData.blocks) {
                    for (const paragraph of block.paragraphs || []) {
                        for (const line of paragraph.lines || []) {
                            for (const word of line.words || []) {
                                flattened.push(word);
                            }
                        }
                    }
                }
            }
            return flattened;
        }

        // --- Start OCR Engine Pipeline ---
        startOcrBtn?.addEventListener('click', async () => {
            if (!originalArrayBuffer || !pdfDocProxy || typeof Tesseract === 'undefined' || !window.PDFLib) {
                showError('Required OCR libraries are still loading. Please check your internet connection and try again.');
                return;
            }
            clearError();

            const selectedLang = ocrLanguageSelect.value;
            const targetDpi = parseInt(ocrDpiSelect.value, 10) || 250;
            const scope = document.querySelector('input[name="ocr-scope"]:checked')?.value || 'all';

            let targetPages = [];
            if (scope === 'all') {
                for (let i = 1; i <= totalPages; i++) targetPages.push(i);
            } else {
                const parsed = PDFRender.parsePageRanges(ocrCustomRangeInput.value, totalPages);
                if (!parsed.valid) {
                    showError(parsed.error || 'Please enter a valid page range.');
                    return;
                }
                targetPages = parsed.flatPages;
            }

            if (targetPages.length === 0) {
                showError('Please select at least one page to recognize.');
                return;
            }

            isCancelled = false;
            startOcrBtn.disabled = true;
            ocrProgressPanel.classList.remove('hidden');
            ocrResultPanel.classList.add('hidden');
            ocrProgressBar.style.width = '5%';
            ocrProgressTitle.textContent = 'Initializing Tesseract OCR Engine...';
            ocrProgressDesc.textContent = `Loading ${selectedLang} neural language model...`;

            let worker = null;
            let fullTextAccumulator = [];
            let totalWordsFound = 0;

            try {
                // Initialize Tesseract.js Worker strictly using createWorker(lang, 1, options)
                worker = await Tesseract.createWorker(selectedLang, 1, {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            const pct = Math.round(m.progress * 100);
                            ocrProgressDesc.textContent = `Recognizing text characters (${pct}%)...`;
                        } else if (m.status === 'loading tesseract core') {
                            ocrProgressDesc.textContent = 'Loading WebAssembly recognition engine...';
                        } else if (m.status === 'loading language traineddata') {
                            ocrProgressDesc.textContent = `Downloading ${selectedLang} language data...`;
                        }
                    },
                });

                activeWorker = worker;

                if (isCancelled) return;

                await worker.setParameters({
                    user_defined_dpi: String(targetDpi),
                });

                // Load source document into pdf-lib for searchable overlay stamping
                const { PDFDocument, StandardFonts } = window.PDFLib;
                const pdfDoc = await PDFDocument.load(originalArrayBuffer.slice(0));
                const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

                const renderScale = targetDpi / 72.0;
                const isNonLatin = ['ara', 'hin', 'chi_sim'].includes(selectedLang);

                // Process pages sequentially
                for (let idx = 0; idx < targetPages.length; idx++) {
                    if (isCancelled) break;

                    const pageNum = targetPages[idx];
                    const overallPercent = Math.round(10 + (idx / targetPages.length) * 80);
                    ocrProgressBar.style.width = `${overallPercent}%`;
                    ocrProgressTitle.textContent = `Processing Page ${pageNum} of ${totalPages}...`;
                    ocrProgressDesc.textContent = 'Rendering high-resolution scan page...';

                    const pageProxy = await pdfDocProxy.getPage(pageNum);
                    const intrinsicRotation = pageProxy.rotate || 0;
                    const viewport = pageProxy.getViewport({ scale: renderScale, rotation: intrinsicRotation });

                    // Offscreen canvas for recognition
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.floor(viewport.width);
                    canvas.height = Math.floor(viewport.height);

                    const ctx = canvas.getContext('2d', { alpha: false });
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    await pageProxy.render({ canvasContext: ctx, viewport }).promise;

                    if (isCancelled) break;

                    // Run recognition on offscreen canvas
                    ocrProgressDesc.textContent = 'Analyzing text layout and neural inference...';
                    const ocrResult = await worker.recognize(canvas, {}, { text: true, blocks: true });

                    if (isCancelled) break;

                    const pageText = (ocrResult.data?.text || '').trim();
                    fullTextAccumulator.push(`--- Page ${pageNum} ---\n${pageText}\n`);

                    // Extract word-level coordinates
                    const words = extractWordsFromResult(ocrResult.data);
                    totalWordsFound += words.length;

                    // Embed invisible searchable text layer into pdf-lib page
                    const pdfPage = pdfDoc.getPage(pageNum - 1);
                    const pageWidthPt = pdfPage.getWidth();
                    const pageHeightPt = pdfPage.getHeight();

                    const scaleX = pageWidthPt / canvas.width;
                    const scaleY = pageHeightPt / canvas.height;

                    for (const word of words) {
                        if (!word.text || !word.bbox) continue;

                        // WinAnsi character sanitization (Standard Helvetica only encodes WinAnsi)
                        const sanitizedText = word.text.replace(/[^\x20-\x7E\xA0-\xFF]/g, '').trim();
                        if (!sanitizedText) continue;

                        const bbox = word.bbox;
                        const wordX = bbox.x0 * scaleX;
                        const wordW = (bbox.x1 - bbox.x0) * scaleX;
                        const wordH = (bbox.y1 - bbox.y0) * scaleY;
                        // Flip Y-axis: PDF coordinate origin is bottom-left
                        const wordY = pageHeightPt - (bbox.y1 * scaleY);

                        const fontSize = Math.max(4, Math.min(wordH * 0.9, 72));

                        try {
                            pdfPage.drawText(sanitizedText, {
                                x: wordX,
                                y: wordY,
                                size: fontSize,
                                font: helveticaFont,
                                opacity: 0, // Fully invisible text overlay
                            });
                        } catch (drawErr) {
                            // Skip glyphs that cannot be encoded by standard fonts
                        }
                    }

                    // Zero out canvas memory
                    canvas.width = 0;
                    canvas.height = 0;

                    // Yield execution tick to keep browser UI responsive
                    await new Promise((r) => setTimeout(r, 0));
                }

                if (isCancelled) return;

                ocrProgressBar.style.width = '95%';
                ocrProgressTitle.textContent = 'Compiling Searchable Document...';
                ocrProgressDesc.textContent = 'Saving searchable PDF with invisible text layers...';

                lastSearchablePdfBytes = await pdfDoc.save();
                lastFullExtractedText = fullTextAccumulator.join('\n');

                ocrProgressBar.style.width = '100%';
                ocrProgressPanel.classList.add('hidden');
                ocrResultPanel.classList.remove('hidden');

                // Update Results Summary & Textarea
                ocrResultSummary.textContent = `Extracted approximately ${totalWordsFound.toLocaleString()} words across ${targetPages.length} recognized pages.`;
                extractedTextArea.value = lastFullExtractedText;

                // Show non-Latin notice if relevant
                if (isNonLatin) {
                    nonLatinNotice.classList.remove('hidden');
                } else {
                    nonLatinNotice.classList.add('hidden');
                }

                if (typeof lucide !== 'undefined') lucide.createIcons();
            } catch (err) {
                console.error('OCR processing error:', err);
                ocrProgressPanel.classList.add('hidden');
                showError('OCR failed: ' + (err.message || 'Error executing optical character recognition.'));
            } finally {
                // Guaranteed worker termination to free WebAssembly heap memory
                if (worker) {
                    try {
                        await worker.terminate();
                    } catch (e) {}
                    activeWorker = null;
                }
                startOcrBtn.disabled = false;
            }
        });

        // Copy Text to Clipboard
        copyTextBtn?.addEventListener('click', async () => {
            if (!extractedTextArea.value) return;
            try {
                await navigator.clipboard.writeText(extractedTextArea.value);
                copyBtnText.textContent = 'Copied!';
                copyTextBtn.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-300');
                setTimeout(() => {
                    copyBtnText.textContent = 'Copy All Text';
                    copyTextBtn.classList.remove('bg-emerald-50', 'text-emerald-700', 'border-emerald-300');
                }, 2000);
            } catch (e) {
                extractedTextArea.select();
                document.execCommand('copy');
            }
        });

        // Download Searchable PDF
        downloadSearchablePdfBtn?.addEventListener('click', () => {
            if (!lastSearchablePdfBytes || !originalFile) return;
            const originalBase = originalFile.name.replace(/\.[^/.]+$/, '');
            const exportName = `${originalBase}-ocr.pdf`;
            PDFCore.downloadBlob(lastSearchablePdfBytes, exportName, 'application/pdf');
        });

        // Download Plain Text
        downloadTextBtn?.addEventListener('click', () => {
            if (!lastFullExtractedText || !originalFile) return;
            const originalBase = originalFile.name.replace(/\.[^/.]+$/, '');
            const exportName = `${originalBase}-ocr.txt`;
            const blob = new Blob([lastFullExtractedText], { type: 'text/plain;charset=utf-8' });
            PDFCore.downloadBlob(blob, exportName, 'text/plain');
        });

        // Reset
        ocrChangeFileBtn?.addEventListener('click', resetAll);
        ocrResetBtn?.addEventListener('click', resetAll);

        function resetAll() {
            originalFile = null;
            originalArrayBuffer = null;
            pdfDocProxy = null;
            lastSearchablePdfBytes = null;
            lastFullExtractedText = '';
            ocrConfigPanel.classList.add('hidden');
            ocrResultPanel.classList.add('hidden');
            ocrProgressPanel.classList.add('hidden');
            uploadPanel.classList.remove('hidden');
        }
    });
})(window, document);
