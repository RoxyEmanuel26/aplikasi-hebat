/**
 * cluster.js — Setup puppeteer-cluster
 * Mengkonfigurasi cluster browser dengan isolasi penuh per task,
 * menggunakan puppeteer-extra dengan StealthPlugin yang sudah terpasang.
 */

const { Cluster } = require('puppeteer-cluster');
const config = require('./config');
const { checkProxyAPI, getProxyList, getProxyArgs } = require('./proxy/proxyManager');

/**
 * Membuat dan mengkonfigurasi puppeteer-cluster
 * @param {object} puppeteer - Instance puppeteer-extra yang sudah dipasang plugin
 * @returns {Promise<{cluster: Cluster, proxyList: Array<{host: string, port: string}>}>} Cluster instance dan proxyList
 */
async function createCluster(puppeteer) {
    // 1. Pastikan API 9Proxy aktif
    await checkProxyAPI();

    // 2. Dapatkan list proxy dari 9Proxy API
    const proxyList = await getProxyList();

    // 3. Hitung penyesuaian dependensi concurrency proxy
    let activeConcurrency = config.MAX_CONCURRENCY;
    if (proxyList.length < activeConcurrency) {
        console.warn(`[Warning] Hanya tersedia ${proxyList.length} proxy, maxConcurrency disesuaikan ke ${proxyList.length}`);
        activeConcurrency = proxyList.length;
    }

    // 4. Siapkan perBrowserOptions untuk mapping proxy unik per worker
    const perBrowserOptions = [];
    for (let i = 0; i < activeConcurrency; i++) {
        // Karena concurrency <= proxyList.length, kita pastikan mapping index ini fix per worker node
        // Dan rotasi index ini akan berjalan round robin jika dipanggil terus-menerus
        const proxy = proxyList[i];

        perBrowserOptions.push({
            headless: config.HEADLESS ? 'new' : false,
            args: [
                '--no-sandbox',
                '--disable-popup-blocking',
                '--disable-notifications',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--disable-extensions',
                '--disable-gpu',
                '--no-first-run',
                '--no-default-browser-check',
                '--ignore-certificate-errors',
                getProxyArgs(proxy),
            ],
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation']
        });
    }

    const cluster = await Cluster.launch({
        // 1 browser per task — isolasi penuh antar instance
        concurrency: Cluster.CONCURRENCY_BROWSER,

        // Jumlah browser paralel maksimal yang active
        maxConcurrency: activeConcurrency,

        // Gunakan puppeteer-extra
        puppeteer: puppeteer,

        // Konfigurasi dinamis browser args array (satu-per-satu browser)
        perBrowserOptions: perBrowserOptions,

        // Opsi launch browser global (timpah oleh perBrowserOptions)
        puppeteerOptions: {
            headless: config.HEADLESS ? 'new' : false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        },

        // Retry otomatis jika instance gagal
        retryLimit: 2,

        // Timeout 120 detik per task (diperpanjang untuk akomodasi reading pacing + popunder)
        timeout: 120000,

        // Monitor events
        monitor: false,
    });

    // Event handler untuk error per instance
    cluster.on('taskerror', (err, data) => {
        const visitId = data && data.visitId ? data.visitId : '?';
        console.error(`[Cluster Error] Visit #${visitId}: ${err.message}`);
    });

    return { cluster, proxyList };
}

module.exports = { createCluster };
