// server/routes/emergencyRoutes.js
router.get('/emergencies/count', adminAuth, async (req, res) => {
  const count = await Emergency.countDocuments({ status: 'active' });
  res.json({ count });
});

router.post('/emergency', authMiddleware, async (req, res) => {
  const emergency = await Emergency.create({
    boatId: req.body.boatId,
    location: req.body.location,
    type: req.body.type, // sinking, engine_failure, medical, etc.
    status: 'active'
  });
  
  // Notify admin
  notifyAdmin(emergency);
  
  res.json({ success: true, emergency });
});