const Boat = require("../models/Boat");
const User = require("../models/User");
const Location = require("../models/Location");
const sendEmail = require("../utils/sendEmail");

// Save new GPS location
const updateLocation = async (req, res) => {
  try {
    const { boatId, latitude, longitude, speed, zone } = req.body;
    
    console.log("updateLocation called");
    console.log("REQ BODY:", req.body);

    if (!boatId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Boat ID, latitude, longitude are required",
      });
    }

    const boat = await Boat.findById(boatId);

    if (!boat) {
      return res.status(404).json({
        message: "Boat not found",
      });
    }

    const location = await Location.create({
      boat: boatId,
      latitude,
      longitude,
      speed: speed || 0,
      zone: zone || "Unknown",
    });

    res.status(201).json({
      message: "Location saved successfully",
      location,
    });
  } catch (error) {
    console.error("Update Location Error:", error.message);
    res.status(500).json({
      message: "Server error",
      
    });
  }
};

// Get latest location
const getLatestLocation = async (req, res) => {
  try {
    const { boatId } = req.params;

    const location = await Location.findOne({ boat: boatId }).sort({
      recordedAt: -1,
    });

    if (!location) {
      return res.status(404).json({
        message: "No location found",
      });
    }

    res.status(200).json(location);
  } catch (error) {
    console.error("Get Latest Location Error:", error.message);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// Get location history
const getLocationHistory = async (req, res) => {
  try {
    const { boatId } = req.params;

    const history = await Location.find({ boat: boatId }).sort({
      recordedAt: -1,
    });

    res.status(200).json(history);
  } catch (error) {
    console.error("Get Location History Error:", error.message);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// OWNER: request a driver to share the boat's current location
const requestLocationShare = async (req, res) => {
  try {
    const { boatId } = req.body;

    if (!boatId) {
      return res.status(400).json({ message: "boatId is required" });
    }

    const boat = await Boat.findById(boatId);
    if (!boat) {
      return res.status(404).json({ message: "Boat not found" });
    }

    if (String(boat.owner) !== String(req.user.id) && req.user.role !== "admin") {
      return res.status(403).json({ message: "You do not own this boat" });
    }

    // Reuse an existing pending request instead of spamming a new one
    let request = await LocationRequest.findOne({
      boat: boatId,
      owner: req.user.id,
      status: "pending",
    });

    if (!request) {
      request = await LocationRequest.create({
        boat: boatId,
        owner: req.user.id,
      });
    }

    // Email every driver so whoever is operating the boat is notified
    const drivers = await User.find({ role: "driver" }).select("email name");

    const emailJobs = drivers.map((driver) =>
      sendEmail({
        toEmail: driver.email,
        subject: `📍 Location Requested for ${boat.boatName}`,
        htmlContent: `
          <p>Hello ${driver.name},</p>
          <p><strong>${req.user.name}</strong> has requested the current location of
          boat <strong>${boat.boatName} (${boat.registrationNumber})</strong>.</p>
          <p>Please log in to Deewaraya, open the Weather Dashboard, select this boat,
          and tap <strong>"Share Location"</strong> to send your current position.</p>
        `,
      }).catch((err) => console.error("Email failed for", driver.email, err.message))
    );
    await Promise.all(emailJobs);

    res.status(200).json({
      message: "Location request sent to drivers via email",
      request,
    });
  } catch (error) {
    console.error("Request Location Share Error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// OWNER: poll for the latest request/shared location for a boat
const getRequestStatus = async (req, res) => {
  try {
    const { boatId } = req.params;

    const request = await LocationRequest.findOne({
      boat: boatId,
      owner: req.user.id,
    })
      .sort({ createdAt: -1 })
      .populate("driver", "name email phone");

    if (!request) {
      return res.status(200).json({ status: "none" });
    }

    res.status(200).json(request);
  } catch (error) {
    console.error("Get Request Status Error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// DRIVER: get all pending requests addressed to drivers
const getDriverRequests = async (req, res) => {
  try {
    const requests = await LocationRequest.find({ status: "pending" })
      .populate("boat", "boatName registrationNumber boatType latitude longitude")
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error("Get Driver Requests Error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// DRIVER: share current (or simulated) GPS location for a request
const shareLocation = async (req, res) => {
  try {
    const { requestId, boatId, latitude, longitude } = req.body;

    if (!boatId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: "boatId, latitude, longitude are required" });
    }

    // Save into location history (feeds /tracking/latest & /tracking/history too)
    const location = await Location.create({
      boat: boatId,
      latitude,
      longitude,
      zone: "Simulated GPS",
    });

    let request = null;
    if (requestId) {
      request = await LocationRequest.findByIdAndUpdate(
        requestId,
        {
          driver: req.user.id,
          status: "shared",
          sharedLocation: { latitude, longitude, sharedAt: new Date() },
        },
        { new: true }
      ).populate("driver", "name email phone");
    }

    res.status(200).json({
      message: "Location shared successfully",
      location,
      request,
    });
  } catch (error) {
    console.error("Share Location Error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  updateLocation,
  getLatestLocation,
  getLocationHistory,
  requestLocationShare,
  getRequestStatus,
  getDriverRequests,
  shareLocation,
};