/**
 * index.js — Entry point utama Website Load Testing Bot
 * Meregistrasi semua plugin anti-detection, meluncurkan cluster,
 * dan menjalankan semua task kunjungan.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AnonymizeUAPlugin = require('puppeteer-extra-plugin-anonymize-ua');
const config = require('./config');
const { createCluster } = require('./cluster');
const { runTask } = require('./task');
const { logProgress, printSummary } = require('./utils/logger');

// ========== TEST MODE OVERRIDE ==========
if (config.TEST_MODE) {
    console.log('');
    console.log('[TEST MODE] ⚠️  Mode Testing Aktif — Config di-override:');
    config.TOTAL_VISITS = 5;
    config.MAX_CONCURRENCY = 2;
    config.HEADLESS = false;
    config.CTR_TARGET = 1.0;
    config.POPUNDER_ENABLED = true;
    console.log('[TEST MODE] TOTAL_VISITS    = 5');
    console.log('[TEST MODE] MAX_CONCURRENCY = 2');
    console.log('[TEST MODE] HEADLESS        = false (browser terlihat)');
    console.log('[TEST MODE] CTR_TARGET      = 1.0 (100% klik banner)');
    console.log('[TEST MODE] POPUNDER_ENABLED = true');
    console.log('');
}
// ========== END TEST MODE OVERRIDE ==========

async function main() {
    console.log('');
    console.log(`[Bot Started] Target: ${config.TARGET_URL} | Total Visits: ${config.TOTAL_VISITS} | Concurrency: ${config.MAX_CONCURRENCY}`);
    console.log('');

    // ========== 1. Startup Check & Fetch Proxy ==========
    if (config.USE_PROXY) {
        console.log('[Bot Starting] Memeriksa koneksi ke 9Proxy API...');

        try {
            const { checkProxyAPI } = require('./proxy/proxyManager');
            await checkProxyAPI();
        } catch (err) {
            console.error(`[Fatal Error] ${err.message}`);
            process.exit(1);
        }

        console.log('[Bot Ready] 9Proxy API aktif. Mengambil daftar proxy...');
    } else {
        console.log('[Bot Starting] USE_PROXY = false — Melewati pengecekan 9Proxy API');
    }

    // ========== 2. Pasang Plugin Anti-Detection ==========

    // StealthPlugin — sembunyikan navigator.webdriver dan passing deteksi bot
    puppeteer.use(StealthPlugin());

    // AnonymizeUA — anonymize User-Agent, set ke Windows-style UA
    puppeteer.use(AnonymizeUAPlugin({ makeWindows: true }));

    // ========== 3. Launch Cluster ==========

    // array proxyList di returns dari createCluster
    const { cluster, proxyList } = await createCluster(puppeteer);

    console.log(`[Proxy] Berhasil mendapatkan ${proxyList.length} proxy aktif dari 9Proxy`);

    // ========== 4. Definisikan Task Handler ==========

    let completedVisits = 0;
    const totalVisits = config.TOTAL_VISITS;

    await cluster.task(async ({ page, data }) => {
        await runTask({ page, data });

        // Update progress counter
        completedVisits++;
        if (completedVisits % 100 === 0 || completedVisits === totalVisits) {
            logProgress(completedVisits, totalVisits);
        }
    });

    // ========== 5. Queue Semua Visits ==========

    for (let i = 1; i <= totalVisits; i++) {
        // Round-robin index assign proxy
        const proxyIndex = (i - 1) % proxyList.length;
        const proxyTarget = proxyList[proxyIndex];
        cluster.queue({ visitId: i, proxyTarget });
    }

    // ========== 6. Tunggu Semua Selesai ==========

    await cluster.idle();
    await cluster.close();

    // ========== 7. Tampilkan Summary ==========

    printSummary();

    console.log('');
    console.log('[Bot Finished] All visits completed.');
}

// Jalankan dan handle error global
main().catch((err) => {
    console.error('[Fatal Error]', err.message);
    process.exit(1);
});
