/**
 * proxyManager.js — Manajemen proxy Evomi Residential Core
 * Menggantikan integrasi 9Proxy lama dengan Evomi residential proxy.
 * Setiap browser instance mendapatkan session ID unik + country acak.
 */

const config = require('../config');
const { getRandomCountry } = require('../profiles');

/**
 * Generate password Evomi unik per instance.
 * Format: PASSWORD_hardsession-botXXX_country-XX
 * @param {number|string} instanceId - ID unik per browser instance
 * @returns {{ password: string, country: string }}
 */
function generateEvomiPassword(instanceId) {
    // Pilih country acak dari daftar
    const country = getRandomCountry(config.EVOMI_COUNTRIES);

    // Buat session ID unik: bot001, bot002, dst
    const sessionId = `bot${String(instanceId).padStart(3, '0')}`;

    // Rakit password sesuai format Evomi
    let password = `${config.EVOMI_PASSWORD}_${config.EVOMI_SESSION_TYPE}-${sessionId}_country-${country}`;

    // Tambahkan lifetime jika dikonfigurasi
    if (config.EVOMI_LIFETIME) {
        password += `_lifetime-${config.EVOMI_LIFETIME}`;
    }

    // Tambahkan mode-speed untuk rotasi IP cepat
    password += '_mode-speed';

    return { password, country };
}

/**
 * Mengembalikan argumen --proxy-server untuk puppeteer launch args.
 * Semua instance menggunakan endpoint Evomi yang sama (auth via page.authenticate).
 * @returns {string} Argumen flag --proxy-server
 */
function getEvomiProxyArgs() {
    return `--proxy-server=https://${config.EVOMI_ENDPOINT}:${config.EVOMI_PORT}`;
}

/**
 * Mengembalikan kredensial Evomi untuk page.authenticate().
 * Setiap panggilan menghasilkan session ID unik → IP unik.
 * @param {number|string} instanceId - ID unik per visit/instance
 * @returns {{ username: string, password: string, country: string }}
 */
function getEvomiAuth(instanceId) {
    const { password, country } = generateEvomiPassword(instanceId);
    return {
        username: config.EVOMI_USERNAME,
        password,
        country,
    };
}

/**
 * Mengembalikan flag argumen proxy untuk puppeteer (backward compat).
 * Digunakan oleh cluster.js untuk mode proxy aktif.
 * @returns {string} Argumen flag --proxy-server
 */
function getProxyArgs() {
    return getEvomiProxyArgs();
}

/**
 * Generate daftar virtual proxy untuk cluster.js.
 * Evomi menggunakan satu endpoint, jadi ini hanya untuk kompatibilitas
 * dengan arsitektur proxyList yang sudah ada.
 * @param {number} count - Jumlah slot concurrent
 * @returns {Array<{host: string, port: string, index: number}>}
 */
function generateProxyList(count) {
    const list = [];
    for (let i = 0; i < count; i++) {
        list.push({
            host: config.EVOMI_ENDPOINT,
            port: String(config.EVOMI_PORT),
            index: i,
        });
    }
    return list;
}

module.exports = {
    generateEvomiPassword,
    getEvomiProxyArgs,
    getEvomiAuth,
    getProxyArgs,
    generateProxyList,
};
