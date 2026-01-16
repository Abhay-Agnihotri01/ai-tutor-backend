import express from 'express';
import { body } from 'express-validator';
import { register, login, getProfile, updateProfile, googleCallback, completeGoogleSignup } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { uploadAvatar } from '../middleware/upload.js';
import passport from '../config/passport.js';

const router = express.Router();

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().isLength({ min: 1 }),
  body('lastName').trim().isLength({ min: 1 })
], register);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], login);

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, uploadAvatar.single('avatar'), updateProfile);

router.get('/google', (req, res, next) => {
  console.log('Google OAuth initiated - Query params:', req.query);
  console.log('Session before:', req.session);
  
  // Store admin role in session if specified
  if (req.query.role === 'admin') {
    console.log('Setting admin login flag in session');
    req.session.adminLogin = true;
  }
  
  console.log('Session after:', req.session);
  
  // Force account selection for admin login
  const authOptions = {
    scope: ['profile', 'email']
  };
  
  if (req.query.role === 'admin') {
    authOptions.prompt = 'select_account';
  }
  
  passport.authenticate('google', authOptions)(req, res, next);
});
router.get('/google/callback', passport.authenticate('google', { session: false }), googleCallback);
router.post('/google/complete', completeGoogleSignup);

export default router;