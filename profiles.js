/**
 * profiles.js — Country → Fingerprint Profile Mapping
 * Memetakan kode negara Evomi ke profil device yang sesuai:
 * timezone, bahasa, platform, User-Agent, dan resolusi layar.
 * Ini memastikan traffic terlihat organik (IP US → UA Windows en-US, dll).
 */

const COUNTRY_PROFILES = {
    US: [
        {
            country: 'US',
            timezone: 'America/New_York',
            language: 'en-US,en;q=0.9',
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            screen: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, label: 'Desktop FHD' },
        },
        {
            country: 'US',
            timezone: 'America/Chicago',
            language: 'en-US,en;q=0.9',
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            screen: { width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, label: 'Desktop Laptop' },
        },
        {
            country: 'US',
            timezone: 'America/Los_Angeles',
            language: 'en-US,en;q=0.9',
            platform: 'MacIntel',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            screen: { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, label: 'MacBook Pro' },
        },
    ],
    GB: [
        {
            country: 'GB',
            timezone: 'Europe/London',
            language: 'en-GB,en;q=0.9',
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            screen: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, label: 'Desktop FHD' },
        },
        {
            country: 'GB',
            timezone: 'Europe/London',
            language: 'en-GB,en;q=0.9',
            platform: 'MacIntel',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            screen: { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, label: 'MacBook Pro' },
        },
    ],
    CA: [
        {
            country: 'CA',
            timezone: 'America/Toronto',
            language: 'en-CA,en;q=0.9',
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            screen: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, label: 'Desktop FHD' },
        },
        {
            country: 'CA',
            timezone: 'America/Vancouver',
            language: 'en-CA,en;q=0.9,fr-CA;q=0.8',
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            screen: { width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, label: 'Desktop Laptop' },
        },
    ],
    AU: [
        {
            country: 'AU',
            timezone: 'Australia/Sydney',
            language: 'en-AU,en;q=0.9',
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            screen: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, label: 'Desktop FHD' },
        },
        {
            country: 'AU',
            timezone: 'Australia/Sydney',
            language: 'en-AU,en;q=0.9',
            platform: 'MacIntel',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            screen: { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, label: 'MacBook Pro' },
        },
    ],
    DE: [
        {
            country: 'DE',
            timezone: 'Europe/Berlin',
            language: 'de-DE,de;q=0.9,en;q=0.8',
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            screen: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, label: 'Desktop FHD' },
        },
        {
            country: 'DE',
            timezone: 'Europe/Berlin',
            language: 'de-DE,de;q=0.9,en;q=0.8',
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            screen: { width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, label: 'Desktop Laptop' },
        },
    ],
    FR: [
        {
            country: 'FR',
            timezone: 'Europe/Paris',
            language: 'fr-FR,fr;q=0.9,en;q=0.8',
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            screen: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, label: 'Desktop FHD' },
        },
        {
            country: 'FR',
            timezone: 'Europe/Paris',
            language: 'fr-FR,fr;q=0.9,en;q=0.8',
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            screen: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, label: 'Desktop HD' },
        },
    ],
    NL: [
        {
            country: 'NL',
            timezone: 'Europe/Amsterdam',
            language: 'nl-NL,nl;q=0.9,en;q=0.8',
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            screen: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, label: 'Desktop FHD' },
        },
        {
            country: 'NL',
            timezone: 'Europe/Amsterdam',
            language: 'nl-NL,nl;q=0.9,en;q=0.8',
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            screen: { width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, label: 'Desktop Laptop' },
        },
    ],
    SG: [
        {
            country: 'SG',
            timezone: 'Asia/Singapore',
            language: 'en-SG,en;q=0.9,zh;q=0.8',
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            screen: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, label: 'Desktop FHD' },
        },
        {
            country: 'SG',
            timezone: 'Asia/Singapore',
            language: 'en-SG,en;q=0.9,zh;q=0.8',
            platform: 'Linux armv81',
            userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
            screen: { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, label: 'Mobile Android' },
        },
    ],
    JP: [
        {
            country: 'JP',
            timezone: 'Asia/Tokyo',
            language: 'ja-JP,ja;q=0.9,en;q=0.8',
            platform: 'Win32',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            screen: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, label: 'Desktop FHD' },
        },
        {
            country: 'JP',
            timezone: 'Asia/Tokyo',
            language: 'ja-JP,ja;q=0.9,en;q=0.8',
            platform: 'iPhone',
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
            screen: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, label: 'Mobile iPhone' },
        },
    ],
};

/**
 * Ambil profil fingerprint berdasarkan kode negara.
 * Jika negara punya >1 profil, pilih secara acak.
 * @param {string} country - Kode negara (e.g., 'US', 'GB', 'JP')
 * @returns {object} Profil fingerprint lengkap
 */
function getProfileByCountry(country) {
    const profiles = COUNTRY_PROFILES[country];
    if (!profiles || profiles.length === 0) {
        // Fallback ke US jika kode negara tidak dikenal
        const fallback = COUNTRY_PROFILES['US'];
        return fallback[Math.floor(Math.random() * fallback.length)];
    }
    return profiles[Math.floor(Math.random() * profiles.length)];
}

/**
 * Pilih country acak dari array konfigurasi
 * @param {string[]} countries - Array kode negara dari config.EVOMI_COUNTRIES
 * @returns {string} Kode negara terpilih
 */
function getRandomCountry(countries) {
    return countries[Math.floor(Math.random() * countries.length)];
}

module.exports = {
    getProfileByCountry,
    getRandomCountry,
    COUNTRY_PROFILES,
};
