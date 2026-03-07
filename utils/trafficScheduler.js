/**
 * trafficScheduler.js — Pengatur Jadwal Operasi Bot
 * Memastikan bot hanya berjalan di jam-jam realistis dan mengirim
 * traffic lebih padat di jam puncak (peak hours).
 */

/**
 * Cek apakah sekarang dalam jam operasional
 * @param {object} config
 * @returns {boolean}
 */
function isOperationalHour(config) {
    if (!config.USE_TRAFFIC_SCHEDULE) return true;

    const now = new Date();
    const hour = now.getHours();
    return hour >= config.SCHEDULE_START_HOUR && hour < config.SCHEDULE_END_HOUR;
}

/**
 * Tunggu sampai masuk jam operasional (blocking loop)
 * @param {object} config
 */
async function waitUntilOperationalHour(config) {
    if (!config.USE_TRAFFIC_SCHEDULE) return;

    while (!isOperationalHour(config)) {
        const now = new Date();
        const currentHour = now.getHours();
        let hoursUntilStart;

        if (currentHour >= config.SCHEDULE_END_HOUR) {
            // Sudah lewat jam tutup, tunggu sampai besok pagi
            hoursUntilStart = (24 - currentHour) + config.SCHEDULE_START_HOUR;
        } else {
            // Sebelum jam buka
            hoursUntilStart = config.SCHEDULE_START_HOUR - currentHour;
        }

        console.log(`[Scheduler] Di luar jam operasional (${currentHour}:00). Menunggu ~${hoursUntilStart} jam hingga jam ${config.SCHEDULE_START_HOUR}:00...`);

        // Tunggu 1 menit lalu cek lagi
        await new Promise(r => setTimeout(r, 60000));
    }
}

/**
 * Hitung delay antar visit berdasarkan apakah sekarang peak hour atau bukan
 * @param {object} config
 * @returns {number} Delay dalam ms
 */
function getVisitDelay(config) {
    const hour = new Date().getHours();
    const isPeak = config.PEAK_HOURS && config.PEAK_HOURS.includes(hour);

    if (isPeak) {
        // Jam puncak: delay pendek (500–1500ms)
        return Math.floor(Math.random() * 1000) + 500;
    } else {
        // Off-peak: delay lebih panjang (2000–5000ms)
        return Math.floor(Math.random() * 3000) + 2000;
    }
}

module.exports = {
    isOperationalHour,
    waitUntilOperationalHour,
    getVisitDelay
};
