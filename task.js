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
const { createPopunderHandler, removePopunderHandler } = require('./utils/popunderHandler');
const { loadSession, saveSession } = require('./utils/sessionManager');
const { getOrCreateDeviceProfile } = require('./utils/deviceProfile');
const { waitForProxy, recordProxyUsage } = require('./utils/proxyRateLimiter');

// Dynamically import ghost-cursor (ESM module)
let createCursor;

/**
 * Safety net: Tutup semua tab "bocor" yang bukan tab task aktif.
 * Ini mencegah RAM penuh akibat tab iklan yang lolos dari popunderHandler.
 */
async function closeLeakedTabs(page, config) {
    try {
        const browser = page.browser();
        const allPages = await browser.pages();
        for (const tab of allPages) {
            if (tab === page || tab.isClosed()) continue;
            const tabUrl = tab.url();
            // Tutup tab yang bukan tab task aktif dan bukan halaman internal
            if (
                tabUrl !== config.TARGET_URL &&
                tabUrl !== config.HOMEPAGE_URL &&
                !tabUrl.startsWith('chrome') &&
                !tabUrl.startsWith('about:') &&
                tabUrl !== '' &&
                tabUrl !== 'about:blank'
            ) {
                await tab.close().catch(() => { });
                console.log(`     -> [TabSweeper] Tab bocor ditutup: ${tabUrl.substring(0, 60)}`);
            }
        }
    } catch (_) { }
}

/**
 * Task utama per browser instance
 * @param {object} params
 * @param {import('puppeteer').Page} params.page - Puppeteer page
 * @param {object} params.data - Data task (visitId, proxyTarget)
 */
async function runTask({ page, data }) {
    const { visitId, proxyTarget } = data;
    const startTime = Date.now();
    let responseTime = 0;
    let status = 'OK';
    let errorMsg = '';
    let exitType = 'normal';

    // Device profile: konsisten per IP atau random (perilaku lama)
    let viewport, tzInfo;
    if (config.USE_CONSISTENT_DEVICE_PROFILE) {
        const profile = getOrCreateDeviceProfile(proxyTarget.host, proxyTarget.port, config);
        viewport = profile.viewport;
        tzInfo = { timezone: profile.timezone, acceptLanguage: profile.acceptLanguage };
    } else {
        viewport = randomViewport();
        tzInfo = randomTimezone();
    }

    const targetHostPort = `${proxyTarget.host}:${proxyTarget.port}`;

    console.log(`[Task] Visit #${visitId} berjalan menggunakan proxy: ${targetHostPort}`);

    // Variabel popunder handler (akan di-cleanup di finally)
    let popunderHandler = null;
    let getPopunderCount = () => 0;

    try {
        // Tutup tab kosong bawaan Chromium (about:blank) yang selalu muncul saat launch
        try {
            const browser = page.browser();
            const allPages = await browser.pages();
            for (const existingPage of allPages) {
                if (existingPage !== page) {
                    const url = existingPage.url();
                    if (url === 'about:blank' || url === '') {
                        await existingPage.close().catch(() => { });
                    }
                }
            }
        } catch (_) { /* ignore */ }

        // 1. Authenticate proxy (Penting: Lakukan authenticate SEBELUM page.goto dipanggil)
        if (config.USE_PROXY) {
            try {
                const proxyAuth = getProxyAuth();
                if (proxyAuth.username) {
                    await page.authenticate(proxyAuth);
                }
            } catch (err) {
                console.warn(`[Visit #${visitId}] Proxy auth failed: ${err.message}. Skipping task.`);
                throw new Error('Proxy Authentication Failed');
            }
        } else {
            console.log(`[Visit #${visitId}] Proxy dinonaktifkan — berjalan dengan IP asli (Testing Mode)`);
        }

        // Rate limit: tunggu jeda yang diperlukan sebelum visit dari IP ini
        await waitForProxy(proxyTarget.host, proxyTarget.port, config);
        recordProxyUsage(proxyTarget.host, proxyTarget.port);

        // 2. Pasang Popunder Handler (setelah auth, sebelum navigasi pertama)
        if (config.POPUNDER_ENABLED) {
            const browser = page.browser();
            const popunder = createPopunderHandler(browser, visitId, config);
            popunderHandler = popunder.handler;
            getPopunderCount = popunder.getCount;
        }

        // 3. Set viewport acak
        await page.setViewport({
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: viewport.deviceScaleFactor,
            isMobile: viewport.isMobile,
        });

        // 4. Inject fingerprint unik
        try {
            const fingerprint = generateFingerprint();
            await injectFingerprint(page, fingerprint);
        } catch (err) {
            console.warn(`[Visit #${visitId}] Fingerprint warning: ${err.message}`);
        }

        // 5. Spoof canvas/WebGL/audio
        try {
            await spoofCanvasWebGLAudio(page);
        } catch (err) {
            console.warn(`[Visit #${visitId}] Canvas spoof warning: ${err.message}`);
        }

        // 6. Set timezone & Accept-Language
        try {
            await injectTimezone(page, tzInfo.timezone);
            await setAcceptLanguage(page, tzInfo.acceptLanguage);
        } catch (err) {
            console.warn(`[Visit #${visitId}] Timezone warning: ${err.message}`);
        }

        // 7. Set Referer header dari list acak di config
        const selectedReferer = config.REFERERS[Math.floor(Math.random() * config.REFERERS.length)];
        const headersToSet = {
            'Accept-Language': tzInfo.acceptLanguage,
        };
        // Set referer jika bukan direct
        if (selectedReferer !== 'direct') {
            headersToSet['Referer'] = selectedReferer;
        }
        await page.setExtraHTTPHeaders(headersToSet);

        // 8. Inject cookies natural
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

        // 9. Lakukan Cookie Warming
        try {
            await performCookieWarming(page, config.WARMING_URLS, cursor);
        } catch (wErr) {
            /* ignore */
        }

        // 10. Catat waktu mulai navigasi target
        const navStart = Date.now();

        // 10b. Load session persistence SEBELUM navigasi (cookies harus terbawa saat request)
        await loadSession(page, proxyTarget.host, proxyTarget.port, config);

        // 11. Navigasi ke target
        await page.goto(config.HOMEPAGE_URL || config.TARGET_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 25000,
        });

        // 12. Tunggu mediumDelay — simulasi membaca halaman
        await mediumDelay();

        // 13. Micro-interaction: Simulate reading & Highlighting text
        await simulateReading(page, cursor);

        // 14. Scroll ke bawah 200–500px secara natural
        const scrollAmount = Math.floor(Math.random() * 300) + 200;
        await page.evaluate((px) => {
            window.scrollBy({ top: px, left: 0, behavior: 'smooth' });
        }, scrollAmount);

        // 15. Phase 4: Probabilitas melakukan pergerakan Micro Typing di text box.
        if (Math.random() < config.MICRO_TYPING_CHANCE) {
            await simulateMicroTyping(page, cursor);
        }

        // 16. Tunggu idle natural
        await humanDelay();

        // 17. Jika HOMEPAGE_URL diset, lakukan Internal Routing page views sebelum klik iklan
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

        // 18. Phase 4: Terapkan dynamic reading pacing sblm interaksi click banner
        await applyReadingPacing(config.READING_PACE_DISTRIBUTION);

        // Paksa viewport desktop sementara agar banner muncul (hidden lg:flex fix)
        const currentViewport = page.viewport();
        const isMobileViewport = currentViewport && currentViewport.width < 1024;
        if (isMobileViewport) {
            await page.setViewport({
                width: 1280,
                height: 800,
                deviceScaleFactor: 1,
                isMobile: false,
            });
            await new Promise(r => setTimeout(r, 800)); // tunggu reflow CSS
        }

        // 19. Tunggu banner muncul
        await page.waitForSelector(config.BANNER_SELECTOR, { timeout: 30000 });

        // 20. Logika CTR: Hanya klik jika random <= CTR_TARGET
        const shouldClick = Math.random() <= config.CTR_TARGET;

        if (shouldClick) {
            console.log(`     -> [ACTION] Visit #${visitId} MENGKLIK BANNER! (CTR Mode)`);
            try {
                // Pilih secara acak dari semua banner iframe yang match selector
                const bannerElements = await page.$$(config.BANNER_SELECTOR);
                if (bannerElements.length > 0) {
                    const randomBanner = bannerElements[Math.floor(Math.random() * bannerElements.length)];

                    // Phase 4: Hesitation / Mouse Wiggle
                    const box = await randomBanner.boundingBox();
                    if (box) {
                        const overshootX = box.x + box.width + 50 + Math.random() * 40;
                        const overshootY = box.y + box.height / 2;
                        await cursor.moveTo({ x: overshootX, y: overshootY });
                        await humanDelay(300, 800); // ragu 0.5 detik
                    }

                    // Ambil parent wrapper di luar iframe (karena iframe cross-origin tidak bisa diklik langsung)
                    const parentWrapper = await randomBanner.evaluateHandle(
                        el => el.closest('.w-full') || el.closest('aside') || el.parentElement
                    );

                    // Klik parent wrapper dengan ghost-cursor
                    await cursor.click(parentWrapper);
                    await humanDelay(3000, 5000); // Tunggu bentar abis diklik

                    // Dispose handle untuk mencegah memory leak
                    await parentWrapper.dispose();
                }
            } catch (cursorErr) {
                // Fallback ke click koordinat tengah wrapper jika ghost-cursor gagal
                console.warn(`[Visit #${visitId}] Ghost-cursor fallback: ${cursorErr.message}`);
                await page.evaluate((selector) => {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length === 0) return;

                    const randomEl = elements[Math.floor(Math.random() * elements.length)];
                    const wrapper = randomEl.closest('.w-full') || randomEl.closest('aside') || randomEl.parentElement;
                    if (!wrapper) return;

                    const rect = wrapper.getBoundingClientRect();
                    const clickX = rect.left + rect.width / 2;
                    const clickY = rect.top + rect.height / 2;
                    const targetEl = document.elementFromPoint(clickX, clickY);
                    if (targetEl) targetEl.click();
                }, config.BANNER_SELECTOR);
            }
        } else {
            console.log(`     -> [ACTION] Visit #${visitId} Impression Organik (Skip Banner)`);
        }

        // Kembalikan viewport ke mobile setelah urusan klik banner selesai
        if (isMobileViewport && currentViewport) {
            await page.setViewport(currentViewport).catch(() => { });
        }

        // 21. Tunggu popunder selesai diproses (beri waktu handler menyelesaikan simulasi)
        if (config.POPUNDER_ENABLED && getPopunderCount() > 0) {
            console.log(`     -> [Popunder #${visitId}] Menunggu ${getPopunderCount()} popunder selesai diproses...`);
            await humanDelay(2000, 4000);
        }

        // Sapu bersih tab bocor sebelum exit
        await closeLeakedTabs(page, config);

        // Exit behavior realistis
        const rand = Math.random();

        if (rand < config.EXIT_BOUNCE_CHANCE) {
            exitType = 'bounce';
            console.log(`     -> [EXIT] Visit #${visitId} Bounce langsung`);

        } else if (rand < config.EXIT_BOUNCE_CHANCE + config.EXIT_CLICK_BACK_CHANCE) {
            exitType = 'back';
            console.log(`     -> [EXIT] Visit #${visitId} Klik tombol Back`);
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => { });
            await humanDelay(1000, 3000);

        } else if (rand < config.EXIT_BOUNCE_CHANCE + config.EXIT_CLICK_BACK_CHANCE + config.EXIT_SCROLL_BOTTOM_CHANCE) {
            exitType = 'scroll';
            console.log(`     -> [EXIT] Visit #${visitId} Scroll sampai bawah`);
            await page.evaluate(() => {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            });
            await humanDelay(2000, 5000);

        } else {
            exitType = 'normal';
            console.log(`     -> [EXIT] Visit #${visitId} Normal exit`);
        }

        // 22. Catat response time
        responseTime = Date.now() - navStart;

        // 23. Screenshot jika diaktifkan
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
    } finally {
        // Sapu bersih tab bocor terakhir kali
        await closeLeakedTabs(page, config);

        // Simpan session sebelum cleanup
        try {
            await saveSession(page, proxyTarget.host, proxyTarget.port, config);
        } catch (_) { /* ignore */ }

        // KRITIS: Bersihkan popunder handler untuk mencegah memory leak
        if (popunderHandler) {
            const browser = page.browser();
            removePopunderHandler(browser, popunderHandler);
        }
    }

    // 24. Log hasil ke CSV via logger (termasuk popunder count + exit type)
    logVisit({
        visitId,
        responseTime,
        proxy: targetHostPort,
        viewport: viewport.label,
        status,
        error: errorMsg,
        popunderCount: getPopunderCount(),
        exitType,
    });
}

module.exports = { runTask };
