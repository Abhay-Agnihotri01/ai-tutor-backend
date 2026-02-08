import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
    getMyGoals,
    updateMyGoals,
    logSession,
    getMyStats,
    getRecentActivity
} from '../controllers/learningController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Learning goals
router.get('/goals', getMyGoals);
router.put('/goals', updateMyGoals);

// Learning sessions
router.post('/session', logSession);

// Stats and activity
router.get('/stats', getMyStats);
router.get('/activity', getRecentActivity);

export default router;
