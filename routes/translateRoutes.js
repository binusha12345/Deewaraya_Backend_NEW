// server/routes/translateRoutes.js

const express = require("express");
const router = express.Router();
const translate = require("google-translate-api-x");

// In-memory cache to avoid re-translating
const cache = new Map();

// Batch translate multiple texts at once (faster!)
router.post("/batch", async (req, res) => {
  try {
    const { texts, to = "si" } = req.body;

    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ message: "texts array required" });
    }

    // If target is English, return original
    if (to === "en") {
      return res.json({ success: true, translations: texts });
    }

    const results = [];
    const toTranslate = [];
    const toTranslateIndexes = [];

    // Check cache first
    texts.forEach((text, index) => {
      const cacheKey = `${text}_${to}`;
      if (cache.has(cacheKey)) {
        results[index] = cache.get(cacheKey);
      } else {
        results[index] = null;
        toTranslate.push(text);
        toTranslateIndexes.push(index);
      }
    });

    // Translate only what's not in cache
    if (toTranslate.length > 0) {
      console.log(`🌐 Translating ${toTranslate.length} new strings...`);

      // Translate in parallel
      const translations = await Promise.all(
        toTranslate.map((text) =>
          translate(text, { from: "en", to })
            .then((res) => res.text)
            .catch(() => text) // Return original on error
        )
      );

      // Save to cache and results
      translations.forEach((translated, i) => {
        const originalIndex = toTranslateIndexes[i];
        const originalText = toTranslate[i];
        results[originalIndex] = translated;
        cache.set(`${originalText}_${to}`, translated);
      });
    }

    res.json({ success: true, translations: results });
  } catch (error) {
    console.error("Translation error:", error);
    res.status(500).json({
      message: "Translation failed",
      error: error.message,
    });
  }
});

// Clear cache endpoint (for development)
router.delete("/cache", (req, res) => {
  cache.clear();
  res.json({ success: true, message: "Cache cleared" });
});

module.exports = router;