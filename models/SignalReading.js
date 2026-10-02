const mongoose = require("mongoose");

const signalReadingSchema = new mongoose.Schema(
  {
    boat: { type: mongoose.Schema.Types.ObjectId, ref: "Boat", required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["good", "medium", "poor", "offline"], required: true },
    latency: { type: Number, default: null },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

signalReadingSchema.index({ recordedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model("SignalReading", signalReadingSchema);