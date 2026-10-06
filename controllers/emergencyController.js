const EmergencyLog = require("../models/EmergencyLog");
const Boat = require("../models/Boat");
const Notification = require("../models/Notification");
const { sendEmergencyAlert, sendSafeAlert } = require("../services/emergencyAlertService");

exports.getEmergencyContacts = async (req, res) => {
  try {
    const boat = await Boat.findOne({ driver: req.user._id })
      .select("owner boatName registrationNumber")
      .populate("owner", "name phone");
    if (!boat) {
      return res.status(404).json({ success: false, message: "No boat assigned to you." });
    }
    return res.status(200).json({
      success: true,
      data: {
        boat: { _id: boat._id, name: boat.boatName, registrationNumber: boat.registrationNumber },
        owner: boat.owner ? { name: boat.owner.name, phone: boat.owner.phone } : null,
      },
    });
  } catch (error) {
    console.error("Get emergency contacts error:", error.message);
    return res.status(500).json({ success: false, message: "Could not load emergency contacts" });
  }
};

// ========== SEND SOS ==========
exports.sendSOS = async (req, res) => {
  try {
    const { emergencyType, latitude, longitude, placeName, message, checklist } = req.body;

    // Driver ගේ assigned boat එක සොයා ගැනීම
    const boat = await Boat.findOne({ driver: req.user._id }).populate("owner");
    if (!boat) {
      return res.status(404).json({ success: false, message: "No boat assigned to you." });
    }

    const owner = boat.owner;
    if (!owner) {
      return res.status(409).json({ success: false, message: "The assigned boat has no owner." });
    }

    // Emergency Log එක Save කිරීම
    const emergency = await EmergencyLog.create({
      driverId: req.user._id,
      boatId: boat._id,
      ownerId: owner._id,
      emergencyType: emergencyType || "other",
      latitude,
      longitude,
      placeName: placeName || "Location unavailable",
      message: message || "",
      checklist: checklist || {},
      status: "active",
    });

    const coordinatesAvailable = latitude != null && longitude != null
      && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
    const notification = await Notification.create({
      owner: owner._id,
      boat: boat._id,
      type: "emergency_sos",
      message: `SOS: ${req.user.name || "Assigned driver"} reported ${emergencyType || "an emergency"} on ${boat.boatName}.${coordinatesAvailable ? ` Location: ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}.` : ""}`,
      latitude: coordinatesAvailable ? Number(latitude) : null,
      longitude: coordinatesAvailable ? Number(longitude) : null,
    });
    await notification.populate("boat", "boatName registrationNumber");
    req.app.get("io")?.to(`owner:${owner._id}`).emit("notification:new", notification);

    let whatsappSent = false;
    try {
      await sendEmergencyAlert({
        ownerPhone: owner.phone,
        ownerName: owner.name,
        driverName: req.user.name,
        boatName: boat.boatName,
        registrationNumber: boat.registrationNumber,
        emergencyType,
        latitude,
        longitude,
        placeName,
        message,
      });
      whatsappSent = true;
    } catch (error) {
      console.error("SOS WhatsApp delivery failed:", error.message);
    }

    return res.status(201).json({
      success: true,
      message: whatsappSent
        ? "SOS sent to the boat owner."
        : "SOS saved and added to the owner's notifications, but WhatsApp could not be sent.",
      whatsappSent,
      data: emergency,
    });
  } catch (error) {
    console.error("SOS Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== MARK SAFE ==========
exports.markSafe = async (req, res) => {
  try {
    const emergency = await EmergencyLog.findOneAndUpdate(
      { _id: req.params.id, driverId: req.user._id, status: "active" },
      { status: "safe", resolvedAt: new Date() },
      { new: true }
    ).populate("boatId ownerId");

    if (!emergency) {
      const existingEmergency = await EmergencyLog.findOne({
        _id: req.params.id,
        driverId: req.user._id,
        status: "safe",
      });
      if (existingEmergency) {
        return res.status(409).json({ success: false, message: "This emergency has already been marked safe." });
      }
      return res.status(404).json({ success: false, message: "Emergency not found" });
    }

    const owner = emergency.ownerId;
    if (!owner) {
      return res.status(409).json({ success: false, message: "The boat owner could not be found." });
    }
    const notification = await Notification.create({
      owner: owner._id,
      boat: emergency.boatId._id,
      type: "emergency_safe",
      message: `${req.user.name || "The assigned driver"} marked safe after an emergency on ${emergency.boatId.boatName}.`,
    });
    await notification.populate("boat", "boatName registrationNumber");
    req.app.get("io")?.to(`owner:${owner._id}`).emit("notification:new", notification);

    let whatsappSent = false;
    try {
      await sendSafeAlert({
        ownerPhone: owner.phone,
        driverName: req.user.name,
        boatName: emergency.boatId.boatName,
      });
      whatsappSent = true;
    } catch (error) {
      console.error("Safe-status WhatsApp delivery failed:", error.message);
    }

    return res.status(200).json({
      success: true,
      whatsappSent,
      message: whatsappSent
        ? "Your boat owner was notified that you are safe."
        : "Your safe status was saved and added to the owner's notifications, but WhatsApp could not be sent.",
      data: emergency,
    });
  } catch (error) {
    console.error("Mark emergency safe error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== EMERGENCY HISTORY ==========
exports.getEmergencyHistory = async (req, res) => {
  try {
    const logs = await EmergencyLog.find({ driverId: req.user._id })
      .populate("boatId", "boatName registrationNumber")
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== ACTIVE EMERGENCY ==========
exports.getActiveEmergency = async (req, res) => {
  try {
    const active = await EmergencyLog.findOne({
      driverId: req.user._id,
      status: "active",
    });
    res.json({ success: true, data: active });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};