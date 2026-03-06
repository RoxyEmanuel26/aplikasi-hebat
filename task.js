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
const { performCookieWarming, simulateReading, clickInternalLink, simulateMicroTyping, applyReadingPacing } = require('./utils/behaviors');

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

        // 6. Set Referer header dari list acak di config
        const selectedReferer = config.REFERERS[Math.floor(Math.random() * config.REFERERS.length)];
        const headersToSet = {
            'Accept-Language': tzInfo.acceptLanguage,
        };
        // Set referer jika bukan direct
        if (selectedReferer !== 'direct') {
            headersToSet['Referer'] = selectedReferer;
        }
        await page.setExtraHTTPHeaders(headersToSet);

        // 7. Inject cookies natural
        try {
            await injectCookies(page);
        } catch (err) {
            console.warn(`[Visit #${visitId}] Cookie warning: ${err.message}`);
        }

        // Dynamically load ghost-cursor
        if (!createCursor) {
            const ghostCursor = await import('ghost-cursor');
            createCursor = ghostCursor.createCursor;
        }
        const cursor = createCursor(page);

        // 8. Lakukan Cookie Warming
        try {
            await performCookieWarming(page, config.WARMING_URLS, cursor);
        } catch (wErr) {
            /* ignore */
        }

        // 9. Catat waktu mulai navigasi target
        const navStart = Date.now();

        // 10. Navigasi ke target

        await page.goto(config.HOMEPAGE_URL || config.TARGET_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 25000,
        });

        // 11. Tunggu mediumDelay — simulasi membaca halaman
        await mediumDelay();

        // 12. Micro-interaction: Simulate reading & Highlighting text
        await simulateReading(page, cursor);

        // 13. Scroll ke bawah 200–500px secara natural
        const scrollAmount = Math.floor(Math.random() * 300) + 200;
        await page.evaluate((px) => {
            window.scrollBy({ top: px, left: 0, behavior: 'smooth' });
        }, scrollAmount);

        // 14. Phase 4: Probabilitas melakukan pergerakan Micro Typing di text box.
        if (Math.random() < config.MICRO_TYPING_CHANCE) {
            await simulateMicroTyping(page, cursor);
        }

        // 15. Tunggu idle natural
        await humanDelay();

        // 16. Jika HOMEPAGE_URL diset, lakukan Internal Routing page views sebelum klik iklan
        if (config.HOMEPAGE_URL && config.HOMEPAGE_URL !== config.TARGET_URL) {
            // Coba klik internal link (halaman kedua)
            const clickedInternal = await clickInternalLink(page, cursor, new URL(config.HOMEPAGE_URL).hostname);

            if (clickedInternal) {
                await humanDelay(3000, 8000); // baca bentar
                await simulateReading(page, cursor);
            }

            // Lanjut ke TARGET_URL final
            await page.goto(config.TARGET_URL, {
                waitUntil: 'domcontentloaded',
                timeout: 25000,
            });
            await humanDelay();
        }

        // 17. Phase 4: Terapkan dynamic reading pacing sblm interaksi click banner
        await applyReadingPacing(config.READING_PACE_DISTRIBUTION);

        // 18. Tunggu banner muncul
        await page.waitForSelector(config.BANNER_SELECTOR, { timeout: 15000 });

        // 19. Logika CTR: Hanya klik jika random <= CTR_TARGET
        const shouldClick = Math.random() <= config.CTR_TARGET;

        if (shouldClick) {
            console.log(`     -> [ACTION] Visit #${visitId} MENGKLIK BANNER! (CTR Mode)`);
            try {
                // Pilih secara acak dari semua banner yang match selector
                const bannerElements = await page.$$(config.BANNER_SELECTOR);
                if (bannerElements.length > 0) {
                    const randomBanner = bannerElements[Math.floor(Math.random() * bannerElements.length)];

                    // Phase 4: Hesitation / Mouse Wiggle
                    // overshoot kursor (gerak lewatin target), lalau diam sebentar
                    const box = await randomBanner.boundingBox();
                    if (box) {
                        const overshootX = box.x + box.width + 50 + Math.random() * 40;
                        const overshootY = box.y + box.height / 2;
                        await cursor.moveTo({ x: overshootX, y: overshootY });
                        await humanDelay(300, 800); // ragu 0.5 detik
                    }

                    // Move click aktual
                    await cursor.click(randomBanner);
                    await humanDelay(3000, 5000); // Tunggu bentar abis diklik
                }
            } catch (cursorErr) {
                // Fallback ke click biasa jika ghost-cursor gagal
                console.warn(`[Visit #${visitId}] Ghost-cursor fallback: ${cursorErr.message}`);
                await page.evaluate((selector) => {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        elements[Math.floor(Math.random() * elements.length)].click();
                    }
                }, config.BANNER_SELECTOR);
            }
        } else {
            console.log(`     -> [ACTION] Visit #${visitId} Impression Organik (Skip Banner)`);
        }

        // 17. Catat response time
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
