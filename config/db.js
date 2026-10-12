const mongoose = require("mongoose");

const connectDB = async (retries = 5) => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      family: 4, // Force IPv4 to avoid IPv6 DNS resolution issues
    });
    console.log("MongoDB Connected");

    // Auto-reconnect on connection loss
    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Attempting to reconnect...");
    });
    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected.");
    });
  } catch (error) {
    console.error("DB Error:", error.message);
    if (retries > 0) {
      const delay = Math.min(5000 * (6 - retries), 30000);
      console.log(`Retrying MongoDB connection in ${delay / 1000}s... (${retries} retries left)`);
      setTimeout(() => connectDB(retries - 1), delay);
    } else {
      console.error("❌ Could not connect to MongoDB after multiple retries.");
      // Don't exit - let the server start anyway and retry in the background
      setTimeout(() => connectDB(5), 30000);
    }
  }
};

module.exports = connectDB;
