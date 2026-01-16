import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getProgressDashboard,
  getMultiCourseProgress,
  updateLectureProgress,
  updateAssignmentProgress,
  getActivityTimeline,
  getLeaderboard,
  refreshProgressSummary
} from '../controllers/progressController.js';

const router = express.Router();

// Get comprehensive progress dashboard for a specific course
router.get('/dashboard/:courseId', authenticateToken, getProgressDashboard);

// Get progress summary for all enrolled courses
router.get('/courses', authenticateToken, getMultiCourseProgress);

// Update lecture progress (called when student watches a lecture)
router.post('/lecture/:courseId/:lectureId', authenticateToken, updateLectureProgress);

// Update assignment progress (called when assignment is submitted/graded)
router.post('/assignment/:courseId/:assignmentId', authenticateToken, updateAssignmentProgress);

// Get activity timeline for a course
router.get('/timeline/:courseId', authenticateToken, getActivityTimeline);

// Get course leaderboard (optional feature)
router.get('/leaderboard/:courseId', authenticateToken, getLeaderboard);

// Refresh materialized view (admin only)
router.post('/refresh', authenticateToken, refreshProgressSummary);

export default router;