# Website Load Testing & Interaction Bot

Bot untuk mensimulasikan **10.000 pengunjung unik per hari** ke sebuah website, di mana setiap pengunjung akan mengklik banner tertentu di halaman utama. Dilengkapi dengan anti-detection lengkap agar setiap kunjungan terlihat natural.

## Fitur Anti-Detection

| Fitur | Keterangan |
|-------|-----------|
| **Stealth Plugin** | Sembunyikan `navigator.webdriver` |
| **Anonymize UA** | Random User-Agent (Windows-style) |
| **Ghost Cursor** | Gerakan mouse natural saat klik |
| **Canvas/WebGL/Audio** | Spoof fingerprint unik per instance |
| **Fingerprint Generator** | Browser, OS, device random per instance |
| **Random Viewport** | Desktop, Laptop, Mobile, Tablet |
| **Timezone Spoofing** | 15 timezone global dengan locale sesuai |
| **Accept-Language** | Header bahasa sesuai timezone |
| **Cookie Injection** | `_ga`, `_gid`, `visited` natural |
| **Referer Header** | Dari Google Search |
| **Natural Scroll** | Scroll smooth 200–500px |
| **Random Delays** | Jeda acak antar semua aksi |
| **Multi-step Nav** | Homepage dulu, baru target page |

## Prasyarat

- **Node.js** v18 atau lebih baru
- **NPM** v8 atau lebih baru
- Akun **9Proxy** untuk rotating residential proxy

## Setup

1. **Clone / Copy** folder `bot/` ke komputer Anda

2. **Install dependencies:**
   ```bash
   cd bot
   npm install
   ```

3. **Edit konfigurasi** di `config.js`:
   ```javascript
   module.exports = {
     TARGET_URL: 'https://websitesaya.com',        // URL target
     BANNER_SELECTOR: '#banner-discord',            // CSS selector banner
     MAX_CONCURRENCY: 50,                           // Browser paralel
     TOTAL_VISITS: 10000,                           // Total kunjungan
     PROXY_ENDPOINT: 'http://USER:PASS@proxy.9proxy.com:8080',
     HEADLESS: true,                                // true = tanpa GUI
     SCREENSHOT_ENABLED: false,                     // Screenshot per visit
     LOG_RESPONSE_TIME: true,                       // Log ke CSV
     WEBSITE_NAME: 'websitesaya',                   // Untuk referer Google
     HOMEPAGE_URL: 'https://websitesaya.com',       // Homepage URL
   };
   ```

4. **Jalankan bot:**
   ```bash
   node index.js
   ```
   atau:
   ```bash
   npm start
   ```

## Output

### Console
```
[Bot Started] Target: https://websitesaya.com | Total Visits: 10000 | Concurrency: 50
[Visit #1]   Time: 1243ms | Viewport: 1920x1080 | Status: ✅ OK
[Visit #2]   Time: 987ms  | Viewport: 390x844   | Status: ✅ OK
...
[Progress] 100/10000 visits completed...
...
========== SUMMARY ==========
Total Visits    : 10000
Success         : 9987 (99.87%)
Failed          : 13
Avg Response    : 1124ms
Fastest         : 432ms
Slowest         : 8921ms
Results saved to: results/log.csv
=============================
```

### CSV Log (`results/log.csv`)
| visit_id | timestamp | response_time_ms | proxy_used | viewport | status |
|----------|-----------|------------------|------------|----------|--------|
| 1 | 2026-03-06T... | 1243 | proxy.9proxy.com:8080 | 1920x1080 | OK |
| 2 | 2026-03-06T... | 987 | proxy.9proxy.com:8080 | 390x844 | OK |

## Struktur Folder

```
bot/
├── index.js              # Entry point utama
├── config.js             # Semua konfigurasi
├── cluster.js            # Setup puppeteer-cluster
├── task.js               # Logic utama per instance
├── anti-detect/
│   ├── fingerprint.js    # Fingerprint gen & inject
│   ├── canvas.js         # Canvas, WebGL, Audio spoofing
│   ├── timezone.js       # Timezone & bahasa spoofing
│   └── cookies.js        # Cookie injection natural
├── proxy/
│   └── proxyManager.js   # Manajemen proxy 9Proxy
├── utils/
│   ├── logger.js         # Logger + CSV + summary
│   ├── delay.js          # Random delay helper
│   └── viewport.js       # Random viewport generator
├── results/
│   └── log.csv           # Output log (auto-generated)
├── screenshots/          # Screenshot per visit (opsional)
├── package.json
└── README.md
```

## Tips

- **Debugging:** Set `HEADLESS: false` di `config.js` untuk melihat browser berjalan
- **Screenshot:** Set `SCREENSHOT_ENABLED: true` untuk menyimpan screenshot setiap visit
- **Concurrency:** Sesuaikan `MAX_CONCURRENCY` dengan spesifikasi mesin (RAM & CPU)
- **Proxy:** Pastikan akun 9Proxy Anda aktif dan endpoint benar

## Troubleshooting

- **Error "Browser was not found"**: Pastikan Chromium terdownload (`npx puppeteer install`)
- **Timeout errors banyak**: Turunkan `MAX_CONCURRENCY` atau periksa koneksi proxy
- **ECONNREFUSED**: Periksa endpoint proxy di `config.js`
