/**
 * fingerprint.js — Fingerprint generator & injector
 * Menggunakan fingerprint-generator dan fingerprint-injector untuk
 * menghasilkan dan meng-inject fingerprint unik per browser instance.
 */

const { FingerprintGenerator } = require('fingerprint-generator');
const { FingerprintInjector } = require('fingerprint-injector');

// Inisialisasi generator dengan opsi random
const generator = new FingerprintGenerator();

/**
 * Generate fingerprint unik baru
 * Randomisasi: browser type, OS, device
 * @returns {object} Fingerprint data
 */
function generateFingerprint() {
    const fingerprint = generator.getFingerprint({
        browsers: [
            { name: 'chrome', minVersion: 110 },
            { name: 'firefox', minVersion: 110 },
            { name: 'edge', minVersion: 110 },
        ],
        operatingSystems: ['windows', 'macos', 'android'],
        devices: ['desktop', 'mobile'],
        locales: ['en-US', 'en-GB', 'id-ID', 'ja-JP', 'de-DE', 'fr-FR'],
    });

    return fingerprint;
}

/**
 * Inject fingerprint ke halaman browser sebelum navigasi
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {object} fingerprint - Fingerprint data dari generateFingerprint()
 */
async function injectFingerprint(page, fingerprint) {
    try {
        const injector = new FingerprintInjector();
        await injector.attachFingerprintToPuppeteer(page, fingerprint);
    } catch (err) {
        // Fallback: inject minimal fingerprint secara manual jika injector gagal
        console.warn(`[Fingerprint] Injection warning: ${err.message}. Using fallback.`);
        await page.evaluateOnNewDocument((fp) => {
            // Override navigator properties
            if (fp.navigator) {
                Object.defineProperty(navigator, 'platform', { get: () => fp.navigator.platform || 'Win32' });
                Object.defineProperty(navigator, 'vendor', { get: () => fp.navigator.vendor || 'Google Inc.' });
            }
        }, fingerprint);
    }
}

module.exports = {
    generateFingerprint,
    injectFingerprint,
};
