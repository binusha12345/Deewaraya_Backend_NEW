const User = require('../models/User');
const Boat = require('../models/Boat');
const nodemailer = require('nodemailer');

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    // Get boat count for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const boatCount = await Boat.countDocuments({ owner: user._id });
        return {
          ...user.toObject(),
          stats: {
            boats: boatCount,
            trips: 0,
            catches: 0,
            revenue: 0
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      count: usersWithStats.length,
      users: usersWithStats
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

// Get single user details
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const boats = await Boat.find({ owner: user._id });

    res.status(200).json({
      success: true,
      user: {
        ...user.toObject(),
        boats,
        stats: {
          boats: boats.length,
          trips: 0,
          catches: 0,
          revenue: 0
        }
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

// Verify user
const verifyUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { verified: true, status: 'active' },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'User verified successfully',
      user
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify user' });
  }
};

// Ban user
const banUser = async (req, res) => {
  try {
    const { reason } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'banned',
        banReason: reason || 'No reason provided',
        bannedAt: new Date()
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'User banned successfully',
      user
    });
  } catch (error) {
    console.error('Ban error:', error);
    res.status(500).json({ success: false, message: 'Failed to ban user' });
  }
};

// Unban user
const unbanUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'active',
        banReason: null,
        bannedAt: null
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'User unbanned successfully',
      user
    });
  } catch (error) {
    console.error('Unban error:', error);
    res.status(500).json({ success: false, message: 'Failed to unban user' });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Also delete user's boats
    await Boat.deleteMany({ owner: req.params.id });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

// Send message to user
const sendMessageToUser = async (req, res) => {
  try {
    const { message, subject } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Setup email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: subject || 'Message from Deewaraya Admin',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
          <div style="background: linear-gradient(135deg, #0ea5e9, #2563eb); padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🚤 Deewaraya</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px;">
            <h2>Hello ${user.name},</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #374151;">${message}</p>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">Best regards,<br>Deewaraya Admin Team</p>
          </div>
        </div>
      `
    });

    res.status(200).json({
      success: true,
      message: 'Email sent successfully'
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

// Get user statistics
const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const bannedUsers = await User.countDocuments({ status: 'banned' });
    const pendingUsers = await User.countDocuments({ verified: false });
    const boatOwners = await User.countDocuments({ role: 'boat_owner' });
    const buyers = await User.countDocuments({ role: 'buyer' });

    res.status(200).json({
      success: true,
      stats: {
        total: totalUsers,
        active: activeUsers,
        banned: bannedUsers,
        pending: pendingUsers,
        boatOwners,
        buyers
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  verifyUser,
  banUser,
  unbanUser,
  deleteUser,
  sendMessageToUser,
  getUserStats
};