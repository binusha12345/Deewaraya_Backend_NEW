const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const fs = require("fs/promises");
const path = require("path");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

let sock = null;
let isConnected = false;
let resettingLoggedOutSession = false;
const authDirectory = path.join(__dirname, "..", "baileys_auth_info");

const resetLoggedOutSession = async () => {
  if (resettingLoggedOutSession) return;
  resettingLoggedOutSession = true;
  try {
    const archiveDirectory = `${authDirectory}.logged-out-${Date.now()}`;
    await fs.rename(authDirectory, archiveDirectory);
    console.warn(`WhatsApp rejected the saved session; archived it as ${path.basename(archiveDirectory)}.`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Could not archive the logged-out WhatsApp session:", error.message);
      resettingLoggedOutSession = false;
      return;
    }
  }

  try {
    await connectToWhatsApp();
  } catch (error) {
    console.error("Could not start a new WhatsApp pairing session:", error.message);
  } finally {
    resettingLoggedOutSession = false;
  }
};

async function connectToWhatsApp() {
  // Session එක save වන folder එක
  const { state, saveCreds } = await useMultiFileAuthState(authDirectory);

  sock = makeWASocket({
    logger: pino({ level: "silent" }),
    auth: state,
    printQRInTerminal: false,
    browser: ["Deewaraya System", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    // QR Code Terminal එකේ පෙන්වීම
    if (qr) {
      console.log("\n========================================");
      console.log("📱 WhatsApp (Baileys) QR Code එක Scan කරන්න!");
      console.log("========================================\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`⚠️ WhatsApp Connection වැසුණි. Reason: ${statusCode}. Reconnecting: ${shouldReconnect}`);
      isConnected = false;

      if (shouldReconnect) {
        connectToWhatsApp(); // නැවත Auto Connect වීම
      } else {
        resetLoggedOutSession();
      }
    } else if (connection === "open") {
      console.log("\n========================================");
      console.log("✅ WhatsApp (Baileys) සාර්ථකව Connect විය!");
      console.log("🟢 දැන් PDF messages යැවීමට සූදානම්!");
      console.log("========================================\n");
      isConnected = true;
    }
  });
}

// Service එක මුලින්ම Start කිරීම
connectToWhatsApp();

const getBaileysStatus = () => isConnected;
const getSocket = () => sock;

module.exports = { connectToWhatsApp, getBaileysStatus, getSocket };