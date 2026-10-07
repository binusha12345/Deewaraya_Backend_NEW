const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create upload folders if not exist
const uploadRoot = path.join(__dirname, "..", "uploads");
const profileDir = path.join(uploadRoot, "profiles");
const coverDir = path.join(uploadRoot, "covers");

if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });
if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Different folders for profile vs cover
    if (file.fieldname === "profilePicture") {
      cb(null, profileDir);
    } else if (file.fieldname === "coverPhoto") {
      cb(null, coverDir);
    } else {
      cb(new Error("Unsupported image upload field."));
    }
  },
  filename: (req, file, cb) => {
    // Unique filename: userId-timestamp-originalname
    const uniqueName = `${req.user?.id || "user"}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter - only images
const fileFilter = (req, file, cb) => {
  const allowedExtensions = new Set([".jpeg", ".jpg", ".png", ".gif", ".webp"]);
  const extname = allowedExtensions.has(path.extname(file.originalname).toLowerCase());
  const mimetype = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
};

// Upload middleware
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
});

module.exports = upload;