import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getCourseDiscussions,
  createDiscussion,
  getDiscussion,
  createReply,
  markResolved
} from '../controllers/discussionController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get discussions for a course
router.get('/course/:courseId', getCourseDiscussions);

// Create new discussion
router.post('/', createDiscussion);

// Get specific discussion with replies
router.get('/:id', getDiscussion);

// Create reply to discussion
router.post('/:discussionId/replies', createReply);

// Mark discussion as resolved
router.patch('/:id/resolve', markResolved);

export default router;