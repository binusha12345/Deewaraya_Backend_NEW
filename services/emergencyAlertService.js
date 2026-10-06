const { sendWhatsAppText } = require("./whatsappService");

const emergencyTypeLabels = {
  medical: "🆘 Medical Emergency",
  sinking: "🌊 Sinking / Water Leak",
  fire: "🔥 Fire Emergency",
  engine_failure: "⚙️ Engine Failure",
  fuel_finished: "⛽ Fuel Finished",
  bad_weather: "🌀 Bad Weather / High Waves",
  lost_navigation: "🧭 Lost / Navigation Problem",
  man_overboard: "👥 Man Overboard",
  other: "⚠️ Other Emergency",
};

const sendEmergencyAlert = async ({
  ownerPhone,
  ownerName,
  driverName,
  boatName,
  registrationNumber,
  emergencyType,
  latitude,
  longitude,
  placeName,
  message,
}) => {
  const typeLabel = emergencyTypeLabels[emergencyType] || "⚠️ Emergency";
  const coordinatesAvailable = latitude != null && longitude != null
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const mapsLink = coordinatesAvailable
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : null;

  const now = new Date().toLocaleString("en-LK");

  let msg =
    `🚨 *URGENT - EMERGENCY SOS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${typeLabel}\n\n` +
    `👨‍✈️ *Driver:* ${driverName}\n` +
    `🚤 *Boat:* ${boatName}\n` +
    `📋 *Reg No:* ${registrationNumber}\n` +
    `⏰ *Time:* ${now}\n` +
    `📍 *Place:* ${placeName || "Unknown"}\n`;

  if (coordinatesAvailable) {
    msg +=
      `🌐 *Latitude:* ${Number(latitude).toFixed(6)}\n` +
      `🌐 *Longitude:* ${Number(longitude).toFixed(6)}\n`;
  }

  if (message) msg += `\n📝 *Driver Note:* ${message}\n`;

  msg +=
    `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `🚑 *Immediate Action Required:*\n` +
    `• Try to contact the driver NOW\n` +
    `• Alert Coast Guard / Navy if needed\n` +
    `• Check nearest harbor help\n`;

  if (mapsLink) msg += `\n📌 *Open Location:*\n${mapsLink}\n`;

  msg += `\n_Dear ${ownerName}, this is an auto-emergency alert from Deewaraya System._`;

  await sendWhatsAppText(ownerPhone, msg);
  console.log("SOS WhatsApp alert sent to boat owner.");
};

const sendSafeAlert = async ({ ownerPhone, driverName, boatName }) => {
  const msg =
    `✅ *DRIVER IS SAFE*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👨‍✈️ ${driverName}\n` +
    `🚤 ${boatName}\n` +
    `⏰ ${new Date().toLocaleString("en-LK")}\n\n` +
    `The emergency has been cleared. Driver reports all is well.\n\n` +
    `_Deewaraya Safety System_`;

  await sendWhatsAppText(ownerPhone, msg);
  console.log("Safe-status WhatsApp alert sent to boat owner.");
};

module.exports = { sendEmergencyAlert, sendSafeAlert };