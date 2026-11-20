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

        /**
         * Clean an uploaded filename, remove unsafe path/filesystem characters,
         * and guarantee the expected file extension.
         * @param {string} name
         * @param {string} fallbackExt
         * @returns {string}
         */
        sanitizeFilename(name, fallbackExt = 'pdf') {
            if (!name || typeof name !== 'string') {
                return `document.${fallbackExt}`;
            }

            // Strip path traversal attempts and directory separators
            let cleaned = name.replace(/^.*[\\\/]/, '');

            // Separate base name and extension
            const targetExt = fallbackExt.toLowerCase().replace(/^\./, '');
            let baseName = cleaned;
            const dotIndex = cleaned.lastIndexOf('.');
            if (dotIndex > 0) {
                baseName = cleaned.substring(0, dotIndex);
            }

            // Remove non-alphanumeric characters except dashes
            baseName = baseName.replace(/[^a-zA-Z0-9.-]/g, '-');
            
            // Collapse consecutive dashes
            baseName = baseName.replace(/[-]+/g, '-');
            
            // Strip leading/trailing dashes and dots
            baseName = baseName.replace(/^[-.]+|[-.]+$/g, '');

            if (!baseName) {
                baseName = 'document';
            }

            return `${baseName.toLowerCase()}.${targetExt}`;
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

            const normalizedExts = acceptExtensions.map(ext => ext.toLowerCase().replace(/^\./, ''));

            for (const file of files) {
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                const mimeMatch = acceptMimeTypes.length === 0 || acceptMimeTypes.includes(file.type);
                const extMatch = normalizedExts.length === 0 || normalizedExts.includes(ext);

                if (!extMatch && !mimeMatch) {
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
                onFilesAdded = () => {},
                onError = () => {},
            } = config;

            if (!dropzoneEl || !inputEl) return;

            inputEl.accept = accept;
            inputEl.multiple = multiple;

            // Make dropzone keyboard accessible
            if (!dropzoneEl.getAttribute('tabindex')) {
                dropzoneEl.setAttribute('tabindex', '0');
                dropzoneEl.setAttribute('role', 'button');
                dropzoneEl.setAttribute('aria-label', 'Upload PDF files');
            }

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

            // Prevent default drag behaviors on window
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

                const { valid, errors } = PDFCore.validateFiles(dt.files, {
                    acceptExtensions: accept.split(',').map(s => s.trim().replace(/^\./, '')),
                    multiple,
                });

                if (errors.length > 0) {
                    onError(errors);
                }
                if (valid.length > 0) {
                    onFilesAdded(multiple ? valid : [valid[0]]);
                }
            });

            inputEl.addEventListener('change', () => {
                if (!inputEl.files || inputEl.files.length === 0) return;

                const { valid, errors } = PDFCore.validateFiles(inputEl.files, {
                    acceptExtensions: accept.split(',').map(s => s.trim().replace(/^\./, '')),
                    multiple,
                });

                if (errors.length > 0) {
                    onError(errors);
                }
                if (valid.length > 0) {
                    onFilesAdded(multiple ? valid : [valid[0]]);
                }
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
                <div class="pdf-progress-widget w-full my-4 hidden">
                    <div class="flex items-center justify-between text-xs text-slate-600 mb-1">
                        <span class="progress-label font-medium">Processing...</span>
                        <span class="progress-percent font-semibold text-blue-600">0%</span>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div class="progress-fill-bar bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
                    </div>
                </div>
            `;

            const widget = containerEl.querySelector('.pdf-progress-widget');
            const labelEl = containerEl.querySelector('.progress-label');
            const percentEl = containerEl.querySelector('.progress-percent');
            const barEl = containerEl.querySelector('.progress-fill-bar');

            return {
                start(label = 'Processing...') {
                    if (widget) widget.classList.remove('hidden');
                    if (labelEl) labelEl.textContent = label;
                    if (percentEl) percentEl.textContent = '0%';
                    if (barEl) barEl.style.width = '0%';
                },

                update(percent, label) {
                    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
                    if (widget) widget.classList.remove('hidden');
                    if (percentEl) percentEl.textContent = `${clamped}%`;
                    if (barEl) barEl.style.width = `${clamped}%`;
                    if (label && labelEl) labelEl.textContent = label;
                },

                complete(label = 'Done!') {
                    if (percentEl) percentEl.textContent = '100%';
                    if (barEl) barEl.style.width = '100%';
                    if (label && labelEl) labelEl.textContent = label;
                },

                reset() {
                    if (widget) widget.classList.add('hidden');
                    if (percentEl) percentEl.textContent = '0%';
                    if (barEl) barEl.style.width = '0%';
                }
            };
        },

        /**
         * Trigger a browser file download from a Blob or Uint8Array,
         * automatically revoking the Object URL to avoid memory retention.
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

            const cleanName = PDFCore.sanitizeFilename(filename);
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
        }
    };

    // Attach to window
    window.PDFCore = PDFCore;

})(window);
