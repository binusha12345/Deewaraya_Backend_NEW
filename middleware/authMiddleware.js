// authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");


// PROTECT MIDDLEWARE - Verify JWT Token
const protect = async (req, res, next) => {
  try {
    let token = req.headers.authorization;

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token, authorization denied",
      });
    }

    // Handle Bearer prefix
    if (token.startsWith("Bearer ")) {
      token = token.split(" ")[1];
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database (fresh data)
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    // Attach full user object to request
    req.user = user;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired, please login again",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};


// DRIVER OR ADMIN MIDDLEWARE - Role Check
const driverOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === "driver" || req.user.role === "admin")) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied. Drivers or admins only.",
    });
  }
};

// EXPORT BOTH MIDDLEWARES
module.exports = { protect, driverOrAdmin };