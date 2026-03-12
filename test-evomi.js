/**
 * test-evomi.js — Script untuk menguji koneksi proxy Evomi
 * Menjalankan 3 browser instance dengan country berbeda,
 * membuka halaman ip.evomi.com untuk verifikasi IP dan lokasi.
 *
 * Jalankan dengan: node test-evomi.js
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const config = require('./config');
const { getEvomiProxyArgs } = require('./proxy/proxyManager');
const { getRandomCountry, getProfileByCountry } = require('./profiles');

puppeteer.use(StealthPlugin());

async function testEvomiProxy() {
    console.log('');
    console.log('==============================================');
    console.log('  EVOMI RESIDENTIAL CORE — PROXY TEST');
    console.log('==============================================');
    console.log(`Endpoint: ${config.EVOMI_ENDPOINT}:${config.EVOMI_PORT}`);
    console.log(`Username: ${config.EVOMI_USERNAME}`);
    console.log(`Session Type: ${config.EVOMI_SESSION_TYPE}`);
    console.log(`Countries: ${config.EVOMI_COUNTRIES.join(', ')}`);
    console.log('');

    const proxyArg = getEvomiProxyArgs();
    const testRounds = 3;

    for (let i = 1; i <= testRounds; i++) {
        const country = getRandomCountry(config.EVOMI_COUNTRIES);
        const profile = getProfileByCountry(country);
        const sessionId = `test${String(i).padStart(3, '0')}`;

        let password = `${config.EVOMI_PASSWORD}_${config.EVOMI_SESSION_TYPE}-${sessionId}_country-${country}_mode-speed`;

        console.log(`--- Test #${i} ---`);
        console.log(`Country: ${country} | Session: ${sessionId}`);
        console.log(`Password: ${password}`);
        console.log(`Profile: ${profile.timezone} | ${profile.language} | ${profile.screen.label}`);

        let browser;
        try {
            browser = await puppeteer.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--ignore-certificate-errors',
                    proxyArg,
                ],
                defaultViewport: {
                    width: profile.screen.width,
                    height: profile.screen.height,
                    deviceScaleFactor: profile.screen.deviceScaleFactor,
                    isMobile: profile.screen.isMobile,
                },
            });

            const page = await browser.newPage();

            // WAJIB: authenticate SEBELUM page.goto()
            await page.authenticate({
                username: config.EVOMI_USERNAME,
                password: password,
            });

            // Set headers sesuai profil negara
            await page.setExtraHTTPHeaders({
                'Accept-Language': profile.language,
            });

            console.log('Navigating to ip.evomi.com/s ...');

            await page.goto('https://ip.evomi.com/s', {
                waitUntil: 'networkidle2',
                timeout: 30000,
            });

            // Ambil IP yang terdeteksi
            const detectedIP = await page.evaluate(() => document.body.innerText.trim());

            console.log(`✅ Detected IP: ${detectedIP}`);
            console.log('');

            // Tunggu sebentar agar bisa dilihat
            await new Promise(r => setTimeout(r, 2000));

        } catch (err) {
            console.error(`❌ Test #${i} GAGAL: ${err.message}`);
            console.log('');

            // Tips debugging
            if (err.message.includes('ERR_PROXY_CONNECTION_FAILED')) {
                console.log('   → Pastikan endpoint Evomi benar (rp.evomi.com:1000)');
            }
            if (err.message.includes('407') || err.message.includes('auth')) {
                console.log('   → Pastikan EVOMI_USERNAME dan EVOMI_PASSWORD sudah diisi di config.js');
            }
            if (err.message.includes('timeout')) {
                console.log('   → Koneksi proxy timeout. Coba lagi atau ganti country.');
            }
        } finally {
            if (browser) {
                await browser.close().catch(() => {});
            }
        }
    }

    console.log('==============================================');
    console.log('  TEST SELESAI');
    console.log('==============================================');
    console.log('');
    console.log('Jika semua test menunjukkan IP berbeda,');
    console.log('proxy Evomi sudah siap digunakan.');
    console.log('');
    console.log('Langkah selanjutnya:');
    console.log('1. Set USE_PROXY = true di config.js');
    console.log('2. Jalankan: node index.js');
    console.log('');
}

testEvomiProxy().catch(err => {
    console.error('[Fatal Error]', err.message);
    process.exit(1);
});
