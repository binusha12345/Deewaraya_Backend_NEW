const mongoose = require("mongoose");
const Boat = require("../models/Boat");
const SignalReading = require("../models/SignalReading");
const { publishConnectionNotification } = require("../services/connectionNotificationService");

const findAccessibleBoat = (boatId, user) => {
  if (!mongoose.isValidObjectId(boatId)) return null;
  const access = user.role === "owner" ? { owner: user._id } : { driver: user._id };
  return Boat.findOne({ _id: boatId, ...access });
};

const getSignalReadings = async (req, res) => {
  try {
    const boat = await findAccessibleBoat(req.params.boatId, req.user);
    if (!boat) return res.status(404).json({ message: "Boat not found" });
    await boat.populate("driver", "name");

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const readings = await SignalReading.find({ boat: boat._id, recordedAt: { $gte: since } })
      .sort({ recordedAt: -1 })
      .limit(3000)
      .lean();

    return res.status(200).json({
      boat: {
        _id: boat._id,
        boatName: boat.boatName,
        registrationNumber: boat.registrationNumber,
        driver: boat.driver,
        connectionStatus: boat.connectionStatus,
        connectionCheckedAt: boat.connectionCheckedAt,
        signalLocation: boat.signalLocation,
      },
      readings: readings.reverse(),
    });
  } catch (error) {
    console.error("Get signal readings error:", error.message);
    return res.status(500).json({ message: "Could not load signal history" });
  }
};

const recordSignalReading = async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ message: "Drivers only" });
    }

    const { boatId, status, latency, latitude, longitude, recordedAt: clientRecordedAt } = req.body;
    const validStatuses = ["good", "medium", "poor", "offline"];
    const recordedAt = clientRecordedAt ? new Date(clientRecordedAt) : new Date();
    if (
      !validStatuses.includes(status) ||
      Number.isNaN(recordedAt.getTime()) ||
      latitude == null || longitude == null || latitude === "" || longitude === "" ||
      !Number.isFinite(Number(latitude)) ||
      !Number.isFinite(Number(longitude)) ||
      Number(latitude) < -90 || Number(latitude) > 90 ||
      Number(longitude) < -180 || Number(longitude) > 180
    ) {
      return res.status(400).json({ message: "Valid status and GPS coordinates are required" });
    }

    const boat = await findAccessibleBoat(boatId, req.user);
    if (!boat) return res.status(404).json({ message: "Assigned boat not found" });

    const previousStatus = boat.connectionStatus || "good";
    const locationIsNewer = !boat.signalLocation?.recordedAt || recordedAt >= boat.signalLocation.recordedAt;
    const statusIsNewer = !boat.connectionCheckedAt || recordedAt >= boat.connectionCheckedAt;
    const boatUpdates = {};
    if (locationIsNewer) {
      boatUpdates["signalLocation.latitude"] = Number(latitude);
      boatUpdates["signalLocation.longitude"] = Number(longitude);
      boatUpdates["signalLocation.recordedAt"] = recordedAt;
      boatUpdates["signalLocation.status"] = status;
    }
    if (statusIsNewer) {
      boatUpdates.connectionStatus = status;
      boatUpdates.connectionCheckedAt = recordedAt;
    }
    if (Object.keys(boatUpdates).length) {
      await Boat.updateOne({ _id: boat._id }, { $set: boatUpdates });
    }

    const latest = await SignalReading.findOne({ boat: boat._id }).sort({ recordedAt: -1 });
    const changed = !latest || latest.status !== status;
    const due = !latest || Date.now() - latest.recordedAt.getTime() >= 15 * 60 * 1000;
    if ((statusIsNewer && status !== previousStatus) || (status === "offline" && changed)) {
      await publishConnectionNotification({
        boat,
        status,
        previousStatus: statusIsNewer ? previousStatus : latest?.status || previousStatus,
        latency,
        io: req.app.get("io"),
      });
    }

    if (!changed && !due) return res.status(200).json({ recorded: false });

    const reading = await SignalReading.create({
      boat: boat._id,
      owner: boat.owner,
      driver: req.user._id,
      status,
      latency: Number.isFinite(Number(latency)) ? Number(latency) : null,
      latitude: Number(latitude),
      longitude: Number(longitude),
      recordedAt,
    });

    return res.status(201).json({ recorded: true, reading });
  } catch (error) {
    console.error("Record signal reading error:", error.message);
    return res.status(500).json({ message: "Could not save signal reading" });
  }
};

module.exports = { getSignalReadings, recordSignalReading };