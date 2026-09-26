const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const https = require('https');
const cron = require('node-cron');

// SSL Certificate bypass agent for Sri Lankan government websites (.gov.lk)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Save location: Root directory of backend (market-data.json)
const OUTPUT_FILE_PATH = path.join(__dirname, '../market-data.json');

// 1. SCRAPE FUEL PRICES FROM CEYPETCO (https://ceypetco.gov.lk/marketing-sales/)
async function scrapeFuelPrices() {
  console.log('⛽ Fetching live fuel prices from Ceypetco Marketing & Sales...');

  const CEYPETCO_URL = 'https://ceypetco.gov.lk/marketing-sales/';

  let previousData = {};
  try {
    previousData = JSON.parse(fs.readFileSync(OUTPUT_FILE_PATH, 'utf8'));
  } catch {
    // The first successful scrape creates the market data file.
  }

  const fuelData = {
    auto_diesel: previousData.fuel?.auto_diesel ?? null,
    super_diesel: previousData.fuel?.super_diesel ?? null,
    kerosene: previousData.fuel?.kerosene ?? null,
  };
  const effectiveFrom = { ...(previousData.fuel_effective_from || {}) };
  const updatedKeys = new Set();

  try {
    const response = await axios.get(CEYPETCO_URL, {
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    $('.fuel-name').each((_, element) => {
      const productName = $(element).text().replace(/\s+/g, ' ').trim();
      const card = $(element).parent().parent();
      const priceText = card.find('.price-value').text().trim();
      const priceMatch = priceText.match(/[\d,]+(?:\.\d+)?/);
      const price = priceMatch ? Number(priceMatch[0].replace(/,/g, '')) : NaN;
      const dateText = card.find('.effective-date').text().replace(/\s+/g, ' ').trim();
      const dateMatch = dateText.match(/Effect\s+from:\s*(.*)$/i);

      if (!Number.isFinite(price) || price <= 0 || !/per\s+Ltr/i.test(priceText)) return;

      let key;
      if (/\bAuto Diesel\b/i.test(productName)) key = 'auto_diesel';
      else if (/\bSuper Diesel\b/i.test(productName)) key = 'super_diesel';
      else if (/\bKerosene\b/i.test(productName) && !/Industrial/i.test(productName)) key = 'kerosene';
      if (!key) return;

      fuelData[key] = price;
      updatedKeys.add(key);
      if (dateMatch?.[1]) effectiveFrom[key] = dateMatch[1].trim();
    });

    const missingKeys = ['auto_diesel', 'super_diesel', 'kerosene'].filter((key) => !updatedKeys.has(key));
    if (missingKeys.length) console.warn(`⚠️ Ceypetco prices not refreshed for: ${missingKeys.join(', ')}`);
    else console.log('✅ All supported Ceypetco fuel prices were refreshed');
    return { fuel: fuelData, effectiveFrom, updated: updatedKeys.size > 0 };

  } catch (error) {
    console.warn(`⚠️ Ceypetco site unreachable (${error.message}). Keeping last known prices.`);
    return { fuel: fuelData, effectiveFrom, updated: false };
  }
}

// =========================================================================
// 2. SCRAPE FISH PRICES FROM CFHC (http://www.cfhc.gov.lk/)
// =========================================================================
async function scrapeFishPrices() {
  console.log('🐟 Fetching fish prices from CFHC harbor site...');
  const CFHC_URL = 'https://www.cfhc.gov.lk/home.php?lang=en';

  try {
    const response = await axios.get(CFHC_URL, {
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/115.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const scrapedFishData = [];

    $('table tr').each((index, element) => {
      if (index === 0) return; // Skip table header
      const columns = $(element).find('td');

      if (columns.length >= 2) {
        const fishNameRaw = $(columns[0]).text().trim();
        const priceRaw = $(columns[1]).text().trim();
        const cleanedPrice = parseFloat(priceRaw.replace(/[^0-9.]/g, ''));

        if (fishNameRaw && !isNaN(cleanedPrice) && cleanedPrice > 0) {
          scrapedFishData.push({
            name: fishNameRaw,
            price_lkr: cleanedPrice,
            unit: 'kg'
          });
        }
      }
    });

    if (scrapedFishData.length > 0) {
      console.log(`✅ Successfully fetched ${scrapedFishData.length} fish records from CFHC.`);
      return { prices: scrapedFishData, source: 'CFHC live harbor feed' };
    } else {
      console.warn('⚠️ CFHC table empty. Using Sri Lanka market averages.');
      return { prices: getFallbackFishPrices(), source: 'System estimate (CFHC has no published price table)' };
    }

  } catch (error) {
    console.warn(`⚠️ CFHC site unreachable (${error.message}). Loading fallback fish dataset.`);
    return { prices: getFallbackFishPrices(), source: 'System estimate (CFHC request failed)' };
  }
}

// Standard Backup Fish Dataset (Sri Lanka Average Rates)
function getFallbackFishPrices() {
  return [
    { name: 'Yellowfin Tuna (කෙලවල්ලා)', price_lkr: 1750, unit: 'kg' },
    { name: 'Skipjack Tuna (බලයා)', price_lkr: 1050, unit: 'kg' },
    { name: 'Sailfish (තලපත)', price_lkr: 1900, unit: 'kg' },
    { name: 'Trevally (පරවා)', price_lkr: 1500, unit: 'kg' },
    { name: 'Goldstripe Sardinella (සාලයා)', price_lkr: 450, unit: 'kg' },
    { name: 'Seer Fish (තෝරා)', price_lkr: 2400, unit: 'kg' }
  ];
}

// 3. MASTER FUNCTION & CRON SCHEDULER
async function updateAllMarketPrices() {
  console.log('🔄 Starting full Sri Lanka market price scrape...');

  const { fuel, effectiveFrom, updated: fuelUpdated } = await scrapeFuelPrices();
  const { prices: scrapedFish, source: fishSource } = await scrapeFishPrices();
  const fish = scrapedFish.map((item) => ({
    name: item.name,
    price: item.price ?? item.price_lkr,
    unit: item.unit || 'kg',
  }));
  const previousData = (() => {
    try {
      return JSON.parse(fs.readFileSync(OUTPUT_FILE_PATH, 'utf8'));
    } catch {
      return {};
    }
  })();

  const combinedPayload = {
    last_updated: fuelUpdated || fishSource === 'CFHC live harbor feed'
      ? new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })
      : previousData.last_updated || new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' }),
    currency: 'LKR',
    fuel,
    fuel_effective_from: effectiveFrom,
    fuel_source: 'https://ceypetco.gov.lk/marketing-sales/',
    fish,
    fish_source: fishSource,
  };

  // Write to market-data.json
  fs.writeFileSync(OUTPUT_FILE_PATH, JSON.stringify(combinedPayload, null, 2));
  console.log('💾 Market data successfully saved to market-data.json!');

  return combinedPayload;
}

// Run scraper automatically every day at 07:30 AM (Sri Lanka time)
cron.schedule('30 7 * * *', () => {
  updateAllMarketPrices();
});

module.exports = { updateAllMarketPrices };