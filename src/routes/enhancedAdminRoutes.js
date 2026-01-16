import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { trackActivity } from '../middleware/activityTracker.js';
import {
  getEnhancedDashboard,
  joinLiveClassAsAdmin,
  getAllLiveClasses,
  getUserBehaviorAnalytics,
  getContentModerationDashboard,
  getSystemMetrics
} from '../controllers/enhancedAdminController.js';
import { getActivities } from '../controllers/activityController.js';

const router = express.Router();

// Enhanced Dashboard
router.get('/dashboard/enhanced',
  authenticateToken,
  requireAdmin,
  trackActivity('view_admin_dashboard', 'dashboard'),
  getEnhancedDashboard
);

// Real-time Activity Monitoring
router.get('/activities',
  authenticateToken,
  requireAdmin,
  trackActivity('view_activities', 'activity_log'),
  getActivities
);

// Live Class Monitoring
router.get('/live-classes',
  authenticateToken,
  requireAdmin,
  trackActivity('view_live_classes', 'live_class'),
  getAllLiveClasses
);

router.post('/live-classes/:meetingId/join',
  authenticateToken,
  requireAdmin,
  trackActivity('join_live_class_admin', 'live_class'),
  joinLiveClassAsAdmin
);

// User Behavior Analytics
router.get('/analytics/behavior',
  authenticateToken,
  requireAdmin,
  trackActivity('view_behavior_analytics', 'analytics'),
  getUserBehaviorAnalytics
);

// Content Moderation
router.get('/moderation',
  authenticateToken,
  requireAdmin,
  trackActivity('view_moderation_dashboard', 'moderation'),
  getContentModerationDashboard
);

// System Health & Performance
router.get('/system/metrics',
  authenticateToken,
  requireAdmin,
  trackActivity('view_system_metrics', 'system'),
  getSystemMetrics
);

// Advanced User Management
router.get('/users/detailed', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select(`
        id, firstName, lastName, email, role, isActive, createdAt,
        courses(count),
        enrollments(count),
        ratings(count)
      `)
      .range(offset, offset + limit - 1)
      .order('createdAt', { ascending: false });

    if (role) query = query.eq('role', role);
    if (status) query = query.eq('isActive', status === 'active');
    if (search) {
      query = query.or(`firstName.ilike.%${search}%,lastName.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      users: users?.map(user => ({
        ...user,
        coursesCount: user.courses?.length || 0,
        enrollmentsCount: user.enrollments?.length || 0,
        ratingsCount: user.ratings?.length || 0
      })) || [],
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// Bulk User Actions
router.post('/users/bulk-action', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userIds, action } = req.body;

    let updateData = {};
    switch (action) {
      case 'activate':
        updateData = { isActive: true };
        break;
      case 'deactivate':
        updateData = { isActive: false };
        break;
      case 'promote_instructor':
        updateData = { role: 'instructor' };
        break;
      case 'demote_student':
        updateData = { role: 'student' };
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .in('id', userIds);

    if (error) throw error;

    res.json({
      success: true,
      message: `Successfully ${action.replace('_', ' ')}d ${userIds.length} users`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Bulk action failed' });
  }
});

// Course Analytics & Management
router.get('/courses/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        id, title, category, price, isPublished, createdAt,
        users!courses_instructorId_fkey(firstName, lastName),
        enrollments(count, pricePaid),
        ratings(rating, comment),
        chapters(count)
      `)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    const analytics = courses?.map(course => {
      const enrollments = course.enrollments || [];
      const ratings = course.ratings || [];

      return {
        ...course,
        instructor: course.users,
        enrollmentCount: enrollments.length,
        revenue: enrollments.reduce((sum, e) => sum + (e.pricePaid || 0), 0),
        avgRating: ratings.length > 0
          ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
          : 0,
        chaptersCount: course.chapters?.length || 0,
        conversionRate: Math.random() * 0.1 + 0.05 // Mock data
      };
    }) || [];

    res.json({ success: true, courses: analytics });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch course analytics' });
  }
});

// Revenue Analytics
router.get('/analytics/revenue', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select('pricePaid, enrolledAt, courses(title, category)')
      .gte('enrolledAt', startDate.toISOString());

    if (error) throw error;

    const revenueByDay = {};
    const revenueByCategory = {};
    let totalRevenue = 0;

    enrollments?.forEach(enrollment => {
      const day = enrollment.enrolledAt.split('T')[0];
      const category = enrollment.courses?.category || 'Other';
      const amount = enrollment.pricePaid || 0;

      revenueByDay[day] = (revenueByDay[day] || 0) + amount;
      revenueByCategory[category] = (revenueByCategory[category] || 0) + amount;
      totalRevenue += amount;
    });

    res.json({
      success: true,
      analytics: {
        totalRevenue,
        revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue })),
        revenueByCategory: Object.entries(revenueByCategory).map(([category, revenue]) => ({ category, revenue })),
        enrollmentCount: enrollments?.length || 0,
        averageOrderValue: enrollments?.length > 0 ? totalRevenue / enrollments.length : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch revenue analytics' });
  }
});

export default router;
// Admin Live Class Token Generation
router.post('/live-classes/token/:meetingId',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const { generateAdminToken } = await import('../controllers/adminLiveClassController.js');
    return generateAdminToken(req, res);
  }
);