const Boat = require("../models/Boat");
const { publishConnectionNotification } = require("./connectionNotificationService");

/**
 * Driver offline වූ විට Owner WhatsApp එකට attractive alert යවයි
 * @param {String} boatId
 * @param {Object} extra
 *  - driverName
 *  - latitude
 *  - longitude
 *  - placeName
 *  - offlineAt (Date)
 */
const notifyOwnerDriverOffline = async (boatId, extra = {}, io) => {
  try {
    if (!boatId) {
      console.log("⚠️ Offline alert skipped: boatId missing");
      return;
    }

    const boat = await Boat.findById(boatId)
      .populate("owner", "name phone")
      .populate("driver", "name");

    if (!boat) {
      console.log("⚠️ Offline alert skipped: boat not found");
      return;
    }

    const details = typeof extra === "object" && extra ? extra : { driverName: extra };
    const location = {
      latitude: details.latitude ?? boat.signalLocation?.latitude,
      longitude: details.longitude ?? boat.signalLocation?.longitude,
      placeName: details.placeName,
      recordedAt: boat.signalLocation?.recordedAt,
    };
    await publishConnectionNotification({
      boat,
      status: "offline",
      previousStatus: boat.connectionStatus || "good",
      offlineAt: details.offlineAt || new Date(),
      location,
      driverName: details.driverName || boat.driver?.name,
      io,
    });
  } catch (error) {
    console.error("❌ Failed to send offline alert:", error.message);
  }
};

module.exports = { notifyOwnerDriverOffline };