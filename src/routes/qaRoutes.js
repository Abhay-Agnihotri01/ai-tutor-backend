import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createQuestion,
  getCourseQuestions,
  createAnswer,
  markBestAnswer,
  upvoteContent
} from '../controllers/qaController.js';

const router = express.Router();

// Public routes
router.get('/course/:courseId', getCourseQuestions);

// Protected routes
router.use(authenticate);
router.post('/questions', createQuestion);
router.post('/questions/:questionId/answers', createAnswer);
router.patch('/answers/:answerId/best', markBestAnswer);
router.patch('/:type/:id/upvote', upvoteContent);

export default router;