/**
 * viewport.js — Random viewport generator
 * Menghasilkan ukuran viewport acak dari daftar resolusi populer
 * untuk mensimulasikan berbagai jenis perangkat.
 */

const VIEWPORTS = [
    { width: 1920, height: 1080, label: '1920x1080', deviceScaleFactor: 1, isMobile: false },   // Desktop FHD
    { width: 1366, height: 768, label: '1366x768', deviceScaleFactor: 1, isMobile: false },   // Laptop HD
    { width: 1440, height: 900, label: '1440x900', deviceScaleFactor: 2, isMobile: false },   // MacBook
    { width: 390, height: 844, label: '390x844', deviceScaleFactor: 3, isMobile: true },    // iPhone 14
    { width: 412, height: 915, label: '412x915', deviceScaleFactor: 2.625, isMobile: true },// Samsung Galaxy
    { width: 768, height: 1024, label: '768x1024', deviceScaleFactor: 2, isMobile: true },    // iPad
];

/**
 * Mengembalikan viewport acak dari daftar
 * @returns {{ width: number, height: number, label: string, deviceScaleFactor: number, isMobile: boolean }}
 */
function randomViewport() {
    return VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
}

module.exports = { randomViewport, VIEWPORTS };
