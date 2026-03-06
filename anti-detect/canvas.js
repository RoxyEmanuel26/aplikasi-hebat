/**
 * canvas.js — Canvas, WebGL, Audio spoofing via puppeteer-afp
 * Spoof fingerprint Canvas, WebGL, dan Audio agar setiap instance
 * memiliki identitas unik dan tidak terdeteksi sebagai bot.
 */

/**
 * Setup anti-fingerprint protection menggunakan puppeteer-afp
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 */
async function spoofCanvasWebGLAudio(page) {
    try {
        // Canvas fingerprint spoofing — inject noise RGBA acak
        await page.evaluateOnNewDocument(() => {
            // Override toDataURL untuk Canvas
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function (type) {
                if (type === 'image/png' || type === undefined) {
                    const canvas = this;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;
                        // Tambahkan noise RGBA kecil acak
                        for (let i = 0; i < data.length; i += 4) {
                            data[i] = data[i] + (Math.random() * 2 - 1);       // R
                            data[i + 1] = data[i + 1] + (Math.random() * 2 - 1); // G
                            data[i + 2] = data[i + 2] + (Math.random() * 2 - 1); // B
                            // Alpha tetap
                        }
                        ctx.putImageData(imageData, 0, 0);
                    }
                }
                return originalToDataURL.apply(this, arguments);
            };

            // Override toBlob untuk Canvas
            const originalToBlob = HTMLCanvasElement.prototype.toBlob;
            HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
                if (type === 'image/png' || type === undefined) {
                    const canvas = this;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;
                        for (let i = 0; i < data.length; i += 4) {
                            data[i] = data[i] + (Math.random() * 2 - 1);
                            data[i + 1] = data[i + 1] + (Math.random() * 2 - 1);
                            data[i + 2] = data[i + 2] + (Math.random() * 2 - 1);
                        }
                        ctx.putImageData(imageData, 0, 0);
                    }
                }
                return originalToBlob.apply(this, arguments);
            };
        });

        // WebGL fingerprint spoofing — override vendor & renderer
        await page.evaluateOnNewDocument(() => {
            const vendors = [
                'Google Inc. (NVIDIA)',
                'Google Inc. (AMD)',
                'Google Inc. (Intel)',
                'Google Inc. (Apple)',
                'Google Inc.',
            ];
            const renderers = [
                'ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
                'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
                'ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
                'ANGLE (Apple M1 Metal)',
                'ANGLE (NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0)',
                'ANGLE (AMD Radeon Vega 8 Direct3D11 vs_5_0 ps_5_0)',
                'ANGLE (Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)',
            ];

            const randomVendor = vendors[Math.floor(Math.random() * vendors.length)];
            const randomRenderer = renderers[Math.floor(Math.random() * renderers.length)];

            const getParameterOriginal = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (param) {
                // UNMASKED_VENDOR_WEBGL = 0x9245
                if (param === 0x9245) return randomVendor;
                // UNMASKED_RENDERER_WEBGL = 0x9246
                if (param === 0x9246) return randomRenderer;
                return getParameterOriginal.apply(this, arguments);
            };

            // WebGL2 juga
            if (typeof WebGL2RenderingContext !== 'undefined') {
                const getParameter2Original = WebGL2RenderingContext.prototype.getParameter;
                WebGL2RenderingContext.prototype.getParameter = function (param) {
                    if (param === 0x9245) return randomVendor;
                    if (param === 0x9246) return randomRenderer;
                    return getParameter2Original.apply(this, arguments);
                };
            }
        });

        // AudioContext fingerprint spoofing
        await page.evaluateOnNewDocument(() => {
            const context = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : null;
            if (context) {
                const originalGetChannelData = AudioBuffer.prototype.getChannelData;
                AudioBuffer.prototype.getChannelData = function (channel) {
                    const data = originalGetChannelData.apply(this, arguments);
                    // Tambahkan noise kecil ke audio data
                    for (let i = 0; i < data.length; i += 100) {
                        data[i] = data[i] + (Math.random() * 0.0001 - 0.00005);
                    }
                    return data;
                };
            }
        });

        // WebRTC protection — prevent real IP leak
        await page.evaluateOnNewDocument(() => {
            // Disable WebRTC IP leak
            Object.defineProperty(navigator, 'mediaDevices', {
                get: () => ({
                    enumerateDevices: () => Promise.resolve([]),
                    getUserMedia: () => Promise.reject(new Error('Permission denied')),
                }),
            });

            // Block RTCPeerConnection to prevent IP leak
            window.RTCPeerConnection = undefined;
            window.webkitRTCPeerConnection = undefined;
            window.mozRTCPeerConnection = undefined;
        });
    } catch (err) {
        console.warn(`[Canvas/WebGL/Audio] Spoofing warning: ${err.message}`);
    }
}

module.exports = { spoofCanvasWebGLAudio };
