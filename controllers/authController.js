const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const crypto = require("crypto"); 
const sendEmail = require("../utils/sendEmail");

// Token generate function
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

//Upload profile picture and cover photo
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Save file path
    user.profilePicture = `/uploads/profiles/${req.file.filename}`;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile picture updated!",
      profilePicture: user.profilePicture,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        nic: user.nic,
        address: user.address,
        role: user.role,
        profilePicture: user.profilePicture,
        coverPhoto: user.coverPhoto,
      },
    });
  } catch (error) {
    console.error("Upload profile picture error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// Upload Cover Photo
const uploadCoverPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.coverPhoto = `/uploads/covers/${req.file.filename}`;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Cover photo updated!",
      coverPhoto: user.coverPhoto,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        nic: user.nic,
        address: user.address,
        role: user.role,
        profilePicture: user.profilePicture,
        coverPhoto: user.coverPhoto,
      },
    });
  } catch (error) {
    console.error("Upload cover photo error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    //  Validate email input
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide your email address",
      });
    }

    //  Find user by email
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    //  If user not found
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "This email is not registered. Please check and try again.",
      });
    }

    // Generate random reset token (32 bytes = 64 chars)
    const resetToken = crypto.randomBytes(32).toString("hex");

    //  Hash token before saving to DB (security)
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    //  Save hashed token + expiry (15 minutes)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save();

    // Create reset URL with unhashed token
    const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    //  Create email HTML content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0;">🚢 Deewaraya</h1>
          <p style="margin: 5px 0 0;">Fishing Management System</p>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1e40af;">Password Reset Request</h2>
          
          <p>Hello <strong>${user.name}</strong>,</p>
          
          <p>We received a request to reset your password. Click the button below to reset it:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetURL}" 
               style="display: inline-block; padding: 14px 40px; background: #1e40af; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              🔒 Reset My Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Or copy and paste this link in your browser:
          </p>
          <p style="word-break: break-all; background: white; padding: 10px; border-radius: 4px; font-size: 12px; color: #1e40af;">
            ${resetURL}
          </p>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #92400e;">
              ⏰ <strong>This link will expire in 15 minutes.</strong>
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 13px;">
            If you did not request this password reset, please ignore this email. Your password will remain unchanged.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;" />
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            © 2025 Deewaraya Fishing Management System<br />
            Do not reply to this email
          </p>
        </div>
      </div>
    `;

    // Send email
    await sendEmail({
      toEmail: user.email,
      subject: "🔑 Password Reset Request - Deewaraya",
      htmlContent,
    });

    // Success response
    res.status(200).json({
      success: true,
      message: "Password reset link sent to your email. Check your inbox!",
    });

  } catch (error) {
    console.error("Forgot Password Error:", error);

    // If email fails, clear token from DB
    if (error.message === "Email could not be sent") {
      try {
        const user = await User.findOne({
          email: req.body.email?.trim().toLowerCase(),
        });
        if (user) {
          user.resetPasswordToken = null;
          user.resetPasswordExpire = null;
          await user.save();
        }
      } catch (err) {
        console.error("Token cleanup error:", err);
      }

      return res.status(500).json({
        success: false,
        message: "Email could not be sent. Please try again later.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

// RESET PASSWORD - Set new password
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    //  Validate inputs
    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide password and confirm password",
      });
    }

    // Password match check
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        field: "confirmPassword",
        message: "Passwords do not match",
      });
    }

    // Password length check
    if (password.length < 5) {
      return res.status(400).json({
        success: false,
        field: "password",
        message: "Password must be at least 5 characters",
      });
    }

    //  Hash the token from URL to compare with DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    //  Find user with matching token AND not expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }, // greater than current time
    });

    //  If no user found = token invalid or expired
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Reset link is invalid or has expired. Please request a new one.",
      });
    }

    //  Check if new password is same as old
    const isSamePassword = await bcrypt.compare(password, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be same as old password",
      });
    }

    //  Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    //  Update password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = null;    // clear token
    user.resetPasswordExpire = null;   // clear expiry
    await user.save();

    // Success response
    res.status(200).json({
      success: true,
      message: "Password reset successful! You can now login with your new password.",
    });

  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
};



// Check if name is available (real-time check)
const checkNameAvailability = async (req, res) => {
  try {
    const { name } = req.params;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        available: false,
        message: "Name must be at least 2 characters",
      });
    }

    const existingUser = await User.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existingUser) {
      return res.status(200).json({
        available: false,
        message: `"${name}" is already taken. Please choose a different name.`,
      });
    }

    return res.status(200).json({
      available: true,
      message: "Name is available!",
    });

  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// Register User
const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      nic,
      address,
      password,
      confirmPassword,
      role,
    } = req.body;

 
    // STEP 1: Check all required fields    
    if (!name || !email || !phone || !password || !confirmPassword || !role || !nic || !address) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields",
      });
    }


    // STEP 2: Clean / Format inputs
    const cleanName    = name.trim();
    const cleanEmail   = email.trim().toLowerCase();
    const cleanPhone   = phone.trim();
    const cleanNic     = nic.trim();
    const cleanAddress = address.trim();

  
    // STEP 3: Phone number validation
    // Check phone is exactly 10 digits
    if (cleanPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        field: "phone",
        message: `Phone number must be exactly 10 digits. You entered ${cleanPhone.length} digits.`,
      });
    }

    // Check phone contains only numbers
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        field: "phone",
        message: "Phone number must contain numbers only. No letters or symbols allowed.",
      });
    }


    // STEP 4: NIC validation
    // Check NIC is exactly 12 characters
    if (cleanNic.length !== 12) {
      return res.status(400).json({
        success: false,
        field: "nic",
        message: `NIC must be exactly 12 digits. You entered ${cleanNic.length} characters.`,
      });
    }

    // Check NIC contains only numbers
    if (!/^[0-9]{12}$/.test(cleanNic)) {
      return res.status(400).json({
        success: false,
        field: "nic",
        message: "NIC must contain numbers only. No letters or symbols allowed.",
      });
    }

   
    // STEP 5: Password match check
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        field: "confirmPassword",
        message: "Passwords do not match",
      });
    }

  
    // STEP 6: Check duplicate NAME
    const existingName = await User.findOne({
      name: { $regex: new RegExp(`^${cleanName}$`, "i") },
    });

    if (existingName) {
      return res.status(409).json({
        success: false,
        field: "name",
        message: `The name "${cleanName}" is already registered. Please use a different name.`,
      });
    }


    // STEP 7: Check duplicate EMAIL
    const existingEmail = await User.findOne({
      email: cleanEmail,
    });

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        field: "email",
        message: "This email is already registered. Please use a different email.",
      });
    }

  
    // STEP 8: Check duplicate PHONE
    const existingPhone = await User.findOne({
      phone: cleanPhone,
    });

    if (existingPhone) {
      return res.status(409).json({
        success: false,
        field: "phone",
        message: "This phone number is already registered. Please use a different number.",
      });
    }


    //  STEP 9: Check duplicate NIC
    const existingNic = await User.findOne({
      nic: cleanNic,
    });

    if (existingNic) {
      return res.status(409).json({
        success: false,
        field: "nic",
        message: "This NIC is already registered. Please check and try again.",
      });
    }


    //  STEP 10: Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

 
    //  STEP 11: Create user
    const user = await User.create({
      name:     cleanName,
      email:    cleanEmail,
      phone:    cleanPhone,
      nic:      cleanNic,
      address:  cleanAddress,
      password: hashedPassword,
      role,
    });


    // STEP 12: Generate token & send response
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id:      user._id,
        name:    user.name,
        email:   user.email,
        phone:   user.phone,
        nic:     user.nic,
        address: user.address,
        role:    user.role,
      },
    });

  } catch (error) {
    console.error("Register Error:", error);

    //  MongoDB duplicate key error backup
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];

      const fieldMessages = {
        name:  "This name is already registered.",
        email: "This email is already registered.",
        phone: "This phone number is already registered.",
        nic:   "This NIC is already registered.",
      };

      return res.status(409).json({
        success: false,
        field: duplicateField,
        message: fieldMessages[duplicateField] || "Duplicate entry found.",
      });
    }

    //  Mongoose validation error handler
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0], // show first error
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
};

//  Login User
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please enter email and password",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id:      user._id,
        name:    user.name,
        email:   user.email,
        phone:   user.phone,
        nic:     user.nic,
        address: user.address,
        role:    user.role,
      },
    });

  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  checkNameAvailability,
  forgotPassword,   
  resetPassword,    
  uploadProfilePicture,   
  uploadCoverPhoto,  
};