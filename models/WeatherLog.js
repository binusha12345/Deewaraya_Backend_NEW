const mongoose = require("mongoose");

const weatherLogSchema = new mongoose.Schema(
  {
    boat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Boat",
      required: true,
    },
    boatName: { type: String, required: true },
    registrationNumber: { type: String, required: true },
    
    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    checkedByName: { type: String },
    checkedByRole: { type: String }, // owner or driver

    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      placeName: { type: String, default: "" },
    },

    weather: {
      // --- Existing fields (unchanged) ---
      temperature: Number,
      humidity: Number,
      windSpeedKts: Number,
      visibilityKm: Number,
      description: String,
      estimatedWaveHeight: Number,

      // --- New fields ---
      windSpeedKmh: Number,
      windDeg: Number,
      windDirection: String, // e.g. "NE"
      weatherMain: String, // e.g. "Rain"
      weatherCondition: String, // simplified: Sunny/Rainy/Cloudy/Foggy
      icon: String,
      sunrise: String, // formatted local time e.g. "06:12 AM"
      sunset: String,
      rainLastHourMm: Number,
      rainLast3HoursMm: Number,
      precipitationProbability: Number, // %

      hourlyForecast: [
        {
          time: String,
          temp: Number,
          pop: Number, // % chance of rain
          rainMm: Number,
        },
      ],

      dailyForecast: [
        {
          date: String,
          maxTemp: Number,
          minTemp: Number,
          rainProbability: Number, // %
        },
      ],
    },

    alerts: [
      {
        title: String,
        message: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("WeatherLog", weatherLogSchema);