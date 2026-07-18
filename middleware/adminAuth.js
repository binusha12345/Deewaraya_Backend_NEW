const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // 🔍 DEBUG
    console.log('\n========== ADMIN AUTH DEBUG ==========');
    console.log('📥 Auth Header:', authHeader ? 'EXISTS' : 'MISSING');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ FAIL: No token or wrong format');
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }

    const token = authHeader.split(' ')[1];
    console.log('🔑 Token (first 30 chars):', token.substring(0, 30) + '...');

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token valid! Decoded:', decoded);

      if (decoded.role !== 'admin') {
        console.log('❌ FAIL: Not admin role. Got:', decoded.role);
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. Admin only.' 
        });
      }

      if (decoded.email !== process.env.ADMIN_EMAIL) {
        console.log('❌ FAIL: Email mismatch');
        console.log('   Token email:', decoded.email);
        console.log('   ENV email:  ', process.env.ADMIN_EMAIL);
        return res.status(403).json({ 
          success: false, 
          message: 'Invalid admin' 
        });
      }

      console.log('✅ SUCCESS: Auth passed!');
      console.log('=====================================\n');
      
      req.admin = decoded;
      next();
    } catch (jwtError) {
      console.log('❌ FAIL: JWT verification failed');
      console.log('   Error:', jwtError.message);
      console.log('=====================================\n');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
  } catch (error) {
    console.error('❌ Auth error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

module.exports = adminAuth;