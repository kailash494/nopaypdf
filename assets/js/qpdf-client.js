/**
 * NoPayPDF - QPDF WebAssembly Client
 * Permissive (ISC / Apache 2.0) Client-Side PDF Operations:
 * AES-256 Encryption, Decryption, Restriction Removal & Lossless Stream Compression
 */

(function (window) {
    'use strict';

    let cachedWasmBinary = null;
    let initPromise = null;

    const QPDFClient = {
        /**
         * Initialize the QPDF WebAssembly module and cache binary in memory
         * @param {Function} [onProgress] Optional callback for loading messages
         */
        async init(onProgress) {
            if (cachedWasmBinary && window.Module) {
                return;
            }

            if (!initPromise) {
                initPromise = (async () => {
                    if (onProgress) onProgress('Loading WebAssembly engine...');

                    // 1. Fetch WASM binary if not already cached
                    if (!cachedWasmBinary) {
                        const response = await fetch('/assets/vendor/qpdf/qpdf.wasm');
                        if (!response.ok) {
                            throw new Error(`Failed to load qpdf.wasm: HTTP ${response.status}`);
                        }
                        cachedWasmBinary = await response.arrayBuffer();
                    }

                    // 2. Ensure Emscripten factory function window.Module exists
                    if (typeof window.Module !== 'function') {
                        throw new Error('QPDF Emscripten factory (window.Module) is not loaded.');
                    }

                    if (onProgress) onProgress('WebAssembly engine ready.');
                })().catch((err) => {
                    initPromise = null;
                    throw err;
                });
            }

            return initPromise;
        },

        /**
         * Run a QPDF command inside an isolated Emscripten instance
         * @param {ArrayBuffer|Uint8Array} inputBytes PDF bytes
         * @param {Array<string>|Function} argsOrBuilder Command arguments or (inPath, outPath) => args
         * @returns {Promise<{ok: boolean, exitCode: number, outputBytes: Uint8Array|null, stdout: string, stderr: string}>}
         */
        async run(inputBytes, argsOrBuilder, options = {}) {
            await this.init();

            const stdoutLines = [];
            const stderrLines = [];
            let exitCode = 0;

            // qpdf.js binds r = console.error.bind(console) synchronously inside window.Module().
            // Temporarily capture it synchronously so Emscripten /dev/stderr routes into stderrLines cleanly
            // without emitting console.error noise during expected probes (e.g. --requires-password).
            const origConsoleError = console.error;
            let modPromise;
            console.error = (...args) => {
                const line = args.map(a => String(a ?? '')).join(' ');
                stderrLines.push(line);
                if (!options.quiet && !line.includes('invalid password')) {
                    origConsoleError.apply(console, args);
                }
            };
            try {
                modPromise = window.Module({
                    wasmBinary: cachedWasmBinary.slice(0),
                    locateFile: (p) => (p.endsWith('.wasm') ? '/assets/vendor/qpdf/qpdf.wasm' : '/assets/vendor/qpdf/' + p),
                    print: (text) => stdoutLines.push(text),
                    printErr: (text) => stderrLines.push(text),
                });
            } finally {
                console.error = origConsoleError;
            }
            const mod = await modPromise;

            const inPath = '/in.pdf';
            const outPath = '/out.pdf';

            // Write input file to Virtual File System
            const uint8Input = inputBytes instanceof Uint8Array ? inputBytes : new Uint8Array(inputBytes);
            mod.FS.writeFile(inPath, uint8Input);

            let args = [];
            if (typeof argsOrBuilder === 'function') {
                args = argsOrBuilder(inPath, outPath);
            } else if (Array.isArray(argsOrBuilder)) {
                args = argsOrBuilder;
            }

            try {
                const callRet = mod.callMain(args);
                if (typeof callRet === 'number') {
                    exitCode = callRet;
                }
            } catch (err) {
                if (err && (typeof err.status === 'number' || err.name === 'ExitStatus')) {
                    exitCode = err.status ?? 0;
                } else {
                    console.error('QPDF execution exception:', err);
                    throw err;
                }
            }

            let outputBytes = null;
            try {
                const rawOutput = mod.FS.readFile(outPath);
                if (rawOutput && rawOutput.length > 0) {
                    outputBytes = new Uint8Array(rawOutput).buffer;
                }
            } catch (e) {
                // outPath may not exist if command only inspected file
            }

            // Cleanup Virtual File System
            try { mod.FS.unlink(inPath); } catch (e) {}
            try { mod.FS.unlink(outPath); } catch (e) {}

            const stdout = stdoutLines.join('\n');
            const stderr = stderrLines.join('\n');

            return {
                ok: exitCode === 0 || exitCode === 3,
                exitCode,
                outputBytes,
                stdout,
                stderr,
            };
        },

        /**
         * Check password and encryption status of a PDF using `qpdf --requires-password`
         * Exit codes per QPDF docs:
         *   2 = Not encrypted
         *   3 = Encrypted, but unlocked (either correct password or owner-only restrictions)
         *   0 = Encrypted and locked (user password required)
         * @param {ArrayBuffer|Uint8Array} inputBytes
         * @param {string} [password='']
         * @returns {Promise<{encrypted: boolean, unlocked: boolean, exitCode: number}>}
         */
        async checkPasswordStatus(inputBytes, password = '') {
            const args = [];
            if (password) {
                args.push(`--password=${password}`);
            }
            args.push('--requires-password', '/in.pdf');

            const res = await this.run(inputBytes, args, { quiet: true });

            // QPDF exits 2 with "invalid password" when an open password is required or incorrect.
            if (/invalid password/i.test(res.stderr || '')) {
                return { encrypted: true, unlocked: false, exitCode: 0 };
            }
            if (res.exitCode === 3) {
                return { encrypted: true, unlocked: true, exitCode: 3 };
            }
            if (res.exitCode === 2) {
                if ((res.stderr || '').trim().length > 0) {
                    throw new Error(res.stderr);
                }
                return { encrypted: false, unlocked: true, exitCode: 2 };
            }
            if (res.exitCode === 0) {
                return { encrypted: true, unlocked: false, exitCode: 0 };
            }

            // If there's an unexpected code or error
            throw new Error(res.stderr || `Could not inspect PDF security (code ${res.exitCode}).`);
        },

        /**
         * Encrypt PDF with AES-256 encryption and configurable permissions
         * @param {ArrayBuffer|Uint8Array} inputBytes
         * @param {Object} options
         * @param {string} options.userPassword Open password
         * @param {string} [options.ownerPassword] Permissions password (auto-generated if empty)
         * @param {string} [options.allowPrint='full'] 'full' | 'low' | 'none'
         * @param {string} [options.allowModify='all'] 'all' | 'annotate' | 'none'
         * @param {boolean} [options.allowExtract=true] Allow text/image copying
         * @returns {Promise<{outputBytes: ArrayBuffer, ownerPassword: string}>}
         */
        async encryptPdf(inputBytes, options = {}) {
            const userPassword = options.userPassword ?? '';
            let ownerPassword = options.ownerPassword ? options.ownerPassword.trim() : '';

            // 256-bit AES encryption requires a non-empty owner password.
            // If the user left it blank, generate a cryptographically secure random owner password
            if (!ownerPassword) {
                const rand = new Uint8Array(12);
                window.crypto.getRandomValues(rand);
                ownerPassword = Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('');
            }

            const allowPrint = options.allowPrint || 'full';
            const allowModify = options.allowModify || 'all';
            const allowExtract = options.allowExtract !== false ? 'y' : 'n';

            const args = (inPath, outPath) => [
                inPath,
                '--encrypt',
                userPassword,
                ownerPassword,
                '256',
                `--print=${allowPrint}`,
                `--modify=${allowModify}`,
                `--extract=${allowExtract}`,
                '--',
                outPath,
            ];

            const res = await this.run(inputBytes, args, { quiet: true });
            if (!res.ok || !res.outputBytes) {
                throw new Error(res.stderr || 'Encryption failed: no output document generated.');
            }

            return {
                outputBytes: res.outputBytes,
                ownerPassword,
            };
        },

        /**
         * Decrypt PDF or remove password and restrictions
         * @param {ArrayBuffer|Uint8Array} inputBytes
         * @param {string} [password='']
         * @returns {Promise<{outputBytes: ArrayBuffer}>}
         */
        async decryptPdf(inputBytes, password = '') {
            const args = (inPath, outPath) => [
                `--password=${password}`,
                '--decrypt',
                inPath,
                outPath,
            ];

            const res = await this.run(inputBytes, args, { quiet: true });

            if (!res.ok || !res.outputBytes) {
                const combined = (res.stderr + '\n' + res.stdout).toLowerCase();
                if (combined.includes('invalid password')) {
                    throw new Error('Incorrect password. Please verify the password and try again.');
                }
                if (combined.includes('damaged') || combined.includes('damaged pdf') || combined.includes('expected') || combined.includes('header')) {
                    throw new Error('The selected file appears to be corrupted or is not a valid PDF document.');
                }
                if (combined.includes('password') && Boolean(password)) {
                    throw new Error('Incorrect password. Please verify the password and try again.');
                }
                throw new Error(res.stderr || res.stdout || 'Decryption failed: invalid or corrupt document.');
            }

            return {
                outputBytes: res.outputBytes,
            };
        },

        /**
         * Lossless structural optimization
         * Compresses streams, regenerates object tables, cleans unreferenced objects
         * @param {ArrayBuffer|Uint8Array} inputBytes
         * @returns {Promise<{outputBytes: ArrayBuffer}>}
         */
        async optimizeLossless(inputBytes) {
            const args = (inPath, outPath) => [
                '--compress-streams=y',
                '--recompress-flate',
                '--compression-level=9',
                '--object-streams=generate',
                '--optimize-images',
                inPath,
                outPath,
            ];

            const res = await this.run(inputBytes, args, { quiet: true });
            if (!res.ok || !res.outputBytes) {
                throw new Error(res.stderr || 'Lossless optimization failed.');
            }

            return {
                outputBytes: res.outputBytes,
            };
        },
    };

    window.QPDFClient = QPDFClient;
})(window);
