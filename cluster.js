/**
 * cluster.js — Setup puppeteer-cluster
 * Mengkonfigurasi cluster browser dengan isolasi penuh per task,
 * menggunakan puppeteer-extra dengan StealthPlugin yang sudah terpasang.
 * Mendukung proxy Evomi, 9Proxy, atau tanpa proxy.
 */

const { Cluster } = require('puppeteer-cluster');
const config = require('./config');
const {
    isProxyEnabled, isEvomi, isNineProxy,
    getEvomiProxyArgs, getNineProxyArgs, getProxyList,
} = require('./proxy/proxyManager');

/**
 * Membuat dan mengkonfigurasi puppeteer-cluster
 * @param {object} puppeteer - Instance puppeteer-extra yang sudah dipasang plugin
 * @returns {Promise<{cluster: Cluster, proxyList: Array<{host: string, port: string, index: number}>}>}
 */
async function createCluster(puppeteer) {
    // Jika proxy dinonaktifkan, jalankan tanpa proxy
    if (!isProxyEnabled()) {
        console.log('[Proxy] PROXY_PROVIDER = none — Menjalankan tanpa proxy (Testing Mode)');
        return await createClusterNoProxy(puppeteer);
    }

    const activeConcurrency = config.MAX_CONCURRENCY;

    // ========== EVOMI MODE ==========
    // Semua browser pakai 1 endpoint, auth berbeda per page.authenticate()
    if (isEvomi()) {
        const proxyArg = getEvomiProxyArgs();
        console.log(`[Evomi] Proxy endpoint: ${config.EVOMI_ENDPOINT}:${config.EVOMI_PORT}`);
        console.log(`[Evomi] Session type: ${config.EVOMI_SESSION_TYPE} | Countries: ${config.EVOMI_COUNTRIES.join(', ')}`);

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
                ignoreDefaultArgs: ['--enable-automation'],
            });
        }

        const cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_BROWSER,
            maxConcurrency: activeConcurrency,
            puppeteer: puppeteer,
            perBrowserOptions: perBrowserOptions,
            puppeteerOptions: {
                headless: config.HEADLESS ? 'new' : false,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            },
            retryLimit: 2,
            timeout: 300000,
            monitor: false,
        });

        cluster.on('taskerror', (err, data) => {
            const visitId = data && data.visitId ? data.visitId : '?';
            console.error(`[Cluster Error] Visit #${visitId}: ${err.message}`);
        });

        const proxyList = await getProxyList(activeConcurrency);
        return { cluster, proxyList };
    }

    // ========== 9PROXY MODE ==========
    // Setiap browser mendapat proxy berbeda dari API list
    if (isNineProxy()) {
        console.log(`[9Proxy] Fetching proxy list dari API: ${config.NINEPROXY_API_URL}`);
        const proxyList = await getProxyList(activeConcurrency);
        console.log(`[9Proxy] Berhasil mendapatkan ${proxyList.length} proxy dari API`);

        // Limit concurrency ke jumlah proxy yang tersedia
        const effectiveConcurrency = Math.min(activeConcurrency, proxyList.length);
        if (effectiveConcurrency < activeConcurrency) {
            console.warn(`[9Proxy] ⚠️  Hanya ${proxyList.length} proxy tersedia, concurrency diturunkan dari ${activeConcurrency} ke ${effectiveConcurrency}`);
        }

        const perBrowserOptions = [];
        for (let i = 0; i < effectiveConcurrency; i++) {
            const proxy = proxyList[i % proxyList.length];
            const proxyArg = getNineProxyArgs(proxy);
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
                ignoreDefaultArgs: ['--enable-automation'],
            });
        }

        const cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_BROWSER,
            maxConcurrency: effectiveConcurrency,
            puppeteer: puppeteer,
            perBrowserOptions: perBrowserOptions,
            puppeteerOptions: {
                headless: config.HEADLESS ? 'new' : false,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            },
            retryLimit: 2,
            timeout: 300000,
            monitor: false,
        });

        cluster.on('taskerror', (err, data) => {
            const visitId = data && data.visitId ? data.visitId : '?';
            console.error(`[Cluster Error] Visit #${visitId}: ${err.message}`);
        });

        return { cluster, proxyList };
    }

    // Fallback (seharusnya tidak sampai sini)
    return await createClusterNoProxy(puppeteer);
}

/**
 * Membuat cluster tanpa proxy untuk mode testing
 * @param {object} puppeteer - Instance puppeteer-extra
 * @returns {Promise<{cluster: Cluster, proxyList: Array<{host: string, port: string}>}>}
 */
async function createClusterNoProxy(puppeteer) {
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

    cluster.on('taskerror', (err, data) => {
        const visitId = data?.visitId ?? '?';
        console.error(`[Cluster Error] Visit #${visitId}: ${err.message}`);
    });

    const dummyProxyList = Array.from(
        { length: config.MAX_CONCURRENCY },
        (_, i) => ({ host: '127.0.0.1', port: String(60000 + i) })
    );

    console.log(`[Proxy] Berjalan tanpa proxy — ${config.MAX_CONCURRENCY} instance dengan IP asli`);

    return { cluster, proxyList: dummyProxyList };
}

module.exports = { createCluster, createClusterNoProxy };
