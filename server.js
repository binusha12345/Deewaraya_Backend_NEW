// server.js
require("dotenv").config();

console.log("✅ Environment Check:");
console.log("PORT:", process.env.PORT);
console.log("MongoDB:", process.env.MONGO_URI ? "✓ Set" : "✗ Missing");
console.log("Email Host:", process.env.EMAIL_HOST);
console.log("Email User:", process.env.EMAIL_USER);
console.log("Email From:", process.env.EMAIL_FROM);

const fs = require("fs");
const https = require("https");
const express = require("express");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");

const User = require("./models/User");
const connectDB = require("./config/db");

// Services
const { updateAllMarketPrices } = require("./services/marketService");
const { scrapeCFHCFishPrices } = require("./services/cfhcScraperService");

// Routes Imports
const translateRoutes = require("./routes/translateRoutes");
const financeRoutes = require("./routes/financeRoutes"); // ✅ financeRoutes එකටම point කර ඇත

// ==================== EXPRESS APP ====================
const app = express();

// ==================== HTTPS SERVER ====================
const tlsDirectory = path.join(__dirname, "..", "client");
const server = https.createServer(
  {
    key: fs.readFileSync(path.join(tlsDirectory, "10.57.89.85+2-key.pem")),
    cert: fs.readFileSync(path.join(tlsDirectory, "10.57.89.85+2.pem")),
  },
  app
);

// ==================== CORS ORIGINS ====================
const allowedOrigins = [
  "https://localhost:5173",
  "https://127.0.0.1:5173",
  "https://10.57.89.85:5173",
];

// ==================== SOCKET.IO ====================
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});
app.set("io", io);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id role");
    if (!user || user.role !== "owner")
      return next(new Error("Owner access required"));
    socket.data.userId = String(user._id);
    next();
  } catch {
    next(new Error("Invalid authentication"));
  }
});

io.on("connection", (socket) => {
  socket.join(`owner:${socket.data.userId}`);
});

// ==================== CONNECT DATABASE ====================
connectDB();

// ==================== STARTUP TASKS ====================
scrapeCFHCFishPrices();
updateAllMarketPrices();

// ==================== MIDDLEWARE ====================
// 1. CORS (මුලින්ම run විය යුතුයි)
app.use(
  cors({
    origin: true, // Development & Ngrok සඳහා ඕනෑම origin එකක් allow කරයි
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type", 
      "Authorization", 
      "ngrok-skip-browser-warning" // 💡 Ngrok warning එක bypass කිරීමට අවශ්‍යයි
    ],
    credentials: true,
  })
);

// 2. Body Parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 3. Static Files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 4. Debug Logger
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

// ==================== INITIALIZE WHATSAPP CLIENT ====================
// (Middlewares වලට පසුව run විය යුතුය)
require("./services/whatsappClient");

// ==================== ROUTES ====================
app.use("/api/vessel", require("./routes/boatRoutes"));
app.use("/api/vessels", require("./routes/boatRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/boats", require("./routes/boatRoutes"));
app.use("/api/weather", require("./routes/weatherRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/tracking", require("./routes/trackingRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/signal", require("./routes/signalRoutes"));

// ✅ Finance Routes (Routes දෙකම එකම file එකකට Map කර ඇත)
app.use("/api/finance", financeRoutes);
app.use("/api/financial", financeRoutes);

app.use("/api/translate", translateRoutes);

// ✅ Contact Route එක නිවැරදි කර ඇත
app.use("/api/contact", require("./routes/contact"));

// Root route
app.get("/", (req, res) => {
  res.send("Deewaraya API Running...");
});

// ==================== SCHEDULED JOBS ====================
const { scheduleMonthlyFinanceEmails } = require("./jobs/monthlyFinanceJob");
scheduleMonthlyFinanceEmails();

// ==================== MARKET & FISH PRICE APIS ====================
app.get("/api/market-prices", (req, res) => {
  try {
    const dataPath = path.join(__dirname, "market-data.json");
    const rawData = fs.readFileSync(dataPath);
    res.status(200).json({ success: true, data: JSON.parse(rawData) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error reading market data" });
  }
});

app.get("/api/fish-prices", (req, res) => {
  try {
    const dataPath = path.join(__dirname, "cfhc-fish-data.json");
    const rawData = fs.readFileSync(dataPath);
    res.status(200).json({ success: true, data: JSON.parse(rawData) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not read price data" });
  }
});

// ==================== GLOBAL ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error("❌ Global error:", err.message);
  res.status(500).json({ message: err.message || "Server error" });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Secure API running on:`);
  console.log(`   → https://localhost:${PORT}`);
  console.log(`   → https://dry-hyphen-grinning.ngrok-free.dev:${PORT}\n`);
});