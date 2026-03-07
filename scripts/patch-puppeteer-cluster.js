/**
 * Script untuk mem-patch package puppeteer-cluster agar kompatibel
 * dengan Puppeteer v22+
 * 
 * Penggantian:
 * createIncognitoBrowserContext() -> createBrowserContext()
 */

const fs = require('fs');
const path = require('path');

const targetFiles = [
    'node_modules/puppeteer-cluster/dist/concurrency/built-in/Browser.js',
    'node_modules/puppeteer-cluster/dist/concurrency/built-in/Context.js'
];

let patchedCount = 0;

for (const file of targetFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');

        // Cek apakah belum dipatch
        if (content.includes('createIncognitoBrowserContext')) {
            content = content.replace(/createIncognitoBrowserContext/g, 'createBrowserContext');
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`[Patch] Berhasil mem-patch ${file}`);
            patchedCount++;
        } else {
            console.log(`[Patch] File sudah dipatch atau fungsi tidak ditemukan: ${file}`);
        }
    } else {
        console.warn(`[Patch] File tidak ditemukan: ${filePath}`);
    }
}

if (patchedCount > 0) {
    console.log(`[Patch] Berhasil mem-patch ${patchedCount} file di puppeteer-cluster untuk Puppeteer v22+`);
} else {
    console.log('[Patch] Tidak ada file yang perlu dipatch.');
}
