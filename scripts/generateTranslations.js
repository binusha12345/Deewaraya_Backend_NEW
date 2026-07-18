// server/scripts/generateTranslations.js

const fs = require("fs");
const path = require("path");
const { translateJSON } = require("../utils/translator");

const SOURCE_FILE = path.join(
  __dirname,
  "../../client/src/i18n/locales/en.json"
);
const OUTPUT_FILE = path.join(
  __dirname,
  "../../client/src/i18n/locales/si.json"
);

async function generateSinhalaTranslations() {
  console.log("🌐 Starting auto-translation: English → Sinhala...\n");

  // Read English source file
  const enData = JSON.parse(fs.readFileSync(SOURCE_FILE, "utf-8"));
  console.log("📖 Read English source file\n");

  // Count total strings
  const countStrings = (obj) => {
    let count = 0;
    for (const value of Object.values(obj)) {
      if (typeof value === "string") count++;
      else if (typeof value === "object") count += countStrings(value);
    }
    return count;
  };

  const totalStrings = countStrings(enData);
  console.log(`📝 Found ${totalStrings} strings to translate\n`);

  // Translate everything
  const startTime = Date.now();
  const siData = await translateJSON(enData, "si");
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Write Sinhala output file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(siData, null, 2), "utf-8");

  console.log(`\n✅ Translation complete in ${elapsed} seconds!`);
  console.log(`📁 Output saved to: ${OUTPUT_FILE}`);
  console.log(`📝 Translated ${totalStrings} strings`);
}

// Run the script
generateSinhalaTranslations().catch((error) => {
  console.error("❌ Translation script failed:", error);
  process.exit(1);
});