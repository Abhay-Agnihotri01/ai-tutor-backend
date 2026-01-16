import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createOrUpdateRating,
  getCourseRatings,
  getUserRating,
  deleteRating,
  getInstructorCourseReviews
} from '../controllers/ratingController.js';

const router = express.Router();

// Create or update rating (requires authentication)
router.post('/', authenticate, createOrUpdateRating);

// Get course ratings (public)
router.get('/course/:courseId', getCourseRatings);

// Get user's rating for a course (requires authentication)
router.get('/course/:courseId/user', authenticate, getUserRating);

// Delete rating (requires authentication)
router.delete('/course/:courseId', authenticate, deleteRating);

// Get course reviews for instructor (requires authentication)
router.get('/instructor/course/:courseId/reviews', authenticate, getInstructorCourseReviews);

export default router;