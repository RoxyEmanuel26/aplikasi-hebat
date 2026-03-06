/**
 * config.js — Konfigurasi terpusat untuk Website Load Testing Bot
 * Ubah nilai-nilai di bawah sesuai kebutuhan testing Anda.
 */

module.exports = {
  // URL website yang akan ditest
  TARGET_URL: 'https://roxynime.vercel.app',

  // CSS selector dari banner yang akan diklik (contoh: banner Discord)
  BANNER_SELECTOR: '#banner-discord',

  // Jumlah Chrome paralel maksimal
  MAX_CONCURRENCY: 50,

  // Total kunjungan yang ingin disimulasikan
  TOTAL_VISITS: 10000,

  // Konfigurasi API 9Proxy
  // Target API untuk fetch proxy list today
  PROXY_API_URL: 'http://127.0.0.1:10101/api/today_list?t=2&limit=50&today',

  // Port lokal aplikasi 9Proxy berjalan
  PROXY_API_PORT: 10101,

  // Host lokal untuk proxy
  PROXY_LOCAL_HOST: '127.0.0.1',

  // Authentication proxy (default 9Proxy config)
  PROXY_USERNAME: 'roxy',
  PROXY_PASSWORD: 'Roxy2603',

  // Maksimal list proxy yang ingin diambil dalam satu request
  PROXY_LIMIT: 50,
  // true untuk production (tanpa GUI), false untuk debugging (tampilkan browser)
  HEADLESS: true,

  // Aktifkan screenshot per instance (disimpan di folder screenshots/)
  SCREENSHOT_ENABLED: false,

  // Aktifkan logging response time ke CSV
  LOG_RESPONSE_TIME: true,

  // Nama website untuk Referer header Google Search
  WEBSITE_NAME: 'websitesaya',

  // Homepage URL (jika berbeda dari TARGET_URL, navigasi ke sini dulu)
  HOMEPAGE_URL: 'https://roxy.my.id',

  // ========== ADVANCED STEALTH & BEHAVIOR ==========
  // Probabilitas sebuah visit akan mengklik banner (0.03 = 3% kunjungan akan click, 97% impression only)
  CTR_TARGET: 0.03,

  // Daftar website besar untuk "Cookie Warming"
  WARMING_URLS: [
    'https://www.google.com',
    'https://www.wikipedia.org',
    'https://www.amazon.com',
    'https://www.youtube.com',
    'https://www.reddit.com'
  ],

  // Daftar sumber trafik palsu (Referer Headers)
  REFERERS: [
    'https://www.google.com/search?q=website+saya',
    'https://www.bing.com/search?q=info+terbaru',
    'https://m.facebook.com/',
    'https://t.co/', // Twitter shortlink
    'direct' // Ketikan URL langsung
  ],
};
