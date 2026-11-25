/**
 * NoPayPDF - Unified Rich Color Picker Popover (window.NoPayColorPicker)
 *
 * Mounts as a single position:fixed portal on document.body (z-index >= 95) so
 * horizontally scrollable sub-toolbars never clip it. Provides 20 curated
 * swatches, optional clear/auto/transparent action, native color wheel, and #HEX input.
 * 100% Client-Side. Permissive MIT / Apache 2.0 compatible.
 */

(function (window, document) {
    'use strict';

    const SWATCHES = [
        '#000000', '#334155', '#64748b', '#cbd5e1', '#ffffff',
        '#dc2626', '#e11d48', '#ea580c', '#d97706', '#eab308',
        '#fef08a', '#16a34a', '#bbf7d0', '#0d9488', '#06b6d4',
        '#2563eb', '#bfdbfe', '#4f46e5', '#9333ea', '#fbcfe8',
    ];

    function normalizeHex(raw) {
        if (!raw || typeof raw !== 'string') return null;
        let hex = raw.trim().replace(/^#/, '');
        if (/^[0-9a-fA-F]{3}$/.test(hex)) {
            hex = hex.split('').map(c => c + c).join('');
        }
        if (/^[0-9a-fA-F]{6}$/.test(hex)) {
            return `#${hex.toLowerCase()}`;
        }
        return null;
    }

    class ColorPickerManager {
        constructor() {
            this.popover = null;
            this.clearRow = null;
            this.clearBtn = null;
            this.swatchButtons = [];
            this.nativeInput = null;
            this.hexInput = null;
            this.bindings = new Map();
            this.activeBinding = null;
            this._docEventsBound = false;
        }

        _ensurePopover() {
            if (this.popover) return;

            const pop = document.createElement('div');
            pop.id = 'nopay-color-popover';
            pop.className = 'nopay-color-popover hidden';
            pop.setAttribute('role', 'dialog');
            pop.setAttribute('aria-label', 'Color Picker');

            pop.addEventListener('mousedown', (e) => e.stopPropagation());
            pop.addEventListener('pointerdown', (e) => e.stopPropagation());
            pop.addEventListener('click', (e) => e.stopPropagation());

            // Optional clear/auto action row
            const clearRow = document.createElement('div');
            clearRow.className = 'nopay-color-clear-row hidden';
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'nopay-color-clear-btn';
            clearBtn.dataset.nopayClear = 'true';
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.activeBinding) return;
                const b = this.activeBinding;
                if (typeof b.onClear === 'function') {
                    b.onClear();
                }
                this.syncVisualState(b);
                this.close();
            });
            clearRow.appendChild(clearBtn);
            pop.appendChild(clearRow);

            // 5x4 curated 20-swatch grid
            const grid = document.createElement('div');
            grid.className = 'nopay-swatch-grid';
            this.swatchButtons = [];
            for (const color of SWATCHES) {
                const sw = document.createElement('button');
                sw.type = 'button';
                sw.className = 'nopay-color-swatch';
                sw.dataset.color = color;
                sw.title = color.toUpperCase();
                sw.setAttribute('aria-label', `Color ${color}`);
                sw.style.backgroundColor = color;
                if (color === '#ffffff' || color === '#fef08a') {
                    sw.classList.add('nopay-swatch-light');
                }
                sw.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._applyColor(color, true);
                });
                grid.appendChild(sw);
                this.swatchButtons.push(sw);
            }
            pop.appendChild(grid);

            // Custom Color Wheel + #HEX Input Row
            const customRow = document.createElement('div');
            customRow.className = 'nopay-custom-row';

            const nativeWrap = document.createElement('label');
            nativeWrap.className = 'nopay-native-wrap';
            nativeWrap.title = 'Custom Color Wheel';
            const nativeInput = document.createElement('input');
            nativeInput.type = 'color';
            nativeInput.id = 'nopay-popover-native-color';
            nativeInput.className = 'nopay-popover-native';
            nativeInput.setAttribute('aria-label', 'Custom Color Picker');
            nativeInput.addEventListener('input', (e) => {
                this._applyColor(e.target.value, false);
            });
            const wheelIcon = document.createElement('span');
            wheelIcon.className = 'nopay-wheel-badge';
            wheelIcon.title = 'Custom Color';
            nativeWrap.appendChild(nativeInput);
            nativeWrap.appendChild(wheelIcon);

            const hexInput = document.createElement('input');
            hexInput.type = 'text';
            hexInput.id = 'nopay-popover-hex-input';
            hexInput.className = 'nopay-popover-hex';
            hexInput.maxLength = 7;
            hexInput.placeholder = '#2563EB';
            hexInput.setAttribute('aria-label', 'Hex Color Code');
            hexInput.addEventListener('input', (e) => {
                const norm = normalizeHex(e.target.value);
                if (norm) {
                    this._applyColor(norm, false, true);
                }
            });
            hexInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const norm = normalizeHex(hexInput.value);
                    if (norm) this._applyColor(norm, true);
                    else this.close();
                } else if (e.key === 'Escape') {
                    this.close();
                }
            });

            customRow.appendChild(nativeWrap);
            customRow.appendChild(hexInput);
            pop.appendChild(customRow);

            document.body.appendChild(pop);

            this.popover = pop;
            this.clearRow = clearRow;
            this.clearBtn = clearBtn;
            this.nativeInput = nativeInput;
            this.hexInput = hexInput;

            if (!this._docEventsBound) {
                this._docEventsBound = true;
                document.addEventListener('mousedown', (e) => {
                    if (!this.isOpen()) return;
                    const clickedTrigger = this.activeBinding && this.activeBinding.triggerBtn.contains(e.target);
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

        _applyColor(rawHex, shouldClose = false, preserveHexInput = false) {
            if (!this.activeBinding) return;
            const norm = normalizeHex(rawHex) || '#2563eb';
            const b = this.activeBinding;
            if (b.inputEl) {
                b.inputEl.value = norm;
            }
            if (this.nativeInput) {
                this.nativeInput.value = norm;
            }
            if (this.hexInput && !preserveHexInput) {
                this.hexInput.value = norm.toUpperCase();
            }
            this._highlightActiveSwatch(norm, false);
            if (typeof b.onChange === 'function') {
                b.onChange(norm);
            }
            this.syncVisualState(b);
            if (shouldClose) {
                this.close();
            }
        }

        _highlightActiveSwatch(hex, isClear) {
            const norm = !isClear ? normalizeHex(hex) : null;
            for (const sw of this.swatchButtons) {
                sw.classList.toggle('active', Boolean(norm && sw.dataset.color === norm));
            }
        }

        bind(config) {
            this._ensurePopover();
            const triggerBtn = typeof config.triggerBtn === 'string'
                ? document.getElementById(config.triggerBtn)
                : config.triggerBtn;
            const inputEl = typeof config.inputEl === 'string'
                ? document.getElementById(config.inputEl)
                : config.inputEl;

            if (!triggerBtn || !inputEl) return null;

            const binding = {
                id: inputEl.id,
                triggerBtn,
                inputEl,
                chipEl: triggerBtn.querySelector('.nopay-trigger-chip'),
                labelEl: triggerBtn.querySelector('.nopay-trigger-label'),
                clearMode: config.clearMode || null, // 'auto' | 'transparent' | 'nofill' | null
                clearLabel: config.clearLabel || 'Clear',
                isClearFn: config.isClearFn || null,
                onChange: config.onChange || null,
                onClear: config.onClear || null,
            };

            this.bindings.set(inputEl.id, binding);
            this.syncVisualState(binding);

            if (!triggerBtn._nopayPickerBound) {
                triggerBtn._nopayPickerBound = true;
                triggerBtn.addEventListener('mousedown', (e) => e.stopPropagation());
                triggerBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.isOpen() && this.activeBinding === binding) {
                        this.close();
                    } else {
                        this.open(binding);
                    }
                });
            }

            return binding;
        }

        syncVisualState(bindingOrId) {
            const b = typeof bindingOrId === 'string' ? this.bindings.get(bindingOrId) : bindingOrId;
            if (!b) return;
            const isClear = typeof b.isClearFn === 'function' ? Boolean(b.isClearFn()) : false;
            const currentHex = normalizeHex(b.inputEl?.value) || '#2563eb';

            if (b.chipEl) {
                if (isClear) {
                    b.chipEl.style.backgroundColor = 'transparent';
                    b.chipEl.classList.add('is-clear');
                } else {
                    b.chipEl.style.backgroundColor = currentHex;
                    b.chipEl.classList.remove('is-clear');
                }
            }
            if (b.labelEl) {
                if (isClear) {
                    b.labelEl.textContent = b.clearLabel || 'None';
                } else {
                    b.labelEl.textContent = currentHex.toUpperCase();
                }
            }
            if (b.triggerBtn && b.triggerBtn.dataset) {
                b.triggerBtn.dataset.colorValue = isClear ? (b.clearMode || 'clear') : currentHex;
            }
        }

        open(binding) {
            this._ensurePopover();
            this.activeBinding = binding;

            const isClear = typeof binding.isClearFn === 'function' ? Boolean(binding.isClearFn()) : false;
            const currentHex = normalizeHex(binding.inputEl?.value) || '#2563eb';

            if (binding.clearMode) {
                this.clearRow.classList.remove('hidden');
                this.clearBtn.textContent = binding.clearLabel || 'Transparent';
                this.clearBtn.classList.toggle('active', isClear);
            } else {
                this.clearRow.classList.add('hidden');
            }

            this.nativeInput.value = currentHex;
            this.hexInput.value = currentHex.toUpperCase();
            this._highlightActiveSwatch(currentHex, isClear);

            this.popover.classList.remove('hidden');
            this.reposition();
        }

        reposition() {
            if (!this.isOpen() || !this.activeBinding) return;
            const rect = this.activeBinding.triggerBtn.getBoundingClientRect();
            const popRect = this.popover.getBoundingClientRect();
            const popW = popRect.width || 216;
            const popH = popRect.height || 210;

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
            this.activeBinding = null;
        }
    }

    window.NoPayColorPicker = new ColorPickerManager();
})(window, document);
