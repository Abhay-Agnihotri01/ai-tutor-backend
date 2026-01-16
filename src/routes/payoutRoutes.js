import express from 'express';
import { authenticateToken, requireAdmin, authorize } from '../middleware/auth.js';
import {
  getInstructorEarnings,
  getAllInstructorEarnings,
  processInstructorPayout
} from '../controllers/payoutController.js';

const router = express.Router();

// Instructor routes
router.get('/earnings', authenticateToken, authorize('instructor'), getInstructorEarnings);

// Admin routes
router.get('/admin/earnings', authenticateToken, requireAdmin, getAllInstructorEarnings);
router.post('/admin/process-payout', authenticateToken, requireAdmin, processInstructorPayout);

export default router;