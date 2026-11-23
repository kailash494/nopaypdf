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

        log('1. Generating realistic Bank e-Receipt PDF with non-zero CropBox, orange header, and grey label...');
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

        // Medium-grey label (#666666) on pure white background
        page.drawText('Beneficiary Bank Name', {
            x: 50,
            y: 450,
            size: 12,
            color: rgb(102 / 255, 102 / 255, 102 / 255),
        });

        // Black value text (#000000) on pure white background
        page.drawText('Chase Bank NA', {
            x: 50,
            y: 420,
            size: 12,
            color: rgb(0, 0, 0),
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
            if (hitboxes.length >= 2) break;
        }

        if (hitboxes.length < 2) {
            throw new Error(`Timed out waiting for .text-hitbox elements. Found: ${hitboxes.length}`);
        }
        log(`✓ Found ${hitboxes.length} text hitbox elements in live DOM`);

        // Find the grey label hitbox by matching block text
        const state = window.EditorState.getActivePage();
        if (!state) throw new Error('Active page state not found in EditorState');

        const greyBlock = state.textBlocks.find(b => b.originalText.includes('Beneficiary Bank Name'));
        const blackBlock = state.textBlocks.find(b => b.originalText.includes('Chase Bank NA'));

        if (!greyBlock) throw new Error('Grey block "Beneficiary Bank Name" not found in EditorState');
        if (!blackBlock) throw new Error('Black block "Chase Bank NA" not found in EditorState');

        const greyHitbox = hitboxes.find(el => el.dataset.id === greyBlock.id);
        if (!greyHitbox) throw new Error('Grey label hitbox element not found in DOM');

        log('\n--- Assertion 1: Pre-Edit Extracted State ---');
        log(`Grey Block bgHex: ${greyBlock.bgHex}`);
        log(`Grey Block autoBgHex: ${greyBlock.autoBgHex}`);
        log(`Grey Block colorHex: ${greyBlock.colorHex}`);
        log(`Grey Block hasVectorBg: ${greyBlock.hasVectorBg}`);

        if (greyBlock.bgHex.toLowerCase() !== '#ffffff') {
            throw new Error(`Assertion Failed: greyBlock.bgHex is ${greyBlock.bgHex}, expected #ffffff`);
        }
        if (greyBlock.autoBgHex.toLowerCase() !== '#ffffff') {
            throw new Error(`Assertion Failed: greyBlock.autoBgHex is ${greyBlock.autoBgHex}, expected #ffffff`);
        }
        if (greyBlock.hasVectorBg !== false) {
            throw new Error(`Assertion Failed: greyBlock.hasVectorBg is ${greyBlock.hasVectorBg}, expected false`);
        }
        // Check grey color range
        const grR = parseInt(greyBlock.colorHex.slice(1, 3), 16);
        const grG = parseInt(greyBlock.colorHex.slice(3, 5), 16);
        const grB = parseInt(greyBlock.colorHex.slice(5, 7), 16);
        log(`Grey Block detected RGB: (${grR}, ${grG}, ${grB})`);

        if (greyBlock.colorHex === '#000000' || greyBlock.colorHex === '#1e293b') {
            throw new Error(`Assertion Failed: Grey label colorHex defaulted to black: ${greyBlock.colorHex}`);
        }
        if (Math.abs(grR - 102) > 20 || Math.abs(grG - 102) > 20 || Math.abs(grB - 102) > 20) {
            throw new Error(`Assertion Failed: Grey label colorHex (${greyBlock.colorHex}) is not close to #666666`);
        }
        log('✓ PASS: Grey label Auto background is #FFFFFF and text color matches #666666');

        log('\n--- Assertion 2: Clicking Grey Label in Live UI ---');
        const origWidth = greyHitbox.offsetWidth;
        log(`Original hitbox offsetWidth: ${origWidth}px`);

        greyHitbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));

        const subBgInput = document.getElementById('sub-bg-color');
        const subTextInput = document.getElementById('sub-text-color');

        if (!subBgInput) throw new Error('#sub-bg-color input not found');
        if (!subTextInput) throw new Error('#sub-text-color input not found');

        log(`Toolbar #sub-bg-color value: ${subBgInput.value}`);
        log(`Toolbar #sub-text-color value: ${subTextInput.value}`);

        if (subBgInput.value.toLowerCase() !== '#ffffff') {
            throw new Error(`Assertion Failed: #sub-bg-color value is ${subBgInput.value}, expected #ffffff (NOT orange!)`);
        }
        if (subTextInput.value === '#000000' || subTextInput.value === '#1e293b') {
            throw new Error(`Assertion Failed: #sub-text-color defaulted to black: ${subTextInput.value}`);
        }
        log('✓ PASS: Toolbar background is #ffffff and text color matches grey');

        const activeInput = greyHitbox.querySelector('.text-inline-input');
        if (!activeInput) throw new Error('.text-inline-input not found inside editing hitbox');

        const editingComputedBg = window.getComputedStyle(greyHitbox).backgroundColor;
        log(`Active editing hitbox computed backgroundColor: ${editingComputedBg}`);
        // Ensure computed bg is white or transparent, NEVER orange (e.g. rgb(242, 101, 34))
        if (editingComputedBg.includes('242') && editingComputedBg.includes('101')) {
            throw new Error(`Assertion Failed: Active editing hitbox background is ORANGE: ${editingComputedBg}`);
        }
        log('✓ PASS: Active editing hitbox background is clean (NOT orange)');

        log('\n--- Assertion 3: Typing Longer Text (" asd") and Dynamic Width Expansion ---');
        activeInput.value = 'Beneficiary Bank Name asd';
        activeInput.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));

        const expandedWidth = greyHitbox.offsetWidth;
        log(`Expanded hitbox offsetWidth: ${expandedWidth}px (orig: ${origWidth}px)`);
        if (expandedWidth <= origWidth) {
            throw new Error(`Assertion Failed: Hitbox width did not expand on typing longer text: ${expandedWidth}px <= ${origWidth}px`);
        }
        log('✓ PASS: Hitbox element dynamically expanded to contain longer text');

        log('\n--- Assertion 4: Blur / Settle Modified Block ---');
        activeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        activeInput.blur();

        // Re-query settled hitbox after renderPage finishes
        let settledHitbox = null;
        for (let t = 0; t < 30; t++) {
            await new Promise(r => setTimeout(r, 150));
            settledHitbox = document.querySelector(`.text-hitbox[data-id="${greyBlock.id}"]`);
            if (settledHitbox && !settledHitbox.classList.contains('editing')) break;
        }
        if (!settledHitbox) {
            const allHitboxes = Array.from(document.querySelectorAll('.text-hitbox')).map(el => `${el.dataset.id} (editing: ${el.classList.contains('editing')})`);
            throw new Error(`Settled hitbox not found in DOM for id ${greyBlock.id}. Existing hitboxes: [${allHitboxes.join(', ')}]`);
        }

        const settledComputedBg = window.getComputedStyle(settledHitbox).backgroundColor;
        log(`Settled hitbox textContent: "${settledHitbox.textContent}"`);
        log(`Settled hitbox computed backgroundColor: ${settledComputedBg}`);
        log(`Settled hitbox offsetWidth: ${settledHitbox.offsetWidth}px`);

        if (settledComputedBg.includes('242') && settledComputedBg.includes('101')) {
            throw new Error(`Assertion Failed: Settled hitbox background is ORANGE: ${settledComputedBg}`);
        }
        if (settledHitbox.offsetWidth <= origWidth + 10) {
            throw new Error(`Assertion Failed: Settled hitbox did not expand for longer text: ${settledHitbox.offsetWidth}px <= ${origWidth}px`);
        }
        log('✓ PASS: Settled hitbox has full expanded width with zero orange background');

        log('\n--- Assertion 5: Real UI PDF Export (Zero Orange Mask Rectangles) ---');
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
        let orangeRectCount = 0;
        while ((match = reRegex.exec(allContentStr)) !== null) {
            const ry = parseFloat(match[2]);
            if (ry >= 400 && ry <= 480) {
                orangeRectCount++;
            }
        }
        log(`Exported PDF rectangles drawn near body text (Y=400..480): ${orangeRectCount}`);
        if (orangeRectCount > 0) {
            throw new Error(`Assertion Failed: Found ${orangeRectCount} unexpected cover rectangles near body text in exported PDF`);
        }
        log('✓ PASS: Exported PDF has zero orange mask rectangles over edited body text');

        log('\n🎉 ALL REAL-UI E2E ASSERTIONS PASSED SUCCESSFULLY!');
        await report('PASSED');
    } catch (err) {
        log(`\n❌ ERROR: ${err.message}\n${err.stack}`);
        await report('FAILED', err.message);
    }
})();
