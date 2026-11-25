/**
 * NoPayPDF - Editor State Module (window.EditorState)
 *
 * Central document state manager: multi-page state, undo/redo history,
 * page management, and multi-page Find & Replace engine.
 * 100% Client-Side. Permissive MIT / Apache 2.0 compatible.
 */

(function (window) {
    'use strict';

    class EditorStateManager {
        constructor() {
            this.pages = [];
            this.activePageIndex = 0;
            this.originalFileName = 'document.pdf';
            this.originalArrayBuffer = null;
            this.undoStack = [];
            this.redoStack = [];
            this.maxHistory = 50;
            this.listeners = new Set();
        }

        reset() {
            this.pages = [];
            this.activePageIndex = 0;
            this.originalFileName = 'document.pdf';
            this.originalArrayBuffer = null;
            this.undoStack = [];
            this.redoStack = [];
            this._notify('reset');
        }

        subscribe(fn) {
            this.listeners.add(fn);
            return () => this.listeners.delete(fn);
        }

        _notify(event, data) {
            for (const fn of this.listeners) {
                try {
                    fn(event, data);
                } catch (e) {
                    console.error('State subscriber error:', e);
                }
            }
        }

        /**
         * Initialize state from loaded PDF page specifications.
         * @param {Array} pagesMeta Array of { widthPt, heightPt, rotation, sourcePageIndex }
         * @param {string} fileName
         * @param {ArrayBuffer} buffer
         * @param {Array} allPagesBlocks Array of extracted text block arrays per page
         */
        initializePages(pagesMeta = [], fileName = 'document.pdf', buffer = null, allPagesBlocks = []) {
            this.reset();
            this.originalFileName = fileName;
            this.originalArrayBuffer = buffer;

            this.pages = pagesMeta.map((p, idx) => ({
                uid: `page-${idx}-${Date.now().toString(36)}`,
                sourcePageIndex: p.sourcePageIndex ?? idx,
                widthPt: p.widthPt || 612,
                heightPt: p.heightPt || 792,
                rotation: p.rotation || 0,
                textBlocks: (allPagesBlocks && allPagesBlocks[idx]) ? allPagesBlocks[idx] : (p.textBlocks || []),
                links: [],
                formFields: [],
                fabricJson: null,
                hasEdits: false,
            }));

            this.activePageIndex = 0;
            this.pushSnapshot('Initial Load');
            this._notify('init');
        }

        getActivePage() {
            return this.pages[this.activePageIndex] || null;
        }

        setActivePageIndex(idx) {
            if (idx >= 0 && idx < this.pages.length && idx !== this.activePageIndex) {
                this.activePageIndex = idx;
                this._notify('page-change', { activePageIndex: idx });
            }
        }

        // ====================================================
        // Page Operations
        // ====================================================

        insertBlankPage(afterIndex = null, dimensions = { widthPt: 612, heightPt: 792 }) {
            const targetIdx = afterIndex === null ? this.pages.length - 1 : afterIndex;
            const newPage = {
                uid: `page-blank-${Date.now().toString(36)}`,
                sourcePageIndex: null, // New blank page
                widthPt: dimensions.widthPt || 612,
                heightPt: dimensions.heightPt || 792,
                rotation: 0,
                textBlocks: [],
                links: [],
                formFields: [],
                fabricJson: null,
                hasEdits: true,
            };

            this.pages.splice(targetIdx + 1, 0, newPage);
            this.activePageIndex = targetIdx + 1;
            this.pushSnapshot('Insert Blank Page');
            this._notify('pages-updated', { reason: 'insert', index: this.activePageIndex });
        }

        deletePage(index = null) {
            const targetIdx = index === null ? this.activePageIndex : index;
            if (this.pages.length <= 1) {
                window.dispatchEvent(new CustomEvent('editor:toast', {
                    detail: { message: 'A PDF must contain at least one page.', type: 'warning' },
                }));
                return false;
            }

            this.pages.splice(targetIdx, 1);
            if (this.activePageIndex >= this.pages.length) {
                this.activePageIndex = this.pages.length - 1;
            }

            this.pushSnapshot('Delete Page');
            this._notify('pages-updated', { reason: 'delete', index: targetIdx });
            return true;
        }

        // ====================================================
        // History & Undo / Redo
        // ====================================================

        pushSnapshot(description = '') {
            // Clone state representation
            const clonedPages = JSON.parse(JSON.stringify(this.pages));
            const top = this.undoStack[this.undoStack.length - 1];
            if (top && JSON.stringify(top.pages) === JSON.stringify(clonedPages) && top.activePageIndex === this.activePageIndex) {
                return;
            }
            const snapshot = {
                desc: description,
                pages: clonedPages,
                activePageIndex: this.activePageIndex,
            };

            this.undoStack.push(snapshot);
            if (this.undoStack.length > this.maxHistory) {
                this.undoStack.shift();
            }
            this.redoStack = []; // Clear forward history
            this._notify('history-change');
        }

        canUndo() {
            return this.undoStack.length > 1;
        }

        canRedo() {
            return this.redoStack.length > 0;
        }

        undo() {
            if (!this.canUndo()) return;
            const current = this.undoStack.pop();
            this.redoStack.push(current);

            const previous = this.undoStack[this.undoStack.length - 1];
            this.pages = JSON.parse(JSON.stringify(previous.pages));
            this.activePageIndex = Math.min(previous.activePageIndex, this.pages.length - 1);

            this._notify('history-change', { action: 'undo' });
            this._notify('render-required');
        }

        redo() {
            if (!this.canRedo()) return;
            const next = this.redoStack.pop();
            this.undoStack.push(next);

            this.pages = JSON.parse(JSON.stringify(next.pages));
            this.activePageIndex = Math.min(next.activePageIndex, this.pages.length - 1);

            this._notify('history-change', { action: 'redo' });
            this._notify('render-required');
        }

        // ====================================================
        // Find & Replace Engine
        // ====================================================

        /**
         * Find all occurrences of query across all pages.
         * @param {string} query
         * @param {Object} options { matchCase: boolean, wholeWord: boolean }
         * @returns {Array} List of matches { pageIndex, blockId, startIdx, endIdx, matchedText }
         */
        findMatches(query = '', options = {}) {
            if (!query || query.trim() === '') return [];
            const { matchCase = false, wholeWord = false } = options;

            const results = [];
            let patternStr = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (wholeWord) {
                patternStr = `\\b${patternStr}\\b`;
            }

            const flags = matchCase ? 'g' : 'gi';
            const regex = new RegExp(patternStr, flags);

            this.pages.forEach((page, pIdx) => {
                for (const block of (page.textBlocks || [])) {
                    if (block.deleted) continue;
                    const text = block.currentText || '';
                    let match;
                    regex.lastIndex = 0;
                    while ((match = regex.exec(text)) !== null) {
                        results.push({
                            pageIndex: pIdx,
                            blockId: block.id,
                            startIdx: match.index,
                            endIdx: match.index + match[0].length,
                            matchedText: match[0],
                        });
                    }
                }
            });

            return results;
        }

        /**
         * Replace a single matched occurrence.
         */
        replaceOne(match, replacement = '') {
            if (!match) return false;
            const page = this.pages[match.pageIndex];
            if (!page) return false;

            const block = page.textBlocks.find(b => b.id === match.blockId);
            if (!block) return false;

            const before = block.currentText.substring(0, match.startIdx);
            const after = block.currentText.substring(match.endIdx);
            block.currentText = before + replacement + after;
            block.modified = true;
            page.hasEdits = true;

            this.pushSnapshot(`Replace "${match.matchedText}" with "${replacement}"`);
            this._notify('render-required');
            return true;
        }

        /**
         * Replace all occurrences across all pages.
         * @returns {number} Count of replacements made
         */
        replaceAll(query = '', replacement = '', options = {}) {
            const matches = this.findMatches(query, options);
            if (matches.length === 0) return 0;

            const { matchCase = false, wholeWord = false } = options;
            let patternStr = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (wholeWord) patternStr = `\\b${patternStr}\\b`;
            const flags = matchCase ? 'g' : 'gi';
            const regex = new RegExp(patternStr, flags);

            let replaceCount = 0;
            this.pages.forEach((page) => {
                for (const block of (page.textBlocks || [])) {
                    if (block.deleted) continue;
                    if (regex.test(block.currentText)) {
                        block.currentText = block.currentText.replace(regex, () => {
                            replaceCount++;
                            return replacement;
                        });
                        block.modified = true;
                        page.hasEdits = true;
                    }
                }
            });

            if (replaceCount > 0) {
                this.pushSnapshot(`Replace All "${query}" (${replaceCount})`);
                this._notify('render-required');
            }
            return replaceCount;
        }
    }

    window.EditorState = new EditorStateManager();
})(window);
