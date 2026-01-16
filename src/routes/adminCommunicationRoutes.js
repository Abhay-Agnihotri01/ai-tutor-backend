import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getCommunications,
  createCommunication,
  getCommunication,
  createReply,
  updateStatus,
  getInstructors
} from '../controllers/adminCommunicationController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get communications for current user
router.get('/', getCommunications);

// Create new communication
router.post('/', createCommunication);

// Get instructors list (for admin)
router.get('/instructors', getInstructors);

// Get specific communication with replies
router.get('/:id', getCommunication);

// Create reply to communication
router.post('/:communicationId/replies', createReply);

// Update communication status
router.patch('/:id/status', updateStatus);

export default router;