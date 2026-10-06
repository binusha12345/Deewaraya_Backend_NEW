const { getSocket, getBaileysStatus } = require("../services/whatsappClient");

/**
 * ශ්‍රී ලාංකීය දුරකථන අංක Format කර Validation කිරීම
 */
const getWhatsAppJid = (phoneNumber) => {
  let cleanedNumber = String(phoneNumber || "").replace(/[^0-9]/g, "");

  // 0771234567 → 94771234567
  if (cleanedNumber.startsWith("0")) {
    cleanedNumber = `94${cleanedNumber.substring(1)}`;
  } 
  // 771234567 (අංක 9ක් නම්) → 94771234567
  else if (!cleanedNumber.startsWith("94") && cleanedNumber.length === 9) {
    cleanedNumber = `94${cleanedNumber}`;
  }

  // ශ්‍රී ලාංකික අංකයක්දැයි පරීක්ෂා කිරීම (94 + අංක 9ක් = අංක 11ක්)
  if (!/^94\d{9}$/.test(cleanedNumber)) {
    throw new Error("Owner phone number is not a valid Sri Lankan WhatsApp number");
  }

  return { cleanedNumber, jid: `${cleanedNumber}@s.whatsapp.net` };
};

/**
 * Active WhatsApp Socket එක ලබා ගැනීම
 */
const getConnectedSocket = () => {
  if (!getBaileysStatus()) throw new Error("WhatsApp client is not connected");
  const sock = getSocket();
  if (!sock) throw new Error("WhatsApp socket is not active");
  return sock;
};

/**
 * WhatsApp Text Message යැවීම (Alerts සඳහා)
 */
const sendWhatsAppText = async (phoneNumber, text) => {
  try {
    const { cleanedNumber, jid } = getWhatsAppJid(phoneNumber);
    const sock = getConnectedSocket();

    await sock.sendMessage(jid, { text });
    console.log(`🚨 WhatsApp alert sent to ${cleanedNumber.slice(0, 4)}*****${cleanedNumber.slice(-2)}`);
    return { success: true };
  } catch (error) {
    console.error("❌ WhatsApp Text Send Error:", error.message);
    throw error;
  }
};

/**
 * WhatsApp හරහා PDF Buffer එකක් යැවීම (Baileys)
 */
const sendWhatsAppPDF = async (phoneNumber, pdfBuffer, caption, fileName) => {
  try {
    const { cleanedNumber, jid } = getWhatsAppJid(phoneNumber);
    const sock = getConnectedSocket();

    // WhatsApp Document Message එක යැවීම
    await sock.sendMessage(jid, {
      document: pdfBuffer,
      mimetype: "application/pdf",
      fileName: fileName || "Deewaraya_Report.pdf",
      caption: caption || "📊 Deewaraya - මාසික මූල්‍ය වාර්තාව",
    });

    console.log(`✅ WhatsApp PDF සාර්ථකව ${cleanedNumber.slice(0, 4)}*****${cleanedNumber.slice(-2)} වෙත යවන ලදී!`);
    return { success: true };
  } catch (error) {
    console.error("❌ WhatsApp Send Error:", error.message);
    throw error;
  }
};

/**
 * WhatsApp Status Check
 */
const getWhatsAppStatus = () => {
  return {
    connected: getBaileysStatus(),
  };
};

module.exports = {
  sendWhatsAppPDF,
  sendWhatsAppText,
  getWhatsAppStatus,
};