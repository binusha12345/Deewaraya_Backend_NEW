const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    boat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Boat",
      required: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: null },
    distanceKm: { type: Number, default: 0 },
    points: [
      {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        recordedAt: { type: Date, required: true, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

tripSchema.index({ driver: 1, endedAt: 1 });

module.exports = mongoose.model("Trip", tripSchema);