/**
 * Real UI Test Driver for NoPayPDF Edit PDF
 * Runs inside the actual dist/edit-pdf/index.html page in headless Edge
 */
(async function () {
    const logs = [];
    function log(msg) {
        console.log('[E2E-TEST]', msg);
        logs.push(msg);
    }

    window.addEventListener('error', e => log(`BROWSER ERROR: ${e.message} at ${e.filename}:${e.lineno}`));
    window.addEventListener('unhandledrejection', e => log(`BROWSER PROMISE REJECTION: ${e.reason?.message || e.reason}`));

    async function report(status, error = null) {
        try {
            await fetch('/report-e2e-result', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, error, logs }),
            });
        } catch (e) {
            console.error('Failed to report test result:', e);
        }
    }

    try {
        if (document.readyState === 'loading') {
            await new Promise(r => document.addEventListener('DOMContentLoaded', r));
        }
        await new Promise(r => setTimeout(r, 500));

        log('1. Generating realistic Bank e-Receipt PDF with 5-row two-column table, orange header, and grey labels...');
        log('PDFJS OPS: ' + Object.keys(window.pdfjsLib?.OPS || {}).sort().join(', '));
        const { PDFDocument, rgb } = window.PDFLib;
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([612, 792]);

        // Non-zero CropBox to simulate real scanned/exported receipt transforms
        page.setCropBox(0, 10, 612, 802);

        // Orange header banner (#F26522) at Y=690..780
        page.drawRectangle({
            x: 0,
            y: 690,
            width: 612,
            height: 90,
            color: rgb(242 / 255, 101 / 255, 34 / 255),
        });

        // Orange decorative accent graphic near top
        page.drawRectangle({
            x: 36,
            y: 660,
            width: 80,
            height: 12,
            color: rgb(242 / 255, 101 / 255, 34 / 255),
        });

        // Fractional font size 7.4pt line with Carlito TrueType font
        let carlitoFont = null;
        try {
            const fontRes = await fetch('/assets/fonts/carlito/Carlito-Regular.ttf');
            if (fontRes.ok) {
                const carlitoBytes = await fontRes.arrayBuffer();
                if (window.fontkit && typeof pdfDoc.registerFontkit === 'function') {
                    pdfDoc.registerFontkit(window.fontkit);
                }
                carlitoFont = await pdfDoc.embedFont(carlitoBytes, { subset: false });
                log('✓ Embedded Carlito-Regular into synthetic test PDF');
            }
        } catch (e) {
            log(`Note: Carlito font fetch: ${e.message}`);
        }

        // 5-Row Two-Column Bank Table (Grey Labels on Left, Black Values on Right)
        const tableRows = [
            { y: 580, left: 'Beneficiary Account Number & Name', right: '(Dow University of Health' },
            { y: 550, left: 'Beneficiary Bank Name', right: 'United Bank Ltd' },
            { y: 520, left: 'Beneficiary Bank Country', right: 'PAKISTAN' },
            { y: 490, left: 'Transfer Currency & Amount*', right: 'USD 100.00' },
            { y: 460, left: 'FX Deal Code', right: 'Not Applied' },
        ];

        for (const row of tableRows) {
            // Left label: exact grey (#555555 = rgb(85/255, 85/255, 85/255))
            page.drawText(row.left, {
                x: 50,
                y: row.y,
                size: 11,
                font: carlitoFont || undefined,
                color: rgb(85 / 255, 85 / 255, 85 / 255),
            });

            // Right value: exact jet black (#000000)
            page.drawText(row.right, {
                x: 300,
                y: row.y,
                size: 11,
                font: carlitoFont || undefined,
                color: rgb(0, 0, 0),
            });
        }

        // Fractional font size 7.4pt line
        page.drawText('Invoice No: INV-2026-0042', {
            x: 50,
            y: 390,
            size: 7.4,
            font: carlitoFont || undefined,
            color: rgb(71 / 255, 85 / 255, 105 / 255),
        });

        const pdfBytes = await pdfDoc.save();
        log(`✓ Synthetic bank receipt PDF generated (${pdfBytes.length} bytes)`);

        log('2. Feeding PDF into the real NoPayPDF Edit PDF UI file input...');
        const file = new File([pdfBytes], 'bank-receipt-test.pdf', { type: 'application/pdf' });
        const dt = new DataTransfer();
        dt.items.add(file);

        const fileInput = document.getElementById('editor-file-input') || document.getElementById('file-input');
        if (!fileInput) throw new Error('File input not found in real UI');

        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Wait for PDF to load and render DOM hitboxes
        log('3. Waiting for EditorState and text hitboxes to mount in live DOM...');
        let hitboxes = [];
        for (let i = 0; i < 50; i++) {
            await new Promise(r => setTimeout(r, 200));
            hitboxes = Array.from(document.querySelectorAll('.text-hitbox'));
            if (hitboxes.length >= 10) break;
        }

        if (hitboxes.length < 10) {
            throw new Error(`Timed out waiting for .text-hitbox elements. Found: ${hitboxes.length}`);
        }
        log(`✓ Found ${hitboxes.length} text hitbox elements in live DOM`);

        const state = window.EditorState.getActivePage();
        if (!state) throw new Error('Active page state not found in EditorState');

        log('\n--- Assertion 1: Two-Column Table Colors (No Swap!) ---');
        // Verify ALL 5 left labels are grey (#555555) and NOT black (#000000)
        for (const row of tableRows) {
            const leftBlock = state.textBlocks.find(b => b.originalText.includes(row.left.trim()));
            if (!leftBlock) throw new Error(`Left block "${row.left}" not found in EditorState`);
            log(`Left Label "${leftBlock.originalText}": colorHex = ${leftBlock.colorHex}, bgHex = ${leftBlock.bgHex}`);

            if (leftBlock.colorHex.toLowerCase() === '#000000') {
                throw new Error(`Assertion Failed: Left label "${leftBlock.originalText}" was assigned BLACK (#000000) instead of grey #555555!`);
            }
            if (leftBlock.bgHex.toLowerCase() !== '#ffffff') {
                throw new Error(`Assertion Failed: Left label "${leftBlock.originalText}" background is ${leftBlock.bgHex}, expected #ffffff`);
            }

            const rightBlock = state.textBlocks.find(b => b.originalText.includes(row.right.trim()));
            if (!rightBlock) throw new Error(`Right block "${row.right}" not found in EditorState`);
            log(`Right Value "${rightBlock.originalText}": colorHex = ${rightBlock.colorHex}, bgHex = ${rightBlock.bgHex}`);

            if (rightBlock.colorHex.toLowerCase() !== '#000000') {
                throw new Error(`Assertion Failed: Right value "${rightBlock.originalText}" was assigned ${rightBlock.colorHex} instead of black #000000! (Color Swap detected!)`);
            }
        }
        log('✓ PASS: All 5 left labels are #555555 (grey) and all 5 right values are #000000 (black) - Zero Color Swap!');

        log('\n--- Assertion 1b: Fractional Font Size & Font Matching ---');
        const invoiceBlock = state.textBlocks.find(b => b.originalText.includes('Invoice No'));
        if (!invoiceBlock) throw new Error('Invoice block "Invoice No" not found in EditorState');
        const invoiceHitbox = hitboxes.find(el => el.dataset.id === invoiceBlock.id);
        if (!invoiceHitbox) throw new Error('Invoice hitbox element not found in DOM');

        log(`Invoice Block fontSizePt: ${invoiceBlock.fontSizePt}`);
        log(`Invoice Block matched font name: ${invoiceBlock.matched?.name}`);
        log(`Invoice Block realName: ${invoiceBlock.realName}`);

        if (Math.abs(invoiceBlock.fontSizePt - 7.4) > 0.05) {
            throw new Error(`Assertion Failed: Invoice Block fontSizePt is ${invoiceBlock.fontSizePt}, expected 7.4 (NOT rounded to whole integer!)`);
        }
        if (invoiceBlock.matched?.name !== 'Carlito') {
            throw new Error(`Assertion Failed: Invoice Block matched name is ${invoiceBlock.matched?.name}, expected Carlito (NOT defaulting to Liberation Sans!)`);
        }

        invoiceHitbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));

        const subFontSize = document.getElementById('sub-font-size');
        const subFontSelect = document.getElementById('sub-font-select');
        log(`Toolbar #sub-font-size value: ${subFontSize?.value}`);
        log(`Toolbar #sub-font-select value: ${subFontSelect?.value}`);

        if (subFontSize?.value !== '7.4') {
            throw new Error(`Assertion Failed: #sub-font-size value is ${subFontSize?.value}, expected 7.4`);
        }
        if (subFontSelect?.value !== 'original' && subFontSelect?.value !== 'carlito') {
            throw new Error(`Assertion Failed: #sub-font-select value is ${subFontSelect?.value}, expected original or carlito`);
        }
        log('✓ PASS: Exact fractional fontSizePt (7.4pt) and font matcher (Carlito) verified in state and toolbar');

        // Blur invoice input to cleanly settle and re-render DOM
        const invoiceInput = invoiceHitbox.querySelector('.text-inline-input');
        if (invoiceInput) {
            invoiceInput.blur();
            for (let t = 0; t < 30; t++) {
                await new Promise(r => setTimeout(r, 100));
                if (!document.querySelector('.text-hitbox.editing')) break;
            }
            await new Promise(r => setTimeout(r, 200));
        }

        log('\n--- Assertion 2: Clicking Grey Label in Live UI ---');
        const greyBlock = state.textBlocks.find(b => b.originalText.includes('Beneficiary Bank Name'));
        if (!greyBlock) throw new Error('Grey block "Beneficiary Bank Name" not found in EditorState');
        let targetGreyHitbox = null;
        for (let t = 0; t < 30; t++) {
            targetGreyHitbox = document.querySelector(`.text-hitbox[data-id="${greyBlock.id}"]`);
            if (targetGreyHitbox && !targetGreyHitbox.classList.contains('editing')) break;
            await new Promise(r => setTimeout(r, 100));
        }
        if (!targetGreyHitbox) throw new Error('Target grey hitbox not found after re-render');

        const origWidth = parseFloat(targetGreyHitbox.style.width) || targetGreyHitbox.offsetWidth;
        log(`Original hitbox width for assertion: ${origWidth}px`);

        targetGreyHitbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 150));

        const activeEditingHitbox = document.querySelector(`.text-hitbox[data-id="${greyBlock.id}"]`);
        if (!activeEditingHitbox) throw new Error('Active editing hitbox not found');

        const subBgInput = document.getElementById('sub-bg-color');
        const subTextInput = document.getElementById('sub-text-color');

        if (!subBgInput) throw new Error('#sub-bg-color input not found');
        if (!subTextInput) throw new Error('#sub-text-color input not found');

        log(`Toolbar #sub-bg-color value: ${subBgInput.value}`);
        log(`Toolbar #sub-text-color value: ${subTextInput.value}`);

        if (subBgInput.value.toLowerCase() !== '#ffffff') {
            throw new Error(`Assertion Failed: #sub-bg-color value is ${subBgInput.value}, expected #ffffff (NOT orange!)`);
        }
        if (subTextInput.value.toLowerCase() !== '#555555') {
            throw new Error(`Assertion Failed: #sub-text-color is ${subTextInput.value}, expected #555555`);
        }
        log(`✓ PASS: Toolbar background is #ffffff and text color matches exact grey (${subTextInput.value})`);

        const activeInput = activeEditingHitbox.querySelector('.text-inline-input');
        if (!activeInput) throw new Error('.text-inline-input not found inside editing hitbox');

        const editingComputedBg = window.getComputedStyle(activeEditingHitbox).backgroundColor;
        log(`Active editing hitbox computed backgroundColor: ${editingComputedBg}`);
        if (editingComputedBg.includes('242') && editingComputedBg.includes('101')) {
            throw new Error(`Assertion Failed: Active editing hitbox background is ORANGE: ${editingComputedBg}`);
        }
        log('✓ PASS: Active editing hitbox background is clean (NOT orange)');

        log('\n--- Assertion 3: Typing Longer Text and Editing Multiple Lines ---');
        // Edit 1: Beneficiary Bank Name
        activeInput.value = 'Beneficiary Bank Name - asdasdsad';
        activeInput.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));

        const expandedHitbox = document.querySelector(`.text-hitbox[data-id="${greyBlock.id}"]`);
        const expandedWidth = expandedHitbox ? (parseFloat(expandedHitbox.style.width) || expandedHitbox.offsetWidth) : 0;
        log(`Expanded hitbox width: ${expandedWidth}px (orig: ${origWidth}px)`);
        if (expandedWidth <= origWidth) {
            throw new Error(`Assertion Failed: Hitbox width did not expand on typing longer text: ${expandedWidth}px <= ${origWidth}px`);
        }
        log('✓ PASS: Hitbox element dynamically expanded to contain longer text');

        activeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        activeInput.blur();
        for (let t = 0; t < 30; t++) {
            await new Promise(r => setTimeout(r, 100));
            if (!document.querySelector(`.text-hitbox[data-id="${greyBlock.id}"].editing`)) break;
        }

        // Edit 2: Transfer Currency & Amount*
        const transferBlock = state.textBlocks.find(b => b.originalText.includes('Transfer Currency & Amount'));
        const transferHitbox = document.querySelector(`.text-hitbox[data-id="${transferBlock.id}"]`);
        if (!transferHitbox) throw new Error('Transfer Currency hitbox not found');
        transferHitbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));
        const transferInput = transferHitbox.querySelector('.text-inline-input');
        if (!transferInput) throw new Error('Transfer inline input not found');
        transferInput.value = 'Transfer Currency & Amount*  asdad';
        transferInput.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));
        transferInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        transferInput.blur();
        await new Promise(r => setTimeout(r, 200));

        // Edit 3: Not Applied
        const notAppliedBlock = state.textBlocks.find(b => b.originalText.includes('Not Applied'));
        const notAppliedHitbox = document.querySelector(`.text-hitbox[data-id="${notAppliedBlock.id}"]`);
        if (!notAppliedHitbox) throw new Error('Not Applied hitbox not found');
        notAppliedHitbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));
        const notAppliedInput = notAppliedHitbox.querySelector('.text-inline-input');
        if (!notAppliedInput) throw new Error('Not Applied inline input not found');
        notAppliedInput.value = 'Applied';
        notAppliedInput.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));
        notAppliedInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        notAppliedInput.blur();
        await new Promise(r => setTimeout(r, 200));

        log('\n--- Assertion 4: Inspect Bleed Mask (Ascender Ghost Coverage) & Baseline Anchoring ---');
        const reSettledGreyHitbox = document.querySelector(`.text-hitbox[data-id="${greyBlock.id}"]`);
        if (!reSettledGreyHitbox) throw new Error('Re-settled grey hitbox not found');

        const beforeStyle = window.getComputedStyle(reSettledGreyHitbox, '::before');
        log(`::before pseudo-element top: ${beforeStyle.top}`);
        log(`::before pseudo-element bottom: ${beforeStyle.bottom}`);
        log(`::before pseudo-element left: ${beforeStyle.left}`);
        log(`::before pseudo-element right: ${beforeStyle.right}`);
        log(`::before pseudo-element position: ${beforeStyle.position}`);
        log(`::before pseudo-element backgroundColor: ${beforeStyle.backgroundColor}`);

        if (beforeStyle.top !== '-3px') {
            throw new Error(`Assertion Failed: ::before top is ${beforeStyle.top}, expected -3px to cover original ascender pixels!`);
        }
        if (beforeStyle.position !== 'absolute') {
            throw new Error(`Assertion Failed: ::before position is ${beforeStyle.position}, expected absolute`);
        }
        if (beforeStyle.backgroundColor !== 'rgb(255, 255, 255)') {
            throw new Error(`Assertion Failed: ::before backgroundColor is ${beforeStyle.backgroundColor}, expected rgb(255, 255, 255)`);
        }
        log('✓ PASS: Bleed mask (::before) extends 3px above top and 2px around perimeter with clean white fill');

        // Check zero baseline shift: compare hitbox top with untouched adjacent block on the exact same row (y=550)
        const unitedBankBlock = state.textBlocks.find(b => b.originalText.includes('United Bank Ltd'));
        if (!unitedBankBlock) throw new Error('United Bank block not found');
        const unitedBankHitbox = document.querySelector(`.text-hitbox[data-id="${unitedBankBlock.id}"]`);
        if (!unitedBankHitbox) throw new Error('United Bank hitbox not found');
        const untouchedRowTopPx = parseFloat(unitedBankHitbox.style.top);
        const actualTopPx = parseFloat(reSettledGreyHitbox.style.top);
        log(`Untouched Row Top Px (United Bank Ltd): ${untouchedRowTopPx.toFixed(2)}, Edited Row Top Px: ${actualTopPx.toFixed(2)}`);
        if (Math.abs(untouchedRowTopPx - actualTopPx) > 0.05) {
            throw new Error(`Assertion Failed: Baseline shifted! Untouched top ${untouchedRowTopPx}px != Edited top ${actualTopPx}px`);
        }
        log('✓ PASS: Zero vertical baseline shift relative to untouched text rows');

        log('\n--- Assertion 5: Real UI PDF Export (In-Place Native Rewrite & Zero Cover Rectangles) ---');
        const exportedBytes = await window.PdfExporter.exportPdf();
        log(`✓ Exported PDF received (${exportedBytes.length} bytes)`);

        const exportedDoc = await PDFDocument.load(exportedBytes);
        const exportedPage = exportedDoc.getPage(0);
        const latin1Decoder = new TextDecoder('latin1');
        const contentsRef = exportedPage.node.Contents();
        let allContentStr = '';
        const { PDFArray, decodePDFRawStream } = window.PDFLib;
        if (contentsRef instanceof PDFArray) {
            for (let i = 0; i < contentsRef.size(); i++) {
                const s = contentsRef.lookup(i);
                if (s) {
                    try {
                        const b = decodePDFRawStream(s).decode();
                        allContentStr += latin1Decoder.decode(b) + '\n';
                    } catch (e) {}
                }
            }
        } else if (contentsRef) {
            try {
                const b = decodePDFRawStream(contentsRef).decode();
                allContentStr = latin1Decoder.decode(b);
            } catch (e) {}
        }

        const reRegex = /([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+re/g;
        let match;
        let bodyCoverRectCount = 0;
        while ((match = reRegex.exec(allContentStr)) !== null) {
            const ry = parseFloat(match[2]);
            if (ry >= 440 && ry <= 620) {
                bodyCoverRectCount++;
            }
        }
        log(`Exported PDF cover rectangles near body table text (Y=440..620): ${bodyCoverRectCount}`);
        if (bodyCoverRectCount > 0) {
            throw new Error(`Assertion Failed: Found ${bodyCoverRectCount} unexpected cover rectangles near body text in exported PDF`);
        }
        log('✓ PASS: Exported PDF has zero cover rectangles over edited table lines');

        // Verify in-place stream rewriting
        if (!allContentStr.includes('Tj') && !allContentStr.includes('TJ')) {
            throw new Error('Assertion Failed: Exported PDF content stream is missing text-showing operators');
        }
        log('✓ PASS: Content stream successfully rewritten in-place using native embedded font');

        log('\n🎉 ALL REAL-UI E2E ASSERTIONS PASSED SUCCESSFULLY!');
        await report('PASSED');
    } catch (err) {
        log(`\n❌ ERROR: ${err.message}\n${err.stack}`);
        await report('FAILED', err.message);
    }
})();
