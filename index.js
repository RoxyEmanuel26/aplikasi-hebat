/**
 * index.js — Entry point utama Website Load Testing Bot
 * Meregistrasi semua plugin anti-detection, meluncurkan cluster,
 * dan menjalankan semua task kunjungan.
 *
 * Mendukung 2 mode:
 * - Single Website (mode lama): MULTI_WEBSITE_ENABLED = false
 * - Multi Website Queue: MULTI_WEBSITE_ENABLED = true
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
        'Execution context was destroyed',
        'Failed to open a new tab',
        'Target closed',
        'Connection closed',
        'Network.setUserAgentOverride',
        'setUserAgentOverride',
        'detached Frame',
        'detached frame',
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
        'Failed to open a new tab',
        'Target closed',
        'Connection closed',
        'Network.setUserAgentOverride',
        'setUserAgentOverride',
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
    config.TOTAL_VISITS = 100;
    config.MAX_CONCURRENCY = 25;
    config.HEADLESS = true;
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

/**
 * Menjalankan satu siklus penuh visit ke satu website.
 * Membuat cluster baru, menjalankan semua visit, lalu cleanup.
 *
 * @param {object} siteConfig - Konfigurasi website
 * @param {string} siteConfig.name - Nama website (untuk log)
 * @param {string} siteConfig.targetUrl - URL target utama
 * @param {string|null} siteConfig.homepageUrl - URL homepage (null = sama dengan targetUrl)
 * @param {number} siteConfig.totalVisits - Jumlah visit untuk website ini
 * @param {Array|null} siteConfig.referers - Override referer list (null = pakai config utama)
 * @returns {Promise<{name, targetUrl, totalVisits, completedVisits, success, error, durationMs}>}
 */
async function runWebsite(siteConfig) {
    const siteStartTime = Date.now();

    // Simpan nilai config asal sebelum di-override
    const originalTargetUrl = config.TARGET_URL;
    const originalHomepageUrl = config.HOMEPAGE_URL;
    const originalTotalVisits = config.TOTAL_VISITS;
    const originalReferers = config.REFERERS;

    let completedVisits = 0;

    try {
        // Override config sementara untuk website ini
        config.TARGET_URL = siteConfig.targetUrl;
        config.HOMEPAGE_URL = siteConfig.homepageUrl || siteConfig.targetUrl;
        config.TOTAL_VISITS = siteConfig.totalVisits;
        if (siteConfig.referers) config.REFERERS = siteConfig.referers;

        console.log(`[Site: ${siteConfig.name}] Target: ${config.TARGET_URL} | Visits: ${config.TOTAL_VISITS} | Concurrency: ${config.MAX_CONCURRENCY}`);

        // Launch cluster baru untuk website ini
        const { cluster, proxyList } = await createCluster(puppeteer);

        console.log(`[Proxy] Berhasil mendapatkan ${proxyList.length} proxy aktif`);

        // Definisikan task handler
        const totalVisits = config.TOTAL_VISITS;

        await cluster.task(async ({ page, data }) => {
            await runTask({ page, data });

            // Update progress counter
            completedVisits++;
            if (completedVisits % 100 === 0 || completedVisits === totalVisits) {
                logProgress(completedVisits, totalVisits);
            }
        });

        // Queue semua visits (dengan Rate Limiting)
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

            // [FIX BUG #1 + #2] Sertakan targetUrl, homepageUrl, dan activeReferers per-site
            const activeReferers = siteConfig.referers || config.REFERERS;
            cluster.queue({
                visitId: i,
                proxyTarget,
                targetUrl: config.TARGET_URL,        // [FIX BUG #2] URL target website aktif
                homepageUrl: config.HOMEPAGE_URL,     // [FIX BUG #2] Homepage website aktif
                activeReferers,                       // [FIX BUG #1] Referer list website aktif
            });
        }

        // Tunggu semua selesai
        await cluster.idle();
        await cluster.close();

        // Tampilkan summary per site
        printSummary();

        const durationMs = Date.now() - siteStartTime;
        console.log(`[Site: ${siteConfig.name}] Selesai — ${completedVisits}/${totalVisits} visits dalam ${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`);

        return {
            name: siteConfig.name,
            targetUrl: siteConfig.targetUrl,
            totalVisits: siteConfig.totalVisits,
            completedVisits,
            success: true,
            error: null,
            durationMs,
        };

    } finally {
        // SELALU kembalikan config ke nilai asal
        config.TARGET_URL = originalTargetUrl;
        config.HOMEPAGE_URL = originalHomepageUrl;
        config.TOTAL_VISITS = originalTotalVisits;
        config.REFERERS = originalReferers;
    }
}

async function main() {
    console.log('');

    // ========== 1. Startup Check ==========
    if (config.USE_PROXY) {
        // Validasi kredensial Evomi sudah diisi
        if (!config.EVOMI_USERNAME || config.EVOMI_USERNAME === 'YOUR_EVOMI_USERNAME' ||
            !config.EVOMI_PASSWORD || config.EVOMI_PASSWORD === 'YOUR_EVOMI_PASSWORD') {
            console.error('[Fatal Error] Kredensial Evomi belum diisi di config.js!');
            console.error('              Isi EVOMI_USERNAME dan EVOMI_PASSWORD terlebih dahulu.');
            console.error('              Atau jalankan "node test-evomi.js" untuk test proxy.');
            process.exit(1);
        }

        console.log(`[Evomi] Proxy aktif — ${config.EVOMI_ENDPOINT}:${config.EVOMI_PORT}`);
        console.log(`[Evomi] Session: ${config.EVOMI_SESSION_TYPE} | Countries: ${config.EVOMI_COUNTRIES.join(', ')}`);
    } else {
        console.log('[Bot Starting] USE_PROXY = false — Berjalan tanpa proxy (Testing Mode)');
    }

    // ========== 2. Pasang Plugin Anti-Detection ==========
    // PENTING: Plugin hanya dipasang SEKALI di main(), bukan di runWebsite()
    // Karena puppeteer-extra plugin bersifat global, memasang dua kali akan error
    puppeteer.use(StealthPlugin());
    puppeteer.use(AnonymizeUAPlugin({ makeWindows: true }));

    // ========== 3. Cek Jadwal Operasional ==========
    await waitUntilOperationalHour(config);
    console.log('[Scheduler] Dalam jam operasional. Bot mulai berjalan...');

    // ========== Mode Single Website (mode lama) ==========
    if (!config.MULTI_WEBSITE_ENABLED) {
        console.log(`[Bot Started] Target: ${config.TARGET_URL} | Total Visits: ${config.TOTAL_VISITS} | Concurrency: ${config.MAX_CONCURRENCY}`);
        await runWebsite({
            name: config.WEBSITE_NAME || 'Website Utama',
            targetUrl: config.TARGET_URL,
            homepageUrl: config.HOMEPAGE_URL,
            totalVisits: config.TOTAL_VISITS,
            referers: null,
        });

        console.log('');
        console.log('[Bot Finished] All visits completed.');
        return;
    }

    // ========== Mode Multi Website Queue ==========
    let queue = [...config.WEBSITE_QUEUE];

    if (!queue || queue.length === 0) {
        console.error('[Fatal Error] MULTI_WEBSITE_ENABLED = true tapi WEBSITE_QUEUE kosong!');
        process.exit(1);
    }

    // Acak urutan jika QUEUE_SHUFFLE aktif
    if (config.QUEUE_SHUFFLE) {
        queue = queue.sort(() => Math.random() - 0.5);
    }

    console.log('');
    console.log(`[Queue] Multi Website Mode — ${queue.length} website akan dikunjungi secara berurutan`);
    console.log('');

    const queueResults = [];
    const queueStartTime = Date.now();

    for (let i = 0; i < queue.length; i++) {
        const site = queue[i];

        console.log('============================================');
        console.log(`[Queue] (${i + 1}/${queue.length}) Memulai: ${site.name}`);
        console.log(`[Queue] URL: ${site.targetUrl} | Visits: ${site.totalVisits}`);
        console.log('============================================');

        let result;
        try {
            result = await runWebsite(site);
        } catch (err) {
            // Jika website ini gagal fatal, log tapi LANJUT ke website berikutnya
            console.error(`[Queue] ❌ Website "${site.name}" gagal: ${err.message}`);
            result = {
                name: site.name,
                targetUrl: site.targetUrl,
                totalVisits: site.totalVisits,
                completedVisits: 0,
                success: false,
                error: err.message,
                durationMs: 0,
            };
        }

        queueResults.push(result);

        // Jeda sebelum website berikutnya (kecuali website terakhir)
        if (i < queue.length - 1) {
            console.log(`\n[Queue] Jeda ${config.QUEUE_DELAY_BETWEEN_SITES / 1000} detik sebelum website berikutnya...`);
            await new Promise(r => setTimeout(r, config.QUEUE_DELAY_BETWEEN_SITES));
        }
    }

    // ========== FINAL SUMMARY ==========
    const totalDurationMs = Date.now() - queueStartTime;
    const totalDurationMin = Math.floor(totalDurationMs / 60000);
    const totalDurationSec = Math.floor((totalDurationMs % 60000) / 1000);

    const totalVisitsAll = queueResults.reduce((sum, r) => sum + r.totalVisits, 0);
    const completedVisitsAll = queueResults.reduce((sum, r) => sum + r.completedVisits, 0);

    console.log('');
    console.log('============================================');
    console.log('[Queue] SUMMARY — Run Selesai');
    console.log('============================================');
    queueResults.forEach((r, idx) => {
        const icon = r.success ? '✅' : '❌';
        const errNote = r.error ? ` (${r.error})` : '';
        const dur = `${Math.floor(r.durationMs / 60000)}m ${Math.floor((r.durationMs % 60000) / 1000)}s`;
        console.log(`[${idx + 1}] ${icon} ${r.name.padEnd(20)} → ${r.completedVisits}/${r.totalVisits} visits | ${dur}${errNote}`);
    });
    console.log('--------------------------------------------');
    console.log(`Total visits     : ${completedVisitsAll} / ${totalVisitsAll}`);
    console.log(`Total waktu      : ${totalDurationMin} menit ${totalDurationSec} detik`);
    console.log('============================================');
    console.log('');
    console.log('[Bot Finished] Semua website selesai dikunjungi.');
}

// Jalankan dan handle error global
main().catch((err) => {
    console.error('[Fatal Error]', err.message);
    process.exit(1);
});
