import express from 'express';
import { logActivity, getActivities } from '../controllers/activityController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import supabase from '../config/supabase.js';

const router = express.Router();

// Robust optional auth that never fails request
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.replace('Bearer ', '');
        if (!token || token === 'null' || token === 'undefined') {
            return next();
        }

        if (process.env.JWT_SECRET) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Lightweight user fetch - assuming token is valid, we trust ID. 
            // Fetching DB is safer to ensure role is up to date.
            const { data: user } = await supabase
                .from('users')
                .select('id, role, firstName, lastName, email') // tailored fetch
                .eq('id', decoded.id)
                .single();

            if (user) {
                req.user = user;
            }
        }
    } catch (error) {
        // Token invalid/expired - proceed as visitor
        console.warn('Optional auth failed:', error.message);
    }
    next();
};

router.post('/log', optionalAuth, logActivity);

// Admin routes
router.get('/admin', authenticateToken, requireAdmin, getActivities);

export default router;
