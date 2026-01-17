import express from 'express';
import {
  getCommunications,
  createCommunication,
  getCommunicationWithReplies,
  replyToCommunication,
  updateCommunicationStatus,
  getInstructors,
  getUnreadCount
} from '../controllers/adminCommunicationController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Test endpoint (no auth required)
router.get('/test', (req, res) => {
  res.json({
    message: 'Admin communications route is working',
    timestamp: new Date().toISOString()
  });
});

// All other routes require authentication
router.use(authenticate);
router.use(authorize('admin', 'instructor', 'student'));

// Get all communications (both root and /communications paths)
router.get('/', getCommunications);
router.get('/communications', getCommunications);

// Create new communication
router.post('/', createCommunication);
router.post('/communications', createCommunication);

// Get instructors (for admin)
router.get('/instructors', authorize('admin'), getInstructors);

// Get unread count
router.get('/unread-count', getUnreadCount);

// Get specific communication with replies (both paths)
router.get('/:id', getCommunicationWithReplies);
router.get('/communications/:id', getCommunicationWithReplies);

// Reply to communication (both paths)
router.post('/:id/reply', replyToCommunication);
router.post('/communications/:id/reply', replyToCommunication);

// Update communication status (both paths)
router.patch('/:id/status', updateCommunicationStatus);
router.patch('/communications/:id/status', updateCommunicationStatus);

export default router;