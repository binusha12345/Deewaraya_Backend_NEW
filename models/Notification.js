const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
	{
		owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
		boat: { type: mongoose.Schema.Types.ObjectId, ref: "Boat", required: true, index: true },
		type: { type: String, enum: ["connection_warning", "connection_recovery"], required: true },
		status: { type: String, enum: ["poor", "offline", "good", "medium"], required: true },
		message: { type: String, required: true, maxlength: 240 },
		latency: { type: Number, default: null },
		readAt: { type: Date, default: null },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
