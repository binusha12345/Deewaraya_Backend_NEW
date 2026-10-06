const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
	reportConnectionStatus,
	getMyNotifications,
	markNotificationRead,
	createQrRequest,
	getDriverQrRequests,
	shareQrRequest,
} = require("../controllers/notificationController");

const router = express.Router();
router.use(protect);
router.post("/connection-status", reportConnectionStatus);
router.post("/qr-requests/:boatId", createQrRequest);
router.get("/qr-requests", getDriverQrRequests);
router.get("/", getMyNotifications);
router.post("/:id/share-qr", shareQrRequest);
router.patch("/:id/read", markNotificationRead);

module.exports = router;
