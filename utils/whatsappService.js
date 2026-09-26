// server/services/whatsappService.js
const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

/**
 * Send WhatsApp message with PDF attachment
 * @param {string} toNumber - Recipient number in E.164 format (e.g., +94771234567)
 * @param {string} pdfUrl - Publicly accessible URL of the PDF
 * @param {string} message - Text message to send with the PDF
 */
const sendWhatsAppPDF = async (toNumber, pdfUrl, message) => {
  try {
    const response = await client.messages.create({
      from: twilioWhatsAppNumber,
      to: `whatsapp:${toNumber}`,
      body: message,
      mediaUrl: [pdfUrl],
    });

    console.log("✅ WhatsApp message sent:", response.sid);
    return { success: true, sid: response.sid };
  } catch (error) {
    console.error("❌ WhatsApp send error:", error.message);
    throw new Error(error.message || "Failed to send WhatsApp message");
  }
};

/**
 * Send text-only WhatsApp message (fallback if no PDF hosting)
 */
const sendWhatsAppText = async (toNumber, message) => {
  try {
    const response = await client.messages.create({
      from: twilioWhatsAppNumber,
      to: `whatsapp:${toNumber}`,
      body: message,
    });

    console.log("✅ WhatsApp text sent:", response.sid);
    return { success: true, sid: response.sid };
  } catch (error) {
    console.error("❌ WhatsApp send error:", error.message);
    throw new Error(error.message || "Failed to send WhatsApp message");
  }
};

module.exports = { sendWhatsAppPDF, sendWhatsAppText };