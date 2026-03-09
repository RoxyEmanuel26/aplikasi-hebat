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
const { waitUntilOperationalHour, getVisitDelay } = require('./utils/trafficScheduler');
const { canUseProxy, waitForProxy, recordProxyUsage, getProxyStats } = require('./utils/proxyRateLimiter');

// Global Error Handlers untuk mencegah crash bot akibat unhandled promise (contoh: dari stealth plugin pada tab popunder yg tertutup cepat)
process.on('unhandledRejection', (reason, promise) => {
    const errorMsg = reason ? String(reason.stack || reason.message || reason) : '';
    const ignoreKeywords = [
        'Requesting main frame too early',
        'Session closed',
        'TargetCloseError',
        'Protocol error',
        'Execution context was destroyed'
    ];

    if (ignoreKeywords.some(kw => errorMsg.includes(kw))) {
        // Abaikan error internal Puppeteer/Stealth yang harmless ini
        return;
    }
    console.error('[Global Error] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
    const errorMsg = err ? String(err.stack || err.message || err) : '';
    const ignoreKeywords = [
        'Requesting main frame too early',
        'Session closed',
        'TargetCloseError',
        'Protocol error',
        'Execution context was destroyed',
        'detached Frame',
        'detached frame',
    ];
    if (ignoreKeywords.some(kw => errorMsg.includes(kw))) return;
    console.error('[Global Error] Uncaught Exception:', err);
});

// ========== TEST MODE OVERRIDE ==========
if (config.TEST_MODE) {
    console.log('');
    console.log('[TEST MODE] ⚠️  Mode Testing Aktif — Config di-override:');
    config.TOTAL_VISITS = 15;
    config.MAX_CONCURRENCY = 5;
    config.HEADLESS = false;
    config.CTR_TARGET = 1.0;
    config.POPUNDER_ENABLED = true;
    console.log('[TEST MODE] TOTAL_VISITS    = 15');
    console.log('[TEST MODE] MAX_CONCURRENCY = 5');
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

    // ========== 3. Cek Jadwal Operasional ==========
    await waitUntilOperationalHour(config);
    console.log('[Scheduler] Dalam jam operasional. Bot mulai berjalan...');

    // ========== 4. Launch Cluster ==========

    // array proxyList di returns dari createCluster
    const { cluster, proxyList } = await createCluster(puppeteer);

    console.log(`[Proxy] Berhasil mendapatkan ${proxyList.length} proxy aktif`);

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

    // ========== 6. Queue Semua Visits (dengan Rate Limiting) ==========

    for (let i = 1; i <= totalVisits; i++) {
        // Cari proxy yang masih bisa dipakai (belum melebihi VISITS_PER_IP)
        let proxyTarget = null;
        let attempts = 0;
        while (!proxyTarget && attempts < proxyList.length) {
            const candidate = proxyList[(i - 1 + attempts) % proxyList.length];
            if (canUseProxy(candidate.host, candidate.port, config)) {
                proxyTarget = candidate;
            }
            attempts++;
        }

        // Jika semua proxy sudah habis limit, log warning dan skip
        if (!proxyTarget) {
            console.warn(`[RateLimit] Semua proxy sudah mencapai VISITS_PER_IP. Visit #${i} dilewati.`);
            continue;
        }

        // Tambah delay visit sesuai jam (peak/off-peak)
        const visitDelay = getVisitDelay(config);
        await new Promise(r => setTimeout(r, visitDelay));

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
