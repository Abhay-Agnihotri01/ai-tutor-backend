import express from 'express';
import supabase from '../config/supabase.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Update user role to admin by email
router.post('/make-admin', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ role: 'admin' })
      .eq('email', email)
      .select()
      .single();

    if (error) throw error;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User role updated to admin successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Make admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message
    });
  }
});

// Quick fix endpoint for the specific user
router.get('/fix-admin-user', async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .update({ role: 'admin' })
      .eq('email', 'phonedocuments786@gmail.com')
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'User phonedocuments786@gmail.com updated to admin successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Fix admin user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message
    });
  }
});

export default router;