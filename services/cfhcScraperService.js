const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Save path adjusted to write to the main project directory
const OUTPUT_FILE_PATH = path.join(__dirname, '../cfhc-fish-data.json');

async function scrapeCFHCFishPrices() {
  console.log('🔄 Fetching fish price data from CFHC...');
  const TARGET_URL = 'https://www.cfhc.gov.lk/home.php?lang=en';

  try {
    const response = await axios.get(TARGET_URL, {
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/115.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const scrapedFishData = [];

    $('table tr').each((index, element) => {
      if (index === 0) return;
      const columns = $(element).find('td');

      if (columns.length >= 2) {
        const fishNameRaw = $(columns[0]).text().trim();
        const priceRaw = $(columns[1]).text().trim();
        const cleanedPrice = parseFloat(priceRaw.replace(/[^0-9.]/g, ''));

        if (fishNameRaw && !isNaN(cleanedPrice)) {
          scrapedFishData.push({ name: fishNameRaw, price_lkr: cleanedPrice, unit: 'kg' });
        }
      }
    });

    if (scrapedFishData.length > 0) {
      saveDataToFile(scrapedFishData, 'CFHC Live Harbor Feed');
      return scrapedFishData;
    } else {
      return loadFallbackData();
    }

  } catch (error) {
    console.error(`❌ CFHC Scraper Notice (${error.message}). Loading system backup.`);
    return loadFallbackData();
  }
}

function loadFallbackData() {
  const fallbackPrices = [
    { name: 'Yellowfin Tuna (කෙලවල්ලා)', price_lkr: 1750, unit: 'kg' },
    { name: 'Skipjack Tuna (බලයා)', price_lkr: 1050, unit: 'kg' },
    { name: 'Sailfish (තලපත)', price_lkr: 1900, unit: 'kg' },
    { name: 'Trevally (පරවා)', price_lkr: 1500, unit: 'kg' },
    { name: 'Goldstripe Sardinella (සාලයා)', price_lkr: 450, unit: 'kg' },
    { name: 'Seer Fish (තෝරා)', price_lkr: 2400, unit: 'kg' }
  ];

  saveDataToFile(fallbackPrices, 'System estimate (CFHC feed unavailable)');
  return fallbackPrices;
}

function saveDataToFile(data, source) {
  const payload = {
    source: source,
    last_updated: new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' }),
    currency: 'LKR',
    fish_prices: data
  };

  fs.writeFileSync(OUTPUT_FILE_PATH, JSON.stringify(payload, null, 2));
  console.log('💾 Market data saved cleanly to root directory!');
}

module.exports = { scrapeCFHCFishPrices };