/**
 * PDFToolKit - Protect PDF Controller
 * AES-256 Bit Client-Side Encryption via QPDF WebAssembly
 */

(function () {
    'use strict';

    // DOM Elements
    const dropzone = document.getElementById('protect-dropzone');
    const fileInput = document.getElementById('protect-file-input');
    const workspace = document.getElementById('protect-workspace');
    const fileNameLabel = document.getElementById('file-name-label');
    const fileMetaLabel = document.getElementById('file-meta-label');
    const changeFileBtn = document.getElementById('change-file-btn');
    const alreadyEncryptedBanner = document.getElementById('already-encrypted-banner');

    const userPasswordInput = document.getElementById('user-password-input');
    const confirmPasswordInput = document.getElementById('confirm-password-input');
    const ownerPasswordInput = document.getElementById('owner-password-input');
    const strengthBar = document.getElementById('password-strength-bar');
    const strengthLabel = document.getElementById('password-strength-label');
    const matchLabel = document.getElementById('confirm-password-match-label');

    const permPrint = document.getElementById('perm-print');
    const permExtract = document.getElementById('perm-extract');
    const permModify = document.getElementById('perm-modify');

    const submitBtn = document.getElementById('protect-submit-btn');
    const progressContainer = document.getElementById('protect-progress-container');
    const resultView = document.getElementById('result-view');
    const resultSummary = document.getElementById('result-summary');
    const downloadBtn = document.getElementById('download-protected-btn');
    const resetBtn = document.getElementById('protect-reset-btn');
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    const errorDismissBtn = document.getElementById('error-dismiss-btn');

    // State
    const progress = PDFCore.createProgress(progressContainer);
    let currentFile = null;
    let currentBuffer = null;
    let protectedBlob = null;

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

    // Password Visibility Toggles
    document.querySelectorAll('.btn-toggle-pw').forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (!input) return;
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            const icon = btn.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
                if (window.lucide) window.lucide.createIcons();
            }
        });
    });

    // Password Strength Evaluator
    function evaluatePasswordStrength(pw) {
        if (!pw) {
            return { score: 0, text: 'Enter at least 4 characters', color: 'bg-rose-500' };
        }
        if (pw.length < 4) {
            return { score: 20, text: 'Too short (min 4 chars)', color: 'bg-rose-500' };
        }

        let score = 20;
        if (pw.length >= 8) score += 25;
        if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 20;
        if (/[0-9]/.test(pw)) score += 15;
        if (/[^A-Za-z0-9]/.test(pw)) score += 20;

        if (score < 40) {
            return { score: 35, text: 'Weak password', color: 'bg-rose-500' };
        } else if (score < 75) {
            return { score: 65, text: 'Moderate strength', color: 'bg-amber-500' };
        } else {
            return { score: 100, text: 'Strong password', color: 'bg-emerald-500' };
        }
    }

    function updateStrength() {
        const pw = userPasswordInput?.value || '';
        const { score, text, color } = evaluatePasswordStrength(pw);
        if (strengthBar) {
            strengthBar.style.width = `${score}%`;
            strengthBar.className = `h-full transition-all duration-300 ${color}`;
        }
        if (strengthLabel) {
            strengthLabel.textContent = text;
        }
        checkMatch();
    }

    function checkMatch() {
        const pw = userPasswordInput?.value || '';
        const confirm = confirmPasswordInput?.value || '';
        if (!matchLabel) return;

        if (!confirm) {
            matchLabel.textContent = 'Passwords must match';
            matchLabel.className = 'text-[11px] text-slate-400 font-medium mt-1 block';
        } else if (pw === confirm) {
            matchLabel.textContent = 'Passwords match';
            matchLabel.className = 'text-[11px] text-emerald-600 font-medium mt-1 block';
        } else {
            matchLabel.textContent = 'Passwords do not match';
            matchLabel.className = 'text-[11px] text-rose-600 font-medium mt-1 block';
        }
    }

    if (userPasswordInput) userPasswordInput.addEventListener('input', updateStrength);
    if (confirmPasswordInput) confirmPasswordInput.addEventListener('input', checkMatch);

    // Ingest Selected File
    async function loadPdfFile(file) {
        clearError();
        if (resultView) resultView.classList.add('hidden');
        if (alreadyEncryptedBanner) alreadyEncryptedBanner.classList.add('hidden');

        try {
            submitBtn.disabled = true;
            progress.start('Reading PDF document...');

            currentFile = file;
            currentBuffer = await PDFCore.readFileAsArrayBuffer(file);

            // Pre-initialize QPDF & check if file is already encrypted
            await QPDFClient.init();
            const status = await QPDFClient.checkPasswordStatus(currentBuffer);

            if (status.encrypted) {
                if (alreadyEncryptedBanner) alreadyEncryptedBanner.classList.remove('hidden');
            }

            fileNameLabel.textContent = file.name;
            fileMetaLabel.textContent = `${PDFCore.formatBytes(file.size)}`;

            dropzone.classList.add('hidden');
            workspace.classList.remove('hidden');
            progress.reset();
            submitBtn.disabled = false;
        } catch (err) {
            console.error('File load error:', err);
            showError('Unable to open this PDF document. Please verify the file is not corrupted.');
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

    // Submit Encryption
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (!currentBuffer || !currentFile) {
                showError('Please upload a PDF file first.');
                return;
            }

            const userPassword = userPasswordInput?.value || '';
            const confirmPassword = confirmPasswordInput?.value || '';
            const ownerPassword = ownerPasswordInput?.value || '';

            if (!userPassword || userPassword.length < 4) {
                showError('Please enter an open password with at least 4 characters.');
                userPasswordInput?.focus();
                return;
            }

            if (userPassword !== confirmPassword) {
                showError('The passwords do not match. Please re-enter confirmation password.');
                confirmPasswordInput?.focus();
                return;
            }

            clearError();
            if (resultView) resultView.classList.add('hidden');

            try {
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

                progress.start('Initializing 256-bit AES encryption...');

                const allowPrint = permPrint?.value || 'full';
                const allowExtract = (permExtract?.value || 'y') === 'y';
                const allowModify = permModify?.value || 'all';

                progress.update(40, 'Encrypting PDF structure and streams...');

                const result = await QPDFClient.encryptPdf(currentBuffer, {
                    userPassword,
                    ownerPassword,
                    allowPrint,
                    allowExtract,
                    allowModify,
                });

                progress.update(90, 'Finalizing encrypted document...');

                protectedBlob = new Blob([result.outputBytes], { type: 'application/pdf' });
                progress.complete('Document protected successfully!');

                if (resultSummary) {
                    resultSummary.textContent = `Encrypted "${currentFile.name}" with 256-bit AES security (${PDFCore.formatBytes(protectedBlob.size)}).`;
                }

                if (resultView) {
                    resultView.classList.remove('hidden');
                    resultView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } catch (err) {
                console.error('Encryption error:', err);
                showError(err.message || 'An error occurred during encryption.');
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
            if (!protectedBlob || !currentFile) return;
            const originalName = currentFile.name.replace(/\.[^/.]+$/, '');
            const downloadName = `${originalName}-protected.pdf`;
            PDFCore.downloadBlob(protectedBlob, downloadName);
        });
    }

    // Reset Handler
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            currentFile = null;
            currentBuffer = null;
            protectedBlob = null;
            if (userPasswordInput) userPasswordInput.value = '';
            if (confirmPasswordInput) confirmPasswordInput.value = '';
            if (ownerPasswordInput) ownerPasswordInput.value = '';
            if (fileInput) fileInput.value = '';

            updateStrength();
            clearError();
            progress.reset();

            if (resultView) resultView.classList.add('hidden');
            if (alreadyEncryptedBanner) alreadyEncryptedBanner.classList.add('hidden');
            if (workspace) workspace.classList.add('hidden');
            if (dropzone) dropzone.classList.remove('hidden');
        });
    }
})();
