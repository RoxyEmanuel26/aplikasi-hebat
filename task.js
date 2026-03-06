/**
 * task.js — Logic utama yang dijalankan tiap browser instance
 * Setiap instance mensimulasikan satu pengunjung unik dengan:
 * viewport acak, fingerprint unik, timezone random, cookie natural,
 * navigasi natural (homepage dulu), scroll, lalu klik banner.
 */

const config = require('./config');
const { randomViewport } = require('./utils/viewport');
const { mediumDelay, humanDelay } = require('./utils/delay');
const { logVisit } = require('./utils/logger');
const { generateFingerprint, injectFingerprint } = require('./anti-detect/fingerprint');
const { spoofCanvasWebGLAudio } = require('./anti-detect/canvas');
const { randomTimezone, injectTimezone, setAcceptLanguage } = require('./anti-detect/timezone');
const { injectCookies } = require('./anti-detect/cookies');
const { getProxyAuth } = require('./proxy/proxyManager');

// Dynamically import ghost-cursor (ESM module)
let createCursor;

/**
 * Task utama per browser instance
 * @param {object} params
 * @param {import('puppeteer').Page} params.page - Puppeteer page
 * @param {object} params.data - Data task (visitId, proxyTarget)
 */
async function runTask({ page, data }) {
    const { visitId, proxyTarget } = data;
    const viewport = randomViewport();
    const tzInfo = randomTimezone();
    const startTime = Date.now();
    let responseTime = 0;
    let status = 'OK';
    let errorMsg = '';

    const targetHostPort = `${proxyTarget.host}:${proxyTarget.port}`;

    console.log(`[Task] Visit #${visitId} berjalan menggunakan proxy: ${targetHostPort}`);

    try {
        // 1. Authenticate proxy (Penting: Lakukan authenticate SEBELUM page.goto dipanggil)
        try {
            const proxyAuth = getProxyAuth();
            if (proxyAuth.username) {
                await page.authenticate(proxyAuth);
            }
        } catch (err) {
            console.warn(`[Visit #${visitId}] Proxy auth failed: ${err.message}. Skipping task.`);
            throw new Error('Proxy Authentication Failed');
        }

        // 2. Set viewport acak
        await page.setViewport({
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: viewport.deviceScaleFactor,
            isMobile: viewport.isMobile,
        });

        // 3. Inject fingerprint unik
        try {
            const fingerprint = generateFingerprint();
            await injectFingerprint(page, fingerprint);
        } catch (err) {
            console.warn(`[Visit #${visitId}] Fingerprint warning: ${err.message}`);
        }

        // 4. Spoof canvas/WebGL/audio
        try {
            await spoofCanvasWebGLAudio(page);
        } catch (err) {
            console.warn(`[Visit #${visitId}] Canvas spoof warning: ${err.message}`);
        }

        // 5. Set timezone & Accept-Language
        try {
            await injectTimezone(page, tzInfo.timezone);
            await setAcceptLanguage(page, tzInfo.acceptLanguage);
        } catch (err) {
            console.warn(`[Visit #${visitId}] Timezone warning: ${err.message}`);
        }

        // 6. Set Referer header dari Google Search
        await page.setExtraHTTPHeaders({
            'Referer': `https://www.google.com/search?q=${encodeURIComponent(config.WEBSITE_NAME)}`,
            'Accept-Language': tzInfo.acceptLanguage,
        });

        // 7. Inject cookies natural
        try {
            await injectCookies(page);
        } catch (err) {
            console.warn(`[Visit #${visitId}] Cookie warning: ${err.message}`);
        }

        // 8. Catat waktu mulai navigasi
        const navStart = Date.now();

        // 9. Navigasi ke homepage dulu (bukan langsung ke halaman target)
        await page.goto(config.HOMEPAGE_URL || config.TARGET_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 25000,
        });

        // 10. Tunggu mediumDelay — simulasi membaca halaman
        await mediumDelay();

        // 11. Scroll ke bawah 200–500px secara natural
        const scrollAmount = Math.floor(Math.random() * 300) + 200;
        await page.evaluate((px) => {
            window.scrollBy({
                top: px,
                left: 0,
                behavior: 'smooth',
            });
        }, scrollAmount);

        // 12. Tunggu humanDelay
        await humanDelay();

        // 13. Jika HOMEPAGE_URL berbeda dari TARGET_URL, navigasi ke TARGET_URL
        if (config.HOMEPAGE_URL && config.HOMEPAGE_URL !== config.TARGET_URL) {
            await page.goto(config.TARGET_URL, {
                waitUntil: 'domcontentloaded',
                timeout: 25000,
            });
            await humanDelay();
        }

        // 14. Tunggu banner muncul
        await page.waitForSelector(config.BANNER_SELECTOR, { timeout: 15000 });

        // 15. Klik banner menggunakan ghost-cursor untuk gerakan mouse natural
        try {
            if (!createCursor) {
                const ghostCursor = await import('ghost-cursor');
                createCursor = ghostCursor.createCursor;
            }
            const cursor = createCursor(page);
            const bannerElement = await page.$(config.BANNER_SELECTOR);
            if (bannerElement) {
                await cursor.click(bannerElement);
            } else {
                await page.click(config.BANNER_SELECTOR);
            }
        } catch (cursorErr) {
            // Fallback ke click biasa jika ghost-cursor gagal
            console.warn(`[Visit #${visitId}] Ghost-cursor fallback: ${cursorErr.message}`);
            await page.click(config.BANNER_SELECTOR);
        }

        // 16. Catat response time
        responseTime = Date.now() - navStart;

        // 17. Screenshot jika diaktifkan
        if (config.SCREENSHOT_ENABLED) {
            const fs = require('fs');
            const path = require('path');
            const screenshotDir = path.join(__dirname, 'screenshots');
            if (!fs.existsSync(screenshotDir)) {
                fs.mkdirSync(screenshotDir, { recursive: true });
            }
            await page.screenshot({
                path: path.join(screenshotDir, `visit-${visitId}.png`),
                fullPage: false,
            });
        }
    } catch (err) {
        status = 'FAIL';
        errorMsg = err.message || 'Unknown error';
        responseTime = Date.now() - startTime;
    }

    // 18. Log hasil ke CSV via logger
    logVisit({
        visitId,
        responseTime,
        proxy: targetHostPort,
        viewport: viewport.label,
        status,
        error: errorMsg,
    });
}

module.exports = { runTask };
