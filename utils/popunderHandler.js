/**
 * popunderHandler.js — Modul Popunder Ad Simulation (Mode 2)
 * Mendeteksi tab popunder yang dibuka oleh iklan di website target,
 * mensimulasikan "orang melihat" iklan tersebut (scroll + delay),
 * lalu menutup tab secara otomatis.
 */

const { humanDelay } = require('./delay');

/**
 * Membuat dan memasang event listener 'targetcreated' ke browser
 * untuk mendeteksi tab popunder baru.
 * 
 * @param {import('puppeteer').Browser} browser - Instance browser Puppeteer
 * @param {number} visitId - ID kunjungan untuk logging
 * @param {object} config - Objek konfigurasi dari config.js
 * @returns {{ handler: Function, getCount: () => number }}
 */
function createPopunderHandler(browser, visitId, config) {
    let popunderCount = 0;
    let totalDetected = 0;

    const handler = async (target) => {
        try {
            // 1. Hanya proses target bertipe 'page'
            if (target.type() !== 'page') return;

            // 2. Ambil page object dari target baru
            const newTab = await target.page();
            if (!newTab) return;

            // 3. Ambil URL tab baru
            const url = await newTab.url().catch(() => 'unknown');

            // 4. Abaikan URL internal browser dan blank tab saat launch
            if (
                url.startsWith('chrome') ||
                url.startsWith('about:') ||
                url.startsWith('data:') ||
                url === '' ||
                url === 'about:blank'
            ) return;

            // 5. Abaikan jika URL = TARGET_URL atau HOMEPAGE_URL (bukan popunder)
            if (url === config.TARGET_URL || url === config.HOMEPAGE_URL) return;

            // 6. Popunder terdeteksi!
            totalDetected++;
            popunderCount++;

            console.log(`     -> [Popunder #${visitId}] Tab baru terdeteksi (${popunderCount}/${config.POPUNDER_MAX_TABS}): ${url.substring(0, 70)}...`);

            // 7. Jika sudah melebihi batas tab, langsung tutup tanpa delay
            if (popunderCount > config.POPUNDER_MAX_TABS) {
                console.log(`     -> [Popunder #${visitId}] Melebihi batas tab, langsung tutup.`);
                await newTab.close().catch(() => { });
                popunderCount--;
                return;
            }

            // 8. Simulasi impresi: tunggu acak MIN_DELAY – MAX_DELAY
            const delay = config.POPUNDER_MIN_DELAY + Math.random() * (config.POPUNDER_MAX_DELAY - config.POPUNDER_MIN_DELAY);
            await new Promise(r => setTimeout(r, delay));

            // 9. Scroll sedikit di tab popunder (biar keliatan natural)
            await newTab.evaluate(() => {
                window.scrollBy({ top: Math.random() * 300 + 100, behavior: 'smooth' });
            }).catch(() => { });

            // 10. Tunggu lagi sebentar setelah scroll
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));

            // 11. Tutup tab popunder
            await newTab.close().catch(() => { });
            popunderCount--;

            console.log(`     -> [Popunder #${visitId}] Ditutup setelah simulasi impresi (${Math.round(delay)}ms).`);

        } catch (e) {
            // Abaikan semua error — tab popunder bisa tertutup sendiri kapan saja
            popunderCount = Math.max(0, popunderCount - 1);
        }
    };

    // Pasang event listener
    browser.on('targetcreated', handler);

    return {
        handler,
        getCount: () => totalDetected
    };
}

/**
 * Melepas event listener popunder dari browser.
 * HARUS dipanggil di blok finally untuk mencegah memory leak.
 * 
 * @param {import('puppeteer').Browser} browser - Instance browser Puppeteer
 * @param {Function} handler - Referensi fungsi handler yang akan dilepas
 */
function removePopunderHandler(browser, handler) {
    try {
        browser.off('targetcreated', handler);
    } catch (e) {
        // Abaikan jika browser sudah tertutup
    }
}

module.exports = {
    createPopunderHandler,
    removePopunderHandler
};
