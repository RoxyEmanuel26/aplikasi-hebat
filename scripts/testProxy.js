/**
 * testProxy.js — Test Koneksi Proxy 9Proxy API
 * Script ini digunakan untuk mengetes 5 proxy pertama dari API
 * terhadap website deteksi bot (https://bot.sannysoft.com).
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AnonymizeUAPlugin = require('puppeteer-extra-plugin-anonymize-ua');
const fs = require('fs');
const path = require('path');
const { getProxyList, checkProxyAPI, getProxyAuth, getProxyArgs } = require('../proxy/proxyManager');

puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUAPlugin({ makeWindows: true }));

const TEST_URL = 'https://bot.sannysoft.com';
const MAX_TEST_PROXIES = 5;

async function runTest() {
    console.log('====================================');
    console.log('[Test] Memulai Test Koneksi 9Proxy');
    console.log('====================================\n');

    try {
        await checkProxyAPI();
        console.log('[OK] 9Proxy API aktif dan merespons.');
    } catch (err) {
        console.error(`[FAIL] ${err.message}`);
        process.exit(1);
    }

    const proxyList = await getProxyList();
    console.log(`[OK] Berhasil fetch ${proxyList.length} proxy dari API.\n`);

    const testLimit = Math.min(proxyList.length, MAX_TEST_PROXIES);
    console.log(`[Info] Menjalankan test pada ${testLimit} proxy pertama (Headless: false)...\n`);

    const results = [];
    const screenshotsDir = path.join(__dirname, '..', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    for (let i = 0; i < testLimit; i++) {
        const proxy = proxyList[i];
        const proxyStr = `${proxy.host}:${proxy.port}`;
        console.log(`---> Testing Proxy #${i + 1}: ${proxyStr}`);

        let browser;
        try {
            browser = await puppeteer.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    getProxyArgs(proxy),
                ],
            });

            const page = await browser.newPage();

            const proxyAuth = getProxyAuth();
            if (proxyAuth.username) {
                await page.authenticate(proxyAuth);
            }

            await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

            // Ambil data IP yang terdeteksi di halaman bot.sannysoft.com
            const ip = await page.evaluate(() => {
                const el = document.getElementById('ip-address');
                return el ? el.innerText : 'Unknown API';
            });

            // Ambil score deteksi userAgent (hijau jika Stealth sukses)
            const isBot = await page.evaluate(() => {
                // Cari baris webdriver
                const rows = Array.from(document.querySelectorAll('td'));
                const webdriverRow = rows.find(r => r.textContent.includes('WebDriver'));
                if (webdriverRow) {
                    const statusEl = webdriverRow.nextElementSibling;
                    return statusEl && statusEl.classList.contains('failed') ? 'YES' : 'NO';
                }
                return 'UNKNOWN';
            });

            console.log(`     [Result] Proxy ${proxyStr} → IP: ${ip} | Bot Detected: ${isBot}`);

            const ssPath = path.join(screenshotsDir, `test-proxy-${proxy.port}.png`);
            await page.screenshot({ path: ssPath, fullPage: true });

            results.push({ proxy: proxyStr, ip, isBot, status: "SUCCESS" });

        } catch (err) {
            console.log(`     [Result] Proxy ${proxyStr} → GAGAL (${err.message})`);
            results.push({ proxy: proxyStr, status: "FAILED", error: err.message });
        } finally {
            if (browser) await browser.close();
        }
        console.log('------------------------------------');
    }

    console.log('\n========== TEST SUMMARY ==========');
    console.log(`Total Tested : ${testLimit}`);
    console.log(`Berhasil     : ${results.filter(r => r.status === 'SUCCESS').length}`);
    console.log(`Gagal        : ${results.filter(r => r.status === 'FAILED').length}`);
    console.log('Screenshot disimpan di folder /screenshots');
    console.log('==================================');
}

runTest().catch((err) => {
    console.error('[Fatal Error]', err);
});
