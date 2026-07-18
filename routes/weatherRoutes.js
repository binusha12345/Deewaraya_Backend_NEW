const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getWeatherFromGps,
  getCurrentWeather,
  getDashboardWeather,
  getAllWeatherLogs,
  getMyWeatherHistory,
  getLatestBoatWeather,
} = require("../controllers/weatherController");


// USER ROUTES (Owner/Driver)

// Simple GPS weather (no DB log)
router.get("/gps", protect, getWeatherFromGps);

// Full weather check - SAVES log for admin monitoring
router.get("/current", protect, getCurrentWeather);

// Owner: latest weather+location the DRIVER shared for a boat (auto-refresh target)
router.get("/latest/:boatId", protect, getLatestBoatWeather);

// Owner/Driver dashboard weather widget
router.get("/dashboard", protect, getDashboardWeather);

// User's own weather history
router.get("/my-history", protect, getMyWeatherHistory);

// ADMIN ROUTES (Admin only)
// Admin: View all weather logs from all users
router.get("/logs", protect, getAllWeatherLogs);

module.exports = router;
