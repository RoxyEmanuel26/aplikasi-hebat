/**
 * behaviors.js — Modul Interaksi Manusia & Behavioral Stealth
 * Menyediakan fungsi-fungsi simulasi layaknya manusia asli (Warming cookies, reading, internal routing)
 */

const { humanDelay } = require('./delay');

/**
 * Cookie Warming: Singgah ke domain besar (Google, Wiki, dll) untuk build riwayat cookie pihak ketiga
 * agar saat kunjungan ke web target, browser tidak terkesan "lahir kemarin" (blank profile).
 * 
 * @param {import('puppeteer').Page} page Puppeteer Page terenkapsulasi
 * @param {Array<string>} warmingUrls Array link untuk cookie warming
 * @param {import('ghost-cursor')} cursor Ghost Cursor instance
 */
async function performCookieWarming(page, warmingUrls, cursor) {
    if (!warmingUrls || warmingUrls.length === 0) return;

    const url = warmingUrls[Math.floor(Math.random() * warmingUrls.length)];
    console.log(`     -> [Warming] Mengunjungi situs pihak ke-3 (${url})`);

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Asumsikan membaca halaman pihak 3
        await humanDelay(10000, 20000); // Tunggu 10 - 20 detik berselancar

        // Scroll dikit
        await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
        await humanDelay(2000, 5000);

        console.log(`     -> [Warming] Selesai mengambil cookie organik dari ${url}`);
    } catch (err) {
        console.log(`     -> [Warming] Timeout mengunjugi situs pihak ke-3 (skip).`);
    }
}

/**
 * Simulate Reading: Fungsi untuk menstimulasi mouse blocking text/highlight, random hover
 * di tengah proses baca (seperti layaknya manusia yang gelisah / fokus pada teks).
 * 
 * @param {import('puppeteer').Page} page
 * @param {import('ghost-cursor')} cursor
 */
async function simulateReading(page, cursor) {
    try {
        // Cari semua tag P
        const paragraphs = await page.$$('p');
        if (paragraphs.length > 0) {
            // Pilih paragraf acak
            const p = paragraphs[Math.floor(Math.random() * paragraphs.length)];

            // Move cursor natural
            await cursor.moveTo(p);

            // Probabilitas 50% untuk melakukan blok teks (highlighting)
            if (Math.random() > 0.5) {
                const boundingBox = await p.boundingBox();
                if (boundingBox) {
                    await page.mouse.down();
                    // Geser cursor sedikit sbg simulasi drag-select paragraf
                    await page.mouse.move(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2, { steps: 20 });
                    await page.mouse.up();
                    await humanDelay(1000, 2000); // baca bentar
                    // klik di tempat kosong buat lepas highlight
                    await page.mouse.click(boundingBox.x, boundingBox.y - 10);
                }
            }
        }
    } catch (err) {
        // Abaikan aja kl pointer error
    }
}

/**
 * Navigate Internal Link: Mencari random tag <a href> yang url-nya match ke domain sendiri, 
 * kemudian mengklik page view kedua.
 * 
 * @param {import('puppeteer').Page} page
 * @param {import('ghost-cursor')} cursor
 * @param {string} domain Target base domain url
 * @returns {boolean} Berhasil ngeklik internal link atau tidak
 */
async function clickInternalLink(page, cursor, domain) {
    try {
        const internalLinks = await page.$$eval(
            `a[href^="/"], a[href*="${domain}"]`,
            el => el.map(a => a.href)
        );

        if (internalLinks.length === 0) return false;

        // Filter link acak & valid (tidak ada element hash # atau mailto)
        const validLinks = internalLinks.filter(href => !href.includes('#') && !href.startsWith('mailto') && !href.startsWith('javascript'));
        if (validLinks.length === 0) return false;

        const chosenLink = validLinks[Math.floor(Math.random() * validLinks.length)];

        console.log(`     -> [Internal Routing] Membuka page view #2: ${chosenLink.substring(0, 50)}...`);

        await page.goto(chosenLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
        return true;
    } catch (err) {
        return false; // Skip aja klo gagal / timeout rendering
    }
}

module.exports = {
    performCookieWarming,
    simulateReading,
    clickInternalLink
};
