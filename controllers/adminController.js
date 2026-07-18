const jwt = require('jsonwebtoken');

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

        // 🔍 DEBUG LOGS - Check backend terminal
    console.log('\n========== ADMIN LOGIN DEBUG ==========');
    console.log('📥 Received email:', JSON.stringify(email));
    console.log('📥 Received password:', JSON.stringify(password));
    console.log('🔐 ENV ADMIN_EMAIL:', JSON.stringify(process.env.ADMIN_EMAIL));
    console.log('🔐 ENV ADMIN_PASSWORD:', JSON.stringify(process.env.ADMIN_PASSWORD));
    console.log('✅ Email match:', email === process.env.ADMIN_EMAIL);
    console.log('✅ Password match:', password === process.env.ADMIN_PASSWORD);
    console.log('=======================================\n');

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign(
        { email: process.env.ADMIN_EMAIL, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.status(200).json({
        success: true,
        message: 'Admin login successful',
        token,
        user: {
          email: process.env.ADMIN_EMAIL,
          role: 'admin'
        }
      });
    } else {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid admin credentials' 
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const verifyAdmin = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Admin verified',
      admin: req.admin
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { adminLogin, verifyAdmin };