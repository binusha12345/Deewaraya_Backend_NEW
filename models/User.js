const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      unique: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],  // make it required
      unique: true,    
      trim: true,
      minlength: [10, "Phone number must be at least 10 characters"],
      maxlength: [10, "Phone number cannot exceed 10 characters"],
      match: [/^[0-9]{10}$/, "Phone number must contain exactly 10 digits only"],
    },

    nic: {
      type: String,
      required: [true, "NIC is required"],
      unique: true,
      trim: true,
      minlength: [12, "NIC must be at least 12 characters"],
      maxlength: [12, "NIC cannot exceed 12 characters"],
      match: [/^[0-9]{12}$/, "NIC must contain exactly 12 digits only"],
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
      // Removed default: "" because it's required
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [5, "Password must be at least 5 characters"],
    },
    role: {
      type: String,
      enum: ["owner", "driver"],
      required: [true, "Role is required"],
    },
        // Forgot Password Fields
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpire: {
      type: Date,
      default: null,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    coverPhoto: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);