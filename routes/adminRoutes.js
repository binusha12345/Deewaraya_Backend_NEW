const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');

// CONTROLLERS
const { adminLogin, verifyAdmin } = require('../controllers/adminController');

const {
  getAllUsers,
  getUserById,
  verifyUser,
  banUser,
  unbanUser,
  deleteUser,
  sendMessageToUser,
  getUserStats
} = require('../controllers/adminUserController');

const {
  getAllBoats,
  getBoatById,
  approveBoat,
  suspendBoat,
  deleteBoat,
} = require('../controllers/adminBoatController');

// ONE import only - combined all weather functions
const {
  getOnlineBoatsWithWeather,
  getWeatherStats,
  getAllWeatherLogs,
  getBoatWeatherHistory
} = require('../controllers/adminWeatherController');

// PUBLIC ROUTES
router.post('/login', adminLogin);

// PROTECTED ROUTES - Admin verification
router.get('/verify', adminAuth, verifyAdmin);

// USER MANAGEMENT ROUTES
router.get('/users', adminAuth, getAllUsers);
router.get('/users/stats', adminAuth, getUserStats);
router.get('/users/:id', adminAuth, getUserById);
router.put('/users/:id/verify', adminAuth, verifyUser);
router.put('/users/:id/ban', adminAuth, banUser);
router.put('/users/:id/unban', adminAuth, unbanUser);
router.delete('/users/:id', adminAuth, deleteUser);
router.post('/users/:id/message', adminAuth, sendMessageToUser);

// BOAT MANAGEMENT ROUTES
router.get('/boats', adminAuth, getAllBoats);
router.get('/boats/:id', adminAuth, getBoatById);
router.put('/boats/:id/approve', adminAuth, approveBoat);
router.put('/boats/:id/suspend', adminAuth, suspendBoat);
router.delete('/boats/:id', adminAuth, deleteBoat);


// WEATHER MANAGEMENT ROUTES (Admin only)
router.get('/weather/online-boats', adminAuth, getOnlineBoatsWithWeather);
router.get('/weather/stats', adminAuth, getWeatherStats);
router.get('/weather/logs', adminAuth, getAllWeatherLogs);
router.get('/weather/logs/boat/:boatId', adminAuth, getBoatWeatherHistory);

module.exports = router;