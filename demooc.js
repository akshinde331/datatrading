const axios = require('axios');

async function fetchNSEData() {
  try {
    // Step 1: Get fresh cookies
    const homepageResp = await axios.get("https://www.nseindia.com", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br"
      }
    });

    const cookies = homepageResp.headers['set-cookie'];

    // Step 2: Call the NSE API
    const apiResp = await axios.get(
      "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Referer": "https://www.nseindia.com/option-chain",
          "Cookie": cookies.join("; ")
        }
      }
    );

    console.log("✅ Success at:", new Date().toLocaleTimeString());
    console.log(apiResp.data);

    // Schedule next run after 1 minute
    setTimeout(fetchNSEData, 60 * 1000);

  } catch (error) {
    console.error("❌ Failed at:", new Date().toLocaleTimeString(),
      "| Status:", error.response?.status, error.response?.statusText);

    // Retry after 1 second
    setTimeout(fetchNSEData, 1000);
  }
}

// Start immediately
fetchNSEData();
