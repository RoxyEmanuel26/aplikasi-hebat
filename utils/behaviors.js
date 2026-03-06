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
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;

    console.log(`     -> [Warming] Mengunjungi situs pihak ke-3 (${url})`);

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Asumsikan membaca halaman depan bentar
        await humanDelay(3000, 8000);

        // Cari link internal di web pihak ketiga (seperti produk Amazon, video Youtube, halaman Wikipedia)
        const links = await page.$$eval(
            `a[href^="/"], a[href*="${domain}"]`,
            elements => elements
                .map(a => a.href)
                .filter(href => !href.includes('#') && !href.startsWith('javascript') && !href.startsWith('mailto'))
        );

        if (links.length > 0) {
            const randomLink = links[Math.floor(Math.random() * links.length)];
            console.log(`     -> [Warming] Berinteraksi dengan konten: ${randomLink.substring(0, 60)}...`);

            try {
                // Navigasi ke video/produk/artikel tersebut
                await page.goto(randomLink, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Simulasi durasi menonton video atau membaca deskripsi produk (15 - 30 detik)
                await humanDelay(15000, 30000);

                // Scroll natural kebawah buat baca komentar / deskripsi 
                await page.evaluate(() => {
                    const scrollAmount = Math.floor(Math.random() * 800) + 300;
                    window.scrollBy({ top: scrollAmount, left: 0, behavior: 'smooth' });
                });
                await humanDelay(3000, 8000);

            } catch (innerErr) {
                // Abaikan error navigasi internal warming
            }
        } else {
            // Jika aneh ngga nemu link, cukup scroll di beranda aja
            await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
            await humanDelay(10000, 20000);
        }

        console.log(`     -> [Warming] Selesai mengambil cookie organik dari profil ${domain}.`);
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

/**
 * Simulate Micro Typing: Mengklik kolom input pertama yang ditemui (search bar / formulir),
 * lalu mengetik teks asal dengan human-like delay (lambat), ada risiko typo dikit otomatis,
 * lalau menghapusnya / membatalkannya. (Simulasi keraguan form abu-abu).
 * 
 * @param {import('puppeteer').Page} page
 * @param {import('ghost-cursor')} cursor
 */
async function simulateMicroTyping(page, cursor) {
    try {
        // Cari input text, textarea, atau kolom search aja yang aman diketik
        const inputs = await page.$$('input[type="text"], input[type="search"], textarea');
        if (inputs.length === 0) return;

        // Pilih satu acak
        const targetInput = inputs[Math.floor(Math.random() * inputs.length)];

        // Pindah wajar ke input box
        await cursor.click(targetInput);

        // Kata-kata ragu random
        const typoWords = ['cari apaan', 'harga m', 'how to ', 'tes tes', 'batal ah'];
        const word = typoWords[Math.floor(Math.random() * typoWords.length)];

        // Ketik human like: delay per keystroke bisa ngelag pelan banget (100 - 450ms pr char)
        await page.keyboard.type(word, { delay: Math.floor(Math.random() * 350) + 100 });

        // Berhenti / ragu 2 detik
        await humanDelay(1500, 3000);

        // Hapus pelan pelan pake backspace
        for (let i = 0; i < word.length; i++) {
            await page.keyboard.press('Backspace');
            await humanDelay(50, 150); // backspace lebih cepet biasanya 
        }

        // blur focus
        await page.mouse.click(10, 10);
        console.log(`     -> [Behavior] Melalui Micro-Typing (Keraguan Keyboard).`);

    } catch (err) {
        // Abaikan
    }
}

/**
 * Apply Dynamic Reading Pacing: Menyuntikkan delay acak berbobot yang
 * mencerminkan "kepribadian" bot untuk membaca konten yang bervariasi.
 * Mendistribusikan waktu page view untuk Analytics Session Durations.
 * 
 * @param {object} distribution - Object distribusi seperti pada config (skimmer: 0.3, average: 0.6, slow: 0.1)
 */
async function applyReadingPacing(distribution) {
    const decider = Math.random();
    let waitTime = 0;
    let label = '';

    if (decider < distribution.skimmer) {
        // Skimmer: Cabut ngebut (5s - 15s)
        waitTime = Math.floor(Math.random() * 10000) + 5000;
        label = 'Skimmer';
    } else if (decider < (distribution.skimmer + distribution.average)) {
        // Average: Baca biasa (20s - 60s)
        waitTime = Math.floor(Math.random() * 40000) + 20000;
        label = 'Average Reader';
    } else {
        // Slow: Diam di web lama (60s - 150s)
        waitTime = Math.floor(Math.random() * 90000) + 60000;
        label = 'Slow Reader';
    }

    console.log(`     -> [Pacing] Profil Sesi: ${label}. Hold durasi: ${Math.round(waitTime / 1000)} detik...`);
    await humanDelay(waitTime, waitTime + 500);
}

module.exports = {
    performCookieWarming,
    simulateReading,
    clickInternalLink,
    simulateMicroTyping,
    applyReadingPacing
};
