const Boat = require("../models/Boat");
const Trip = require("../models/Trip");
const { calculateTripDistanceKm, getTrackableSegmentDistanceKm } = require("../utils/tripDistance");

const validCoordinates = ({ latitude, longitude }) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

const addPoint = (trip, coordinates) => {
  if (!validCoordinates(coordinates)) return false;
  const lastPoint = trip.points[trip.points.length - 1];
  const point = {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    recordedAt: coordinates.recordedAt ? new Date(coordinates.recordedAt) : new Date(),
  };

  if (lastPoint) {
    const segmentDistanceKm = getTrackableSegmentDistanceKm(lastPoint, point);
    if (segmentDistanceKm === null) return false;
    trip.distanceKm += segmentDistanceKm;
  }

  trip.points.push(point);
  return true;
};

const getMyTrips = async (req, res) => {
  try {
    const [trips, activeTrip] = await Promise.all([
      Trip.find({ driver: req.user._id })
        .populate("boat", "boatName registrationNumber boatType modelYear engineSerial engineType fuelCapacity horsepower boatStatus imageUrl owner")
        .populate("boat.owner", "name email")
        .sort({ startedAt: -1 })
        .limit(50),
      Trip.findOne({ driver: req.user._id, endedAt: null })
        .populate("boat", "boatName registrationNumber boatType modelYear engineSerial engineType fuelCapacity horsepower boatStatus imageUrl owner")
        .populate("boat.owner", "name email"),
    ]);

    const uniqueTrips = new Map(trips.map((trip) => [String(trip._id), trip]));
    if (activeTrip && !uniqueTrips.has(String(activeTrip._id))) {
      uniqueTrips.set(String(activeTrip._id), activeTrip);
    }
    const updates = [];
    for (const trip of uniqueTrips.values()) {
      const correctedDistanceKm = calculateTripDistanceKm(trip.points);
      if (Math.abs((trip.distanceKm || 0) - correctedDistanceKm) > 1e-9) {
        trip.distanceKm = correctedDistanceKm;
        updates.push(trip.save());
      }
    }
    if (activeTrip && uniqueTrips.has(String(activeTrip._id))) {
      activeTrip.distanceKm = uniqueTrips.get(String(activeTrip._id)).distanceKm;
    }
    await Promise.all(updates);

    res.status(200).json({ trips, activeTrip });
  } catch (error) {
    console.error("Get driver trips error:", error.message);
    res.status(500).json({ message: "Could not load trips" });
  }
};

const getOwnerTrips = async (req, res) => {
  try {
    const { boatId } = req.query;
    if (!boatId || !/^[a-f\d]{24}$/i.test(boatId)) {
      return res.status(400).json({ message: "Select a valid boat" });
    }

    const boat = await Boat.findOne({ _id: boatId, owner: req.user._id }).select("_id");
    if (!boat) return res.status(404).json({ message: "Boat not found in your fleet" });

    const [trips, summaryResults] = await Promise.all([
      Trip.find({ boat: boat._id })
      .select("boat driver startedAt endedAt durationSeconds distanceKm")
      .populate("boat", "boatName registrationNumber")
      .populate("driver", "name email")
      .sort({ startedAt: -1 })
      .limit(100),
      Trip.aggregate([
        { $match: { boat: boat._id } },
        {
          $group: {
            _id: "$boat",
            tripCount: { $sum: 1 },
            totalDistanceKm: { $sum: { $ifNull: ["$distanceKm", 0] } },
            totalDurationSeconds: {
              $sum: {
                $ifNull: [
                  "$durationSeconds",
                  { $divide: [{ $subtract: [new Date(), "$startedAt"] }, 1000] },
                ],
              },
            },
          },
        },
      ]),
    ]);

    const summary = summaryResults[0] || {
      tripCount: 0,
      totalDistanceKm: 0,
      totalDurationSeconds: 0,
    };

    return res.status(200).json({ trips, summary });
  } catch (error) {
    console.error("Get owner trips error:", error.message);
    return res.status(500).json({ message: "Could not load boat trips" });
  }
};

const startTrip = async (req, res) => {
  try {
    const { boatId, latitude, longitude, recordedAt } = req.body;
    if (!boatId || !validCoordinates({ latitude, longitude })) {
      return res.status(400).json({ message: "Boat and valid GPS coordinates are required" });
    }

    const boat = await Boat.findOne({ _id: boatId, driver: req.user._id });
    if (!boat) return res.status(403).json({ message: "This boat is not assigned to you" });

    const activeTrip = await Trip.findOne({ driver: req.user._id, endedAt: null });
    if (activeTrip) return res.status(409).json({ message: "End your active trip before starting another" });

    const trip = await Trip.create({
      driver: req.user._id,
      boat: boat._id,
      startedAt: recordedAt ? new Date(recordedAt) : new Date(),
      points: [{ latitude, longitude, recordedAt: recordedAt ? new Date(recordedAt) : new Date() }],
    });
    await trip.populate("boat", "boatName registrationNumber boatType modelYear engineSerial engineType fuelCapacity horsepower boatStatus imageUrl owner");
    await trip.populate("boat.owner", "name email");

    res.status(201).json({ trip });
  } catch (error) {
    console.error("Start trip error:", error.message);
    res.status(500).json({ message: "Could not start trip" });
  }
};

const recordTripPoint = async (req, res) => {
  try {
    const { latitude, longitude, recordedAt } = req.body;
    if (!validCoordinates({ latitude, longitude })) {
      return res.status(400).json({ message: "Valid GPS coordinates are required" });
    }

    const trip = await Trip.findOne({ _id: req.params.id, driver: req.user._id, endedAt: null });
    if (!trip) return res.status(404).json({ message: "Active trip not found" });

    addPoint(trip, { latitude, longitude, recordedAt });
    await trip.save();
    await trip.populate("boat", "boatName registrationNumber boatType modelYear engineSerial engineType fuelCapacity horsepower boatStatus imageUrl owner");
    await trip.populate("boat.owner", "name email");
    res.status(200).json({ trip });
  } catch (error) {
    console.error("Record trip location error:", error.message);
    res.status(500).json({ message: "Could not record trip location" });
  }
};

const endTrip = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, driver: req.user._id, endedAt: null });
    if (!trip) return res.status(404).json({ message: "Active trip not found" });

    const { latitude, longitude, recordedAt } = req.body;
    if (latitude !== undefined || longitude !== undefined) {
      if (!validCoordinates({ latitude, longitude })) {
        return res.status(400).json({ message: "Valid GPS coordinates are required" });
      }
      addPoint(trip, { latitude, longitude, recordedAt });
    }

    trip.endedAt = recordedAt ? new Date(recordedAt) : new Date();
    trip.durationSeconds = Math.max(0, Math.round((trip.endedAt - trip.startedAt) / 1000));
    await trip.save();
    await trip.populate("boat", "boatName registrationNumber boatType modelYear engineSerial engineType fuelCapacity horsepower boatStatus imageUrl owner");
    await trip.populate("boat.owner", "name email");

    res.status(200).json({ trip });
  } catch (error) {
    console.error("End trip error:", error.message);
    res.status(500).json({ message: "Could not end trip" });
  }
};

module.exports = { getMyTrips, getOwnerTrips, startTrip, recordTripPoint, endTrip };