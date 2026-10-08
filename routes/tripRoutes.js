const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { getMyTrips, getOwnerTrips, startTrip, recordTripPoint, endTrip } = require("../controllers/tripController");

const router = express.Router();
router.use(protect);

router.get("/owner", (req, res, next) => {
  if (req.user.role !== "owner") return res.status(403).json({ message: "Owners only" });
  next();
}, getOwnerTrips);

router.use((req, res, next) => {
  if (req.user.role !== "driver") return res.status(403).json({ message: "Drivers only" });
  next();
});

router.get("/", getMyTrips);
router.post("/start", startTrip);
router.post("/:id/points", recordTripPoint);
router.post("/:id/end", endTrip);

module.exports = router;