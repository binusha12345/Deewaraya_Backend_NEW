const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
	{
		owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
		boat: { type: mongoose.Schema.Types.ObjectId, ref: "Boat", required: true, index: true },
		type: { type: String, enum: ["connection_warning", "connection_recovery", "qr_request", "emergency_sos", "emergency_safe"], required: true },
		status: {
			type: String,
			enum: ["poor", "offline", "good", "medium"],
			default: null,
			required() { return this.type === "connection_warning" || this.type === "connection_recovery"; },
		},
		message: { type: String, required: true, maxlength: 240 },
		latency: { type: Number, default: null },
		latitude: { type: Number, default: null },
		longitude: { type: Number, default: null },
		requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
		requestStatus: { type: String, enum: ["pending", "shared"], default: null },
		sharedAt: { type: Date, default: null },
		readAt: { type: Date, default: null },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
