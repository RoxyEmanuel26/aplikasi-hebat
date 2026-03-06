/**
 * logger.js — Logger hasil test
 * Mencatat setiap kunjungan ke console dan file CSV,
 * serta menampilkan summary statistik di akhir.
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'results');
const LOG_FILE = path.join(LOG_DIR, 'log.csv');

// Pastikan folder results/ ada
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Tulis header CSV jika file belum ada
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'visit_id,timestamp,response_time_ms,proxy_used,viewport,status\n', 'utf-8');
}

// Buffer untuk menyimpan semua hasil (untuk summary)
const results = [];

/**
 * Log satu kunjungan ke console dan CSV
 * @param {object} entry
 * @param {number} entry.visitId - Nomor kunjungan
 * @param {number} entry.responseTime - Response time dalam ms
 * @param {string} entry.proxy - Proxy endpoint yang digunakan
 * @param {string} entry.viewport - Label viewport (contoh: "1920x1080")
 * @param {string} entry.status - "OK" atau "FAIL"
 * @param {string} [entry.error] - Pesan error jika status FAIL
 */
function logVisit(entry) {
    const { visitId, responseTime, proxy, viewport, status, error } = entry;
    const timestamp = new Date().toISOString();
    const icon = status === 'OK' ? '✅' : '❌';

    // Console output
    if (status === 'OK') {
        console.log(
            `[Visit #${visitId}] Proxy: ${proxy} | Time: ${responseTime}ms | Viewport: ${viewport} | Status: ${icon} OK`
        );
    } else {
        console.log(
            `[Visit #${visitId}] Proxy: ${proxy} | Time: ${responseTime || '-'}ms | Viewport: ${viewport} | Status: ${icon} FAIL | ${error || 'Unknown error'}`
        );
    }

    // Simpan ke buffer
    results.push({ visitId, timestamp, responseTime: responseTime || 0, proxy, viewport, status });

    // Append ke CSV
    const csvLine = `${visitId},${timestamp},${responseTime || 0},${proxy},${viewport},${status}\n`;
    fs.appendFileSync(LOG_FILE, csvLine, 'utf-8');
}

/**
 * Tampilkan progress update
 * @param {number} completed - Jumlah yang sudah selesai
 * @param {number} total - Total target
 */
function logProgress(completed, total) {
    console.log(`[Progress] ${completed}/${total} visits completed...`);
}

/**
 * Tampilkan summary statistik di akhir
 */
function printSummary() {
    const total = results.length;
    const successes = results.filter((r) => r.status === 'OK');
    const failures = results.filter((r) => r.status === 'FAIL');
    const successCount = successes.length;
    const failCount = failures.length;
    const successRate = total > 0 ? ((successCount / total) * 100).toFixed(2) : '0.00';

    const responseTimes = successes.map((r) => r.responseTime).filter((t) => t > 0);
    const avgResponse = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;
    const fastest = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const slowest = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

    console.log('');
    console.log('========== SUMMARY ==========');
    console.log(`Total Visits    : ${total}`);
    console.log(`Success         : ${successCount} (${successRate}%)`);
    console.log(`Failed          : ${failCount}`);
    console.log(`Avg Response    : ${avgResponse}ms`);
    console.log(`Fastest         : ${fastest}ms`);
    console.log(`Slowest         : ${slowest}ms`);
    console.log(`Results saved to: results/log.csv`);
    console.log('=============================');
}

module.exports = {
    logVisit,
    logProgress,
    printSummary,
};
