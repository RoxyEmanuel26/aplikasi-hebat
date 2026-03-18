/**
 * proxyManager.js — Manajemen Proxy Multi-Provider
 * Mendukung 2 provider proxy:
 *   - Evomi Residential Core (1 endpoint, auth per session)
 *   - 9Proxy Local App (API fetch daftar proxy)
 *
 * Provider dipilih via config.PROXY_PROVIDER ('evomi' | '9proxy' | 'none')
 */

const config = require('../config');
const http = require('http');

// =============================================
// ============= EVOMI FUNCTIONS ===============
// =============================================

// Import profiles hanya jika diperlukan (Evomi)
let getRandomCountry;
try {
    ({ getRandomCountry } = require('../profiles'));
} catch (e) {
    getRandomCountry = () => 'US';
}

/**
 * Generate password Evomi unik per instance.
 * Format: PASSWORD_session-botXXX_country-XX_mode-speed
 * @param {number|string} instanceId - ID unik per browser instance
 * @returns {{ password: string, country: string }}
 */
function generateEvomiPassword(instanceId) {
    const country = getRandomCountry(config.EVOMI_COUNTRIES);
    const sessionId = `bot${String(instanceId).padStart(3, '0')}`;
    let password = `${config.EVOMI_PASSWORD}_${config.EVOMI_SESSION_TYPE}-${sessionId}_country-${country}`;
    if (config.EVOMI_LIFETIME) {
        password += `_lifetime-${config.EVOMI_LIFETIME}`;
    }
    password += '_mode-speed';
    return { password, country };
}

/**
 * Argumen --proxy-server untuk Evomi
 * @returns {string}
 */
function getEvomiProxyArgs() {
    return `--proxy-server=https://${config.EVOMI_ENDPOINT}:${config.EVOMI_PORT}`;
}

/**
 * Kredensial Evomi untuk page.authenticate()
 * @param {number|string} instanceId
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

// =============================================
// ============= 9PROXY FUNCTIONS ==============
// =============================================

/**
 * Fetch daftar proxy dari API lokal 9Proxy atau parse dari daftar statis.
 * @returns {Promise<Array<{host: string, port: string, index: number}>>}
 */
function fetchNineProxyList() {
    return new Promise((resolve, reject) => {
        if (config.NINEPROXY_LIST_MODE === 'auto') {
            const proxies = [];
            const startPort = config.NINEPROXY_START_PORT || 60000;
            const count = config.NINEPROXY_PORT_COUNT || 10;
            const host = config.NINEPROXY_LOCAL_HOST || '127.0.0.1';

            for (let i = 0; i < count; i++) {
                proxies.push({
                    host: host,
                    port: String(startPort + i),
                    index: i
                });
            }
            return resolve(proxies);
        }

        if (config.NINEPROXY_LIST_MODE === 'static') {
            if (!config.NINEPROXY_STATIC_LIST || config.NINEPROXY_STATIC_LIST.length === 0) {
                return reject(new Error('NINEPROXY_STATIC_LIST kosong. Isi daftar proxy di config.js atau gunakan mode "api".'));
            }

            const proxies = config.NINEPROXY_STATIC_LIST.map((proxyStr, i) => {
                let hostPort = proxyStr;
                // Parse format "username:password@host:port"
                if (proxyStr.includes('@')) {
                    hostPort = proxyStr.split('@')[1];
                }

                const [host, port] = hostPort.split(':');
                if (!host || !port) {
                    throw new Error(`Format proxy tidak valid (harus host:port): ${proxyStr}`);
                }

                return {
                    host: host.trim(),
                    port: port.trim(),
                    index: i
                };
            });

            return resolve(proxies);
        }

        // Mode API
        const url = config.NINEPROXY_API_URL;
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    // 9Proxy API mengembalikan array object dengan host & port
                    let proxies = [];
                    if (Array.isArray(json)) {
                        proxies = json;
                    } else if (json.data && Array.isArray(json.data)) {
                        proxies = json.data;
                    } else if (json.list && Array.isArray(json.list)) {
                        proxies = json.list;
                    }

                    const result = proxies.map((p, i) => ({
                        host: p.host || p.ip || config.NINEPROXY_LOCAL_HOST,
                        port: String(p.port),
                        index: i,
                    }));

                    if (result.length === 0) {
                        reject(new Error('9Proxy API mengembalikan 0 proxy. Pastikan aplikasi 9Proxy berjalan.'));
                    } else {
                        resolve(result);
                    }
                } catch (e) {
                    reject(new Error(`Gagal parse response 9Proxy API: ${e.message}`));
                }
            });
        }).on('error', (err) => {
            reject(new Error(`Gagal koneksi ke 9Proxy API (${url}): ${err.message}. Pastikan 9Proxy berjalan di port ${config.NINEPROXY_API_PORT}.`));
        });
    });
}

/**
 * Cek apakah 9Proxy API bisa dihubungi (hanya untuk mode API)
 * @returns {Promise<boolean>}
 */
function checkNineProxyAPI() {
    if (config.NINEPROXY_LIST_MODE === 'static' || config.NINEPROXY_LIST_MODE === 'auto') {
        return Promise.resolve(true); // Bypass cek API
    }

    return new Promise((resolve, reject) => {
        const url = `http://${config.NINEPROXY_LOCAL_HOST}:${config.NINEPROXY_API_PORT}`;
        const req = http.get(url, (res) => {
            resolve(true);
        });
        req.on('error', (err) => {
            reject(new Error(`9Proxy API tidak merespons di ${url}. Pastikan aplikasi 9Proxy berjalan.`));
        });
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error(`9Proxy API timeout di ${url}.`));
        });
    });
}

/**
 * Argumen --proxy-server untuk 9Proxy (per-proxy basis)
 * @param {{ host: string, port: string }} proxy - Object proxy individual
 * @returns {string}
 */
function getNineProxyArgs(proxy) {
    return `--proxy-server=http://${proxy.host}:${proxy.port}`;
}

/**
 * Kredensial 9Proxy untuk page.authenticate()
 * @returns {{ username: string, password: string } | null}
 */
function getNineProxyAuth() {
    if (config.NINEPROXY_USERNAME && config.NINEPROXY_PASSWORD) {
        return {
            username: config.NINEPROXY_USERNAME,
            password: config.NINEPROXY_PASSWORD,
        };
    }
    return null; // 9Proxy tanpa auth
}

// =============================================
// ========= UNIFIED DISPATCH FUNCTIONS ========
// =============================================

/**
 * Cek apakah proxy aktif (bukan 'none')
 * @returns {boolean}
 */
function isProxyEnabled() {
    return config.PROXY_PROVIDER && config.PROXY_PROVIDER !== 'none';
}

/**
 * Cek apakah provider aktif adalah Evomi
 * @returns {boolean}
 */
function isEvomi() {
    return config.PROXY_PROVIDER === 'evomi';
}

/**
 * Cek apakah provider aktif adalah 9Proxy
 * @returns {boolean}
 */
function isNineProxy() {
    return config.PROXY_PROVIDER === '9proxy';
}

/**
 * Mengembalikan flag --proxy-server untuk puppeteer launch args.
 * Dispatch berdasarkan PROXY_PROVIDER.
 * @param {{ host: string, port: string }} [proxy] - Proxy individual (diperlukan untuk 9Proxy)
 * @returns {string}
 */
function getProxyArgs(proxy) {
    if (isEvomi()) {
        return getEvomiProxyArgs();
    } else if (isNineProxy() && proxy) {
        return getNineProxyArgs(proxy);
    }
    return '';
}

/**
 * Mengembalikan kredensial proxy untuk page.authenticate().
 * @param {number|string} instanceId - ID unik per visit
 * @returns {{ username: string, password: string, country?: string } | null}
 */
function getProxyAuth(instanceId) {
    if (isEvomi()) {
        return getEvomiAuth(instanceId);
    } else if (isNineProxy()) {
        return getNineProxyAuth();
    }
    return null;
}

/**
 * Fetch daftar proxy (untuk 9Proxy) atau generate virtual list (untuk Evomi).
 * @param {number} count - Jumlah slot concurrent (untuk Evomi virtual list)
 * @returns {Promise<Array<{host: string, port: string, index: number}>>}
 */
async function getProxyList(count) {
    if (isNineProxy()) {
        return await fetchNineProxyList();
    }

    // Evomi: generate virtual proxy list (semua sama 1 endpoint)
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
    // Evomi specific
    generateEvomiPassword,
    getEvomiProxyArgs,
    getEvomiAuth,

    // 9Proxy specific
    fetchNineProxyList,
    checkNineProxyAPI,
    getNineProxyArgs,
    getNineProxyAuth,

    // Unified dispatch
    isProxyEnabled,
    isEvomi,
    isNineProxy,
    getProxyArgs,
    getProxyAuth,
    getProxyList,
};
