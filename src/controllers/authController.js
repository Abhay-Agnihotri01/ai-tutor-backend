import jwt from 'jsonwebtoken';
import supabase from '../config/supabase.js';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

export const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, role = 'student' } = req.body;

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role
      })
      .select()
      .single();
    
    if (error) throw error;

    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    const token = generateToken(user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, email, firstName, lastName, role, avatar, bio, location, isEmailVerified, isActive, createdAt, updatedAt')
      .eq('id', req.user.id)
      .single();
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, bio, location } = req.body;
    const userId = req.user.id;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData = {
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      email: email || user.email,
      bio: bio || user.bio || null,
      location: location || user.location || null,
      updatedAt: new Date().toISOString()
    };

    // If file was uploaded, add avatar path
    if (req.file) {
      updateData.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, email, firstName, lastName, role, avatar, bio, location, isEmailVerified, isActive, createdAt, updatedAt')
      .single();
    
    if (error) throw error;



    res.json({
      success: true,
      user: updatedUser,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const googleCallback = async (req, res) => {
  try {
    console.log('Google OAuth Callback - Session:', req.session);
    console.log('Google OAuth Callback - User:', req.user);
    
    const isAdminLogin = req.session?.adminLogin;
    console.log('Is Admin Login:', isAdminLogin);
    
    if (req.user.isNewUser) {
      console.log('New user detected');
      if (isAdminLogin) {
        console.log('Admin login attempted with new user - redirecting with error');
        res.redirect(`${process.env.CLIENT_URL}/admin/login?error=admin_not_found`);
        return;
      }
      // Store user data in session and redirect to role selection
      const userData = encodeURIComponent(JSON.stringify({
        googleId: req.user.googleId,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        avatar: req.user.avatar
      }));
      res.redirect(`${process.env.CLIENT_URL}/auth/role-selection?data=${userData}`);
    } else {
      console.log('Existing user found:', req.user.email, 'Role:', req.user.role);
      
      // Check if user has admin role for admin login
      if (isAdminLogin && req.user.role !== 'admin') {
        console.log('Non-admin user attempted admin login - redirecting with error');
        res.redirect(`${process.env.CLIENT_URL}/admin/login?error=access_denied`);
        return;
      }
      
      const token = generateToken(req.user.id);
      console.log('Generated token for user:', req.user.id);
      
      if (isAdminLogin) {
        console.log('Redirecting to admin success');
        res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${token}&admin=true`);
      } else {
        console.log('Redirecting to regular success');
        res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${token}`);
      }
    }
    
    // Clear admin login flag
    if (req.session) {
      delete req.session.adminLogin;
    }
  } catch (error) {
    console.error('Google OAuth Callback Error:', error);
    const redirectUrl = req.session?.adminLogin ? '/admin/login' : '/login';
    res.redirect(`${process.env.CLIENT_URL}${redirectUrl}?error=auth_failed`);
  }
};

export const completeGoogleSignup = async (req, res) => {
  try {
    const { googleId, email, firstName, lastName, avatar, role } = req.body;
    
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('googleId', googleId)
      .single();
    
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        googleId,
        email,
        firstName,
        lastName,
        avatar,
        role,
        isEmailVerified: true
      })
      .select()
      .single();
    
    if (error) throw error;
    
    const token = generateToken(user.id);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};