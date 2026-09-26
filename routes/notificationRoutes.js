const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
	reportConnectionStatus,
	getMyNotifications,
	markNotificationRead,
} = require("../controllers/notificationController");

const router = express.Router();
router.use(protect);
router.post("/connection-status", reportConnectionStatus);
router.get("/", getMyNotifications);
router.patch("/:id/read", markNotificationRead);

module.exports = router;
