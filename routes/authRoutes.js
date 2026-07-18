const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  checkNameAvailability,
  forgotPassword,     
  resetPassword, 
  uploadProfilePicture,   
  uploadCoverPhoto, 
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");   
const upload = require("../middleware/upload");                 

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/check-name/:name", checkNameAvailability); 

// Forgot Password Routes
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);


//  NEW - Upload routes (require authentication)
router.post(
  "/upload-profile-picture",
  protect,
  upload.single("profilePicture"),
  uploadProfilePicture
);

router.post(
  "/upload-cover-photo",
  protect,
  upload.single("coverPhoto"),
  uploadCoverPhoto
);

module.exports = router;