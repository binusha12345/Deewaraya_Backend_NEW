const express = require("express");
const router = express.Router();

const {
  createDailyEntry,
  getDailyEntries,
  getDailyEntryById,
  updateDailyEntry,
  deleteDailyEntry,
  getMonthlyReport,
  getMonthlyComparison,
  sendMonthlyPDFEmail,
  sendMonthlyReportWhatsApp,
  getWhatsAppConnectionStatus,
  getDashboardStats,
} = require("../controllers/financeController");

// Auth Middleware (ඔබේ project එකේ auth middleware එකේ නම අනුව වෙනස් කරන්න)
const { protect } = require("../middleware/authMiddleware");

// ==================== DASHBOARD & STATS ====================
router.get("/dashboard-stats", protect, getDashboardStats);

// ==================== DAILY ENTRIES ====================
router.route("/daily")
  .post(protect, createDailyEntry)
  .get(protect, getDailyEntries);

router.route("/daily/:id")
  .get(protect, getDailyEntryById)
  .put(protect, updateDailyEntry)
  .delete(protect, deleteDailyEntry);

// ==================== MONTHLY REPORTS & COMPARISON ====================
router.get("/monthly/:year/:month", protect, getMonthlyReport);

// ✅ Frontend URL වලට ගැලපෙන පරිදි Routes සකස් කර ඇත
router.get("/comparison", protect, getMonthlyComparison);
router.get("/monthly/compare", protect, getMonthlyComparison); // 👈 Frontend එකෙන් ඉල්ලන URL එක

// ==================== PDF SENDING (EMAIL & WHATSAPP) ====================
// ✅ Email routes දෙකම allow කර ඇත
router.post("/send-email", protect, sendMonthlyPDFEmail);
router.post("/monthly/send-pdf", protect, sendMonthlyPDFEmail); // 👈 Frontend එකෙන් ඉල්ලන Email PDF URL එක

// ✅ WhatsApp routes දෙකම allow කර ඇත
router.post("/send-whatsapp-report", protect, sendMonthlyReportWhatsApp);
router.post("/monthly/send-whatsapp", protect, sendMonthlyReportWhatsApp); // 👈 Frontend එකෙන් ඉල්ලන URL එක

// ==================== WHATSAPP STATUS ====================
router.get("/whatsapp-status", protect, getWhatsAppConnectionStatus);

module.exports = router;