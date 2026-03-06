/**
 * timezone.js — Timezone & bahasa spoofing
 * Mengacak timezone dan Accept-Language header agar setiap instance
 * terlihat datang dari lokasi yang berbeda di seluruh dunia.
 */

// Daftar timezone umum beserta locale/Accept-Language yang sesuai
const TIMEZONE_MAP = [
    { timezone: 'Asia/Jakarta', locale: 'id-ID', acceptLanguage: 'id-ID,id;q=0.9,en;q=0.8' },
    { timezone: 'America/New_York', locale: 'en-US', acceptLanguage: 'en-US,en;q=0.9' },
    { timezone: 'Europe/London', locale: 'en-GB', acceptLanguage: 'en-GB,en;q=0.9' },
    { timezone: 'Asia/Tokyo', locale: 'ja-JP', acceptLanguage: 'ja-JP,ja;q=0.9,en;q=0.8' },
    { timezone: 'Europe/Berlin', locale: 'de-DE', acceptLanguage: 'de-DE,de;q=0.9,en;q=0.8' },
    { timezone: 'Europe/Paris', locale: 'fr-FR', acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8' },
    { timezone: 'Asia/Singapore', locale: 'en-SG', acceptLanguage: 'en-SG,en;q=0.9,zh;q=0.8' },
    { timezone: 'America/Los_Angeles', locale: 'en-US', acceptLanguage: 'en-US,en;q=0.9' },
    { timezone: 'Asia/Seoul', locale: 'ko-KR', acceptLanguage: 'ko-KR,ko;q=0.9,en;q=0.8' },
    { timezone: 'America/Sao_Paulo', locale: 'pt-BR', acceptLanguage: 'pt-BR,pt;q=0.9,en;q=0.8' },
    { timezone: 'Asia/Kolkata', locale: 'hi-IN', acceptLanguage: 'hi-IN,hi;q=0.9,en;q=0.8' },
    { timezone: 'Europe/Moscow', locale: 'ru-RU', acceptLanguage: 'ru-RU,ru;q=0.9,en;q=0.8' },
    { timezone: 'Australia/Sydney', locale: 'en-AU', acceptLanguage: 'en-AU,en;q=0.9' },
    { timezone: 'Asia/Bangkok', locale: 'th-TH', acceptLanguage: 'th-TH,th;q=0.9,en;q=0.8' },
    { timezone: 'Asia/Dubai', locale: 'ar-AE', acceptLanguage: 'ar-AE,ar;q=0.9,en;q=0.8' },
];

/**
 * Pilih timezone acak dari daftar
 * @returns {{ timezone: string, locale: string, acceptLanguage: string }}
 */
function randomTimezone() {
    return TIMEZONE_MAP[Math.floor(Math.random() * TIMEZONE_MAP.length)];
}

/**
 * Inject timezone spoofing ke page via evaluateOnNewDocument
 * Membuat Intl.DateTimeFormat mengembalikan timezone palsu
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} timezone - Timezone string (e.g., 'Asia/Jakarta')
 */
async function injectTimezone(page, timezone) {
    await page.evaluateOnNewDocument((tz) => {
        // Override Intl.DateTimeFormat timezone
        const originalDateTimeFormat = Intl.DateTimeFormat;
        const ProxiedDateTimeFormat = new Proxy(originalDateTimeFormat, {
            construct(target, args) {
                if (args[1]) {
                    args[1].timeZone = tz;
                } else {
                    args[1] = { timeZone: tz };
                }
                return new target(...args);
            },
        });
        // eslint-disable-next-line no-global-assign
        Intl.DateTimeFormat = ProxiedDateTimeFormat;

        // Override Date.prototype.getTimezoneOffset()
        // Ini adalah estimasi sederhana; offset real tergantung DST
        const offsetMap = {
            'Asia/Jakarta': -420,
            'America/New_York': 300,
            'Europe/London': 0,
            'Asia/Tokyo': -540,
            'Europe/Berlin': -60,
            'Europe/Paris': -60,
            'Asia/Singapore': -480,
            'America/Los_Angeles': 480,
            'Asia/Seoul': -540,
            'America/Sao_Paulo': 180,
            'Asia/Kolkata': -330,
            'Europe/Moscow': -180,
            'Australia/Sydney': -660,
            'Asia/Bangkok': -420,
            'Asia/Dubai': -240,
        };

        const offset = offsetMap[tz] !== undefined ? offsetMap[tz] : 0;
        Date.prototype.getTimezoneOffset = function () {
            return offset;
        };
    }, timezone);
}

/**
 * Set Accept-Language header pada page
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} acceptLanguage - Accept-Language value
 */
async function setAcceptLanguage(page, acceptLanguage) {
    await page.setExtraHTTPHeaders({
        'Accept-Language': acceptLanguage,
    });
}

module.exports = {
    randomTimezone,
    injectTimezone,
    setAcceptLanguage,
    TIMEZONE_MAP,
};
