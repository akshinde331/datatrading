const puppeteer = require('puppeteer');


async function startFetchingEvery5Sec() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set user agent and viewport to mimic a real browser
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1280, height: 800 });

  async function fetchNSEOptionChain() {
    try {
      // Visit NSE homepage to establish session and cookies
      await page.goto('https://www.nseindia.com', { waitUntil: 'domcontentloaded' });
      // Wait for cookies/session using a standard JS delay
      await new Promise(res => setTimeout(res, 2000));

      // Fetch the option chain API as the browser
      const apiUrl = 'https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY';
      const data = await page.evaluate(async (apiUrl) => {
        const response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://www.nseindia.com/option-chain',
          },
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
      }, apiUrl);

      console.log('✅ Success at:', new Date().toLocaleTimeString());
      console.log(data);
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  // Fetch immediately, then every 5 seconds
  await fetchNSEOptionChain();
  setInterval(fetchNSEOptionChain, 5000);
}

startFetchingEvery5Sec();
