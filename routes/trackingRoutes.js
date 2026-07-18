const express = require("express");
const router = express.Router();
console.log("Loading tracking routes...");

const { protect } = require("../middleware/authMiddleware");
const {
  updateLocation,
  getLatestLocation,
  getLocationHistory,
  requestLocationShare,
  getRequestStatus,
  getDriverRequests,
  shareLocation,
} = require("../controllers/trackingController");

router.post("/update", protect, updateLocation);
router.get("/latest/:boatId", protect, getLatestLocation);
router.get("/history/:boatId", protect, getLocationHistory);

// Owner -> driver location-sharing workflow
router.post("/request", protect, requestLocationShare);
router.get("/request-status/:boatId", protect, getRequestStatus);
router.get("/requests/driver", protect, getDriverRequests);
router.post("/share", protect, shareLocation);

module.exports = router;