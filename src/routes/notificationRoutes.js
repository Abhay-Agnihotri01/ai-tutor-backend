import express from 'express';
import {
  sendCourseMessage,
  getNotificationHistory,
  getCourseStudents,
  triggerCourseUpdate,
  getNotificationAnalytics,
  getMyNotifications,
  markRead,
  markAllRead
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Send custom message to course students
router.post('/send-message', authenticate, sendCourseMessage);

// Get notification history (for instructors)
router.get('/history', authenticate, getNotificationHistory);

// Get current user's notifications (for all users)
router.get('/my-notifications', authenticate, getMyNotifications);

// Mark notification as read
router.put('/:id/read', authenticate, markRead);

// Mark all notifications as read
router.put('/mark-all-read', authenticate, markAllRead);

// Get course students
router.get('/students/:courseId', authenticate, getCourseStudents);

// Trigger course update notification
router.post('/course-update', authenticate, triggerCourseUpdate);

// Get notification analytics
router.get('/analytics', authenticate, getNotificationAnalytics);

export default router;