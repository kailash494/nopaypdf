/**
 * PDFToolKit - GDPR & AdSense-Ready Cookie Consent Manager
 * Client-Side Only - Stores choices locally in localStorage
 * Includes Google Consent Mode v2 support for Google AdSense and Analytics
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'pdftoolkit_consent_v1';

    // Google Consent Mode v2 setup
    window.dataLayer = window.dataLayer || [];
    function gtag() {
        window.dataLayer.push(arguments);
    }

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

            this.updateGoogleConsent(consentData);
            this.dispatchUpdate(consentData);
            this.hideBanner();
        },

        acceptAll() {
            this.saveConsent({ analytics: true, marketing: true });
        },

        acceptEssential() {
            this.saveConsent({ analytics: false, marketing: false });
        },

        updateGoogleConsent(consentData) {
            if (typeof gtag === 'function') {
                gtag('consent', 'update', {
                    ad_storage: consentData.marketing ? 'granted' : 'denied',
                    ad_user_data: consentData.marketing ? 'granted' : 'denied',
                    ad_personalization: consentData.marketing ? 'granted' : 'denied',
                    analytics_storage: consentData.analytics ? 'granted' : 'denied',
                });
            }
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
                // Initialize default denied state for Google Consent Mode v2
                gtag('consent', 'default', {
                    ad_storage: 'denied',
                    ad_user_data: 'denied',
                    ad_personalization: 'denied',
                    analytics_storage: 'denied',
                    wait_for_update: 500,
                });
                // Show banner if not yet decided
                this.showBanner();
            } else {
                // Apply stored consent to Google tags immediately
                this.updateGoogleConsent(existing);
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
