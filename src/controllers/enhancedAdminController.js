import supabase from '../config/supabase.js';
import ActivityLog from '../models/ActivityLog.js';
import AdminSession from '../models/AdminSession.js';

// Enhanced Dashboard with Real-time Analytics
export const getEnhancedDashboard = async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get comprehensive stats
    const [
      { count: totalUsers },
      { count: totalCourses },
      { count: totalEnrollments },
      { count: activeLiveClasses }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('courses').select('*', { count: 'exact', head: true }),
      supabase.from('enrollments').select('*', { count: 'exact', head: true }),
      supabase.from('live_classes').select('*', { count: 'exact', head: true }).eq('status', 'live')
    ]);

    // Mock data for features not yet implemented
    const recentActivities = [];
    const topCourses = [];
    const activeInstructors = [];
    const systemHealth = await getSystemHealthMetrics();

    // Calculate growth metrics
    const growthMetrics = await calculateGrowthMetrics(days);

    // Get revenue data
    const { data: revenueData } = await supabase
      .from('enrollments')
      .select('pricePaid, enrolledAt')
      .gte('enrolledAt', startDate.toISOString());

    const totalRevenue = revenueData?.reduce((sum, e) => sum + (e.pricePaid || 0), 0) || 0;

    res.json({
      success: true,
      dashboard: {
        stats: {
          totalUsers: totalUsers || 0,
          totalCourses: totalCourses || 0,
          totalEnrollments: totalEnrollments || 0,
          totalRevenue,
          activeLiveClasses: activeLiveClasses || 0,
          activeInstructors: activeInstructors?.length || 0
        },
        growth: growthMetrics,
        recentActivities: recentActivities || [],
        topCourses: topCourses?.map(course => ({
          ...course,
          enrollments: course.enrollments?.length || 0,
          avgRating: course.ratings?.length > 0
            ? course.ratings.reduce((sum, r) => sum + r.rating, 0) / course.ratings.length
            : 0
        })) || [],
        systemHealth,
        timeRange
      }
    });
  } catch (error) {
    console.error('Enhanced dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
};

// Real-time Activity Monitor
export const getActivityMonitor = async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, action, resource } = req.query;

    // Check if activity_logs table exists
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      // Table doesn't exist, return empty result
      return res.json({
        success: true,
        activities: [],
        pagination: { total: 0, page: 1, limit: 50, totalPages: 0 },
        message: 'Activity logging not yet configured. Please set up activity_logs table.'
      });
    }

    // If table exists, fetch real data
    let query = supabase
      .from('activity_logs')
      .select(`
        *,
        users(firstName, lastName, email, role)
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (userId) query = query.eq('userId', userId);
    if (action) query = query.eq('action', action);
    if (resource) query = query.eq('resource', resource);

    const { data: activities, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    res.json({
      success: true,
      activities: activities || [],
      pagination: {
        total: activities?.length || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: 1
      }
    });
  } catch (error) {
    console.error('Activity monitor error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch activities' });
  }
};

// Live Class Monitoring - Admin can join any live class
export const joinLiveClassAsAdmin = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const adminId = req.user.id;

    // Get live class details
    const { data: liveClass, error } = await supabase
      .from('live_classes')
      .select('*')
      .eq('meetingId', meetingId)
      .single();

    if (error || !liveClass) {
      return res.status(404).json({ success: false, message: 'Live class not found' });
    }

    // Get course and instructor info
    const { data: course } = await supabase
      .from('courses')
      .select('title, instructorId')
      .eq('id', liveClass.courseId)
      .single();

    const { data: instructor } = await supabase
      .from('users')
      .select('firstName, lastName')
      .eq('id', liveClass.instructorId)
      .single();

    // Generate admin access (feature disabled - no token needed)
    const adminName = `Admin (${req.user.firstName} ${req.user.lastName})`;
    const adminToken = null;

    // Log admin session
    try {
      await AdminSession.create({
        adminId,
        sessionType: 'live_class',
        targetId: liveClass.id,
        notes: `Admin joined live class: ${liveClass.title}`
      });
    } catch (sessionError) {
      console.log('Session logging failed:', sessionError);
    }

    // Track activity
    try {
      await ActivityLog.create({
        userId: adminId,
        action: 'join_live_class_admin',
        resource: 'live_class',
        resourceId: liveClass.id,
        details: {
          meetingId,
          liveClassTitle: liveClass.title,
          instructor
        }
      });
    } catch (activityError) {
      console.log('Activity logging failed:', activityError);
    }

    res.json({
      success: true,
      meetingConfig: {
        roomName: meetingId,
        displayName: adminName,
        domain: 'meet.jit.si', // Placeholder - feature disabled
        jwt: adminToken
      },
      liveClass: {
        ...liveClass,
        course,
        instructor,
        adminAccess: true
      },
      message: 'Admin access granted to live class'
    });
  } catch (error) {
    console.error('Admin live class join error:', error);
    res.status(500).json({ success: false, message: 'Failed to join live class' });
  }
};

// Get all live classes for admin monitoring
export const getAllLiveClasses = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('live_classes')
      .select('*')
      .order('scheduledAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: liveClasses, error, count } = await query;

    if (error) {
      console.error('Live classes query error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch live classes' });
    }

    // Get additional data separately
    const enrichedClasses = [];
    for (const lc of liveClasses || []) {
      // Get course info
      const { data: course } = await supabase
        .from('courses')
        .select('title, category')
        .eq('id', lc.courseId)
        .single();

      // Get instructor info
      const { data: instructor } = await supabase
        .from('users')
        .select('firstName, lastName, email')
        .eq('id', lc.instructorId)
        .single();

      enrichedClasses.push({
        ...lc,
        participantCount: 0, // Will be updated when participants table is used
        instructor,
        course
      });
    }

    res.json({
      success: true,
      liveClasses: enrichedClasses,
      pagination: {
        total: count || enrichedClasses.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((count || enrichedClasses.length) / limit)
      }
    });
  } catch (error) {
    console.error('Get all live classes error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch live classes' });
  }
};

// User Behavior Analytics
export const getUserBehaviorAnalytics = async (req, res) => {
  try {
    const { userId, timeRange = '30d' } = req.query;
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let whereClause = { createdAt: { $gte: startDate } };
    if (userId) whereClause.userId = userId;

    const activities = await ActivityLog.findAll({
      where: whereClause,
      include: [{ model: 'User', attributes: ['firstName', 'lastName', 'email', 'role'] }],
      order: [['createdAt', 'DESC']]
    });

    // Analyze behavior patterns
    const behaviorAnalysis = analyzeBehaviorPatterns(activities);

    res.json({
      success: true,
      analytics: behaviorAnalysis,
      timeRange
    });
  } catch (error) {
    console.error('User behavior analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch behavior analytics' });
  }
};

// Content Moderation Dashboard
export const getContentModerationDashboard = async (req, res) => {
  try {
    const [
      { data: flaggedContent },
      { data: recentReviews },
      { data: reportedUsers }
    ] = await Promise.all([
      supabase.from('courses').select(`
        id, title, description, isPublished,
        users!courses_instructorId_fkey(firstName, lastName, email),
        ratings(rating, comment)
      `).eq('isPublished', false),
      supabase.from('ratings').select(`
        id, rating, comment, createdAt,
        courses(title),
        users(firstName, lastName)
      `).order('createdAt', { ascending: false }).limit(20),
      supabase.from('users').select('id, firstName, lastName, email, isActive')
        .eq('isActive', false)
    ]);

    res.json({
      success: true,
      moderation: {
        flaggedContent: flaggedContent || [],
        recentReviews: recentReviews || [],
        reportedUsers: reportedUsers || [],
        pendingApprovals: flaggedContent?.length || 0
      }
    });
  } catch (error) {
    console.error('Content moderation error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch moderation data' });
  }
};

// System Performance Metrics
export const getSystemMetrics = async (req, res) => {
  try {
    const metrics = await getSystemHealthMetrics();

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('System metrics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch system metrics' });
  }
};

// Helper Functions
const calculateGrowthMetrics = async (days) => {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const prevStartDate = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000);

  const [currentPeriod, previousPeriod] = await Promise.all([
    Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true })
        .gte('createdAt', startDate.toISOString()),
      supabase.from('courses').select('*', { count: 'exact', head: true })
        .gte('createdAt', startDate.toISOString()),
      supabase.from('enrollments').select('*', { count: 'exact', head: true })
        .gte('enrolledAt', startDate.toISOString())
    ]),
    Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true })
        .gte('createdAt', prevStartDate.toISOString())
        .lt('createdAt', startDate.toISOString()),
      supabase.from('courses').select('*', { count: 'exact', head: true })
        .gte('createdAt', prevStartDate.toISOString())
        .lt('createdAt', startDate.toISOString()),
      supabase.from('enrollments').select('*', { count: 'exact', head: true })
        .gte('enrolledAt', prevStartDate.toISOString())
        .lt('enrolledAt', startDate.toISOString())
    ])
  ]);

  return {
    userGrowth: calculateGrowthRate(currentPeriod[0].count, previousPeriod[0].count),
    courseGrowth: calculateGrowthRate(currentPeriod[1].count, previousPeriod[1].count),
    enrollmentGrowth: calculateGrowthRate(currentPeriod[2].count, previousPeriod[2].count)
  };
};

const calculateGrowthRate = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const getSystemHealthMetrics = async () => {
  try {
    const [
      { count: activeUsers },
      { count: activeCourses },
      { count: ongoingClasses }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('isActive', true),
      supabase.from('courses').select('*', { count: 'exact', head: true }).eq('isPublished', true),
      supabase.from('live_classes').select('*', { count: 'exact', head: true }).eq('status', 'live')
    ]);

    return {
      status: 'healthy',
      activeUsers: activeUsers || 0,
      activeCourses: activeCourses || 0,
      ongoingClasses: ongoingClasses || 0,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      lastUpdated: new Date().toISOString()
    };
  }
};

const analyzeBehaviorPatterns = (activities) => {
  const patterns = {
    mostActiveHours: {},
    topActions: {},
    resourceUsage: {},
    sessionDuration: 0,
    uniqueDays: new Set()
  };

  activities.forEach(activity => {
    const hour = new Date(activity.createdAt).getHours();
    const day = new Date(activity.createdAt).toDateString();

    patterns.mostActiveHours[hour] = (patterns.mostActiveHours[hour] || 0) + 1;
    patterns.topActions[activity.action] = (patterns.topActions[activity.action] || 0) + 1;
    patterns.resourceUsage[activity.resource] = (patterns.resourceUsage[activity.resource] || 0) + 1;
    patterns.uniqueDays.add(day);
  });

  return {
    ...patterns,
    uniqueDays: patterns.uniqueDays.size,
    totalActivities: activities.length,
    avgActivitiesPerDay: activities.length / Math.max(patterns.uniqueDays.size, 1)
  };
};