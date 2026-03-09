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
 * @returns {{ handler: Function, getCount: () => number, cancel: () => void }}
 */
function createPopunderHandler(browser, visitId, config) {
    let popunderCount = 0;
    let totalDetected = 0;
    let cancelled = false;

    const handler = async (target) => {
        try {
            if (cancelled) return;
            if (target.type() !== 'page') return;

            const newTab = await target.page();
            if (!newTab) return;

            // Tunggu agar popup sempat redirect dari about:blank
            await new Promise(r => setTimeout(r, 800));
            if (cancelled) { await newTab.close().catch(() => { }); return; }

            let url = '';
            try { url = newTab.url(); } catch { url = ''; }

            if (!url || url === 'about:blank' || url === '') {
                await new Promise(r => setTimeout(r, 1500));
                if (cancelled) { await newTab.close().catch(() => { }); return; }
                try { url = newTab.url(); } catch { url = ''; }
            }

            // Abaikan URL internal atau blank
            if (
                !url ||
                url === '' ||
                url === 'about:blank' ||
                url.startsWith('chrome') ||
                url.startsWith('about:') ||
                url.startsWith('data:')
            ) return;

            // Abaikan jika URL = TARGET_URL atau HOMEPAGE_URL
            if (url === config.TARGET_URL || url === config.HOMEPAGE_URL) return;

            totalDetected++;
            popunderCount++;

            console.log(`     -> [Popunder #${visitId}] Tab baru terdeteksi (${popunderCount}/${config.POPUNDER_MAX_TABS}): ${url.substring(0, 70)}...`);

            // Jika melebihi batas tab, tutup langsung
            if (popunderCount > config.POPUNDER_MAX_TABS) {
                console.log(`     -> [Popunder #${visitId}] Melebihi batas tab, langsung tutup.`);
                await newTab.close().catch(() => { });
                popunderCount--;
                return;
            }

            // Simulasi impresi dengan delay
            const delay = config.POPUNDER_MIN_DELAY + Math.random() * (config.POPUNDER_MAX_DELAY - config.POPUNDER_MIN_DELAY);

            // Pecah delay menjadi potongan kecil agar bisa di-cancel
            const chunkMs = 300;
            let elapsed = 0;
            while (elapsed < delay) {
                if (cancelled) { await newTab.close().catch(() => { }); popunderCount--; return; }
                await new Promise(r => setTimeout(r, Math.min(chunkMs, delay - elapsed)));
                elapsed += chunkMs;
            }

            if (cancelled) { await newTab.close().catch(() => { }); popunderCount--; return; }

            // Scroll natural di tab popunder
            await newTab.evaluate(() => {
                window.scrollBy({ top: Math.random() * 300 + 100, behavior: 'smooth' });
            }).catch(() => { });

            await new Promise(r => setTimeout(r, 800));
            if (cancelled) { await newTab.close().catch(() => { }); popunderCount--; return; }

            await newTab.close().catch(() => { });
            popunderCount--;

            console.log(`     -> [Popunder #${visitId}] Ditutup setelah simulasi impresi (${Math.round(delay)}ms).`);

        } catch (e) {
            try {
                const newTab = await target.page().catch(() => null);
                if (newTab && !newTab.isClosed()) {
                    await newTab.close().catch(() => { });
                }
            } catch (_) { }
            popunderCount = Math.max(0, popunderCount - 1);
        }
    };

    browser.on('targetcreated', handler);

    return {
        handler,
        getCount: () => totalDetected,
        cancel: () => { cancelled = true; }
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
    } catch (e) { }
}

module.exports = { createPopunderHandler, removePopunderHandler };
