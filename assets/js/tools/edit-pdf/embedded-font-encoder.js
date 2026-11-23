/**
 * NoPayPDF - Embedded Font Encoder Module (window.EmbeddedFontEncoder)
 *
 * Reverse font encoder for Sejda-style in-place content stream rewriting:
 * 1. Inspects page /Resources -> /Font dictionaries in pdf-lib.
 * 2. Decompresses and parses /ToUnicode CMaps (beginbfchar and beginbfrange)
 *    to construct exact Unicode -> CID / HexCode reverse mapping tables.
 * 3. Supports simple TrueType / Type1 fonts with /WinAnsiEncoding and
 *    custom /Encoding -> /Differences arrays via Adobe Glyph List (AGL).
 * 4. Determines whether modified strings can be encoded natively by the embedded font.
 * 5. Re-encodes text into exact PDF hex strings (<...>) or TJ spacing arrays.
 *
 * 100% Client-Side. Permissive MIT / Apache 2.0 compatible.
 */

(function (window) {
    'use strict';

    // Standard Adobe Glyph List mapping for common /Differences names
    const AGL_COMMON = {
        space: ' ', exclam: '!', quotedbl: '"', numbersign: '#', dollar: '$',
        percent: '%', ampersand: '&', quotesingle: "'", parenleft: '(', parenright: ')',
        asterisk: '*', plus: '+', comma: ',', hyphen: '-', minus: '-', period: '.',
        slash: '/', zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
        six: '6', seven: '7', eight: '8', nine: '9', colon: ':', semicolon: ';',
        less: '<', equal: '=', greater: '>', question: '?', at: '@',
        bracketleft: '[', backslash: '\\', bracketright: ']', asciicircum: '^',
        underscore: '_', grave: '`', braceleft: '{', bar: '|', braceright: '}',
        asciitilde: '~', bullet: '•', endash: '–', emdash: '—', quoteleft: '‘',
        quoteright: '’', quotedblleft: '“', quotedblright: '”', euro: '€',
        copyright: '©', registered: '®', trademark: '™', degree: '°',
    };

    // Populate A-Z, a-z
    for (let c = 65; c <= 90; c++) {
        const ch = String.fromCharCode(c);
        AGL_COMMON[ch] = ch;
        AGL_COMMON[ch.toLowerCase()] = ch.toLowerCase();
    }

    // Windows-1252 special characters (0x80 to 0x9F)
    const WIN_1252_EXTRAS = {
        '€': '80', '‚': '82', 'ƒ': '83', '„': '84', '…': '85', '†': '86',
        '‡': '87', 'ˆ': '88', '‰': '89', 'Š': '8a', '‹': '8b', 'Œ': '8c',
        'Ž': '8e', '‘': '91', '’': '92', '“': '93', '”': '94', '•': '95',
        '–': '96', '—': '97', '˜': '98', '™': '99', 'š': '9a', '›': '9b',
        'œ': '9c', 'ž': '9e', 'Ÿ': '9f',
    };

    class FontEncoder {
        constructor(fontKey, baseFont = '', isCID = false, codeBytes = 2) {
            this.fontKey = fontKey; // e.g. '/F1', '/F2', '/TT0'
            this.baseFont = baseFont; // Raw BaseFont e.g. 'ABCDEF+Calibri'
            this.cleanName = baseFont.replace(/^\//, '').replace(/^[A-Z]{6}\+/, '').trim();
            this.isCID = isCID;
            this.codeBytes = codeBytes; // 2 for Type0/CID, 1 for simple TrueType/Type1
            this.charToHex = new Map();
            this.hexToChar = new Map();
            this.spaceCode = null; // Specific hex code for space if known
        }

        registerMapping(srcHex, unicodeChar) {
            const cleanHex = srcHex.toLowerCase();
            this.charToHex.set(unicodeChar, cleanHex);
            this.hexToChar.set(cleanHex, unicodeChar);
            if (unicodeChar === ' ') {
                this.spaceCode = cleanHex;
            }
        }

        canEncode(text) {
            if (!text || typeof text !== 'string') return true;
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                if (ch === ' ' && this.spaceCode) continue;
                if (ch === ' ' && !this.spaceCode) continue; // Spaces can be handled via TJ kerning
                if (!this.charToHex.has(ch)) {
                    return false;
                }
            }
            return true;
        }

        /**
         * Re-encode text into exact PDF stream operands for Tj or TJ.
         * @param {string} text
         * @returns {{ operator: 'Tj'|'TJ', operands: Array<string> }}
         */
        encode(text) {
            if (!text) {
                return { operator: 'Tj', operands: ['()'] };
            }

            // If space is directly in charToHex or text has no spaces:
            const hasSpaceMapping = this.charToHex.has(' ');
            if (hasSpaceMapping || !text.includes(' ')) {
                let hexStr = '';
                for (let i = 0; i < text.length; i++) {
                    const ch = text[i];
                    const hex = this.charToHex.get(ch);
                    if (hex) {
                        hexStr += hex;
                    } else if (ch === ' ' && this.spaceCode) {
                        hexStr += this.spaceCode;
                    }
                }
                return {
                    operator: 'Tj',
                    operands: [`<${hexStr}>`],
                };
            }

            // If font lacks a direct space glyph/CID, split words and format as a TJ spacing array
            // In PDF TJ, negative numbers advance cursor forward (e.g. -275 is ~0.275 em space)
            const words = text.split(' ');
            const tjElements = [];

            for (let w = 0; w < words.length; w++) {
                const word = words[w];
                if (word.length > 0) {
                    let wordHex = '';
                    for (let i = 0; i < word.length; i++) {
                        const ch = word[i];
                        const hex = this.charToHex.get(ch) || '';
                        wordHex += hex;
                    }
                    if (wordHex.length > 0) {
                        tjElements.push(`<${wordHex}>`);
                    }
                }
                if (w < words.length - 1) {
                    tjElements.push('-275'); // Kerning advance for space
                }
            }

            return {
                operator: 'TJ',
                operands: [`[ ${tjElements.join(' ')} ]`],
            };
        }
    }

    const EmbeddedFontEncoder = {
        /**
         * Create font encoders for all fonts defined in a PDF page's /Resources.
         * @param {Object} pdfDoc PDFDocument from pdf-lib
         * @param {Object} pdfPage PDFPage from pdf-lib
         * @returns {Map<string, FontEncoder>} Map of fontKey (e.g. '/F1', '/TT0') -> FontEncoder
         */
        createPageFontEncoders(pdfDoc, pdfPage) {
            const encoders = new Map();
            if (!pdfDoc || !pdfPage || !pdfPage.node) return encoders;

            const { PDFName, decodePDFRawStream } = window.PDFLib || {};
            if (!PDFName) return encoders;

            const resources = pdfPage.node.lookup(PDFName.of('Resources'));
            if (!resources || typeof resources.lookup !== 'function') return encoders;

            const fontDict = resources.lookup(PDFName.of('Font'));
            if (!fontDict || typeof fontDict.entries !== 'function') return encoders;

            for (const [keyName, fontRef] of fontDict.entries()) {
                const fontKey = keyName.asString(); // e.g. '/F1'
                const fontObj = pdfDoc.context.lookup(fontRef);
                if (!fontObj || typeof fontObj.lookup !== 'function') continue;

                const subtype = fontObj.lookup(PDFName.of('Subtype'))?.asString() || '';
                const baseFont = fontObj.lookup(PDFName.of('BaseFont'))?.asString() || '';
                const isCID = (subtype === '/Type0') || (subtype === '/CIDFontType0') || (subtype === '/CIDFontType2');
                const codeBytes = isCID ? 2 : 1;

                const encoder = new FontEncoder(fontKey, baseFont, isCID, codeBytes);

                // 1. Parse /ToUnicode CMap if present (Gold Standard for CID & Simple fonts)
                const toUnicodeRef = fontObj.lookup(PDFName.of('ToUnicode'));
                let hasToUnicode = false;

                if (toUnicodeRef && decodePDFRawStream) {
                    try {
                        const toUnicodeStream = pdfDoc.context.lookup(toUnicodeRef);
                        if (toUnicodeStream) {
                            const rawBytes = decodePDFRawStream(toUnicodeStream).decode();
                            if (rawBytes && rawBytes.length > 0) {
                                const cMapStr = new TextDecoder('latin1').decode(rawBytes);
                                this._parseToUnicodeCMap(encoder, cMapStr);
                                hasToUnicode = encoder.charToHex.size > 0;
                            }
                        }
                    } catch (e) {
                        console.warn(`Failed to parse /ToUnicode for font ${fontKey}:`, e);
                    }
                }

                // 2. Parse /Encoding if simple font without /ToUnicode or to supplement standard characters
                if (!isCID) {
                    this._populateSimpleFontEncoding(encoder, fontObj, pdfDoc);
                }

                encoders.set(fontKey, encoder);
            }

            return encoders;
        },

        /**
         * Parse /ToUnicode CMap content stream for beginbfchar and beginbfrange blocks.
         */
        _parseToUnicodeCMap(encoder, cMapStr) {
            // A. Parse beginbfchar blocks:
            // N beginbfchar
            // <0021> <0048>
            // <0022> <0065>
            // endbfchar
            const bfcharRegex = /(\d+)\s+beginbfchar([\s\S]*?)endbfchar/g;
            let bfcharMatch;
            while ((bfcharMatch = bfcharRegex.exec(cMapStr)) !== null) {
                const block = bfcharMatch[2];
                const pairRegex = /<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g;
                let pairMatch;
                while ((pairMatch = pairRegex.exec(block)) !== null) {
                    const srcHex = pairMatch[1];
                    const dstHex = pairMatch[2];
                    const unicodeChar = this._hexToUnicodeString(dstHex);
                    if (unicodeChar) {
                        encoder.registerMapping(srcHex, unicodeChar);
                    }
                }
            }

            // B. Parse beginbfrange blocks:
            // Format 1: <startHex> <endHex> <dstStartHex>
            // Format 2: <startHex> <endHex> [ <dst1> <dst2> ... ]
            const bfrangeRegex = /(\d+)\s+beginbfrange([\s\S]*?)endbfrange/g;
            let bfrangeMatch;
            while ((bfrangeMatch = bfrangeRegex.exec(cMapStr)) !== null) {
                const block = bfrangeMatch[2];
                const lines = block.split(/\r?\n/);

                for (let line of lines) {
                    line = line.trim();
                    if (!line) continue;

                    // Form 2: <startHex> <endHex> [ <...> ... ]
                    const arrayMatch = line.match(/^<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s*\[([\s\S]*?)\]$/);
                    if (arrayMatch) {
                        const start = parseInt(arrayMatch[1], 16);
                        const end = parseInt(arrayMatch[2], 16);
                        const hexLen = arrayMatch[1].length;
                        const arrayItems = arrayMatch[3].match(/<([0-9a-fA-F]+)>/g) || [];

                        for (let k = 0; k < arrayItems.length && (start + k) <= end; k++) {
                            const curSrc = (start + k).toString(16).padStart(hexLen, '0');
                            const dstItem = arrayItems[k].replace(/[<>]/g, '');
                            const unicodeChar = this._hexToUnicodeString(dstItem);
                            if (unicodeChar) {
                                encoder.registerMapping(curSrc, unicodeChar);
                            }
                        }
                        continue;
                    }

                    // Form 1: <startHex> <endHex> <dstStartHex>
                    const rangeMatch = line.match(/^<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>$/);
                    if (rangeMatch) {
                        const start = parseInt(rangeMatch[1], 16);
                        const end = parseInt(rangeMatch[2], 16);
                        const dstStart = parseInt(rangeMatch[3], 16);
                        const hexLen = rangeMatch[1].length;

                        for (let cur = start; cur <= end; cur++) {
                            const curSrc = cur.toString(16).padStart(hexLen, '0');
                            const curDst = dstStart + (cur - start);
                            const unicodeChar = String.fromCodePoint(curDst);
                            encoder.registerMapping(curSrc, unicodeChar);
                        }
                    }
                }
            }
        },

        _hexToUnicodeString(hex) {
            try {
                if (hex.length === 4) {
                    return String.fromCodePoint(parseInt(hex, 16));
                } else if (hex.length === 8) {
                    // Could be UTF-16 surrogate pair
                    const w1 = parseInt(hex.slice(0, 4), 16);
                    const w2 = parseInt(hex.slice(4, 8), 16);
                    return String.fromCharCode(w1, w2);
                } else {
                    let str = '';
                    for (let i = 0; i < hex.length; i += 4) {
                        str += String.fromCodePoint(parseInt(hex.slice(i, i + 4), 16));
                    }
                    return str;
                }
            } catch (e) {
                return null;
            }
        },

        _populateSimpleFontEncoding(encoder, fontObj, pdfDoc) {
            const { PDFName } = window.PDFLib;
            const encodingRef = fontObj.lookup(PDFName.of('Encoding'));
            if (!encodingRef) {
                // Default to WinAnsi for standard Roman fonts
                this._addStandardWinAnsi(encoder);
                return;
            }

            const encodingObj = pdfDoc.context.lookup(encodingRef);
            if (!encodingObj) return;

            if (encodingObj instanceof PDFName) {
                const encName = encodingObj.asString();
                if (encName === '/WinAnsiEncoding') {
                    this._addStandardWinAnsi(encoder);
                } else if (encName === '/MacRomanEncoding') {
                    this._addStandardAscii(encoder);
                }
                return;
            }

            // Custom /Encoding dictionary with /Differences
            if (typeof encodingObj.lookup === 'function') {
                const baseEnc = encodingObj.lookup(PDFName.of('BaseEncoding'));
                if (baseEnc && baseEnc.asString && baseEnc.asString() === '/WinAnsiEncoding') {
                    this._addStandardWinAnsi(encoder);
                } else {
                    this._addStandardAscii(encoder);
                }

                const differences = encodingObj.lookup(PDFName.of('Differences'));
                if (differences && typeof differences.size === 'function') {
                    let currentCode = 0;
                    for (let i = 0; i < differences.size(); i++) {
                        const item = differences.lookup(i);
                        if (typeof item === 'number') {
                            currentCode = item;
                        } else if (item && item.asString) {
                            const glyphName = item.asString().replace(/^\//, '');
                            const unicodeChar = AGL_COMMON[glyphName];
                            if (unicodeChar) {
                                const hex = currentCode.toString(16).padStart(2, '0');
                                encoder.registerMapping(hex, unicodeChar);
                            }
                            currentCode++;
                        }
                    }
                }
            }
        },

        _addStandardAscii(encoder) {
            for (let c = 32; c <= 126; c++) {
                const ch = String.fromCharCode(c);
                const hex = c.toString(16).padStart(2, '0');
                if (!encoder.charToHex.has(ch)) {
                    encoder.registerMapping(hex, ch);
                }
            }
        },

        _addStandardWinAnsi(encoder) {
            this._addStandardAscii(encoder);
            // Latin-1 Supplement (0xA0..0xFF)
            for (let c = 160; c <= 255; c++) {
                const ch = String.fromCharCode(c);
                const hex = c.toString(16).padStart(2, '0');
                if (!encoder.charToHex.has(ch)) {
                    encoder.registerMapping(hex, ch);
                }
            }
            // Win-1252 Extras
            for (const [ch, hex] of Object.entries(WIN_1252_EXTRAS)) {
                if (!encoder.charToHex.has(ch)) {
                    encoder.registerMapping(hex, ch);
                }
            }
        },
    };

    window.EmbeddedFontEncoder = EmbeddedFontEncoder;
})(window);
