const { getSocket, getBaileysStatus } = require("../services/whatsappClient");

/**
 * WhatsApp හරහා PDF Buffer එකක් යැවීම (Baileys)
 */
const sendWhatsAppPDF = async (phoneNumber, pdfBuffer, caption, fileName) => {
  try {
    if (!getBaileysStatus()) {
      throw new Error("WhatsApp Client සම්බන්ධ වී නැත. Terminal එකේ QR code එක scan කරන්න.");
    }

    const sock = getSocket();
    if (!sock) {
      throw new Error("WhatsApp Socket සක්‍රිය නැත.");
    }

    // Phone number format: +94771234567 / 0771234567 → 94771234567@s.whatsapp.net
    let cleanedNumber = phoneNumber.replace(/[^0-9]/g, "");
    if (cleanedNumber.startsWith("0")) {
      cleanedNumber = "94" + cleanedNumber.substring(1);
    }
    const jid = `${cleanedNumber}@s.whatsapp.net`;

    // WhatsApp Document Message එක යැවීම
    await sock.sendMessage(jid, {
      document: pdfBuffer,
      mimetype: "application/pdf",
      fileName: fileName || "Deewaraya_Report.pdf",
      caption: caption || "📊 Deewaraya - මාසික මූල්‍ය වාර්තාව",
    });

    console.log(`✅ WhatsApp PDF සාර්ථකව ${cleanedNumber} වෙත යවන ලදී!`);
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
  getWhatsAppStatus,
};

