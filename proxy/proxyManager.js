/**
 * proxyManager.js — Manajemen proxy dari 9Proxy API
 * Mengambil daftar proxy secara real-time dari aplikasi 9Proxy lokal pengguna.
 */

const axios = require('axios');
const config = require('../config');

// Variabel memori cache proxy list
let proxyList = [];

/**
 * Validasi dan ping ke 9Proxy API
 * Memastikan aplikasi 9Proxy berjalan sebelum bot start.
 * @throws {Error} Apabila aplikasi 9Proxy tidak aktif / request gagal.
 */
async function checkProxyAPI() {
    try {
        const response = await axios.get(config.PROXY_API_URL, { timeout: 5000 });

        // Validasi apabila API berjalan namun respond bukan success
        if (response.data.error === "True" || response.data.error === true) {
            throw new Error(`9Proxy API Error: ${response.data.message}`);
        }

        // Validasi list tidak boleh kosong
        if (!response.data.data || response.data.data.length === 0) {
            throw new Error(`9Proxy gagal mengembalikan data proxy. Daftar kosong atau limit habis.`);
        }

    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('timeout')) {
            throw new Error('9Proxy app tidak berjalan. Pastikan aplikasi 9Proxy aktif di komputer kamu.');
        }
        throw error;
    }
}

/**
 * Fetch daftar proxy terbaru dari API
 * Mengubah string "127.0.0.1:PORT" ke object array.
 * @returns {Promise<Array<{host: string, port: string}>>}
 */
async function fetchProxyList() {
    const response = await axios.get(config.PROXY_API_URL);

    if (!response.data || !response.data.data || response.data.data.length === 0) {
        throw new Error('API mengembalikan proxy list kosong.');
    }

    // Parse response menjadi objects array
    proxyList = response.data.data.map(proxyStr => {
        // String format from 9Proxy is "Host:Port" (e.g., "127.0.0.1:60000")
        const [host, port] = proxyStr.split(':');
        return { host, port };
    });

    return proxyList;
}

/**
 * Mengembalikan array daftar proxy (dari cache atau di fetch baru)
 * @returns {Promise<Array<{host: string, port: string}>>}
 */
async function getProxyList() {
    if (proxyList.length === 0) {
        await fetchProxyList();
    }
    return proxyList;
}

/**
 * Mengembalikan flag argumen untuk puppeteer
 * @param {{host: string, port: string}} proxy - Proxy object instance
 * @returns {string} Argumen flag --proxy-server
 */
function getProxyArgs(proxy) {
    return `--proxy-server=http://${proxy.host}:${proxy.port}`;
}

/**
 * Mengembalikan object kredenstial proxy dari config
 * @returns {{username: string, password: string}} Object credentials puppeteer page
 */
function getProxyAuth() {
    return {
        username: config.PROXY_USERNAME,
        password: config.PROXY_PASSWORD
    };
}

module.exports = {
    checkProxyAPI,
    fetchProxyList,
    getProxyList,
    getProxyArgs,
    getProxyAuth
};
