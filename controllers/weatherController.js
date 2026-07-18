const axios = require("axios");
const Boat = require("../models/Boat");
const WeatherLog = require("../models/WeatherLog");

// HELPER: Get OpenWeather API Key (supports both env names)
const getApiKey = () => {
  return process.env.OPENWEATHER_API_KEY || process.env.OPENWEATHER_KEY;
};


// HELPER: Generate weather alerts
const generateAlerts = (weather) => {
  const alerts = [];

  if (weather.windSpeedKts >= 20) {
    alerts.push({
      type: "danger",
      title: "⚠️ High Wind Advisory",
      message: `Wind speed is ${weather.windSpeedKts} kts. Not safe for fishing.`,
    });
  }

  if (weather.visibilityKm <= 5) {
    alerts.push({
      type: "warning",
      title: "🌫️ Low Visibility",
      message: `Visibility is only ${weather.visibilityKm} km.`,
    });
  }

  if (weather.humidity >= 85) {
    alerts.push({
      type: "info",
      title: "💧 High Humidity",
      message: `Humidity is ${weather.humidity}%.`,
    });
  }

  if (weather.temperature >= 32) {
    alerts.push({
      type: "warning",
      title: "🌡️ Heat Advisory",
      message: `Temperature is ${weather.temperature}°C.`,
    });
  }

  return alerts;
};


// HELPER: Convert wind degrees to compass direction (N, NE, E, SE, S, SW, W, NW...)
const getWindDirection = (deg) => {
  if (deg === undefined || deg === null) return "N/A";
  const directions = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
};

// HELPER: Format a unix timestamp (UTC seconds) into that location's local HH:MM AM/PM
const formatLocalTime = (unixSeconds, tzOffsetSeconds = 0) => {
  if (!unixSeconds) return "N/A";
  const d = new Date((unixSeconds + tzOffsetSeconds) * 1000);
  let hours = d.getUTCHours();
  const minutes = d.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};

// HELPER: Simplify OpenWeather's "main" condition into Sunny/Rainy/Cloudy/Foggy
const mapWeatherCondition = (main) => {
  const m = (main || "").toLowerCase();
  if (m.includes("thunderstorm") || m.includes("drizzle") || m.includes("rain"))
    return "Rainy";
  if (m.includes("cloud")) return "Cloudy";
  if (m.includes("clear")) return "Sunny";
  if (m.includes("mist") || m.includes("fog") || m.includes("haze")) return "Foggy";
  return main || "N/A";
};

// HELPER: Fetch & format weather from OpenWeather API
const fetchWeather = async (lat, lon) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Weather API key not configured on server");
  }

  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
  const { data } = await axios.get(currentUrl);

  const tzOffset = data.timezone || 0; // seconds, from OpenWeather

  // --- EXISTING FIELDS — unchanged, nothing here was touched ---
  const weatherData = {
    temperature: Math.round(data.main.temp),
    humidity: data.main.humidity,
    windSpeedKts: +(data.wind?.speed * 1.94384 || 0).toFixed(0),
    visibilityKm: data.visibility ? +(data.visibility / 1000).toFixed(1) : 0,
    estimatedWaveHeight: +((data.wind?.speed || 0) / 2.5).toFixed(1),
    description: data.weather?.[0]?.description || "N/A",
    icon: data.weather?.[0]?.icon || "01d",
  };

  // --- NEW FIELDS ---
  weatherData.windSpeedKmh = +((data.wind?.speed || 0) * 3.6).toFixed(1);
  weatherData.windDeg = data.wind?.deg ?? null;
  weatherData.windDirection = getWindDirection(data.wind?.deg);
  weatherData.weatherMain = data.weather?.[0]?.main || "N/A";
  weatherData.weatherCondition = mapWeatherCondition(data.weather?.[0]?.main);
  weatherData.sunrise = formatLocalTime(data.sys?.sunrise, tzOffset);
  weatherData.sunset = formatLocalTime(data.sys?.sunset, tzOffset);
  weatherData.rainLastHourMm = data.rain?.["1h"] ?? 0;
  weatherData.rainLast3HoursMm = data.rain?.["3h"] ?? 0;
  weatherData.precipitationProbability = 0; // filled below if forecast succeeds
  weatherData.hourlyForecast = [];
  weatherData.dailyForecast = [];

  // Forecast call is best-effort: if it fails, we still return everything above
  try {
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
    const { data: forecast } = await axios.get(forecastUrl);
    const list = forecast.list || [];

    // Next ~24h in 3-hour steps — feeds the Temperature Graph
    weatherData.hourlyForecast = list.slice(0, 8).map((item) => ({
      time: formatLocalTime(item.dt, tzOffset),
      temp: Math.round(item.main.temp),
      pop: Math.round((item.pop || 0) * 100),
      rainMm: item.rain?.["3h"] ?? 0,
    }));

    // Nearest upcoming slot = current precipitation probability
    weatherData.precipitationProbability = weatherData.hourlyForecast[0]?.pop ?? 0;

    // Group forecast slots by local calendar day -> daily rain probability + min/max temp
    const dayMap = {};
    list.forEach((item) => {
      const localDate = new Date((item.dt + tzOffset) * 1000);
      const dayKey = localDate.toISOString().slice(0, 10);
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = {
          date: dayKey,
          maxTemp: item.main.temp,
          minTemp: item.main.temp,
          pop: item.pop || 0,
        };
      } else {
        dayMap[dayKey].maxTemp = Math.max(dayMap[dayKey].maxTemp, item.main.temp);
        dayMap[dayKey].minTemp = Math.min(dayMap[dayKey].minTemp, item.main.temp);
        dayMap[dayKey].pop = Math.max(dayMap[dayKey].pop, item.pop || 0);
      }
    });

    weatherData.dailyForecast = Object.values(dayMap)
      .slice(0, 5)
      .map((d) => ({
        date: d.date,
        maxTemp: Math.round(d.maxTemp),
        minTemp: Math.round(d.minTemp),
        rainProbability: Math.round(d.pop * 100),
      }));
  } catch (forecastErr) {
    console.error("⚠️ Forecast fetch failed (non-fatal):", forecastErr.message);
  }

  return weatherData;
};


// GET Weather From GPS (Simple - No DB save)
//    Used by Owner/Driver dashboard widgets
const getWeatherFromGps = async (req, res) => {
  try {
    const { boatId, lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        message: "Latitude and longitude are required",
      });
    }

    let boat = null;
    if (boatId) {
      boat = await Boat.findById(boatId);
      if (!boat) {
        return res.status(404).json({ message: "Boat not found" });
      }
    }

    const weatherData = await fetchWeather(lat, lon);
    const alerts = generateAlerts(weatherData);

    return res.status(200).json({
      boat: boat
        ? {
            id: boat._id,
            boatName: boat.boatName,
            registrationNumber: boat.registrationNumber,
            boatStatus: boat.boatStatus,
          }
        : null,
      location: {
        latitude: Number(lat),
        longitude: Number(lon),
        source: "device_gps",
      },
      weather: weatherData,
      alerts,
    });
  } catch (error) {
    console.error("Weather From GPS Error:", error.message);
    return res.status(500).json({
      message: "Weather data fetch failed",
      error: error.message,
    });
  }
};

// GET Current Weather (Full check - SAVES to DB)
//   Used by Weather Dashboard - creates admin log
const getCurrentWeather = async (req, res) => {
  try {
    const { boatId, lat, lon, placeName } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        message: "Latitude and longitude are required",
      });
    }

    if (!boatId) {
      return res.status(400).json({
        message: "Boat ID is required",
      });
    }

    // Get boat details
    const boat = await Boat.findById(boatId);
    if (!boat) {
      return res.status(404).json({ message: "Boat not found" });
    }

    // Fetch weather
    const weatherData = await fetchWeather(lat, lon);
    const alerts = generateAlerts(weatherData);

    // ✅ SAVE TO DATABASE (for admin monitoring)
    try {
      await WeatherLog.create({
        boat: boat._id,
        boatName: boat.boatName,
        registrationNumber: boat.registrationNumber,
        checkedBy: req.user._id,
        checkedByName: req.user.name || req.user.email,
        checkedByRole: req.user.role,
        location: {
          latitude: Number(lat),
          longitude: Number(lon),
          placeName: placeName || "",
        },
        weather: weatherData,
        alerts,
      });
      console.log(`✅ Weather log saved for boat: ${boat.boatName}`);
    } catch (logErr) {
      // Don't fail the request if logging fails
      console.error("⚠️ Failed to save weather log:", logErr.message);
    }

    return res.status(200).json({
      boat: {
        id: boat._id,
        boatName: boat.boatName,
        registrationNumber: boat.registrationNumber,
        boatStatus: boat.boatStatus,
      },
      location: {
        latitude: Number(lat),
        longitude: Number(lon),
        placeName: placeName || "",
        source: "GPS",
      },
      weather: weatherData,
      alerts,
    });
  } catch (error) {
    console.error("Weather fetch error:", error.message);
    return res.status(500).json({
      message: "Weather fetch failed",
      error: error.message,
    });
  }
};


// GET Weather for Owner/Driver Dashboard
// Shows weather for user's boats (dashboard widget)
const getDashboardWeather = async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        message: "Latitude and longitude are required for dashboard weather",
      });
    }

    // Get user's boats (owner) or all boats (driver)
    let boats = [];
    if (req.user.role === "owner") {
      boats = await Boat.find({ owner: req.user._id }).select(
        "boatName registrationNumber boatStatus"
      );
    } else if (req.user.role === "driver") {
      boats = await Boat.find().select(
        "boatName registrationNumber boatStatus"
      );
    }

    const weatherData = await fetchWeather(lat, lon);
    const alerts = generateAlerts(weatherData);

    return res.status(200).json({
      success: true,
      user: {
        name: req.user.name || req.user.email,
        role: req.user.role,
      },
      boatsCount: boats.length,
      boats,
      location: {
        latitude: Number(lat),
        longitude: Number(lon),
        source: "device_gps",
      },
      weather: weatherData,
      alerts,
    });
  } catch (error) {
    console.error("Dashboard weather error:", error.message);
    return res.status(500).json({
      message: "Failed to fetch dashboard weather",
      error: error.message,
    });
  }
};

// GET All Weather Logs (Admin view)
const getAllWeatherLogs = async (req, res) => {
  try {
    const { limit = 100, role, boatId } = req.query;

    // Optional filters
    const filter = {};
    if (role) filter.checkedByRole = role;
    if (boatId) filter.boat = boatId;

    const logs = await WeatherLog.find(filter)
      .populate("boat", "boatName registrationNumber boatStatus")
      .populate("checkedBy", "name email role")
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (err) {
    console.error("Get weather logs error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch weather logs",
    });
  }
};


// GET My Weather History (Owner/Driver's own checks)
const getMyWeatherHistory = async (req, res) => {
  try {
    const logs = await WeatherLog.find({ checkedBy: req.user._id })
      .populate("boat", "boatName registrationNumber")
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (err) {
    console.error("Get my history error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch weather history",
    });
  }
};


// GET Latest Shared Weather+Location for a Boat
//   Used by Owner's WeatherDashboard — reads whatever the DRIVER last shared
//   (via getCurrentWeather) so it does NOT use the owner's own GPS at all.
const getLatestBoatWeather = async (req, res) => {
  try {
    const { boatId } = req.params;

    const boat = await Boat.findById(boatId);
    if (!boat) {
      return res.status(404).json({ message: "Boat not found" });
    }

    // Prefer the latest log submitted by a driver; fall back to any latest log
    let log = await WeatherLog.findOne({
      boat: boatId,
      checkedByRole: "driver",
    }).sort({ createdAt: -1 });

    if (!log) {
      log = await WeatherLog.findOne({ boat: boatId }).sort({ createdAt: -1 });
    }

    if (!log) {
      return res.status(200).json({
        status: "none",
        boat: {
          id: boat._id,
          boatName: boat.boatName,
          registrationNumber: boat.registrationNumber,
          boatStatus: boat.boatStatus,
        },
      });
    }

    return res.status(200).json({
      status: "available",
      boat: {
        id: boat._id,
        boatName: boat.boatName,
        registrationNumber: boat.registrationNumber,
        boatStatus: boat.boatStatus,
      },
      location: log.location,
      weather: log.weather,
      alerts: log.alerts || [],
      checkedByName: log.checkedByName,
      checkedByRole: log.checkedByRole,
      checkedAt: log.createdAt,
    });
  } catch (error) {
    console.error("Get Latest Boat Weather Error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// EXPORTS
module.exports = {
  getWeatherFromGps,      // Simple weather (no DB save)
  getCurrentWeather,      // Full check + saves log (for admin)
  getDashboardWeather,    // Owner/Driver dashboard widget
  getAllWeatherLogs,      // Admin: all logs
  getMyWeatherHistory,    // Owner/Driver: own history
  getLatestBoatWeather,   // Owner: latest driver-shared weather+location
};