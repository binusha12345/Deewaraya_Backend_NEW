const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

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

// protect first, then upload, then controller
router.post("/", protect, upload.single("image"), createBoat);
router.get("/", protect, getMyBoats);
router.get("/all", protect, driverOrAdmin, getAllBoats);

module.exports = router;