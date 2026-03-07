/**
 * deviceProfile.js — Profil Device Konsisten per IP Proxy
 * Memastikan satu IP selalu menggunakan viewport, timezone, dan UA yang sama
 * sehingga terlihat seperti satu perangkat asli.
 */

const fs = require('fs');
const path = require('path');

// Pool viewport yang realistis
const VIEWPORT_POOL = [
    { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, label: 'Desktop FHD' },
    { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, label: 'Desktop HD' },
    { width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, label: 'Desktop Laptop' },
    { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false, label: 'Desktop Small' },
    { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, label: 'Mobile iPhone' },
    { width: 412, height: 915, deviceScaleFactor: 2.6, isMobile: true, label: 'Mobile Android' },
];

// Pool timezone dengan bahasa yang cocok
const TIMEZONE_POOL = [
    { timezone: 'Asia/Jakarta', acceptLanguage: 'id-ID,id;q=0.9,en-US;q=0.8' },
    { timezone: 'Asia/Makassar', acceptLanguage: 'id-ID,id;q=0.9,en-US;q=0.8' },
    { timezone: 'Asia/Jayapura', acceptLanguage: 'id-ID,id;q=0.9,en-US;q=0.8' },
    { timezone: 'Asia/Singapore', acceptLanguage: 'en-SG,en;q=0.9,zh;q=0.8' },
    { timezone: 'Asia/Kuala_Lumpur', acceptLanguage: 'ms-MY,ms;q=0.9,en;q=0.8' },
    { timezone: 'Asia/Bangkok', acceptLanguage: 'th-TH,th;q=0.9,en;q=0.8' },
    { timezone: 'Asia/Tokyo', acceptLanguage: 'ja-JP,ja;q=0.9,en;q=0.8' },
    { timezone: 'America/New_York', acceptLanguage: 'en-US,en;q=0.9' },
    { timezone: 'Europe/London', acceptLanguage: 'en-GB,en;q=0.9' },
];

/**
 * Generate profil random baru
 * @returns {object} Profile baru
 */
function generateRandomProfile() {
    const viewport = VIEWPORT_POOL[Math.floor(Math.random() * VIEWPORT_POOL.length)];
    const tz = TIMEZONE_POOL[Math.floor(Math.random() * TIMEZONE_POOL.length)];

    return {
        viewport,
        timezone: tz.timezone,
        acceptLanguage: tz.acceptLanguage,
        userAgentHint: viewport.isMobile ? 'android' : 'windows',
    };
}

/**
 * Ambil atau buat device profile untuk IP proxy tertentu.
 * Jika USE_CONSISTENT_DEVICE_PROFILE false, selalu return random.
 *
 * @param {string} proxyHost
 * @param {string} proxyPort
 * @param {object} config
 * @returns {object} Device profile { viewport, timezone, acceptLanguage, userAgentHint }
 */
function getOrCreateDeviceProfile(proxyHost, proxyPort, config) {
    // Fallback ke random jika fitur tidak diaktifkan
    if (!config.USE_CONSISTENT_DEVICE_PROFILE) {
        return generateRandomProfile();
    }

    try {
        const profileDir = path.resolve(config.DEVICE_PROFILE_DIR);
        if (!fs.existsSync(profileDir)) {
            fs.mkdirSync(profileDir, { recursive: true });
        }

        const profilePath = path.join(profileDir, `${proxyHost}_${proxyPort}.json`);

        // Jika file sudah ada, baca dan return
        if (fs.existsSync(profilePath)) {
            const raw = fs.readFileSync(profilePath, 'utf-8');
            return JSON.parse(raw);
        }

        // Generate baru, simpan, dan return
        const profile = generateRandomProfile();
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf-8');
        console.log(`     -> [DeviceProfile] Profil baru dibuat untuk IP ${proxyHost}:${proxyPort} — ${profile.viewport.label}`);
        return profile;

    } catch (err) {
        console.warn(`[DeviceProfile] Error: ${err.message}. Fallback ke random.`);
        return generateRandomProfile();
    }
}

/**
 * Hapus device profile untuk IP tertentu (reset)
 * @param {string} proxyHost
 * @param {string} proxyPort
 * @param {object} config
 */
function clearDeviceProfile(proxyHost, proxyPort, config) {
    try {
        const profilePath = path.resolve(config.DEVICE_PROFILE_DIR, `${proxyHost}_${proxyPort}.json`);
        if (fs.existsSync(profilePath)) {
            fs.unlinkSync(profilePath);
        }
    } catch (err) {
        // ignore
    }
}

module.exports = {
    getOrCreateDeviceProfile,
    clearDeviceProfile
};
