const Notification = require("../models/Notification");
const User = require("../models/User");
const { sendWhatsAppText } = require("./whatsappService");

const getLocationName = async (latitude, longitude) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("localityLanguage", "en");
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Place lookup returned ${response.status}`);
    const data = await response.json();
    return [data.locality || data.city, data.principalSubdivision, data.countryName]
      .filter((part, index, parts) => part && parts.indexOf(part) === index)
      .join(", ") || "Place name unavailable";
  } catch {
    return "Place name unavailable";
  } finally {
    clearTimeout(timeout);
  }
};

const formatOfflineMessage = async ({ boat, driver, location, offlineAt }) => {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  const hasCoordinates = location?.latitude != null && location?.longitude != null
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  const placeName = location?.placeName || (hasCoordinates
    ? await getLocationName(latitude, longitude)
    : "Location unavailable");
  const detectedAt = new Date(offlineAt || Date.now());
  const dateTime = detectedAt.toLocaleString("en-LK", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  });
  const lastContact = boat.connectionCheckedAt
    ? new Date(boat.connectionCheckedAt).toLocaleString("en-LK", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Colombo",
    })
    : "Unavailable";

  let message =
    `🚨 *DEEWARAYA | BOAT OFFLINE* 🚨\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🛥️ *Boat:* ${boat.boatName || "Unknown boat"}\n` +
    `🔖 *Registration:* ${boat.registrationNumber || "Unavailable"}\n` +
    `🧑‍✈️ *Driver:* ${driver?.name || "Assigned driver"}\n` +
    `📅 *Offline detected:* ${dateTime}\n` +
    `📡 *Last driver contact:* ${lastContact}\n` +
    `📍 *Last known place:* ${placeName}\n`;

  if (hasCoordinates) {
    message +=
      `🌐 *Latitude:* ${latitude.toFixed(6)}\n` +
      `🌐 *Longitude:* ${longitude.toFixed(6)}\n` +
      `🗺️ *Map:* https://www.google.com/maps?q=${latitude},${longitude}\n`;
  } else {
    message += `🌐 *Coordinates:* Not available\n`;
  }

  return `${message}━━━━━━━━━━━━━━━━━━━━\nPlease contact the driver and confirm the boat's safety.\n_Automatic alert from Deewaraya._`;
};

const publishConnectionNotification = async ({ boat, status, previousStatus, latency, io, offlineAt, location: providedLocation, driverName }) => {
  const isWarning = status === "poor" || status === "offline";
  const isRecovery = (previousStatus === "poor" || previousStatus === "offline")
    && (status === "good" || status === "medium");
  if (!isWarning && !isRecovery) return null;

  if (status === "offline") {
    const latestNotification = await Notification.findOne({ boat: boat._id }).sort({ createdAt: -1 });
    if (latestNotification?.type === "connection_warning" && latestNotification.status === "offline") return null;
  }

  const type = isWarning ? "connection_warning" : "connection_recovery";
  const message = status === "offline"
    ? `${boat.boatName}: the assigned driver is offline.`
    : status === "poor"
      ? `${boat.boatName}: the driver's internet connection is poor.`
      : `${boat.boatName}: the driver's internet connection has recovered.`;

  const notification = await Notification.create({
    owner: boat.owner?._id || boat.owner,
    boat: boat._id,
    type,
    status,
    latency: Number.isFinite(Number(latency)) ? Number(latency) : null,
    message,
  });
  await notification.populate("boat", "boatName registrationNumber");
  io?.to(`owner:${boat.owner?._id || boat.owner}`).emit("notification:new", notification);

  if (status === "offline") {
    try {
      const owner = boat.owner?.phone ? boat.owner : await User.findById(boat.owner).select("name phone");
      if (!owner?.phone) throw new Error("Boat owner has no registered phone number");
      const driver = driverName
        ? { name: driverName }
        : boat.driver?.name
          ? boat.driver
          : await User.findById(boat.driver).select("name");
      const message = await formatOfflineMessage({
        boat,
        driver,
        location: providedLocation || boat.signalLocation,
        offlineAt,
      });
      await sendWhatsAppText(owner.phone, message);
    } catch (error) {
      console.error(`Could not send offline WhatsApp alert for ${boat.boatName}:`, error.message);
    }
  }

  return notification;
};

module.exports = { publishConnectionNotification, formatOfflineMessage };