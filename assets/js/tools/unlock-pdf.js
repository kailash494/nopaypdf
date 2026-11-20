/**
 * PDFToolKit - Unlock PDF Controller
 * Automatic Security Detection & Client-Side Decryption via QPDF WebAssembly
 */

(function () {
    'use strict';

    // DOM Elements
    const dropzone = document.getElementById('unlock-dropzone');
    const fileInput = document.getElementById('unlock-file-input');
    const workspace = document.getElementById('unlock-workspace');
    const fileNameLabel = document.getElementById('file-name-label');
    const fileMetaLabel = document.getElementById('file-meta-label');
    const changeFileBtn = document.getElementById('change-file-btn');

    const statusNotEncrypted = document.getElementById('status-not-encrypted');
    const statusOwnerRestricted = document.getElementById('status-owner-restricted');
    const statusPasswordRequired = document.getElementById('status-password-required');
    const unlockPasswordInput = document.getElementById('unlock-password-input');
    const togglePwBtn = document.getElementById('btn-toggle-unlock-pw');
    const inputError = document.getElementById('unlock-input-error');

    const submitBtn = document.getElementById('unlock-submit-btn');
    const progressContainer = document.getElementById('unlock-progress-container');
    const resultView = document.getElementById('result-view');
    const resultSummary = document.getElementById('result-summary');
    const downloadBtn = document.getElementById('download-unlocked-btn');
    const resetBtn = document.getElementById('unlock-reset-btn');
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    const errorDismissBtn = document.getElementById('error-dismiss-btn');

    // State
    const progress = PDFCore.createProgress(progressContainer);
    let currentFile = null;
    let currentBuffer = null;
    let currentSecurityStatus = null; // { encrypted, unlocked, exitCode }
    let decryptedBlob = null;

    function showError(msg) {
        if (!errorAlert || !errorMessage) return;
        errorMessage.textContent = msg;
        errorAlert.classList.remove('hidden');
    }

    function clearError() {
        if (errorAlert) errorAlert.classList.add('hidden');
    }

    function showInputError(msg) {
        if (!inputError) return;
        inputError.textContent = msg;
        inputError.classList.remove('hidden');
        if (unlockPasswordInput) {
            unlockPasswordInput.classList.add('border-rose-400', 'focus:ring-rose-500');
        }
    }

    function clearInputError() {
        if (!inputError) return;
        inputError.classList.add('hidden');
        if (unlockPasswordInput) {
            unlockPasswordInput.classList.remove('border-rose-400', 'focus:ring-rose-500');
        }
    }

    if (errorDismissBtn) errorDismissBtn.addEventListener('click', clearError);
    if (unlockPasswordInput) unlockPasswordInput.addEventListener('input', clearInputError);

    // Toggle Password Visibility
    if (togglePwBtn && unlockPasswordInput) {
        togglePwBtn.addEventListener('click', () => {
            const isPassword = unlockPasswordInput.type === 'password';
            unlockPasswordInput.type = isPassword ? 'text' : 'password';
            const icon = togglePwBtn.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
                if (window.lucide) window.lucide.createIcons();
            }
        });
    }

    // Enter Key Trigger
    if (unlockPasswordInput) {
        unlockPasswordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitBtn?.click();
            }
        });
    }

    // Ingest Selected File
    async function loadPdfFile(file) {
        clearError();
        clearInputError();
        if (resultView) resultView.classList.add('hidden');
        if (statusNotEncrypted) statusNotEncrypted.classList.add('hidden');
        if (statusOwnerRestricted) statusOwnerRestricted.classList.add('hidden');
        if (statusPasswordRequired) statusPasswordRequired.classList.add('hidden');

        try {
            submitBtn.disabled = true;
            progress.start('Inspecting document security...');

            currentFile = file;
            currentBuffer = await PDFCore.readFileAsArrayBuffer(file);

            // Pre-initialize QPDF and check security status
            await QPDFClient.init();
            const status = await QPDFClient.checkPasswordStatus(currentBuffer);
            currentSecurityStatus = status;

            fileNameLabel.textContent = file.name;
            fileMetaLabel.textContent = `${PDFCore.formatBytes(file.size)}`;

            if (status.exitCode === 2) {
                // Not encrypted at all
                statusNotEncrypted?.classList.remove('hidden');
                submitBtn.classList.add('hidden');
            } else if (status.exitCode === 3) {
                // Owner restrictions only (no open password needed)
                statusOwnerRestricted?.classList.remove('hidden');
                submitBtn.classList.remove('hidden');
                submitBtn.querySelector('span').textContent = 'Remove Restrictions Now';
            } else {
                // Open password required
                statusPasswordRequired?.classList.remove('hidden');
                submitBtn.classList.remove('hidden');
                submitBtn.querySelector('span').textContent = 'Unlock PDF Document';
                setTimeout(() => unlockPasswordInput?.focus(), 150);
            }

            dropzone.classList.add('hidden');
            workspace.classList.remove('hidden');
            progress.reset();
            submitBtn.disabled = false;
        } catch (err) {
            console.error('File load error:', err);
            showError('Unable to inspect this PDF document. Please verify the file is not corrupted.');
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

    // Submit Decryption
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (!currentBuffer || !currentFile) {
                showError('Please upload a PDF file first.');
                return;
            }

            clearError();
            clearInputError();

            const password = unlockPasswordInput?.value || '';

            // If open password is required but user left it blank
            if (currentSecurityStatus && currentSecurityStatus.exitCode === 0 && !password) {
                showInputError('Please enter the password to unlock this document.');
                unlockPasswordInput?.focus();
                return;
            }

            try {
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

                progress.start('Decrypting document and stripping restrictions...');

                const result = await QPDFClient.decryptPdf(currentBuffer, password);

                progress.update(90, 'Finalizing unlocked document...');
                decryptedBlob = new Blob([result.outputBytes], { type: 'application/pdf' });
                progress.complete('Document unlocked successfully!');

                if (resultSummary) {
                    resultSummary.textContent = `Removed security locks from "${currentFile.name}" (${PDFCore.formatBytes(decryptedBlob.size)}).`;
                }

                if (resultView) {
                    resultView.classList.remove('hidden');
                    resultView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } catch (err) {
                const msg = err.message || '';
                if (msg.includes('Incorrect password') || msg.includes('password') || msg.includes('Decryption failed')) {
                    console.warn('Unlock password rejected:', msg);
                    showInputError('Incorrect password. Please verify the password and try again.');
                    unlockPasswordInput?.select();
                } else {
                    console.error('Unlock error:', err);
                    showError(msg || 'An error occurred while unlocking this document.');
                }
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
            if (!decryptedBlob || !currentFile) return;
            const originalName = currentFile.name.replace(/\.[^/.]+$/, '');
            const downloadName = `${originalName}-unlocked.pdf`;
            PDFCore.downloadBlob(decryptedBlob, downloadName);
        });
    }

    // Reset Handler
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            currentFile = null;
            currentBuffer = null;
            decryptedBlob = null;
            currentSecurityStatus = null;
            if (unlockPasswordInput) unlockPasswordInput.value = '';
            if (fileInput) fileInput.value = '';

            clearError();
            clearInputError();
            progress.reset();

            if (resultView) resultView.classList.add('hidden');
            if (statusNotEncrypted) statusNotEncrypted.classList.add('hidden');
            if (statusOwnerRestricted) statusOwnerRestricted.classList.add('hidden');
            if (statusPasswordRequired) statusPasswordRequired.classList.add('hidden');
            if (workspace) workspace.classList.add('hidden');
            if (dropzone) dropzone.classList.remove('hidden');
        });
    }
})();
