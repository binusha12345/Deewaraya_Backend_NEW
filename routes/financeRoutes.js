// server/routes/financeRoutes.js

const express = require("express");
const router = express.Router();
const financeController = require("../controllers/financeController");
const { protect } = require("../middleware/authMiddleware");

// ✅ Debug - Check if controller functions exist
console.log("Finance controller loaded:", {
  createDailyEntry: typeof financeController.createDailyEntry,
  getDailyEntries: typeof financeController.getDailyEntries,
  getMonthlyReport: typeof financeController.getMonthlyReport,
  sendMonthlyPDFEmail: typeof financeController.sendMonthlyPDFEmail,
});

console.log("Protect middleware:", typeof protect);

// Monthly - specific routes FIRST (before :param routes)
router.get("/monthly/compare", protect, financeController.getMonthlyComparison);
router.post("/monthly/send-pdf", protect, financeController.sendMonthlyPDFEmail);
router.get("/monthly/:year/:month", protect, financeController.getMonthlyReport);

// Dashboard
router.get("/dashboard-stats", protect, financeController.getDashboardStats);

// Daily entries
router.post("/daily", protect, financeController.createDailyEntry);
router.get("/daily", protect, financeController.getDailyEntries);
router.get("/daily/:id", protect, financeController.getDailyEntryById);
router.put("/daily/:id", protect, financeController.updateDailyEntry);
router.delete("/daily/:id", protect, financeController.deleteDailyEntry);

// TEMPORARY - Delete all your entries for testing
router.delete("/reset", protect, async (req, res) => {
  const DailyFinance = require("../models/Finance");
  await DailyFinance.deleteMany({ ownerId: req.user._id });
  res.json({ message: "All entries deleted" });
});

module.exports = router;