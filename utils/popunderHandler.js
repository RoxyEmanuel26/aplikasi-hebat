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

            // 3. Tunggu sebentar agar popup sempat redirect dari about:blank
            await new Promise(r => setTimeout(r, 800));

            // 4. Ambil URL tab baru setelah jeda pertama
            let url = '';
            try { url = newTab.url(); } catch { url = ''; }

            // 5. Kalau masih blank/kosong, tunggu sekali lagi lebih lama
            if (!url || url === 'about:blank' || url === '') {
                await new Promise(r => setTimeout(r, 1500));
                try { url = newTab.url(); } catch { url = ''; }
            }

            // 6. Abaikan URL internal browser (termasuk about:blank yang gagal redirect)
            if (
                !url ||
                url === '' ||
                url === 'about:blank' ||
                url.startsWith('chrome') ||
                url.startsWith('about:') ||
                url.startsWith('data:')
            ) return;

            // 7. Abaikan jika URL = TARGET_URL atau HOMEPAGE_URL (bukan popunder)
            if (url === config.TARGET_URL || url === config.HOMEPAGE_URL) return;

            // 8. Popunder terdeteksi!
            totalDetected++;
            popunderCount++;

            console.log(`     -> [Popunder #${visitId}] Tab baru terdeteksi (${popunderCount}/${config.POPUNDER_MAX_TABS}): ${url.substring(0, 70)}...`);

            // 9. Jika sudah melebihi batas tab, langsung tutup tanpa delay
            if (popunderCount > config.POPUNDER_MAX_TABS) {
                console.log(`     -> [Popunder #${visitId}] Melebihi batas tab, langsung tutup.`);
                await newTab.close().catch(() => { });
                popunderCount--;
                return;
            }

            // 10. Simulasi impresi: tunggu acak MIN_DELAY - MAX_DELAY
            const delay = config.POPUNDER_MIN_DELAY + Math.random() * (config.POPUNDER_MAX_DELAY - config.POPUNDER_MIN_DELAY);
            await new Promise(r => setTimeout(r, delay));

            // 11. Scroll sedikit di tab popunder (biar keliatan natural)
            await newTab.evaluate(() => {
                window.scrollBy({ top: Math.random() * 300 + 100, behavior: 'smooth' });
            }).catch(() => { });

            // 12. Tunggu lagi sebentar setelah scroll
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));

            // 13. Tutup tab popunder
            await newTab.close().catch(() => { });
            popunderCount--;

            console.log(`     -> [Popunder #${visitId}] Ditutup setelah simulasi impresi (${Math.round(delay)}ms).`);

        } catch (e) {
            // Coba tutup tab jika masih terbuka meski ada error
            try {
                const newTab = await target.page().catch(() => null);
                if (newTab && !newTab.isClosed()) {
                    await newTab.close().catch(() => { });
                }
            } catch (_) { }
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
