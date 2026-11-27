/**
 * NoPayPDF - Shared Client-Side JavaScript Core (window.PDFCore)
 *
 * Provides reusable utilities for dropzones, file queue state management,
 * validation, progress indicators, safe blob downloads, and error handling.
 * 100% Client-Side. Permissive ISC/MIT compatible implementation.
 */

(function (window) {
    'use strict';

    const PDFCore = {
        /**
         * Convert raw byte count into a human-readable file size string.
         * @param {number} bytes
         * @param {number} decimals
         * @returns {string}
         */
        formatBytes(bytes, decimals = 1) {
            if (bytes === 0 || isNaN(bytes)) return '0 B';
            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            const formatted = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
            return `${formatted} ${sizes[i]}`;
        },

        SAFE_EXPORT_EXTS: new Set(['pdf', 'zip', 'jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'txt', 'csv']),

        MIME_TO_EXT: {
            'application/pdf': 'pdf',
            'application/zip': 'zip',
            'application/x-zip-compressed': 'zip',
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/tiff': 'tiff',
            'text/plain': 'txt',
            'text/csv': 'csv',
        },

        /**
         * Escape untrusted strings (such as user filenames) before inserting into HTML.
         * @param {string} str
         * @returns {string}
         */
        escapeHtml(str) {
            return String(str ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        /**
         * Clean an uploaded filename, remove unsafe path/filesystem characters,
         * and guarantee the expected file extension.
         * @param {string} name
         * @param {string} fallbackExt
         * @returns {string}
         */
        sanitizeFilename(name, fallbackExt = 'pdf', options = {}) {
            const targetExt = String(fallbackExt || 'pdf').toLowerCase().replace(/^\./, '') || 'pdf';
            const preserveCase = Boolean(options && options.preserveCase);
            const trimmed = typeof name === 'string' ? name.trim() : '';
            if (!trimmed) {
                return `document.${targetExt}`;
            }

            // Strip path traversal attempts and directory separators
            let cleaned = trimmed.replace(/^.*[\\\/]/, '');

            // Separate base name and known/terminal extension
            let baseName = cleaned;
            const dotIndex = cleaned.lastIndexOf('.');
            if (dotIndex > 0) {
                baseName = cleaned.substring(0, dotIndex);
            }

            // Remove non-alphanumeric characters except dashes/dots
            baseName = baseName.replace(/[^a-zA-Z0-9.-]/g, '-');

            // Collapse consecutive dashes
            baseName = baseName.replace(/[-]+/g, '-');

            // Strip leading/trailing dashes and dots
            baseName = baseName.replace(/^[-.]+|[-.]+$/g, '');

            if (!baseName) {
                baseName = 'document';
            }

            return `${preserveCase ? baseName : baseName.toLowerCase()}.${targetExt}`;
        },

        /**
         * Validate an array or FileList against size, quantity, and mime/extension criteria.
         * @param {FileList|File[]} fileList
         * @param {Object} options
         * @returns {{ valid: File[], errors: string[] }}
         */
        validateFiles(fileList, options = {}) {
            const files = Array.from(fileList || []);
            const {
                acceptExtensions = ['pdf'],
                acceptMimeTypes = ['application/pdf'],
                maxFiles = 50,
                maxSizeBytes = 150 * 1024 * 1024, // 150MB per file default client threshold
            } = options;

            const valid = [];
            const errors = [];

            if (files.length === 0) {
                errors.push('Please select at least one file.');
                return { valid, errors };
            }

            if (files.length > maxFiles) {
                errors.push(`Maximum allowed file limit is ${maxFiles}. You selected ${files.length}.`);
                return { valid, errors };
            }

            const normalizedExts = acceptExtensions.map(ext => ext.toLowerCase().replace(/^\./, '')).filter(Boolean);
            const normalizedMimes = acceptMimeTypes.map(m => m.toLowerCase()).filter(Boolean);

            for (const file of files) {
                const rawName = file.name || '';
                const ext = rawName.includes('.') ? rawName.split('.').pop().toLowerCase() : '';
                const fType = (file.type || '').toLowerCase();
                const mimeMatch = normalizedMimes.length === 0 || normalizedMimes.some(m => (
                    m.endsWith('/*') ? fType.startsWith(m.slice(0, -1)) : fType === m
                ));
                const extMatch = normalizedExts.length === 0 || normalizedExts.includes(ext);

                // Reject explicitly mismatched extensions even if browser omits MIME, and only allow MIME-only pass when extension is empty
                if (!extMatch && !(ext === '' && normalizedMimes.length > 0 && mimeMatch)) {
                    errors.push(`"${file.name}" has an unsupported format. Expected: .${normalizedExts.join(', .')}`);
                    continue;
                }

                if (file.size > maxSizeBytes) {
                    errors.push(`"${file.name}" exceeds the maximum in-browser size limit (${this.formatBytes(maxSizeBytes)}).`);
                    continue;
                }

                valid.push(file);
            }

            return { valid, errors };
        },

        /**
         * Bind drag-and-drop, click, and keyboard triggers to a container.
         * @param {Object} config
         */
        initDropzone(config) {
            const {
                dropzoneEl,
                inputEl,
                accept = '.pdf,application/pdf',
                multiple = true,
                maxFiles = null,
                maxSizeBytes = 150 * 1024 * 1024,
                acceptExtensions = null,
                acceptMimeTypes = null,
                ariaLabel = null,
                onFilesAdded = () => {},
                onError = () => {},
            } = config;

            if (!dropzoneEl || !inputEl) return;

            inputEl.accept = accept;
            inputEl.multiple = multiple;

            const parsedTokens = accept.split(',').map(s => s.trim()).filter(Boolean);
            const derivedExts = acceptExtensions || parsedTokens
                .filter(s => !s.includes('/'))
                .map(s => s.replace(/^\./, '').toLowerCase());
            const derivedMimes = acceptMimeTypes || parsedTokens
                .filter(s => s.includes('/'))
                .map(s => s.toLowerCase());
            const effectiveMaxFiles = maxFiles !== null ? maxFiles : (multiple ? 50 : 1);

            const inferredAriaLabel = ariaLabel || (
                derivedExts.some(e => ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(e))
                    ? 'Upload image files'
                    : (derivedExts.includes('docx') ? 'Upload Word document' : 'Upload PDF files')
            );

            // Make dropzone keyboard accessible
            if (!dropzoneEl.getAttribute('tabindex')) {
                dropzoneEl.setAttribute('tabindex', '0');
                dropzoneEl.setAttribute('role', 'button');
            }
            if (!dropzoneEl.getAttribute('aria-label')) {
                dropzoneEl.setAttribute('aria-label', inferredAriaLabel);
            }

            if (!window.__nopaypdfWindowDragGuard) {
                window.__nopaypdfWindowDragGuard = true;
                window.addEventListener('dragover', (e) => { e.preventDefault(); });
                window.addEventListener('drop', (e) => { e.preventDefault(); });
            }

            const handleIncomingFiles = (fileList) => {
                const { valid, errors } = PDFCore.validateFiles(fileList, {
                    acceptExtensions: derivedExts,
                    acceptMimeTypes: derivedMimes,
                    maxFiles: effectiveMaxFiles,
                    maxSizeBytes,
                });

                if (errors.length > 0) {
                    onError(errors);
                }
                if (valid.length > 0) {
                    onFilesAdded(multiple ? valid : [valid[0]]);
                }
            };

            const triggerInput = () => {
                inputEl.value = '';
                inputEl.click();
            };

            dropzoneEl.addEventListener('click', triggerInput);

            dropzoneEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    triggerInput();
                }
            });

            // Prevent default drag behaviors on dropzone container
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropzoneEl.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            let dragCounter = 0;

            dropzoneEl.addEventListener('dragenter', () => {
                dragCounter++;
                dropzoneEl.classList.add('dropzone-active');
            });

            dropzoneEl.addEventListener('dragleave', () => {
                dragCounter--;
                if (dragCounter <= 0) {
                    dragCounter = 0;
                    dropzoneEl.classList.remove('dropzone-active');
                }
            });

            dropzoneEl.addEventListener('drop', (e) => {
                dragCounter = 0;
                dropzoneEl.classList.remove('dropzone-active');

                const dt = e.dataTransfer;
                if (!dt || !dt.files || dt.files.length === 0) return;
                handleIncomingFiles(dt.files);
            });

            inputEl.addEventListener('change', () => {
                if (!inputEl.files || inputEl.files.length === 0) return;
                handleIncomingFiles(inputEl.files);
            });
        },

        /**
         * Create an ordered, reactive file queue store with subscription callbacks.
         * @param {File[]} initialFiles
         */
        createFileQueue(initialFiles = []) {
            let files = [...initialFiles];
            const listeners = [];

            const notify = () => {
                listeners.forEach(cb => {
                    try {
                        cb([...files]);
                    } catch (e) {
                        console.error('Queue listener error:', e);
                    }
                });
            };

            return {
                add(newFiles) {
                    const toAdd = Array.isArray(newFiles) ? newFiles : [newFiles];
                    files = [...files, ...toAdd];
                    notify();
                    return [...files];
                },

                remove(index) {
                    if (index >= 0 && index < files.length) {
                        files.splice(index, 1);
                        notify();
                    }
                    return [...files];
                },

                move(index, delta) {
                    const newIndex = index + delta;
                    if (index < 0 || index >= files.length || newIndex < 0 || newIndex >= files.length) {
                        return [...files];
                    }
                    const item = files.splice(index, 1)[0];
                    files.splice(newIndex, 0, item);
                    notify();
                    return [...files];
                },

                clear() {
                    files = [];
                    notify();
                    return [...files];
                },

                getAll() {
                    return [...files];
                },

                count() {
                    return files.length;
                },

                onChange(cb) {
                    if (typeof cb === 'function') {
                        listeners.push(cb);
                        // Trigger immediate initial update
                        cb([...files]);
                    }
                    return () => {
                        const idx = listeners.indexOf(cb);
                        if (idx > -1) listeners.splice(idx, 1);
                    };
                }
            };
        },

        /**
         * Create and bind a progress bar controller to a container element.
         * @param {HTMLElement} containerEl
         */
        createProgress(containerEl) {
            if (!containerEl) {
                return {
                    start: () => {},
                    update: () => {},
                    complete: () => {},
                    reset: () => {},
                };
            }

            containerEl.innerHTML = `
                <div class="pdf-progress-widget w-full my-4 hidden" role="status" aria-live="polite">
                    <div class="flex items-center justify-between text-xs text-slate-600 mb-1">
                        <span class="progress-label font-medium">Processing...</span>
                        <span class="progress-percent font-semibold text-blue-600">0%</span>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                        <div class="progress-fill-bar bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
                    </div>
                </div>
            `;

            const widget = containerEl.querySelector('.pdf-progress-widget');
            const labelEl = containerEl.querySelector('.progress-label');
            const percentEl = containerEl.querySelector('.progress-percent');
            const barWrapEl = containerEl.querySelector('[role="progressbar"]');
            const barEl = containerEl.querySelector('.progress-fill-bar');

            return {
                start(label = 'Processing...') {
                    if (widget) widget.classList.remove('hidden');
                    if (labelEl) labelEl.textContent = label;
                    if (percentEl) percentEl.textContent = '0%';
                    if (barWrapEl) barWrapEl.setAttribute('aria-valuenow', '0');
                    if (barEl) barEl.style.width = '0%';
                },

                update(percent, label) {
                    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
                    if (widget) widget.classList.remove('hidden');
                    if (percentEl) percentEl.textContent = `${clamped}%`;
                    if (barWrapEl) barWrapEl.setAttribute('aria-valuenow', String(clamped));
                    if (barEl) barEl.style.width = `${clamped}%`;
                    if (label && labelEl) labelEl.textContent = label;
                },

                complete(label = 'Done!') {
                    if (percentEl) percentEl.textContent = '100%';
                    if (barWrapEl) barWrapEl.setAttribute('aria-valuenow', '100');
                    if (barEl) barEl.style.width = '100%';
                    if (label && labelEl) labelEl.textContent = label;
                },

                reset() {
                    if (widget) widget.classList.add('hidden');
                    if (percentEl) percentEl.textContent = '0%';
                    if (barWrapEl) barWrapEl.setAttribute('aria-valuenow', '0');
                    if (barEl) barEl.style.width = '0%';
                }
            };
        },

        /**
         * Trigger a browser file download from a Blob or Uint8Array,
         * automatically revoking the Object URL to avoid memory retention.
         * Preserves real non-PDF extensions (.zip, .jpg, .png, .txt, etc.).
         * @param {Blob|Uint8Array} blobOrUint8Array
         * @param {string} filename
         * @param {string} mimeType
         */
        downloadBlob(blobOrUint8Array, filename = 'document.pdf', mimeType = 'application/pdf') {
            let blob;
            if (blobOrUint8Array instanceof Blob) {
                blob = blobOrUint8Array;
            } else if (blobOrUint8Array instanceof Uint8Array || ArrayBuffer.isView(blobOrUint8Array)) {
                blob = new Blob([blobOrUint8Array], { type: mimeType });
            } else {
                console.error('Invalid download payload: must be Blob or Uint8Array');
                return;
            }

            const rawName = String(filename || '').trim();
            const dotIdx = rawName.lastIndexOf('.');
            const explicitExt = dotIdx > 0 ? rawName.substring(dotIdx + 1).toLowerCase() : '';
            const normalizedMime = String(mimeType || blob.type || '').split(';')[0].trim().toLowerCase();
            const fallbackExt = this.SAFE_EXPORT_EXTS.has(explicitExt)
                ? explicitExt
                : (this.MIME_TO_EXT[normalizedMime] || 'pdf');

            const cleanName = PDFCore.sanitizeFilename(rawName || `document.${fallbackExt}`, fallbackExt, { preserveCase: true });
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = objectUrl;
            a.download = cleanName;
            document.body.appendChild(a);

            a.click();

            // Cleanup safely after a delay to ensure the browser has initiated download
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(objectUrl);
            }, 1500);
        },

        /**
         * Read a File or Blob as an ArrayBuffer safely across all browser environments.
         * @param {File|Blob} file
         * @returns {Promise<ArrayBuffer>}
         */
        async readFileAsArrayBuffer(file) {
            if (!file) throw new Error('No file provided to readFileAsArrayBuffer');
            if (typeof file.arrayBuffer === 'function') {
                return await file.arrayBuffer();
            }
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsArrayBuffer(file);
            });
        },

        /**
         * Translate low-level PDF parsing / library errors into clear, friendly guidance.
         * @param {Error|string} error
         * @returns {string}
         */
        formatPdfError(error) {
            const message = (typeof error === 'string' ? error : error?.message || '').toLowerCase();

            if (message.includes('password') || message.includes('encrypted') || message.includes('decrypt')) {
                return 'This PDF is password-protected. Please unlock it with the password before processing.';
            }

            if (message.includes('invalid pdf') || message.includes('header') || message.includes('bad xref')) {
                return 'The selected file is not a valid PDF or has a corrupted document structure.';
            }

            if (message.includes('out of memory') || message.includes('quota') || message.includes('heap')) {
                return 'Browser memory limit reached. Try processing fewer pages or a smaller file.';
            }

            if (message.includes('network') || message.includes('fetch')) {
                return 'A required resource could not be loaded. Please check your internet connection.';
            }

            return error?.message || 'An unexpected error occurred while processing the PDF.';
        },

        /**
         * Replace modern CSS color functions unsupported by html2canvas 1.4.x
         * cleanly so document cloning never throws an uncaught promise error.
         */
        _stripUnsupportedColorFns(cssText) {
            if (!cssText || typeof cssText !== 'string') return cssText || '';
            return cssText.replace(/(?:oklch|oklab|lch|lab|color-mix)\([^)]*(?:\([^)]*\)[^)]*)*\)/gi, '#334155');
        },

        /**
         * Render sanitized HTML inside a sandboxed preview <iframe> (scripts disabled)
         * so user/document <style> tags never leak onto the host page.
         */
        renderIsolatedPreview(containerEl, sanitizedHtml, baseCss = '', title = 'Document Preview') {
            if (!containerEl) return;
            let frame = containerEl.querySelector('iframe.nopay-isolated-preview');
            if (!frame) {
                containerEl.innerHTML = '';
                frame = document.createElement('iframe');
                frame.className = 'nopay-isolated-preview w-full border-0 bg-white rounded-lg';
                frame.setAttribute('sandbox', '');
                frame.setAttribute('title', title);
                frame.style.minHeight = '280px';
                frame.style.height = '100%';
                containerEl.appendChild(frame);
            }
            const cleanBody = this._stripUnsupportedColorFns(sanitizedHtml || '');
            const cleanCss = this._stripUnsupportedColorFns(baseCss || '');
            frame.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*,*::before,*::after{box-sizing:border-box;}html,body{margin:0;padding:16px;background:#ffffff;color:#111827;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;font-size:13px;line-height:1.5;overflow-wrap:break-word;}${cleanCss}</style></head><body>${cleanBody}</body></html>`;
        },

        /**
         * Render sanitized HTML via an isolated iframe + html2canvas into paginated jsPDF pages.
         * Immune to parent Tailwind v4 oklch stylesheets and rejects cleanly on any error.
         */
        async renderIsolatedHtmlToPdf(options = {}) {
            const {
                iframeEl,
                sanitizedHtml,
                baseCss = '',
                pageSize = 'a4',
                orientation = 'portrait',
                marginMm = 15,
                scale = 2.0,
                renderWidthPx = 800,
            } = options;

            if (!iframeEl) throw new Error('Render sandbox iframe not found.');
            if (typeof window.html2canvas !== 'function') {
                throw new Error('HTML renderer library (html2canvas) failed to load.');
            }
            if (!window.jspdf || !window.jspdf.jsPDF) {
                throw new Error('PDF generator library (jsPDF) failed to load.');
            }

            const iframeDoc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
            if (!iframeDoc) throw new Error('Could not access isolated render document.');

            const safeBody = this._stripUnsupportedColorFns(sanitizedHtml || '');
            const safeCss = this._stripUnsupportedColorFns(baseCss || '');

            iframeDoc.open();
            iframeDoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*,*::before,*::after{box-sizing:border-box;}html,body{margin:0;padding:0;background-color:#ffffff;color:#111827;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;font-size:13px;line-height:1.55;width:${renderWidthPx}px;}${safeCss}</style></head><body>${safeBody}</body></html>`);
            iframeDoc.close();

            await new Promise(r => setTimeout(r, 70));

            const imgs = Array.from(iframeDoc.images || []);
            if (imgs.length > 0) {
                await Promise.race([
                    Promise.all(imgs.map(img => (
                        img.complete ? Promise.resolve() : new Promise(res => {
                            img.onload = res;
                            img.onerror = res;
                        })
                    ))),
                    new Promise(res => setTimeout(res, 2000)),
                ]);
            }

            let canvas = null;
            try {
                canvas = await window.html2canvas(iframeDoc.body, {
                    scale,
                    backgroundColor: '#ffffff',
                    useCORS: true,
                    logging: false,
                    width: renderWidthPx,
                    windowWidth: renderWidthPx,
                    onclone: (clonedDoc) => {
                        clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                            const href = (link.getAttribute('href') || '').toLowerCase();
                            if (href.includes('tailwind') || link.ownerDocument !== iframeDoc) {
                                link.remove();
                            }
                        });
                        clonedDoc.querySelectorAll('style').forEach(styleEl => {
                            if (styleEl.textContent && /(?:oklch|oklab|lch|lab|color-mix)\(/i.test(styleEl.textContent)) {
                                styleEl.textContent = PDFCore._stripUnsupportedColorFns(styleEl.textContent);
                            }
                        });
                    },
                });

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation, unit: 'mm', format: pageSize });
                const pageW = doc.internal.pageSize.getWidth();
                const pageH = doc.internal.pageSize.getHeight();
                const usableW = Math.max(10, pageW - marginMm * 2);
                const usableH = Math.max(10, pageH - marginMm * 2);

                const mmPerPx = usableW / Math.max(1, canvas.width);
                const sliceHeightPx = Math.max(1, Math.floor(usableH / mmPerPx));
                let yOffset = 0;
                let pageIndex = 0;

                const sliceCanvas = document.createElement('canvas');
                try {
                    sliceCanvas.width = canvas.width;
                    const sliceCtx = sliceCanvas.getContext('2d', { alpha: false });
                    while (yOffset < canvas.height) {
                        const sliceH = Math.min(sliceHeightPx, canvas.height - yOffset);
                        sliceCanvas.height = sliceH;
                        sliceCtx.fillStyle = '#ffffff';
                        sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceH);
                        sliceCtx.drawImage(canvas, 0, yOffset, canvas.width, sliceH, 0, 0, sliceCanvas.width, sliceH);

                        const imgData = sliceCanvas.toDataURL('image/jpeg', 0.94);
                        if (pageIndex > 0) doc.addPage();
                        doc.addImage(imgData, 'JPEG', marginMm, marginMm, usableW, sliceH * mmPerPx, undefined, 'FAST');

                        yOffset += sliceH;
                        pageIndex++;
                    }
                } finally {
                    sliceCanvas.width = 0;
                    sliceCanvas.height = 0;
                }

                const pageCount = doc.getNumberOfPages();
                const blob = doc.output('blob');
                return { blob, pageCount };
            } finally {
                if (canvas) {
                    canvas.width = 0;
                    canvas.height = 0;
                }
                if (iframeDoc && iframeDoc.body) {
                    iframeDoc.body.innerHTML = '';
                }
            }
        }
    };

    // Attach to window
    window.PDFCore = PDFCore;

})(window);
