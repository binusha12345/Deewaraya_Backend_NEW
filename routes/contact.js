const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Contact Form Schema (Optional - with Mongoose)
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  vesselId: { type: String, trim: true },
  category: { type: String, required: true },
  message: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['new', 'in-progress', 'resolved', 'closed'],
    default: 'new'
  },
  createdAt: { type: Date, default: Date.now }
});

const Contact = mongoose.model('Contact', contactSchema);

// POST /api/contact
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, vesselId, category, message } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !category || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields.'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    // Save to database
    const newContact = new Contact({
      firstName,
      lastName,
      email,
      phone: phone || '',
      vesselId: vesselId || '',
      category,
      message
    });

    await newContact.save();

    // Send notification email (optional)
    // Uncomment and configure if you want email notifications
    /*
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Email to admin
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'support@marinetrack.com',
      subject: `🚢 New Support Request: ${category} - ${firstName} ${lastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #0077b6;">New Fleet Support Request</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${firstName} ${lastName}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${email}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Phone:</td><td style="padding: 8px;">${phone || 'N/A'}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Vessel ID:</td><td style="padding: 8px;">${vesselId || 'N/A'}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Category:</td><td style="padding: 8px;">${category}</td></tr>
          </table>
          <h3 style="color: #0077b6; margin-top: 20px;">Message:</h3>
          <p style="background: #f0f8ff; padding: 15px; border-radius: 8px;">${message}</p>
        </div>
      `
    });

    // Auto-reply to user
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: '🚢 We received your message - MarineTrack Support',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #0077b6;">Thank You, Captain ${firstName}! ⚓</h2>
          <p>We have received your support request and our marine crew will get back to you within <strong>24 hours</strong>.</p>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Your Message:</strong></p>
          <p style="background: #f0f8ff; padding: 15px; border-radius: 8px;">${message}</p>
          <hr style="margin: 20px 0;">
          <p style="color: #888; font-size: 12px;">
            MarineTrack Fleet Management & Tracking System<br>
            Dock 42, Marina Bay | support@marinetrack.com
          </p>
        </div>
      `
    });
    */

    res.status(201).json({
      success: true,
      message: 'Your message has been sent successfully! We will respond within 24 hours.',
      data: newContact
    });

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again or contact us directly.'
    });
  }
});

// GET /api/contact (Admin - Get all messages)
router.get('/', async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: messages.length, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/contact/:id/status (Admin - Update status)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;