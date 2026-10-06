const Boat = require("../models/Boat");
const Notification = require("../models/Notification");
const { publishConnectionNotification } = require("../services/connectionNotificationService");

const reportConnectionStatus = async (req, res) => {
	try {
		const { boatId, status, latency } = req.body;
		const validStatuses = ["good", "medium", "poor", "offline"];
		if (!boatId || !validStatuses.includes(status)) {
			return res.status(400).json({ message: "A valid boatId and connection status are required" });
		}

		if (req.user.role !== "driver") return res.status(403).json({ message: "Drivers only" });
		const boat = await Boat.findOne({ _id: boatId, driver: req.user._id });
		if (!boat) return res.status(404).json({ message: "Assigned boat not found" });

		const previousStatus = boat.connectionStatus || "good";
		await Boat.updateOne(
			{ _id: boat._id },
			{ $set: { connectionStatus: status, connectionCheckedAt: new Date() } }
		);
		if (previousStatus === status) {
			return res.status(200).json({ changed: false });
		}

		const notification = await publishConnectionNotification({
			boat,
			status,
			previousStatus,
			latency,
			io: req.app.get("io"),
		});
		return res.status(200).json({ changed: true, notification });
	} catch (error) {
		console.error("Connection status notification error:", error.message);
		return res.status(500).json({ message: "Could not report connection status" });
	}
};

const getMyNotifications = async (req, res) => {
	try {
		const notifications = await Notification.find({ owner: req.user._id })
			.populate("boat", "boatName registrationNumber")
			.populate("requester", "name email")
			.sort({ createdAt: -1 })
			.limit(100);
		return res.status(200).json(notifications);
	} catch (error) {
		console.error("Get notifications error:", error.message);
		return res.status(500).json({ message: "Could not load notifications" });
	}
};

const createQrRequest = async (req, res) => {
	try {
		if (req.user.role !== "driver") return res.status(403).json({ message: "Drivers only" });

		const boat = await Boat.findOne({ _id: req.params.boatId, driver: req.user._id });
		if (!boat) return res.status(404).json({ message: "Assigned boat not found" });

		let request = await Notification.findOne({
			boat: boat._id,
			requester: req.user._id,
			type: "qr_request",
			requestStatus: { $in: ["pending", "shared"] },
		}).sort({ createdAt: -1 });

		if (request) {
			await request.populate(["boat", "requester"]);
			return res.status(200).json(request);
		}

		request = await Notification.create({
			owner: boat.owner,
			boat: boat._id,
			type: "qr_request",
			message: `${req.user.name || "A driver"} requested the QR code for ${boat.boatName}.`,
			requester: req.user._id,
			requestStatus: "pending",
		});
		await request.populate(["boat", "requester"]);
		req.app.get("io")?.to(`owner:${boat.owner}`).emit("notification:new", request);
		return res.status(201).json(request);
	} catch (error) {
		console.error("Create vessel QR request error:", error.message);
		return res.status(500).json({ message: "Could not request the boat QR code" });
	}
};

const getDriverQrRequests = async (req, res) => {
	try {
		if (req.user.role !== "driver") return res.status(403).json({ message: "Drivers only" });
		const requests = await Notification.find({ requester: req.user._id, type: "qr_request" })
			.populate("boat", "boatName registrationNumber")
			.sort({ createdAt: -1 });
		return res.status(200).json(requests);
	} catch (error) {
		console.error("Get driver QR requests error:", error.message);
		return res.status(500).json({ message: "Could not load boat QR requests" });
	}
};

const shareQrRequest = async (req, res) => {
	try {
		if (req.user.role !== "owner") return res.status(403).json({ message: "Owners only" });

		const request = await Notification.findOne({
			_id: req.params.id,
			owner: req.user._id,
			type: "qr_request",
		});
		if (!request) return res.status(404).json({ message: "QR request not found" });

		const boat = await Boat.findOne({
			_id: request.boat,
			owner: req.user._id,
			driver: request.requester,
		});
		if (!boat) return res.status(409).json({ message: "This driver is no longer assigned to the boat" });

		if (request.requestStatus !== "shared") {
			request.requestStatus = "shared";
			request.sharedAt = new Date();
			request.readAt = new Date();
			await request.save();
		}

		await request.populate(["boat", "requester"]);
		req.app.get("io")?.to(`driver:${request.requester._id}`).emit("notification:qr-shared", request);
		return res.status(200).json(request);
	} catch (error) {
		console.error("Share boat QR request error:", error.message);
		return res.status(500).json({ message: "Could not share the boat QR code" });
	}
};

const markNotificationRead = async (req, res) => {
	try {
		const notification = await Notification.findOneAndUpdate(
			{ _id: req.params.id, owner: req.user._id },
			{ readAt: new Date() },
			{ new: true }
		);
		if (!notification) return res.status(404).json({ message: "Notification not found" });
		return res.status(200).json(notification);
	} catch (error) {
		return res.status(500).json({ message: "Could not update notification" });
	}
};

module.exports = {
	reportConnectionStatus,
	getMyNotifications,
	markNotificationRead,
	createQrRequest,
	getDriverQrRequests,
	shareQrRequest,
};
