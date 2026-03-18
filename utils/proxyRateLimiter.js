/**
 * proxyRateLimiter.js — Pembatas dan Pengatur Jeda Visit per IP Proxy
 * Mencegah satu IP digunakan terlalu banyak dalam sehari.
 *
 * Untuk Evomi (single endpoint): gunakan visitId sebagai key,
 * karena setiap visit sudah mendapat IP unik dari Evomi.
 * Untuk multi-host proxy (9Proxy dll): gunakan host:port sebagai key.
 */

const config = require('../config');
const { isProxyEnabled, isEvomi } = require('../proxy/proxyManager');

// Map untuk menyimpan state penggunaan per proxy
const proxyUsageMap = new Map();

/**
 * Tentukan key rate limiter yang tepat.
 * Jika Evomi (single endpoint), gunakan visitId.
 * Jika multi-host atau no-proxy, gunakan host:port.
 * @param {string} proxyHost
 * @param {string} proxyPort
 * @param {number|string|null} visitId
 * @returns {string}
 */
function getRateLimitKey(proxyHost, proxyPort, visitId) {
    if (isEvomi() && visitId != null) {
        // Evomi: setiap visitId = IP unik, key per visit
        return `visit-${visitId}`;
    }
    // Multi-host proxy atau testing mode: key per host:port
    return `${proxyHost}:${proxyPort}`;
}

/**
 * Cek apakah proxy masih bisa dipakai (belum melebihi VISITS_PER_IP)
 * @param {string} proxyHost
 * @param {string} proxyPort
 * @param {object} config
 * @param {number|string|null} visitId
 * @returns {boolean}
 */
function canUseProxy(proxyHost, proxyPort, config, visitId = null) {
    const key = getRateLimitKey(proxyHost, proxyPort, visitId);

    if (!proxyUsageMap.has(key)) {
        proxyUsageMap.set(key, { count: 0, lastUsed: 0 });
    }

    const usage = proxyUsageMap.get(key);
    return usage.count < config.VISITS_PER_IP;
}

/**
 * Tunggu jeda yang diperlukan sebelum visit berikutnya dari IP yang sama
 * @param {string} proxyHost
 * @param {string} proxyPort
 * @param {object} config
 * @param {number|string|null} visitId
 */
async function waitForProxy(proxyHost, proxyPort, config, visitId = null) {
    // Jika VISITS_PER_IP === 1 dan provider Evomi aktif,
    // setiap visit = IP baru, tidak perlu delay antar visit
    if (isEvomi() && config.VISITS_PER_IP === 1) {
        return;
    }

    const key = getRateLimitKey(proxyHost, proxyPort, visitId);

    if (!proxyUsageMap.has(key)) {
        proxyUsageMap.set(key, { count: 0, lastUsed: 0 });
    }

    const usage = proxyUsageMap.get(key);
    const elapsed = Date.now() - usage.lastUsed;
    const requiredDelay = config.DELAY_BETWEEN_VISITS_MIN +
        Math.random() * (config.DELAY_BETWEEN_VISITS_MAX - config.DELAY_BETWEEN_VISITS_MIN);

    if (usage.lastUsed > 0 && elapsed < requiredDelay) {
        const remainingWait = requiredDelay - elapsed;
        console.log(`     -> [RateLimit] IP ${key} menunggu ${(remainingWait / 1000).toFixed(1)}s sebelum visit berikutnya`);
        await new Promise(r => setTimeout(r, remainingWait));
    }
}

/**
 * Catat penggunaan proxy (increment count + update timestamp)
 * @param {string} proxyHost
 * @param {string} proxyPort
 * @param {number|string|null} visitId
 */
function recordProxyUsage(proxyHost, proxyPort, visitId = null) {
    const key = getRateLimitKey(proxyHost, proxyPort, visitId);

    if (!proxyUsageMap.has(key)) {
        proxyUsageMap.set(key, { count: 0, lastUsed: 0 });
    }

    const usage = proxyUsageMap.get(key);
    usage.count++;
    usage.lastUsed = Date.now();

    console.log(`     -> [RateLimit] IP ${key} — Visit ke-${usage.count} hari ini`);
}

/**
 * Ambil ringkasan semua statistik proxy
 * @returns {Array<{proxy: string, count: number, lastUsed: number}>}
 */
function getProxyStats() {
    const stats = [];
    for (const [proxy, usage] of proxyUsageMap.entries()) {
        stats.push({
            proxy,
            count: usage.count,
            lastUsed: usage.lastUsed
        });
    }
    return stats;
}

module.exports = {
    canUseProxy,
    waitForProxy,
    recordProxyUsage,
    getProxyStats
};
