const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

// Add Boat model import
const Boat = require("../models/Boat");

const { createBoat, getMyBoats, getAllBoats } = require("../controllers/boatController");
const { protect, driverOrAdmin } = require("../middleware/authMiddleware");

// Multer storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/boats");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// PUBLIC route - No auth needed - must be BEFORE protected routes
router.get("/public/:id", async (req, res) => {
  try {
    const boat = await Boat.findById(req.params.id);

    if (!boat) {
      return res.status(404).json({ message: "Vessel not found" });
    }

    res.json(boat);
  } catch (err) {
    console.error("Public vessel fetch error:", err);

    // Handle invalid MongoDB ID format
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid vessel ID format" });
    }

    res.status(500).json({ message: "Server error" });
  }
});

// Protected routes
router.post("/", protect, upload.single("image"), createBoat);
router.get("/", protect, getMyBoats);
router.get("/all", protect, driverOrAdmin, getAllBoats);

module.exports = router;