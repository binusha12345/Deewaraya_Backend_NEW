const mongoose = require("mongoose");

const emergencyLogSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    boatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Boat",
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    emergencyType: {
      type: String,
      enum: [
        "medical",
        "sinking",
        "fire",
        "engine_failure",
        "fuel_finished",
        "bad_weather",
        "lost_navigation",
        "man_overboard",
        "other",
      ],
      required: true,
    },
    latitude: Number,
    longitude: Number,
    placeName: String,
    message: String,
    status: {
      type: String,
      enum: ["active", "resolved", "safe"],
      default: "active",
    },
    resolvedAt: Date,
    checklist: {
      lifeJackets: Boolean,
      radioWorking: Boolean,
      fuelOk: Boolean,
      crewConfirmed: Boolean,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmergencyLog", emergencyLogSchema);