const mongoose = require("mongoose");

const boatSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    boatName: {
      type: String,
      required: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    boatType: {
      type: String,
      required: true,
    },
    modelYear: {
      type: String,
      required: true,
      minlength: [4, "NIC must be at least 4 characters"],
      maxlength: [4, "NIC cannot exceed 4 characters"],
    },
    engineSerial: {
      type: String,
      default: "",
      required: [true, "Engine serial is required"],
    },
    fuelCapacity: {
      type: Number,
      default: 0,
      required: true
    },
    horsepower: {
      type: Number,
      required: [true, "Horsepower is required"],
      min: [1, "Horsepower must be greater than 0"],
    },
    imageUrl: {
      type: String,
      default: "",
    },
    boatStatus: {
      type: String,
      enum: ["ACTIVE", "MAINTENANCE", "NON-ACTIVE"],
      default: "ACTIVE",
      required: [true, "Boat status is required"],
    },
    engineType: {
      type: String,
      required: [true, "Engine type is required"],
    },
    latitude: {
    type: Number,
    default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Boat", boatSchema);