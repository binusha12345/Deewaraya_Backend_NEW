const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    boat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Boat",
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "shared", "declined"],
      default: "pending",
    },
    sharedLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      sharedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Location", locationSchema);