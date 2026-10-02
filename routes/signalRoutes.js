const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { getSignalReadings, recordSignalReading } = require("../controllers/signalController");

const router = express.Router();
router.use(protect);
router.get("/readings/:boatId", getSignalReadings);
router.post("/readings", recordSignalReading);

module.exports = router;