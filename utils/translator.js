// server/utils/translator.js

const translate = require("google-translate-api-x");

/**
 * Translate a single text from English to target language
 */
const translateText = async (text, targetLang = "si") => {
  try {
    if (!text || text.trim() === "") return text;

    const result = await translate(text, { from: "en", to: targetLang });
    return result.text;
  } catch (error) {
    console.error(`❌ Failed to translate: "${text}"`, error.message);
    return text; // Return original if translation fails
  }
};

/**
 * Translate an entire JSON object (nested)
 * Input: { "title": "Hello", "sub": { "name": "World" } }
 * Output: { "title": "හෙලෝ", "sub": { "name": "ලෝකය" } }
 */
const translateJSON = async (obj, targetLang = "si") => {
  const result = {};

  for (const key of Object.keys(obj)) {
    const value = obj[key];

    if (typeof value === "string") {
      // Translate the string
      console.log(`  Translating: "${value}"`);
      result[key] = await translateText(value, targetLang);

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } else if (typeof value === "object" && value !== null) {
      // Recursively translate nested objects
      result[key] = await translateJSON(value, targetLang);
    } else {
      // Keep numbers, booleans, etc. as-is
      result[key] = value;
    }
  }

  return result;
};

module.exports = { translateText, translateJSON };