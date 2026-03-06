/**
 * cookies.js — Cookie injection natural
 * Inject cookie-cookie umum (Google Analytics, dll.) sebelum navigasi
 * agar browser terlihat seperti pengguna yang sudah pernah mengunjungi website.
 */

const config = require('../config');

/**
 * Generate GA client ID yang realistis
 * Format: GA1.2.XXXXXXXXX.XXXXXXXXXX
 * @returns {string}
 */
function generateGAClientId() {
    const rand1 = Math.floor(Math.random() * 900000000) + 100000000; // 9 digit
    const rand2 = Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400 * 30); // timestamp realistis
    return `GA1.2.${rand1}.${rand2}`;
}

/**
 * Generate GA session ID (_gid) yang realistis
 * Format: GA1.2.XXXXXXXXX.XXXXXXXXXX
 * @returns {string}
 */
function generateGASessionId() {
    const rand1 = Math.floor(Math.random() * 900000000) + 100000000;
    const rand2 = Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400);
    return `GA1.2.${rand1}.${rand2}`;
}

/**
 * Mendapatkan domain dari TARGET_URL untuk cookie
 * @returns {string}
 */
function getCookieDomain() {
    try {
        const url = new URL(config.TARGET_URL);
        return url.hostname;
    } catch {
        return 'localhost';
    }
}

/**
 * Inject cookie natural ke page sebelum navigasi
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 */
async function injectCookies(page) {
    const domain = getCookieDomain();
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 86400 * 365; // 1 tahun dari sekarang

    const cookies = [
        {
            name: '_ga',
            value: generateGAClientId(),
            domain: domain,
            path: '/',
            expires: expiry,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
        },
        {
            name: '_gid',
            value: generateGASessionId(),
            domain: domain,
            path: '/',
            expires: now + 86400, // 24 jam
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
        },
        {
            name: 'visited',
            value: 'true',
            domain: domain,
            path: '/',
            expires: expiry,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
        },
        {
            name: '_gat',
            value: '1',
            domain: domain,
            path: '/',
            expires: now + 60, // 1 menit
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
        },
    ];

    try {
        await page.setCookie(...cookies);
    } catch (err) {
        console.warn(`[Cookies] Injection warning: ${err.message}`);
    }
}

module.exports = {
    injectCookies,
    generateGAClientId,
    generateGASessionId,
};
