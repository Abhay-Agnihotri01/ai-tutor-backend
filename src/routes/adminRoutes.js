import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import supabase from '../config/supabase.js';
import enhancedAdminRoutes from './enhancedAdminRoutes.js';
import { getActivities } from '../controllers/activityController.js';

const router = express.Router();

// Use enhanced admin routes
router.use('/', enhancedAdminRoutes);

// Activity Monitoring
router.get('/activities', authenticateToken, requireAdmin, getActivities);

// Admin Dashboard Stats
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get total courses
    const { count: totalCourses } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true });

    // Get active instructors
    const { count: activeInstructors } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'instructor');

    // Get recent users
    const { data: recentUsers } = await supabase
      .from('users')
      .select('id, firstName, lastName, email, role, createdAt')
      .order('createdAt', { ascending: false })
      .limit(5);

    // Get recent courses
    const { data: recentCourses } = await supabase
      .from('courses')
      .select(`
        id, title, isPublished, createdAt,
        users!courses_instructorId_fkey (firstName, lastName)
      `)
      .order('createdAt', { ascending: false })
      .limit(5);

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers || 0,
        totalCourses: totalCourses || 0,
        totalRevenue: 0, // Calculate from enrollments/payments
        activeInstructors: activeInstructors || 0,
        pendingApprovals: 0
      },
      recentUsers: recentUsers || [],
      recentCourses: recentCourses?.map(course => ({
        ...course,
        instructor: course.users
      })) || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
});

// User Management
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, firstName, lastName, email, role, isActive, createdAt')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      users: users || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Update User Status
router.patch('/users/:userId/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const { error } = await supabase
      .from('users')
      .update({ isActive })
      .eq('id', userId);

    if (error) throw error;

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
});

// Create New Admin
router.post('/create-admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    const { data, error } = await supabase
      .from('users')
      .insert({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: 'admin',
        isActive: true
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Admin created successfully',
      user: {
        id: data.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create admin',
      error: error.message
    });
  }
});

// Update User Role
router.patch('/users/:userId/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', userId);

    if (error) throw error;

    res.json({
      success: true,
      message: `User role updated to ${role} successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message
    });
  }
});

// Delete User
router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// Course Management
router.get('/courses', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        id, title, description, price, thumbnail, isPublished, createdAt,
        users!courses_instructorId_fkey (firstName, lastName),
        enrollments (count)
      `)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      courses: courses?.map(course => ({
        ...course,
        instructor: course.users,
        enrollments: course.enrollments?.length || 0
      })) || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses',
      error: error.message
    });
  }
});

// Update Course Status
router.patch('/courses/:courseId/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { isPublished } = req.body;

    const { error } = await supabase
      .from('courses')
      .update({ isPublished })
      .eq('id', courseId);

    if (error) throw error;

    res.json({
      success: true,
      message: `Course ${isPublished ? 'published' : 'unpublished'} successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update course status',
      error: error.message
    });
  }
});

// Delete Course
router.delete('/courses/:courseId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { courseId } = req.params;

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete course',
      error: error.message
    });
  }
});

// Analytics
router.get('/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { range = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    const daysAgo = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
    const startDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));

    // Get overview stats
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('createdAt', startDate.toISOString());

    const { count: totalCourses } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .gte('createdAt', startDate.toISOString());

    const { count: totalEnrollments } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .gte('enrolledAt', startDate.toISOString());

    // Get top courses
    const { data: topCourses } = await supabase
      .from('courses')
      .select(`
        id, title,
        enrollments (count)
      `)
      .limit(5);

    // Get top instructors
    const { data: topInstructors } = await supabase
      .from('users')
      .select(`
        id, firstName, lastName,
        courses (
          id,
          enrollments (count)
        )
      `)
      .eq('role', 'instructor')
      .limit(5);

    // Get recent activity
    const { data: activities } = await supabase
      .from('activity_logs')
      .select('action, details, created_at, role')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      success: true,
      overview: {
        totalRevenue: 0,
        totalUsers: totalUsers || 0,
        totalCourses: totalCourses || 0,
        totalEnrollments: totalEnrollments || 0
      },
      growth: {
        userGrowth: 0,
        courseGrowth: 0,
        revenueGrowth: 0
      },
      topCourses: topCourses?.map(course => ({
        ...course,
        enrollments: course.enrollments[0]?.count || 0,
        revenue: 0
      })) || [],
      topInstructors: topInstructors?.map(instructor => ({
        ...instructor,
        courses: instructor.courses?.length || 0,
        students: instructor.courses?.reduce((sum, course) =>
          sum + (course.enrollments[0]?.count || 0), 0) || 0
      })) || [],
      recentActivity: activities?.map(activity => ({
        type: activity.role === 'admin' ? 'user' : 'course', // Simple mapping for icon color
        description: activity.action,
        timestamp: new Date(activity.created_at).toLocaleDateString() + ' ' + new Date(activity.created_at).toLocaleTimeString()
      })) || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

// Settings
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Return default settings for now
    res.json({
      success: true,
      settings: {
        general: {
          siteName: 'LearnHub',
          siteDescription: 'A modern learning management system',
          contactEmail: 'admin@learnhub.com',
          supportEmail: 'support@learnhub.com'
        },
        platform: {
          allowRegistration: true,
          requireEmailVerification: true,
          defaultUserRole: 'student',
          maxFileUploadSize: 10
        },
        payment: {
          currency: 'USD',
          commissionRate: 10,
          minimumPayout: 50,
          paymentMethods: ['stripe', 'paypal']
        },
        notifications: {
          emailNotifications: true,
          courseApprovalNotifications: true,
          newUserNotifications: true,
          systemMaintenanceNotifications: true
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message
    });
  }
});

// Update Settings
router.put('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { settings } = req.body;

    // In a real app, you'd save these to a settings table
    // For now, just return success

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
});

export default router;