const Boat = require('../models/Boat');
const WeatherLog = require('../models/WeatherLog'); // ✅ NEW
const axios = require('axios');


// GET ALL ONLINE BOATS WITH LIVE WEATHER
//    (Real-time monitoring of GPS-enabled boats)
const getOnlineBoatsWithWeather = async (req, res) => {
  try {
    const boats = await Boat.find({
      gpsEnabled: true,
      isOnline: true,
      'currentLocation.lat': { $exists: true, $ne: null },
      'currentLocation.lng': { $exists: true, $ne: null }
    }).populate('owner', 'name email phone');

    console.log(`🚤 Found ${boats.length} online boats`);

    const boatsWithWeather = await Promise.all(
      boats.map(async (boat) => {
        try {
          const weatherData = await fetchWeatherData(
            boat.currentLocation.lat,
            boat.currentLocation.lng
          );
          const alerts = generateWeatherAlerts(weatherData);

          return {
            ...boat.toObject(),
            weather: weatherData,
            alerts
          };
        } catch (err) {
          console.error(`Weather error for boat ${boat.name}:`, err.message);
          return {
            ...boat.toObject(),
            weather: null,
            alerts: []
          };
        }
      })
    );

    const allAlerts = boatsWithWeather.flatMap((boat) =>
      boat.alerts.map((alert) => ({
        ...alert,
        boatName: boat.name,
        boatId: boat._id,
        location: boat.currentLocation
      }))
    );

    res.status(200).json({
      success: true,
      count: boatsWithWeather.length,
      boats: boatsWithWeather,
      alerts: allAlerts,
      alertCount: allAlerts.length
    });
  } catch (error) {
    console.error('Get online boats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch online boats',
      error: error.message
    });
  }
};

// GET ALL WEATHER LOGS (NEW ✅)
//    Shows history of weather checks by owners/drivers
const getAllWeatherLogs = async (req, res) => {
  try {
    const { limit = 100, role, boatId } = req.query;

    const filter = {};
    if (role) filter.checkedByRole = role;
    if (boatId) filter.boat = boatId;

    // Don't populate - use the stored names directly
    const logs = await WeatherLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    console.log(`📊 Admin fetched ${logs.length} weather logs`);

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("Get weather logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch weather logs",
      error: error.message,
    });
  }
};


// GET WEATHER LOGS FOR A SPECIFIC BOAT (NEW)
const getBoatWeatherHistory = async (req, res) => {
  try {
    const { boatId } = req.params;

    const logs = await WeatherLog.find({ boat: boatId })
      .populate('boat', 'boatName registrationNumber')
      .populate('checkedBy', 'name email role')
      .sort({ createdAt: -1 })
      .limit(50);

    if (logs.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        logs: [],
        message: 'No weather checks found for this boat'
      });
    }

    res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Get boat weather history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weather history',
      error: error.message
    });
  }
};


// 4️⃣ GET WEATHER STATISTICS (Updated)
const getWeatherStats = async (req, res) => {
  try {
    const totalBoats = await Boat.countDocuments();
    const onlineBoats = await Boat.countDocuments({
      isOnline: true,
      gpsEnabled: true
    });
    const gpsEnabledBoats = await Boat.countDocuments({ gpsEnabled: true });

    // NEW: Weather log stats
    const totalWeatherChecks = await WeatherLog.countDocuments();

    // Today's checks
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayChecks = await WeatherLog.countDocuments({
      createdAt: { $gte: todayStart }
    });

    // Checks by role
    const ownerChecks = await WeatherLog.countDocuments({
      checkedByRole: 'owner'
    });
    const driverChecks = await WeatherLog.countDocuments({
      checkedByRole: 'driver'
    });

    // Recent alerts (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const recentAlertsCount = await WeatherLog.countDocuments({
      createdAt: { $gte: yesterday },
      'alerts.0': { $exists: true } // has at least 1 alert
    });

    res.status(200).json({
      success: true,
      stats: {
        totalBoats,
        onlineBoats,
        gpsEnabledBoats,
        offlineBoats: totalBoats - onlineBoats,
        totalWeatherChecks,
        todayChecks,
        ownerChecks,
        driverChecks,
        recentAlertsCount
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats'
    });
  }
};

// HELPER: Fetch Weather Data from OpenWeather API
const fetchWeatherData = async (lat, lng) => {
  try {
    const API_KEY =
      process.env.OPENWEATHER_API_KEY || process.env.OPENWEATHER_KEY;

    if (!API_KEY) {
      throw new Error('OpenWeather API key not configured');
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${API_KEY}&units=metric`;

    const response = await axios.get(url);
    const data = response.data;

    return {
      location: data.name || 'Unknown',
      country: data.sys?.country,
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      windSpeed: data.wind.speed,
      windDirection: data.wind.deg,
      condition: data.weather[0].main,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      cloudiness: data.clouds.all,
      visibility: data.visibility ? data.visibility / 1000 : null,
      sunrise: new Date(data.sys.sunrise * 1000),
      sunset: new Date(data.sys.sunset * 1000),
      timestamp: new Date()
    };
  } catch (error) {
    throw new Error('Weather API error: ' + error.message);
  }
};

// HELPER: Generate Weather Alerts
const generateWeatherAlerts = (weather) => {
  if (!weather) return [];

  const alerts = [];

  // 🌡️ Temperature alerts
  if (weather.temperature >= 35) {
    alerts.push({
      type: 'temperature',
      severity: 'high',
      icon: '🌡️',
      title: 'Extreme Heat Warning',
      message: `Temperature is ${weather.temperature}°C - Dangerously hot conditions`
    });
  } else if (weather.temperature >= 32) {
    alerts.push({
      type: 'temperature',
      severity: 'medium',
      icon: '🌡️',
      title: 'High Temperature',
      message: `Temperature is ${weather.temperature}°C - Stay hydrated`
    });
  } else if (weather.temperature <= 15) {
    alerts.push({
      type: 'temperature',
      severity: 'medium',
      icon: '❄️',
      title: 'Low Temperature',
      message: `Temperature is ${weather.temperature}°C - Cold conditions`
    });
  }

  // Humidity alerts
  if (weather.humidity >= 85) {
    alerts.push({
      type: 'humidity',
      severity: 'high',
      icon: '💧',
      title: 'Very High Humidity',
      message: `Humidity is ${weather.humidity}% - Uncomfortable conditions`
    });
  } else if (weather.humidity >= 75) {
    alerts.push({
      type: 'humidity',
      severity: 'medium',
      icon: '💧',
      title: 'High Humidity',
      message: `Humidity is ${weather.humidity}%`
    });
  }

  // Wind alerts
  if (weather.windSpeed >= 15) {
    alerts.push({
      type: 'wind',
      severity: 'high',
      icon: '💨',
      title: 'Strong Wind Warning',
      message: `Wind speed is ${weather.windSpeed} m/s - Dangerous for boats`
    });
  } else if (weather.windSpeed >= 10) {
    alerts.push({
      type: 'wind',
      severity: 'medium',
      icon: '💨',
      title: 'Moderate Wind',
      message: `Wind speed is ${weather.windSpeed} m/s`
    });
  }

  // Weather condition alerts
  const dangerousConditions = ['Thunderstorm', 'Tornado', 'Squall'];
  const cautionConditions = ['Rain', 'Snow', 'Drizzle'];

  if (dangerousConditions.includes(weather.condition)) {
    alerts.push({
      type: 'weather',
      severity: 'high',
      icon: '⛈️',
      title: 'Dangerous Weather',
      message: `${weather.condition} detected - Return to shore immediately`
    });
  } else if (cautionConditions.includes(weather.condition)) {
    alerts.push({
      type: 'weather',
      severity: 'medium',
      icon: '🌧️',
      title: 'Weather Caution',
      message: `${weather.description} - Exercise caution`
    });
  }

  // Visibility alerts
  if (weather.visibility !== null && weather.visibility < 1) {
    alerts.push({
      type: 'visibility',
      severity: 'high',
      icon: '🌫️',
      title: 'Low Visibility',
      message: `Visibility is only ${weather.visibility}km - Very dangerous`
    });
  }

  // Pressure alerts
  if (weather.pressure < 1000) {
    alerts.push({
      type: 'pressure',
      severity: 'high',
      icon: '⚠️',
      title: 'Storm Warning',
      message: `Low pressure detected (${weather.pressure} hPa) - Storm approaching`
    });
  }

  return alerts;
};

// EXPORTS
module.exports = {
  getOnlineBoatsWithWeather,
  getWeatherStats,
  getAllWeatherLogs,        
  getBoatWeatherHistory     
};