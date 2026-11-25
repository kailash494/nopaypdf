/**
 * NoPayPDF - Searchable Body-Portal Font Picker Popover (window.NoPayFontPicker)
 *
 * Renders all 40 permissive SIL OFL 1.1 / Apache 2.0 static TrueType fonts
 * across 5 categories plus Recent fonts, Office alias search, live row preview,
 * keyboard navigation, and synced sr-only <select id="sub-font-select">.
 * 100% Client-Side. Permissive MIT / Apache 2.0 compatible.
 */

(function (window, document) {
    'use strict';

    const RECENT_STORAGE_KEY = 'nopaypdf_recent_fonts';
    const CATEGORY_ORDER = [
        'Document & Office',
        'Modern Sans',
        'Classic Serif',
        'Monospace',
        'Handwriting & Display',
    ];

    class FontPickerManager {
        constructor() {
            this.popover = null;
            this.searchInput = null;
            this.listEl = null;
            this.triggerBtn = null;
            this.triggerLabelEl = null;
            this.spinnerEl = null;
            this.selectEl = null;
            this.allowOriginal = true;
            this.currentValue = 'sans';
            this.highlightedIndex = -1;
            this.visibleItems = [];
            this.onSelectCallback = null;
            this._docEventsBound = false;
            this._loadSeq = 0;
        }

        _readRecents() {
            try {
                const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed.filter(k => typeof k === 'string') : [];
            } catch (e) {
                return [];
            }
        }

        _pushRecent(key) {
            if (!key || key === 'original') return;
            try {
                const prev = this._readRecents().filter(k => k !== key);
                prev.unshift(key);
                window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(prev.slice(0, 5)));
            } catch (e) {}
        }

        _populateSelectOptions(selectEl) {
            if (!selectEl || !window.FontManager) return;
            const catalog = window.FontManager.getCatalog();
            const existing = new Set(Array.from(selectEl.options).map(o => o.value));

            if (!existing.has('original')) {
                const opt = document.createElement('option');
                opt.value = 'original';
                opt.textContent = 'Original (Embedded)';
                selectEl.appendChild(opt);
            }
            for (const item of catalog) {
                if (!existing.has(item.key)) {
                    const opt = document.createElement('option');
                    opt.value = item.key;
                    opt.textContent = item.alias ? `${item.cssName} (${item.alias})` : item.cssName;
                    selectEl.appendChild(opt);
                }
            }
        }

        _ensurePopover() {
            if (this.popover) return;

            const pop = document.createElement('div');
            pop.id = 'nopay-font-popover';
            pop.className = 'nopay-font-popover hidden';
            pop.setAttribute('role', 'dialog');
            pop.setAttribute('aria-label', 'Font Family Picker');

            ['mousedown', 'pointerdown', 'click'].forEach(evt => {
                pop.addEventListener(evt, (e) => e.stopPropagation());
            });

            const searchWrap = document.createElement('div');
            searchWrap.className = 'nopay-font-search-wrap';

            const searchLabel = document.createElement('label');
            searchLabel.htmlFor = 'nopay-font-search-input';
            searchLabel.className = 'sr-only';
            searchLabel.textContent = 'Search font families or Office aliases';

            const searchInput = document.createElement('input');
            searchInput.type = 'search';
            searchInput.id = 'nopay-font-search-input';
            searchInput.name = 'nopay-font-search';
            searchInput.className = 'nopay-font-search-input';
            searchInput.placeholder = 'Search 40 fonts (e.g. Calibri, Montserrat, Mono)...';
            searchInput.autocomplete = 'off';
            searchInput.setAttribute('aria-label', 'Search font families');

            searchInput.addEventListener('input', () => {
                this.highlightedIndex = -1;
                this._renderList(searchInput.value);
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.close();
                    this.triggerBtn?.focus();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (this.visibleItems.length > 0) {
                        this.highlightedIndex = (this.highlightedIndex + 1) % this.visibleItems.length;
                        this._syncHighlight();
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (this.visibleItems.length > 0) {
                        this.highlightedIndex = this.highlightedIndex <= 0
                            ? this.visibleItems.length - 1
                            : this.highlightedIndex - 1;
                        this._syncHighlight();
                    }
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const idx = this.highlightedIndex >= 0 ? this.highlightedIndex : 0;
                    const chosen = this.visibleItems[idx];
                    if (chosen) {
                        this.selectKey(chosen.dataset.fontKey, { triggerChange: true });
                    }
                }
            });

            searchWrap.appendChild(searchLabel);
            searchWrap.appendChild(searchInput);
            pop.appendChild(searchWrap);

            const listEl = document.createElement('div');
            listEl.id = 'nopay-font-list';
            listEl.className = 'nopay-font-list';
            listEl.setAttribute('role', 'listbox');
            listEl.setAttribute('aria-label', 'Available font families');
            pop.appendChild(listEl);

            document.body.appendChild(pop);

            this.popover = pop;
            this.searchInput = searchInput;
            this.listEl = listEl;

            if (!this._docEventsBound) {
                this._docEventsBound = true;
                document.addEventListener('mousedown', (e) => {
                    if (!this.isOpen()) return;
                    const clickedTrigger = this.triggerBtn && this.triggerBtn.contains(e.target);
                    if (!clickedTrigger && !this.popover.contains(e.target)) {
                        this.close();
                    }
                });
                window.addEventListener('resize', () => this.reposition());
                const scrollViewport = document.querySelector('.editor-viewport-container');
                if (scrollViewport) {
                    scrollViewport.addEventListener('scroll', () => {
                        if (this.isOpen()) this.close();
                    }, { passive: true });
                }
            }
        }

        bind({ triggerBtn, selectEl, onSelect }) {
            this._ensurePopover();
            this.triggerBtn = typeof triggerBtn === 'string' ? document.getElementById(triggerBtn) : triggerBtn;
            this.selectEl = typeof selectEl === 'string' ? document.getElementById(selectEl) : selectEl;
            this.onSelectCallback = typeof onSelect === 'function' ? onSelect : null;

            if (this.selectEl) {
                this._populateSelectOptions(this.selectEl);
                this.selectEl.addEventListener('change', () => {
                    this.setValue(this.selectEl.value, { load: false });
                });
            }

            if (this.triggerBtn) {
                this.triggerLabelEl = this.triggerBtn.querySelector('.nopay-font-trigger-label');
                this.spinnerEl = document.getElementById('sub-font-loading-spinner');

                if (!this.triggerBtn._nopayFontBound) {
                    this.triggerBtn._nopayFontBound = true;
                    ['mousedown', 'pointerdown'].forEach(evt => {
                        this.triggerBtn.addEventListener(evt, (e) => e.stopPropagation());
                    });
                    this.triggerBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (this.isOpen()) {
                            this.close();
                        } else {
                            this.open();
                        }
                    });
                }
            }

            this.setValue(this.selectEl?.value || 'sans', { load: false });
        }

        setAllowOriginal(allow) {
            this.allowOriginal = Boolean(allow);
            if (this.selectEl) {
                const origOpt = Array.from(this.selectEl.options).find(o => o.value === 'original');
                if (origOpt) origOpt.disabled = !this.allowOriginal;
            }
            if (!this.allowOriginal && this.currentValue === 'original') {
                this.setValue('sans', { load: false });
            }
        }

        setValue(keyOrName, { load = false } = {}) {
            const fm = window.FontManager;
            const resolvedKey = (keyOrName === 'original' && this.allowOriginal)
                ? 'original'
                : (fm ? fm.resolveFontKey(keyOrName) : 'sans');

            this.currentValue = resolvedKey === 'original' && !this.allowOriginal ? 'sans' : resolvedKey;

            if (this.selectEl && this.selectEl.value !== this.currentValue) {
                this.selectEl.value = this.currentValue;
            }

            if (this.triggerLabelEl) {
                if (this.currentValue === 'original') {
                    this.triggerLabelEl.textContent = 'Original (Embedded)';
                    this.triggerLabelEl.style.fontFamily = '';
                } else {
                    const entry = fm?.getFontEntry(this.currentValue);
                    this.triggerLabelEl.textContent = entry ? entry.cssName : 'Liberation Sans';
                    this.triggerLabelEl.style.fontFamily = entry ? `"${entry.cssName}", "Liberation Sans", sans-serif` : '';
                }
            }

            if (this.triggerBtn) {
                this.triggerBtn.dataset.fontKey = this.currentValue;
            }

            if (load && this.currentValue !== 'original' && fm) {
                this._loadFontVariantWithSpinner(this.currentValue);
            }
        }

        async _loadFontVariantWithSpinner(key, opts = {}) {
            const fm = window.FontManager;
            if (!fm || key === 'original') return null;
            const seq = ++this._loadSeq;
            if (this.spinnerEl) this.spinnerEl.classList.remove('hidden');
            try {
                const result = await fm.ensureFontLoaded(key, opts);
                if (seq === this._loadSeq && result && result.cssName && this.triggerLabelEl && this.currentValue === key) {
                    this.triggerLabelEl.style.fontFamily = `"${result.cssName}", "Liberation Sans", sans-serif`;
                }
                return result;
            } finally {
                if (seq === this._loadSeq && this.spinnerEl) {
                    this.spinnerEl.classList.add('hidden');
                }
            }
        }

        async selectKey(key, { triggerChange = true } = {}) {
            this._pushRecent(key);
            this.setValue(key, { load: false });
            this.close();

            if (triggerChange && this.selectEl) {
                this.selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (triggerChange && typeof this.onSelectCallback === 'function') {
                this.onSelectCallback(this.currentValue);
            }
            if (key !== 'original') {
                await this._loadFontVariantWithSpinner(key);
            }
        }

        _createOptionButton(item) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'nopay-font-option';
            btn.dataset.fontKey = item.key;
            btn.setAttribute('role', 'option');
            const isSelected = this.currentValue === item.key;
            btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
            if (isSelected) btn.classList.add('active');

            const mainCol = document.createElement('div');
            mainCol.className = 'nopay-font-option-main';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'nopay-font-option-name';
            nameSpan.textContent = item.cssName;
            if (item.cssName !== 'Original (Embedded)') {
                nameSpan.style.fontFamily = `"${item.cssName}", "Liberation Sans", sans-serif`;
            }

            mainCol.appendChild(nameSpan);

            if (item.alias) {
                const aliasSpan = document.createElement('span');
                aliasSpan.className = 'nopay-font-option-alias';
                aliasSpan.textContent = item.alias;
                mainCol.appendChild(aliasSpan);
            }

            const rightCol = document.createElement('span');
            rightCol.className = 'nopay-font-option-check';
            rightCol.textContent = isSelected ? '✓' : '';

            btn.appendChild(mainCol);
            btn.appendChild(rightCol);

            btn.addEventListener('mouseenter', () => {
                if (item.key !== 'original' && !item.isLocal) {
                    window.FontManager?.ensureFontLoaded(item.key, { silent: true });
                }
            });

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectKey(item.key, { triggerChange: true });
            });

            return btn;
        }

        _renderList(queryRaw = '') {
            if (!this.listEl || !window.FontManager) return;
            this.listEl.innerHTML = '';
            this.visibleItems = [];

            const q = String(queryRaw || '').trim().toLowerCase();
            const catalog = window.FontManager.getCatalog();
            const byKey = new Map(catalog.map(c => [c.key, c]));

            const matchesQuery = (item) => {
                if (!q) return true;
                const haystack = [
                    item.cssName,
                    item.alias || '',
                    item.category || '',
                    ...(item.aliases || []),
                ].join(' ').toLowerCase();
                return haystack.includes(q);
            };

            // Pin Original (Embedded) at top when editing existing PDF text
            if (this.allowOriginal) {
                const origItem = {
                    key: 'original',
                    cssName: 'Original (Embedded)',
                    alias: 'Preserve source PDF font glyphs',
                    aliases: ['original', 'embedded', 'default'],
                    category: 'Document',
                    isLocal: true,
                };
                if (matchesQuery(origItem)) {
                    const btn = this._createOptionButton(origItem);
                    this.listEl.appendChild(btn);
                    this.visibleItems.push(btn);
                }
            }

            // Recent Fonts Section (only when search query is empty)
            if (!q) {
                const recents = this._readRecents().map(k => byKey.get(k)).filter(Boolean);
                if (recents.length > 0) {
                    const hdr = document.createElement('div');
                    hdr.className = 'nopay-font-category-hdr';
                    hdr.textContent = 'Recent';
                    this.listEl.appendChild(hdr);
                    for (const item of recents) {
                        const btn = this._createOptionButton(item);
                        this.listEl.appendChild(btn);
                        this.visibleItems.push(btn);
                    }
                }
            }

            // Grouped Categories
            for (const category of CATEGORY_ORDER) {
                const entries = catalog.filter(c => c.category === category && matchesQuery(c));
                if (entries.length === 0) continue;

                const hdr = document.createElement('div');
                hdr.className = 'nopay-font-category-hdr';
                hdr.textContent = category;
                this.listEl.appendChild(hdr);

                for (const item of entries) {
                    const btn = this._createOptionButton(item);
                    this.listEl.appendChild(btn);
                    this.visibleItems.push(btn);
                }
            }

            if (this.visibleItems.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'nopay-font-empty';
                empty.textContent = `No fonts matching "${queryRaw.trim()}"`;
                this.listEl.appendChild(empty);
            } else {
                this._syncHighlight();
            }
        }

        _syncHighlight() {
            this.visibleItems.forEach((el, idx) => {
                const isHl = idx === this.highlightedIndex;
                el.classList.toggle('is-highlighted', isHl);
                if (isHl) {
                    el.scrollIntoView({ block: 'nearest' });
                }
            });
        }

        open() {
            this._ensurePopover();
            if (window.NoPayColorPicker?.isOpen()) {
                window.NoPayColorPicker.close();
            }
            this.searchInput.value = '';
            this.highlightedIndex = -1;
            this._renderList('');

            this.popover.classList.remove('hidden');
            if (this.triggerBtn) this.triggerBtn.setAttribute('aria-expanded', 'true');
            this.reposition();
            this.searchInput.focus();
        }

        reposition() {
            if (!this.isOpen() || !this.triggerBtn) return;
            const rect = this.triggerBtn.getBoundingClientRect();
            const popRect = this.popover.getBoundingClientRect();
            const popW = popRect.width || 276;
            const popH = popRect.height || 340;

            let left = rect.left;
            left = Math.max(8, Math.min(window.innerWidth - popW - 8, left));

            let top = rect.bottom + 6;
            if (top + popH > window.innerHeight - 8 && rect.top - popH - 6 >= 8) {
                top = rect.top - popH - 6;
            }

            this.popover.style.left = `${Math.round(left)}px`;
            this.popover.style.top = `${Math.round(top)}px`;
        }

        isOpen() {
            return Boolean(this.popover && !this.popover.classList.contains('hidden'));
        }

        close() {
            if (this.popover) {
                this.popover.classList.add('hidden');
            }
            if (this.triggerBtn) {
                this.triggerBtn.setAttribute('aria-expanded', 'false');
            }
        }
    }

    window.NoPayFontPicker = new FontPickerManager();
})(window, document);
