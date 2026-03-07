const { Cluster } = require('puppeteer-cluster');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    try {
        console.log('Launching cluster...');
        const cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_CONTEXT,
            maxConcurrency: 1,
            puppeteer: puppeteer,
            puppeteerOptions: {
                headless: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            }
        });

        cluster.on('taskerror', (err, data) => {
            console.log(`Error: ${err.message}`);
        });

        await cluster.task(async ({ page }) => {
            console.log('Task started');
            await page.goto('about:blank');
            console.log('Task success');
        });

        cluster.queue('url1');

        await cluster.idle();
        await cluster.close();
        console.log('Done');
    } catch (e) {
        console.error('Fatal:', e);
    }
})();
