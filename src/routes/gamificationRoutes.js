import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
    getMyStats,
    getAllBadges,
    getMyBadges,
    getLeaderboard,
    initializeBadges
} from '../controllers/gamificationController.js';

const router = express.Router();

// Public routes
router.get('/badges', getAllBadges);
router.get('/leaderboard', getLeaderboard);

// Protected routes
router.get('/stats', authenticate, getMyStats);
router.get('/my-badges', authenticate, getMyBadges);

// Admin route to initialize badges (call once)
router.post('/init-badges', authenticate, initializeBadges);

export default router;
