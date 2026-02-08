import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
    getMyPreferences,
    updateMyPreferences
} from '../controllers/preferencesController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get current user's notification preferences
router.get('/', getMyPreferences);

// Update notification preferences
router.put('/', updateMyPreferences);

export default router;
