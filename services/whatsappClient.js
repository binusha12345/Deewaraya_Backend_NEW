const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

let sock = null;
let isConnected = false;

async function connectToWhatsApp() {
  // Session එක save වන folder එක
  const { state, saveCreds } = await useMultiFileAuthState("baileys_auth_info");

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