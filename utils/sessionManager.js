/**
 * sessionManager.js — Mengelola session persistence per IP proxy
 * Menyimpan dan memuat cookies agar browser terlihat seperti pengunjung yang kembali.
 */

const fs = require('fs');
const path = require('path');

/**
 * Dapatkan path direktori session untuk IP proxy tertentu
 * @param {string} proxyHost
 * @param {string} proxyPort
 * @param {object} config
 * @returns {string} Path absolut ke folder session IP
 */
function getSessionDir(proxyHost, proxyPort, config) {
    const sessionDir = path.resolve(config.SESSION_DIR, `${proxyHost}_${proxyPort}`);
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
}

/**
 * Simpan cookies dari page ke disk
 * @param {import('puppeteer').Page} page
 * @param {string} proxyHost
 * @param {string} proxyPort
 * @param {object} config
 */
async function saveSession(page, proxyHost, proxyPort, config) {
    if (!config.USE_PERSISTENT_SESSION) return;

    try {
        const sessionDir = getSessionDir(proxyHost, proxyPort, config);
        const cookies = await page.cookies();
        const cookiePath = path.join(sessionDir, 'cookies.json');
        fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), 'utf-8');
    } catch (err) {
        console.warn(`[Session] Gagal menyimpan session: ${err.message}`);
    }
}

/**
 * Muat cookies dari disk ke page
 * @param {import('puppeteer').Page} page
 * @param {string} proxyHost
 * @param {string} proxyPort
 * @param {object} config
 */
async function loadSession(page, proxyHost, proxyPort, config) {
    if (!config.USE_PERSISTENT_SESSION) return;

    try {
        const sessionDir = getSessionDir(proxyHost, proxyPort, config);
        const cookiePath = path.join(sessionDir, 'cookies.json');

        if (!fs.existsSync(cookiePath)) return;

        const raw = fs.readFileSync(cookiePath, 'utf-8');
        const cookies = JSON.parse(raw);

        if (cookies.length > 0) {
            // Filter invalid fields that Puppeteer's setCookie doesn't accept
            const validCookies = cookies.map(c => {
                const { name, value, domain, path, expires, httpOnly, secure, sameSite } = c;
                return { name, value, domain, path, expires, httpOnly, secure, sameSite };
            });
            await page.setCookie(...validCookies);
            console.log(`     -> [Session] Loaded ${validCookies.length} cookies untuk IP ${proxyHost}:${proxyPort}`);
        }
    } catch (err) {
        console.warn(`[Session] Gagal memuat session: ${err.message}`);
    }
}

module.exports = {
    getSessionDir,
    saveSession,
    loadSession
};
