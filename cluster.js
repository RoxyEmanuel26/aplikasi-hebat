/**
 * cluster.js — Setup puppeteer-cluster
 * Mengkonfigurasi cluster browser dengan isolasi penuh per task,
 * menggunakan puppeteer-extra dengan StealthPlugin yang sudah terpasang.
 * Proxy: Evomi Residential Core (satu endpoint, auth per page).
 */

const { Cluster } = require('puppeteer-cluster');
const config = require('./config');
const { getEvomiProxyArgs, generateProxyList } = require('./proxy/proxyManager');

/**
 * Membuat dan mengkonfigurasi puppeteer-cluster
 * @param {object} puppeteer - Instance puppeteer-extra yang sudah dipasang plugin
 * @returns {Promise<{cluster: Cluster, proxyList: Array<{host: string, port: string, index: number}>}>} Cluster instance dan proxyList
 */
async function createCluster(puppeteer) {
    // Jika USE_PROXY false, jalankan tanpa proxy
    if (!config.USE_PROXY) {
        console.log('[Proxy] USE_PROXY = false — Menjalankan tanpa proxy (Testing Mode)');
        return await createClusterNoProxy(puppeteer);
    }

    // Evomi menggunakan satu endpoint untuk semua instance.
    // Auth (username/password) berbeda per page via page.authenticate().
    const proxyArg = getEvomiProxyArgs();
    const activeConcurrency = config.MAX_CONCURRENCY;

    console.log(`[Evomi] Proxy endpoint: ${config.EVOMI_ENDPOINT}:${config.EVOMI_PORT}`);
    console.log(`[Evomi] Session type: ${config.EVOMI_SESSION_TYPE} | Countries: ${config.EVOMI_COUNTRIES.join(', ')}`);

    // Siapkan perBrowserOptions — semua browser pakai endpoint Evomi yang sama
    const perBrowserOptions = [];
    for (let i = 0; i < activeConcurrency; i++) {
        perBrowserOptions.push({
            headless: config.HEADLESS ? 'new' : false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-popup-blocking',
                '--disable-notifications',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--disable-extensions',
                '--no-first-run',
                '--no-default-browser-check',
                '--ignore-certificate-errors',
                proxyArg,
            ],
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation']
        });
    }

    const cluster = await Cluster.launch({
        // 1 browser per task — isolasi penuh antar instance
        concurrency: Cluster.CONCURRENCY_BROWSER,

        // Jumlah browser paralel maksimal
        maxConcurrency: activeConcurrency,

        // Gunakan puppeteer-extra
        puppeteer: puppeteer,

        // Konfigurasi dinamis browser args (satu per browser)
        perBrowserOptions: perBrowserOptions,

        // Opsi launch browser global (ditimpa oleh perBrowserOptions)
        puppeteerOptions: {
            headless: config.HEADLESS ? 'new' : false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        },

        // Retry otomatis jika instance gagal
        retryLimit: 2,

        // Timeout 300 detik (5 menit) per task
        timeout: 300000,

        // Monitor events
        monitor: false,
    });

    // Event handler untuk error per instance
    cluster.on('taskerror', (err, data) => {
        const visitId = data && data.visitId ? data.visitId : '?';
        console.error(`[Cluster Error] Visit #${visitId}: ${err.message}`);
    });

    // Generate virtual proxy list untuk kompatibilitas arsitektur
    const proxyList = generateProxyList(activeConcurrency);

    return { cluster, proxyList };
}

/**
 * Membuat cluster tanpa proxy untuk mode testing
 * @param {object} puppeteer - Instance puppeteer-extra
 * @returns {Promise<{cluster: Cluster, proxyList: Array<{host: string, port: string}>}>}
 */
async function createClusterNoProxy(puppeteer) {
    // Siapkan perBrowserOptions tanpa proxy args
    const perBrowserOptions = [];
    for (let i = 0; i < config.MAX_CONCURRENCY; i++) {
        perBrowserOptions.push({
            headless: config.HEADLESS ? true : false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-popup-blocking',
                '--disable-notifications',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--no-first-run',
                '--no-default-browser-check',
                '--ignore-certificate-errors',
            ],
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation'],
        });
    }

    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_BROWSER,
        maxConcurrency: config.MAX_CONCURRENCY,
        puppeteer: puppeteer,
        perBrowserOptions: perBrowserOptions,
        puppeteerOptions: {
            headless: config.HEADLESS ? true : false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
        retryLimit: 2,
        timeout: 300000,
        monitor: false,
    });

    // Event handler untuk error per instance
    cluster.on('taskerror', (err, data) => {
        const visitId = data?.visitId ?? '?';
        console.error(`[Cluster Error] Visit #${visitId}: ${err.message}`);
    });

    // Return dummy proxyList agar struktur return sama
    const dummyProxyList = Array.from(
        { length: config.MAX_CONCURRENCY },
        (_, i) => ({ host: '127.0.0.1', port: String(60000 + i) })
    );

    console.log(`[Proxy] Berjalan tanpa proxy — ${config.MAX_CONCURRENCY} instance dengan IP asli`);

    return { cluster, proxyList: dummyProxyList };
}

module.exports = { createCluster, createClusterNoProxy };
