const Boat = require("../models/Boat");

const createBoat = async (req, res) => {
  try {
    // ✅ DEBUG - See what's coming in
    console.log("═══════════════════════════════════════");
    console.log("📥 REQ BODY:", req.body);
    console.log("📥 REQ FILE:", req.file);
    console.log("📥 REQ USER ID:", req.user?.id);
    console.log("═══════════════════════════════════════");

    const {
      boatName,
      registrationNumber,
      boatType,
      modelYear,
      engineSerial,
      fuelCapacity,
      horsepower,
      engineType,        // ✅ ADD THIS
      boatStatus,
      latitude,
      longitude,
    } = req.body;

    // ✅ Updated validation - check all required fields
    if (
      !boatName ||
      !registrationNumber ||
      !boatType ||
      !modelYear ||
      !engineSerial ||
      !engineType ||
      !fuelCapacity ||
      !horsepower
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled",
      });
    }

    // ✅ Check duplicate registration
    const existingBoat = await Boat.findOne({ registrationNumber });
    if (existingBoat) {
      return res.status(400).json({
        success: false,
        message: `Registration number "${registrationNumber}" already exists. Please use a different one.`,
      });
    }

    // ✅ Multer file
    const imageUrl = req.file ? `/uploads/boats/${req.file.filename}` : "";

    const boat = await Boat.create({
      owner: req.user.id,
      boatName,
      registrationNumber,
      boatType,
      modelYear,
      engineSerial,
      fuelCapacity: fuelCapacity ? Number(fuelCapacity) : 0,
      horsepower: horsepower ? Number(horsepower) : 0,
      engineType,        // ✅ ADD THIS
      imageUrl,
      boatStatus: boatStatus || "ACTIVE",
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
    });

    console.log("✅ Boat created successfully:", boat._id);

    res.status(201).json({
      success: true,
      message: "Boat registered successfully",
      boat,
    });
  } catch (error) {
    // ✅ Better error logging
    console.error("═══════════════════════════════════════");
    console.error("❌ CREATE BOAT ERROR:", error);
    console.error("❌ MESSAGE:", error.message);
    console.error("❌ NAME:", error.name);
    console.error("❌ CODE:", error.code);
    console.error("═══════════════════════════════════════");

    // Duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: `Registration number already exists. Try a different one.`,
      });
    }

    // Mongoose validation error
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    // Any other error - send actual message
    res.status(500).json({
      success: false,
      message: error.message || "Server error while creating boat",
    });
  }
};

const getMyBoats = async (req, res) => {
  try {
    const boats = await Boat.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(boats);
  } catch (error) {
    console.error("Get Boats Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get ALL boats (for weather page)
const getAllBoats = async (req, res) => {
  try {
    const boats = await Boat.find({}).sort({ createdAt: -1 });
    res.status(200).json(boats);
  } catch (error) {
    console.error("Get All Boats Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  createBoat,
  getMyBoats,
  getAllBoats,
};