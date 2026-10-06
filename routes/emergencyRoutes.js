const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  sendSOS,
  markSafe,
  getEmergencyHistory,
  getActiveEmergency,
  getEmergencyContacts,
} = require("../controllers/emergencyController");

router.use(protect, (req, res, next) => {
  if (req.user.role !== "driver") {
    return res.status(403).json({ success: false, message: "Drivers only" });
  }
  next();
});

// SOS යැවීම
router.get("/contacts", getEmergencyContacts);
router.post("/sos", sendSOS);

// I'm Safe button එක ඔබූ විට
router.put("/safe/:id", markSafe);

// Driver ගේ Emergency History එක
router.get("/history", getEmergencyHistory);

// දැනට active emergency එකක් තියෙනවද බලන්න
router.get("/active", getActiveEmergency);

module.exports = router;