// server.js
require("dotenv").config();

console.log("✅ Environment Check:");
console.log("PORT:", process.env.PORT);
console.log("MongoDB:", process.env.MONGO_URI ? "✓ Set" : "✗ Missing");
console.log("Email Host:", process.env.EMAIL_HOST);
console.log("Email User:", process.env.EMAIL_USER);
console.log("Email From:", process.env.EMAIL_FROM);

const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const translateRoutes = require("./routes/translateRoutes");
const contactRoutes = require('./routes/contact');
const app = express();

// ==================== CONNECT DATABASE ====================
connectDB();

// 2. Enable CORS
app.use(cors({
  origin: "*", // This allows ALL devices and IPs to connect
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (only once!)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 🔍 Debug logger - see every request
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

// ==================== ROUTES ====================
app.use("/api/vessel", require("./routes/boatRoutes"));
app.use("/api/vessels", require("./routes/boatRoutes"));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/boats", require("./routes/boatRoutes"));
app.use("/api/weather", require("./routes/weatherRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/tracking", require("./routes/trackingRoutes"));
app.use("/api/finance", require("./routes/financeRoutes"));  
app.use("/api/translate", translateRoutes);
app.use('/api/contact', contactRoutes);
app.use("/reports", express.static(path.join(__dirname, "public/reports")));

// Root route
app.get("/", (req, res) => {
  res.send("Deewaraya API Running...");
});

// ==================== SCHEDULED JOBS ====================
const { scheduleMonthlyFinanceEmails } = require("./jobs/monthlyFinanceJob");
scheduleMonthlyFinanceEmails();

// ==================== ERROR HANDLER ====================


app.use((err, req, res, next) => {
  console.error("❌ Global error:", err.message);
  res.status(500).json({ message: err.message || "Server error" });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://10.57.89.85:${PORT}`);
});