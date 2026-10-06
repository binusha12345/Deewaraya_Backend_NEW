const Boat = require("../models/Boat");
const { publishConnectionNotification } = require("../services/connectionNotificationService");

const OFFLINE_AFTER_MS = 2 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;

const checkDriverConnections = async (io) => {
  const staleBefore = new Date(Date.now() - OFFLINE_AFTER_MS);
  const staleBoats = await Boat.find({
    driver: { $ne: null },
    connectionStatus: { $ne: "offline" },
    connectionCheckedAt: { $ne: null, $lt: staleBefore },
  }).populate("owner", "name phone").populate("driver", "name");

  for (const boat of staleBoats) {
    const previousStatus = boat.connectionStatus || "good";
    const markedOffline = await Boat.findOneAndUpdate(
      {
        _id: boat._id,
        connectionStatus: { $ne: "offline" },
        connectionCheckedAt: { $ne: null, $lt: staleBefore },
      },
      { $set: { connectionStatus: "offline" } },
      { new: true }
    ).populate("owner", "name phone").populate("driver", "name");

    if (markedOffline) {
      await publishConnectionNotification({
        boat: markedOffline,
        status: "offline",
        previousStatus,
        io,
      });
    }
  }
};

const startConnectionMonitor = (io) => {
  const runCheck = () => checkDriverConnections(io).catch((error) => {
    console.error("Driver connection monitor failed:", error.message);
  });
  runCheck();
  setInterval(runCheck, CHECK_INTERVAL_MS);
  console.log("Driver connection monitor started (2-minute offline threshold).");
};

module.exports = { startConnectionMonitor, checkDriverConnections };