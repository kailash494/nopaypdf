/**
 * NoPayPDF - Content Stream Editor Module (window.ContentStreamEditor)
 *
 * Surgical client-side PDF content-stream text removal:
 * 1. Decompresses page /Contents (single stream or stream arrays) and Form XObjects.
 * 2. Tokenizes PDF content streams with 100% byte fidelity via Latin-1 preservation.
 * 3. Tracks full graphics and text state matrices (q/Q, cm, BT/ET, Tm, Td, TD, T*, Tf, TL).
 * 4. Maps text-showing operators (Tj, TJ, ', ") to exact PDF user-space coordinates.
 * 5. Matches and removes edited/deleted text runs with horizontal advance compensation.
 * 6. Recompresses modified streams via pdfDoc.context.flateStream().
 *
 * 100% Client-Side. Permissive MIT / Apache 2.0 compatible.
 */

(function (window) {
    'use strict';

    // 2D Affine Matrix Multiplication: M1 x M2
    function multMatrix(m1, m2) {
        return [
            m1[0] * m2[0] + m1[1] * m2[2],
            m1[0] * m2[1] + m1[1] * m2[3],
            m1[2] * m2[0] + m1[3] * m2[2],
            m1[2] * m2[1] + m1[3] * m2[3],
            m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
            m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
        ];
    }

    // Identity Matrix [a, b, c, d, e, f]
    function identityMatrix() {
        return [1, 0, 0, 1, 0, 0];
    }

    /**
     * Tokenizer for PDF content streams.
     * Preserves exact operands and operators.
     */
    function parseContentStream(streamStr) {
        const operations = [];
        const len = streamStr.length;
        let pos = 0;
        let operands = [];

        function isWhitespace(ch) {
            return ch === 32 || ch === 10 || ch === 13 || ch === 9 || ch === 12 || ch === 0;
        }

        function isDelimiter(ch) {
            return isWhitespace(ch) ||
                ch === 40 || ch === 41 || // ( )
                ch === 60 || ch === 62 || // < >
                ch === 91 || ch === 93 || // [ ]
                ch === 123 || ch === 125 || // { }
                ch === 47 || ch === 37; // / %
        }

        while (pos < len) {
            let ch = streamStr.charCodeAt(pos);

            // Skip whitespaces
            if (isWhitespace(ch)) {
                pos++;
                continue;
            }

            // Skip comments
            if (ch === 37) { // '%'
                while (pos < len && streamStr.charCodeAt(pos) !== 10 && streamStr.charCodeAt(pos) !== 13) {
                    pos++;
                }
                continue;
            }

            // Literal string: (...)
            if (ch === 40) { // '('
                const start = pos;
                pos++;
                let depth = 1;
                let escaped = false;
                while (pos < len && depth > 0) {
                    const c = streamStr.charCodeAt(pos);
                    if (escaped) {
                        escaped = false;
                    } else if (c === 92) { // '\'
                        escaped = true;
                    } else if (c === 40) { // '('
                        depth++;
                    } else if (c === 41) { // ')'
                        depth--;
                    }
                    pos++;
                }
                operands.push(streamStr.slice(start, pos));
                continue;
            }

            // Hex string: <...> (or dict <<...>>)
            if (ch === 60) { // '<'
                if (pos + 1 < len && streamStr.charCodeAt(pos + 1) === 60) { // '<<'
                    pos += 2;
                    let depth = 1;
                    const start = pos - 2;
                    while (pos + 1 < len && depth > 0) {
                        if (streamStr.charCodeAt(pos) === 60 && streamStr.charCodeAt(pos + 1) === 60) {
                            depth++;
                            pos += 2;
                        } else if (streamStr.charCodeAt(pos) === 62 && streamStr.charCodeAt(pos + 1) === 62) {
                            depth--;
                            pos += 2;
                        } else {
                            pos++;
                        }
                    }
                    operands.push(streamStr.slice(start, pos));
                    continue;
                } else {
                    // Single hex string <...>
                    const start = pos;
                    pos++;
                    while (pos < len && streamStr.charCodeAt(pos) !== 62) {
                        pos++;
                    }
                    if (pos < len) pos++; // include '>'
                    operands.push(streamStr.slice(start, pos));
                    continue;
                }
            }

            // Array: [...]
            if (ch === 91) { // '['
                const start = pos;
                pos++;
                let depth = 1;
                while (pos < len && depth > 0) {
                    const c = streamStr.charCodeAt(pos);
                    if (c === 40) { // nested literal string
                        pos++;
                        let sDepth = 1;
                        let esc = false;
                        while (pos < len && sDepth > 0) {
                            const sc = streamStr.charCodeAt(pos);
                            if (esc) {
                                esc = false;
                            } else if (sc === 92) {
                                esc = true;
                            } else if (sc === 40) {
                                sDepth++;
                            } else if (sc === 41) {
                                sDepth--;
                            }
                            pos++;
                        }
                        continue;
                    }
                    if (c === 91) depth++;
                    if (c === 93) depth--;
                    pos++;
                }
                operands.push(streamStr.slice(start, pos));
                continue;
            }

            // Name: /Name
            if (ch === 47) { // '/'
                const start = pos;
                pos++;
                while (pos < len && !isDelimiter(streamStr.charCodeAt(pos))) {
                    pos++;
                }
                operands.push(streamStr.slice(start, pos));
                continue;
            }

            // Other token: Number, Keyword, or Operator
            const start = pos;
            while (pos < len && !isDelimiter(streamStr.charCodeAt(pos))) {
                pos++;
            }
            const token = streamStr.slice(start, pos);

            // Check if token is a standard PDF content stream operator
            if (isOperator(token)) {
                operations.push({
                    operator: token,
                    operands: operands,
                });
                operands = [];
            } else {
                operands.push(token);
            }
        }

        return operations;
    }

    const KNOWN_OPERATORS = new Set([
        'b', 'B', 'b*', 'B*', 'BDC', 'BI', 'BMC', 'BT', 'BX',
        'c', 'cm', 'CS', 'cs',
        'd', 'd0', 'd1', 'Do', 'DP',
        'EI', 'EMC', 'ET', 'EX',
        'f', 'F', 'f*',
        'g', 'G', 'gs',
        'h',
        'i', 'ID',
        'j', 'J',
        'k', 'K',
        'l',
        'm', 'M', 'MP',
        'n',
        'q', 'Q',
        're', 'RG', 'rg', 'ri',
        's', 'S', 'sc', 'SC', 'scn', 'SCN', 'sh',
        'T*', 'Tc', 'Td', 'TD', 'Tf', 'Tj', 'TJ', 'TL', 'Tm', 'Tr', 'Ts', 'Tw', 'Tz',
        'v',
        'w', 'W', 'W*',
        'y',
        '\'', '"',
    ]);

    function isOperator(token) {
        return KNOWN_OPERATORS.has(token);
    }

    const ContentStreamEditor = {
        /**
         * Surgically rewrite or remove edited and deleted text runs from a page's content stream.
         * For blocks whose fonts can natively encode the modified text, rewrites operands in-place.
         * Otherwise cleanly removes the operator so fallback fonts can be stamped.
         *
         * @param {Object} pdfDoc PDFDocument from pdf-lib
         * @param {Object} pdfPage PDFPage from pdf-lib
         * @param {Object} pageState State object for the page from EditorState
         * @returns {Promise<{ inPlaceRewrittenBlockIds: Set<string>, removedBlockIds: Set<string> }>}
         */
        async rewriteOrRemoveTextRuns(pdfDoc, pdfPage, pageState) {
            const removedBlockIds = new Set();
            const inPlaceRewrittenBlockIds = new Set();
            removedBlockIds.inPlaceRewrittenBlockIds = inPlaceRewrittenBlockIds;

            const editedBlocks = (pageState.textBlocks || []).filter(b => b.modified || b.deleted);

            if (editedBlocks.length === 0) {
                return { inPlaceRewrittenBlockIds, removedBlockIds };
            }

            // 1. Build font encoders for all fonts defined in this page's /Resources
            let fontEncoders = new Map();
            if (window.EmbeddedFontEncoder && typeof window.EmbeddedFontEncoder.createPageFontEncoders === 'function') {
                try {
                    fontEncoders = window.EmbeddedFontEncoder.createPageFontEncoders(pdfDoc, pdfPage);
                } catch (e) {
                    console.warn('Failed to create page font encoders:', e);
                }
            }

            // 2. Build target lookup list of all raw runs needing removal or in-place rewriting
            const targetRuns = [];
            for (const b of editedBlocks) {
                const runs = (b.rawRuns && b.rawRuns.length > 0) ? b.rawRuns : [{
                    pdfX: b.pdfX,
                    pdfY: b.baselinePdfY !== undefined ? b.baselinePdfY : b.pdfY,
                    pdfWidth: b.pdfWidth,
                    fontSizePt: b.fontSizePt,
                    str: b.originalText,
                }];

                const isFontChanged = Boolean(b.fontFamily && b.fontFamily !== 'original');
                const wantInPlace = !b.deleted && !isFontChanged;

                for (let rIdx = 0; rIdx < runs.length; rIdx++) {
                    targetRuns.push({
                        blockId: b.id,
                        run: runs[rIdx],
                        runIndex: rIdx,
                        totalRuns: runs.length,
                        block: b,
                        wantInPlace,
                        removed: false,
                        inPlaceRewritten: false,
                    });
                }
            }

            const { PDFName, PDFArray, decodePDFRawStream } = window.PDFLib;

            // 3. Process Page's /Contents
            const contentsRef = pdfPage.node.lookup(PDFName.of('Contents'));
            if (contentsRef) {
                await this._processContentsEntry(pdfDoc, pdfPage.node, PDFName.of('Contents'), contentsRef, targetRuns, fontEncoders);
            }

            // 4. Process Form XObjects if any unremoved runs remain
            const unremovedCount = targetRuns.filter(t => !t.removed).length;
            if (unremovedCount > 0) {
                const resources = pdfPage.node.lookup(PDFName.of('Resources'));
                if (resources && typeof resources.lookup === 'function') {
                    const xObjects = resources.lookup(PDFName.of('XObject'));
                    if (xObjects && typeof xObjects.entries === 'function') {
                        for (const [name, xObjRef] of xObjects.entries()) {
                            const xObj = pdfDoc.context.lookup(xObjRef);
                            if (xObj && xObj.lookup) {
                                const subtype = xObj.lookup(PDFName.of('Subtype'));
                                if (subtype && subtype.asString && subtype.asString() === '/Form') {
                                    // Process Form XObject stream
                                    await this._processContentsEntry(pdfDoc, null, null, xObj, targetRuns, fontEncoders);
                                }
                            }
                        }
                    }
                }
            }

            // 5. Check which blocks were rewritten in-place vs removed
            for (const b of editedBlocks) {
                const blockTargets = targetRuns.filter(t => t.blockId === b.id);
                const allInPlace = blockTargets.length > 0 && blockTargets.every(t => t.inPlaceRewritten);
                const allRemoved = blockTargets.length > 0 && blockTargets.every(t => t.removed);

                if (allInPlace) {
                    inPlaceRewrittenBlockIds.add(b.id);
                    removedBlockIds.add(b.id);
                } else if (allRemoved) {
                    removedBlockIds.add(b.id);
                }
            }

            return { inPlaceRewrittenBlockIds, removedBlockIds };
        },

        async removeEditedTextRuns(pdfDoc, pdfPage, pageState) {
            return this.rewriteOrRemoveTextRuns(pdfDoc, pdfPage, pageState);
        },

        async _processContentsEntry(pdfDoc, parentNode, entryName, streamOrArray, targetRuns, fontEncoders = new Map()) {
            const { PDFArray, decodePDFRawStream } = window.PDFLib;

            let streams = [];
            if (streamOrArray instanceof PDFArray) {
                for (let i = 0; i < streamOrArray.size(); i++) {
                    const s = streamOrArray.lookup(i);
                    if (s) streams.push({ stream: s, isArray: true, index: i });
                }
            } else {
                streams.push({ stream: streamOrArray, isArray: false });
            }

            const latin1Decoder = new TextDecoder('latin1');

            for (const item of streams) {
                let streamBytes;
                try {
                    streamBytes = decodePDFRawStream(item.stream).decode();
                } catch (e) {
                    // Not a decodable raw stream
                    continue;
                }

                if (!streamBytes || streamBytes.length === 0) continue;

                const streamStr = latin1Decoder.decode(streamBytes);
                const operations = parseContentStream(streamStr);

                // Run surgical text rewriting/removal with matrix tracking
                const { modified, newStreamStr } = this._applyStreamTransform(operations, targetRuns, fontEncoders);

                if (modified) {
                    // Encode new bytes preserving 100% Latin-1 mapping
                    const updatedBytes = new Uint8Array(newStreamStr.length);
                    for (let j = 0; j < newStreamStr.length; j++) {
                        updatedBytes[j] = newStreamStr.charCodeAt(j) & 0xff;
                    }

                    // Flate recompress and register indirect object
                    const newFlateStream = pdfDoc.context.flateStream(updatedBytes);
                    const newRef = pdfDoc.context.register(newFlateStream);

                    if (item.isArray && parentNode && entryName) {
                        const contentsArr = parentNode.lookup(entryName);
                        contentsArr.set(item.index, newRef);
                    } else if (parentNode && entryName) {
                        parentNode.set(entryName, newRef);
                    } else if (item.stream && item.stream.dict) {
                        // Form XObject direct stream replacement
                        for (const [k, v] of item.stream.dict.entries()) {
                            if (k.asString() !== '/Length' && k.asString() !== '/Filter') {
                                newFlateStream.dict.set(k, v);
                            }
                        }
                        item.stream.contents = newFlateStream.contents;
                        item.stream.dict = newFlateStream.dict;
                    }
                }
            }
        },

        _applyStreamTransform(operations, targetRuns, fontEncoders = new Map()) {
            let modified = false;

            // Graphics State Stack
            const graphicsStack = [];
            let ctm = identityMatrix();

            // Text State
            let inTextObject = false;
            let currentFontKey = null;
            let tm = identityMatrix();
            let tlm = identityMatrix();
            let leading = 12;
            let fontSize = 12;

            const transformedOps = [];

            for (let i = 0; i < operations.length; i++) {
                const op = operations[i];
                const fn = op.operator;
                const args = op.operands;

                // Graphics State: q / Q / cm
                if (fn === 'q') {
                    graphicsStack.push(ctm.slice());
                    transformedOps.push(op);
                    continue;
                }
                if (fn === 'Q') {
                    ctm = graphicsStack.pop() || identityMatrix();
                    transformedOps.push(op);
                    continue;
                }
                if (fn === 'cm' && args.length >= 6) {
                    const m = args.slice(0, 6).map(v => parseFloat(v) || 0);
                    ctm = multMatrix(m, ctm);
                    transformedOps.push(op);
                    continue;
                }

                // Text Object: BT / ET
                if (fn === 'BT') {
                    inTextObject = true;
                    tm = identityMatrix();
                    tlm = identityMatrix();
                    transformedOps.push(op);
                    continue;
                }
                if (fn === 'ET') {
                    inTextObject = false;
                    transformedOps.push(op);
                    continue;
                }

                // Text State: Tm / Td / TD / T* / Tf / TL
                if (fn === 'Tm' && args.length >= 6) {
                    const m = args.slice(0, 6).map(v => parseFloat(v) || 0);
                    tm = m;
                    tlm = m.slice();
                    transformedOps.push(op);
                    continue;
                }
                if (fn === 'Td' && args.length >= 2) {
                    const tx = parseFloat(args[0]) || 0;
                    const ty = parseFloat(args[1]) || 0;
                    tlm = multMatrix([1, 0, 0, 1, tx, ty], tlm);
                    tm = tlm.slice();
                    transformedOps.push(op);
                    continue;
                }
                if (fn === 'TD' && args.length >= 2) {
                    const tx = parseFloat(args[0]) || 0;
                    const ty = parseFloat(args[1]) || 0;
                    leading = -ty;
                    tlm = multMatrix([1, 0, 0, 1, tx, ty], tlm);
                    tm = tlm.slice();
                    transformedOps.push(op);
                    continue;
                }
                if (fn === 'T*') {
                    tlm = multMatrix([1, 0, 0, 1, 0, -leading], tlm);
                    tm = tlm.slice();
                    transformedOps.push(op);
                    continue;
                }
                if (fn === 'TL' && args.length >= 1) {
                    leading = parseFloat(args[0]) || 12;
                    transformedOps.push(op);
                    continue;
                }
                if (fn === 'Tf' && args.length >= 2) {
                    currentFontKey = args[0];
                    fontSize = parseFloat(args[1]) || 12;
                    transformedOps.push(op);
                    continue;
                }

                // Text-Showing Operators: Tj, TJ, ', "
                if (fn === 'Tj' || fn === 'TJ' || fn === '\'' || fn === '"') {
                    if (fn === '\'') {
                        tlm = multMatrix([1, 0, 0, 1, 0, -leading], tlm);
                        tm = tlm.slice();
                    } else if (fn === '"' && args.length >= 3) {
                        tlm = multMatrix([1, 0, 0, 1, 0, -leading], tlm);
                        tm = tlm.slice();
                    }

                    // Compute User-Space Rendering Coordinates (0, 0) x Tm x CTM
                    const trm = multMatrix(tm, ctm);
                    const userX = trm[4];
                    const userY = trm[5];

                    // Match against pending target runs within dynamic tolerance (accounting for matrix transforms & font scale)
                    let matchedTarget = null;
                    for (const t of targetRuns) {
                        if (t.removed) continue;
                        const dx = Math.abs(userX - t.run.pdfX);
                        const dy = Math.abs(userY - (t.run.baselinePdfY !== undefined ? t.run.baselinePdfY : t.run.pdfY));
                        const maxTol = Math.max(3.5, (t.run.fontSizePt || 12) * 0.35);

                        if (dx <= maxTol && dy <= maxTol) {
                            matchedTarget = t;
                            break;
                        }
                    }

                    if (matchedTarget) {
                        // Check if in-place native embedded font rewriting is possible
                        if (matchedTarget.wantInPlace && currentFontKey && fontEncoders && fontEncoders.has(currentFontKey)) {
                            const encoder = fontEncoders.get(currentFontKey);
                            if (encoder && encoder.canEncode(matchedTarget.block.currentText)) {
                                matchedTarget.inPlaceRewritten = true;
                                matchedTarget.removed = true;
                                modified = true;

                                if (matchedTarget.runIndex === 0) {
                                    // First run in this block: rewrite with full updated text
                                    const enc = encoder.encode(matchedTarget.block.currentText);
                                    transformedOps.push({
                                        operator: enc.operator,
                                        operands: enc.operands,
                                    });

                                    // Compensate horizontal position difference if downstream text exists in same block
                                    let hasDownstreamTextInBlock = false;
                                    for (let k = i + 1; k < operations.length; k++) {
                                        const nextFn = operations[k].operator;
                                        if (nextFn === 'ET' || nextFn === 'Tm') break;
                                        if (nextFn === 'Tj' || nextFn === 'TJ' || nextFn === '\'' || nextFn === '"') {
                                            hasDownstreamTextInBlock = true;
                                            break;
                                        }
                                    }

                                    if (hasDownstreamTextInBlock) {
                                        const deltaAdv = Math.round(((matchedTarget.block.pdfWidth || 0) - (matchedTarget.run.pdfWidth || 0)) * 100) / 100;
                                        if (Math.abs(deltaAdv) > 0.5) {
                                            transformedOps.push({
                                                operator: 'Td',
                                                operands: [deltaAdv.toString(), '0'],
                                            });
                                            tlm = multMatrix([1, 0, 0, 1, deltaAdv, 0], tlm);
                                            tm = tlm.slice();
                                        }
                                    }
                                    continue;
                                } else {
                                    // Subsequent runs of the same line: omit them cleanly
                                    continue;
                                }
                            }
                        }

                        // Fallback: Remove operator from content stream so PdfExporter can stamp replacement text
                        matchedTarget.removed = true;
                        modified = true;

                        // Check if another text operator follows in the same BT...ET block
                        let hasDownstreamTextInBlock = false;
                        for (let k = i + 1; k < operations.length; k++) {
                            const nextFn = operations[k].operator;
                            if (nextFn === 'ET' || nextFn === 'Tm') break;
                            if (nextFn === 'Tj' || nextFn === 'TJ' || nextFn === '\'' || nextFn === '"') {
                                hasDownstreamTextInBlock = true;
                                break;
                            }
                        }

                        if (fn === 'Tj' || fn === 'TJ') {
                            if (hasDownstreamTextInBlock) {
                                // Compensate horizontal advance so downstream text doesn't shift left
                                const adv = Math.round((matchedTarget.run.pdfWidth || 0) * 100) / 100;
                                transformedOps.push({
                                    operator: 'Td',
                                    operands: [adv.toString(), '0'],
                                });
                                tlm = multMatrix([1, 0, 0, 1, adv, 0], tlm);
                                tm = tlm.slice();
                            }
                            // Original Tj/TJ omitted
                            continue;
                        } else if (fn === '\'') {
                            // Replace with T* to maintain exact vertical line advance
                            transformedOps.push({
                                operator: 'T*',
                                operands: [],
                            });
                            continue;
                        } else if (fn === '"') {
                            // Replace with T* preserving spacing parameters
                            const aw = args[0] || '0';
                            const ac = args[1] || '0';
                            transformedOps.push({ operator: 'Tw', operands: [aw] });
                            transformedOps.push({ operator: 'Tc', operands: [ac] });
                            transformedOps.push({ operator: 'T*', operands: [] });
                            continue;
                        }
                    }
                }

                transformedOps.push(op);
            }

            if (!modified) {
                return { modified: false, newStreamStr: '' };
            }

            // Reconstruct stream text cleanly
            let newStreamStr = '';
            for (const op of transformedOps) {
                if (op.operands && op.operands.length > 0) {
                    newStreamStr += op.operands.join(' ') + ' ' + op.operator + '\n';
                } else {
                    newStreamStr += op.operator + '\n';
                }
            }

            return { modified: true, newStreamStr };
        },
    };

    window.ContentStreamEditor = ContentStreamEditor;
})(window);
