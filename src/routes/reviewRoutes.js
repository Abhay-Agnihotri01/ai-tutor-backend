import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createOrUpdateReview,
  getCourseReviews,
  deleteReview
} from '../controllers/reviewController.js';

const router = express.Router();

// Public routes
router.get('/course/:courseId', getCourseReviews);

// Protected routes
router.use(authenticate);
router.post('/course/:courseId', createOrUpdateReview);
router.delete('/:reviewId', deleteReview);

export default router;