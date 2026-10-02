const Boat = require("../models/Boat");
const Notification = require("../models/Notification");

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

		let notification = null;
		const emittedNotifications = [];
		if (status === "poor" || status === "offline") {
			notification = await Notification.create({
				owner: boat.owner,
				boat: boat._id,
				type: "connection_warning",
				status,
				latency: Number.isFinite(Number(latency)) ? Number(latency) : null,
				message: `${boat.boatName}: the driver's internet connection is ${status}.`,
			});
			emittedNotifications.push(notification);
		} else if (previousStatus === "poor" || previousStatus === "offline") {
			notification = await Notification.create({
				owner: boat.owner,
				boat: boat._id,
				type: "connection_recovery",
				status,
				latency: Number.isFinite(Number(latency)) ? Number(latency) : null,
				message: `${boat.boatName}: the driver's internet connection has recovered.`,
			});
			emittedNotifications.push(notification);
		}

		if (req.app.get("io")) {
			for (const newNotification of emittedNotifications) {
				req.app.get("io").to(`owner:${boat.owner}`).emit("notification:new", newNotification);
			}
		}
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
			.sort({ createdAt: -1 })
			.limit(100);
		return res.status(200).json(notifications);
	} catch (error) {
		console.error("Get notifications error:", error.message);
		return res.status(500).json({ message: "Could not load notifications" });
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

module.exports = { reportConnectionStatus, getMyNotifications, markNotificationRead };
