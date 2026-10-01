const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const MARKET_DATA_PATH = path.join(__dirname, '..', 'market-data.json');

// 1. Scrape Function
async function scrapeMarketPrices() {
  console.log('🔄 Running daily price scraper...');

  let previousData = {};
  try {
    previousData = JSON.parse(fs.readFileSync(MARKET_DATA_PATH, 'utf8'));
  } catch {
    // No prior market data exists yet.
  }

  const fuelData = {
    auto_diesel: previousData.fuel?.auto_diesel ?? null,
    super_diesel: previousData.fuel?.super_diesel ?? null,
    kerosene: previousData.fuel?.kerosene ?? null,
  };
  const fuelEffectiveFrom = { ...(previousData.fuel_effective_from || {}) };
  const scrapedFuelKeys = new Set();
  let fishData = [
    { name: 'Kelawalla (Yellowfin Tuna)', price: 1750, unit: 'kg' },
    { name: 'Balaya (Skipjack Tuna)', price: 1050, unit: 'kg' },
    { name: 'Thalapath (Sailfish)', price: 1900, unit: 'kg' },
    { name: 'Paraw (Trevally)', price: 1500, unit: 'kg' }
  ];

  try {
    const fuelRes = await axios.get('https://ceypetco.gov.lk/marketing-sales/', {
      timeout: 15000,
      headers: { 'User-Agent': 'Deewaraya market price checker' },
    });
    const page = cheerio.load(fuelRes.data);

    page('.fuel-name').each((_, element) => {
      const productName = page(element).text().replace(/\s+/g, ' ').trim();
      const productCard = page(element).parent().parent();
      const priceText = productCard.find('.price-value').text().trim();
      const priceMatch = priceText.match(/[\d,]+(?:\.\d+)?/);
      const price = priceMatch ? Number(priceMatch[0].replace(/,/g, '')) : NaN;
      const effectiveFrom = productCard.find('.effective-date').text()
        .replace(/\s+/g, ' ')
        .replace(/^.*?Effect\s+from:\s*/i, '')
        .trim();

      if (!Number.isFinite(price) || price <= 0 || !/per\s+Ltr/i.test(priceText)) return;

      let key;
      if (/\bAuto Diesel\b/i.test(productName)) key = 'auto_diesel';
      else if (/\bSuper Diesel\b/i.test(productName)) key = 'super_diesel';
      else if (/\bKerosene\b/i.test(productName) && !/Industrial/i.test(productName)) key = 'kerosene';

      if (key) {
        fuelData[key] = price;
        scrapedFuelKeys.add(key);
        if (effectiveFrom) fuelEffectiveFrom[key] = effectiveFrom;
      }
    });

    const missingPrices = ['auto_diesel', 'super_diesel', 'kerosene']
      .filter((key) => !scrapedFuelKeys.has(key));
    if (missingPrices.length) {
      console.warn(`⚠️ Ceypetco page did not provide fresh prices for: ${missingPrices.join(', ')}`);
    }
  } catch (err) {
    console.warn(`⚠️ Ceypetco price page request failed; retaining last known values: ${err.message}`);
  }

  // 2. Prepare payload
  const finalData = {
    last_updated: scrapedFuelKeys.size
      ? new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })
      : previousData.last_updated || new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' }),
    currency: 'LKR',
    fuel: fuelData,
    fuel_effective_from: fuelEffectiveFrom,
    fuel_source: 'https://ceypetco.gov.lk/marketing-sales/',
    fish: fishData
  };

  // 3. Save to JSON File (or update MongoDB)
  fs.writeFileSync(MARKET_DATA_PATH, JSON.stringify(finalData, null, 2));
  console.log('✅ Market data updated successfully!');
}

// 4. Schedule to run automatically at 07:30 AM every morning
cron.schedule('30 7 * * *', () => {
  scrapeMarketPrices();
}, { timezone: 'Asia/Colombo' });

module.exports = { scrapeMarketPrices };