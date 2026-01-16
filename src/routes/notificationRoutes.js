import express from 'express';
import {
  sendCourseMessage,
  getNotificationHistory,
  getCourseStudents,
  triggerCourseUpdate,
  getNotificationAnalytics
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Send custom message to course students
router.post('/send-message', authenticate, sendCourseMessage);

// Get notification history
router.get('/history', authenticate, getNotificationHistory);

// Get course students
router.get('/students/:courseId', authenticate, getCourseStudents);

// Trigger course update notification
router.post('/course-update', authenticate, triggerCourseUpdate);

// Get notification analytics
router.get('/analytics', authenticate, getNotificationAnalytics);

export default router;