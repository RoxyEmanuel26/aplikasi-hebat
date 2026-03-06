/**
 * delay.js — Random delay helper functions
 * Mensimulasikan jeda waktu natural antar aksi agar terlihat seperti pengguna asli.
 */

/**
 * Menghasilkan delay acak antara min dan max (ms)
 * @param {number} min - Minimum delay dalam ms
 * @param {number} max - Maximum delay dalam ms
 * @returns {Promise<void>}
 */
function randomDelay(min, max) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Delay pendek: 500ms – 1500ms */
function shortDelay() {
    return randomDelay(500, 1500);
}

/** Delay menengah: 1500ms – 3500ms */
function mediumDelay() {
    return randomDelay(1500, 3500);
}

/** Delay panjang: 3500ms – 6000ms */
function longDelay() {
    return randomDelay(3500, 6000);
}

/** Delay menyerupai manusia: 800ms – 2500ms */
function humanDelay() {
    return randomDelay(800, 2500);
}

module.exports = {
    randomDelay,
    shortDelay,
    mediumDelay,
    longDelay,
    humanDelay,
};
