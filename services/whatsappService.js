const fs = require("fs");
const path = require("path");
const os = require("os");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const { getSocket, getBaileysStatus } = require("../services/whatsappClient");

// Point fluent-ffmpeg to the bundled static binary
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

/**
 * ශ්‍රී ලාංකීය දුරකථන අංක Format කර Validation කිරීම
 */
const getWhatsAppJid = (phoneNumber) => {
  let cleanedNumber = String(phoneNumber || "").replace(/[^0-9]/g, "");

  if (cleanedNumber.startsWith("0")) {
    cleanedNumber = `94${cleanedNumber.substring(1)}`;
  } else if (!cleanedNumber.startsWith("94") && cleanedNumber.length === 9) {
    cleanedNumber = `94${cleanedNumber}`;
  }

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
 * Any Audio (WebM/OGG/WAV) -> Standard MP3 Conversion
 */
const convertToMp3 = (inputBuffer) => {
  return new Promise((resolve) => {
    const tempId = Date.now();
    const inputPath = path.join(os.tmpdir(), `input_${tempId}.webm`);
    const outputPath = path.join(os.tmpdir(), `output_${tempId}.mp3`);

    try {
      fs.writeFileSync(inputPath, inputBuffer);
    } catch (err) {
      console.error("❌ Temp file write error:", err.message);
      return resolve(null);
    }

    ffmpeg(inputPath)
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .audioChannels(2)
      .audioFrequency(44100)
      .toFormat("mp3")
      .on("end", () => {
        try {
          const mp3Buffer = fs.readFileSync(outputPath);
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          resolve(mp3Buffer);
        } catch (err) {
          console.error("❌ MP3 read error:", err.message);
          resolve(null);
        }
      })
      .on("error", (err) => {
        console.error("⚠️ FFmpeg MP3 conversion failed, attempting raw fallback:", err.message);
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        resolve(null);
      })
      .save(outputPath);
  });
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
 * WhatsApp හරහා Playable Voice Recording එකක් යැවීම (MP3 Audio)
 */
const sendWhatsAppAudio = async (phoneNumber, audioInput) => {
  try {
    const { cleanedNumber, jid } = getWhatsAppJid(phoneNumber);
    const sock = getConnectedSocket();

    let rawBuffer;
    if (Buffer.isBuffer(audioInput)) {
      rawBuffer = audioInput;
    } else if (typeof audioInput === "string" && fs.existsSync(audioInput)) {
      rawBuffer = fs.readFileSync(audioInput);
    } else if (typeof audioInput === "string") {
      const cleanBase64 = String(audioInput)
        .replace(/^data:audio\/\w+;base64,/, "")
        .replace(/^data:application\/\w+;base64,/, "")
        .replace(/\s/g, "");
      rawBuffer = Buffer.from(cleanBase64, "base64");
    } else {
      throw new Error("Invalid audio input provided");
    }

    if (!rawBuffer || rawBuffer.length === 0) {
      throw new Error("Audio buffer is empty");
    }

    console.log(`🔄 Converting recording (${rawBuffer.length} bytes) to MP3 format...`);

    // Convert browser recording to standard MP3
    const mp3Buffer = await convertToMp3(rawBuffer);
    const finalBuffer = mp3Buffer || rawBuffer;
    const finalMime = mp3Buffer ? "audio/mpeg" : "audio/webm";

    console.log(`🎙️ Sending MP3 Audio (${finalBuffer.length} bytes) to ${cleanedNumber}...`);

    // Send as standard playable WhatsApp Audio message (ptt: false)
    await sock.sendMessage(jid, {
      audio: finalBuffer,
      mimetype: finalMime,
      ptt: false,
    });

    console.log(`✅ WhatsApp Voice Recording delivered to ${cleanedNumber}`);
    return { success: true };
  } catch (error) {
    console.error("❌ WhatsApp Audio Send Error:", error.message);
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
  sendWhatsAppAudio,
  getWhatsAppStatus,
};