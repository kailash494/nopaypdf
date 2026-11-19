/**
 * PDFToolKit - GDPR & AdSense-Ready Cookie Consent Manager
 * Client-Side Only - Stores choices locally in localStorage
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'pdftoolkit_consent_v1';

    const ConsentManager = {
        getConsent() {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                return stored ? JSON.parse(stored) : null;
            } catch (e) {
                return null;
            }
        },

        saveConsent(preferences) {
            const consentData = {
                essential: true,
                analytics: !!preferences.analytics,
                marketing: !!preferences.marketing,
                timestamp: new Date().toISOString(),
            };
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(consentData));
            } catch (e) {
                console.warn('Could not save consent to localStorage', e);
            }

            this.dispatchUpdate(consentData);
            this.hideBanner();
        },

        acceptAll() {
            this.saveConsent({ analytics: true, marketing: true });
        },

        acceptEssential() {
            this.saveConsent({ analytics: false, marketing: false });
        },

        dispatchUpdate(consentData) {
            const event = new CustomEvent('pdftoolkit:consent-updated', {
                detail: consentData,
            });
            window.dispatchEvent(event);
        },

        showBanner() {
            const banner = document.getElementById('cookie-consent-banner');
            if (banner) {
                banner.classList.remove('hidden');
                banner.classList.add('flex');
            }
        },

        hideBanner() {
            const banner = document.getElementById('cookie-consent-banner');
            if (banner) {
                banner.classList.add('hidden');
                banner.classList.remove('flex');
            }
        },

        openSettings() {
            this.showBanner();
        },

        init() {
            const existing = this.getConsent();
            if (!existing) {
                // Show banner if not yet decided
                this.showBanner();
            } else {
                // Dispatch existing preference
                this.dispatchUpdate(existing);
            }

            // Bind buttons
            const btnAcceptAll = document.getElementById('cookie-accept-all');
            const btnAcceptEssential = document.getElementById('cookie-accept-essential');
            const btnClose = document.getElementById('cookie-banner-close');

            if (btnAcceptAll) {
                btnAcceptAll.addEventListener('click', () => this.acceptAll());
            }
            if (btnAcceptEssential) {
                btnAcceptEssential.addEventListener('click', () => this.acceptEssential());
            }
            if (btnClose) {
                btnClose.addEventListener('click', () => this.acceptEssential());
            }

            // Expose globally
            window.PDFCookieConsent = this;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ConsentManager.init());
    } else {
        ConsentManager.init();
    }
})();
