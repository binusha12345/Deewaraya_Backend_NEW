const Boat = require('../models/Boat');

//Get all boats
const getAllBoats = async (req, res) => {
  try {
    const boats = await Boat.find()
      .populate('owner', 'name email phone nic')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: boats.length,
      boats
    });
  } catch (error) {
    console.error('Get boats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch boats',
      error: error.message 
    });
  }
};

// Get single boat
const getBoatById = async (req, res) => {
  try {
    const boat = await Boat.findById(req.params.id)
      .populate('owner', 'name email phone nic address');
    
    if (!boat) {
      return res.status(404).json({ success: false, message: 'Boat not found' });
    }

    res.status(200).json({ success: true, boat });
  } catch (error) {
    console.error('Get boat error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch boat' });
  }
};

// Approve boat
const approveBoat = async (req, res) => {
  try {
    const boat = await Boat.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'active',
        suspendReason: null,
        suspendedAt: null
      },
      { new: true }
    );
    
    if (!boat) {
      return res.status(404).json({ success: false, message: 'Boat not found' });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Boat approved successfully', 
      boat 
    });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ success: false, message: 'Approval failed' });
  }
};

// Suspend boat
const suspendBoat = async (req, res) => {
  try {
    const { reason } = req.body;
    
    const boat = await Boat.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'suspended', 
        suspendReason: reason || 'No reason provided',
        suspendedAt: new Date()
      },
      { new: true }
    );
    
    if (!boat) {
      return res.status(404).json({ success: false, message: 'Boat not found' });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Boat suspended successfully', 
      boat 
    });
  } catch (error) {
    console.error('Suspend error:', error);
    res.status(500).json({ success: false, message: 'Suspension failed' });
  }
};

// Delete boat
const deleteBoat = async (req, res) => {
  try {
    const boat = await Boat.findByIdAndDelete(req.params.id);
    
    if (!boat) {
      return res.status(404).json({ success: false, message: 'Boat not found' });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Boat deleted successfully' 
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, message: 'Deletion failed' });
  }
};

// Update boat status (active, inactive, maintenance, suspended)
const updateBoatStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const validStatuses = ['active', 'inactive', 'suspended', 'maintenance', 'pending'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status. Must be: active, inactive, suspended, maintenance, or pending' 
      });
    }
    
    const boat = await Boat.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!boat) {
      return res.status(404).json({ success: false, message: 'Boat not found' });
    }
    
    res.status(200).json({ 
      success: true, 
      message: `Boat status updated to ${status}`, 
      boat 
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, message: 'Status update failed' });
  }
};

// CRITICAL: Export all functions
module.exports = {
  getAllBoats,
  getBoatById,
  approveBoat,
  suspendBoat,
  deleteBoat
};