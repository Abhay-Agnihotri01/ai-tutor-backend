import jwt from 'jsonwebtoken';
import supabase from '../config/supabase.js';

export const authenticate = async (req, res, next) => {
  const authTimeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        message: 'Authentication timeout'
      });
    }
  }, 30000);
  
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'Access denied. Invalid token format.'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Server configuration error.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();
    
    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }
    
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account inactive.' });
    }

    req.user = user;
    clearTimeout(authTimeout);
    next();
  } catch (error) {
    clearTimeout(authTimeout);
    if (!res.headersSent) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token format.' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired.' });
      }
      res.status(401).json({ message: 'Authentication failed.' });
    }
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.' 
      });
    }
    next();
  };
};

// Alias for authenticate
export const authenticateToken = authenticate;

// Admin-specific middleware
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
};