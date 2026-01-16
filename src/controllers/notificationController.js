import NotificationService from '../notifications/NotificationService.js';
import supabase from '../config/supabase.js';

const notificationService = new NotificationService();

// Send custom message to course students
const sendCourseMessage = async (req, res) => {
  try {
    const { courseId, subject, message } = req.body;
    const instructorId = req.user.id;

    // Verify instructor owns the course
    const { data: course, error } = await supabase
      .from('courses')
      .select('id, instructorId')
      .eq('id', courseId)
      .eq('instructorId', instructorId)
      .single();

    if (error || !course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found or access denied'
      });
    }

    const result = await notificationService.sendCustomMessage(
      courseId, 
      subject, 
      message, 
      instructorId
    );

    res.json({
      success: true,
      message: `Message sent to ${result.sent} students`,
      ...result
    });
  } catch (error) {
    console.error('Error sending course message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

// Get notification history for instructor
const getNotificationHistory = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { courseId } = req.query;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('senderId', instructorId)
      .order('sentAt', { ascending: false });

    if (courseId) {
      query = query.eq('courseId', courseId);
    }

    const { data: notifications, error } = await query;

    if (error) throw error;

    // Manually fetch course titles for each notification
    const notificationsWithCourses = await Promise.all(
      (notifications || []).map(async (notification) => {
        if (notification.courseId) {
          const { data: course } = await supabase
            .from('courses')
            .select('title')
            .eq('id', notification.courseId)
            .single();
          
          return {
            ...notification,
            courses: course ? { title: course.title } : null
          };
        }
        return notification;
      })
    );

    res.json({
      success: true,
      notifications: notificationsWithCourses
    });
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification history'
    });
  }
};

// Get enrolled students for a course
const getCourseStudents = async (req, res) => {
  try {
    const { courseId } = req.params;
    const instructorId = req.user.id;

    // Verify instructor owns the course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('instructorId', instructorId)
      .single();

    if (courseError || !course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found or access denied'
      });
    }

    const students = await notificationService.getCourseStudents(courseId);

    res.json({
      success: true,
      students,
      count: students.length
    });
  } catch (error) {
    console.error('Error fetching course students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students'
    });
  }
};

// Trigger automatic course update notification
const triggerCourseUpdate = async (req, res) => {
  try {
    const { courseId, updateType, updateData } = req.body;
    const instructorId = req.user.id;

    // Verify instructor owns the course
    const { data: course, error } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('instructorId', instructorId)
      .single();

    if (error || !course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found or access denied'
      });
    }

    const result = await notificationService.sendCourseUpdate(
      courseId,
      updateType,
      updateData
    );

    res.json({
      success: true,
      message: `Update notification sent to ${result.sent} students`,
      ...result
    });
  } catch (error) {
    console.error('Error triggering course update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send update notification'
    });
  }
};

// Get notification analytics for instructor
const getNotificationAnalytics = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { courseId, days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    let query = supabase
      .from('notifications')
      .select('type, sentAt, metadata')
      .eq('senderId', instructorId)
      .gte('sentAt', startDate.toISOString());

    if (courseId) {
      query = query.eq('courseId', courseId);
    }

    const { data: notifications, error } = await query;

    if (error) throw error;

    // Calculate analytics
    const analytics = {
      totalSent: notifications?.length || 0,
      byType: {},
      byDay: {},
      recentActivity: notifications?.slice(0, 10) || []
    };

    notifications?.forEach(notification => {
      // Count by type
      analytics.byType[notification.type] = (analytics.byType[notification.type] || 0) + 1;
      
      // Count by day
      const day = new Date(notification.sentAt).toDateString();
      analytics.byDay[day] = (analytics.byDay[day] || 0) + 1;
    });

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error fetching notification analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
};

export {
  sendCourseMessage,
  getNotificationHistory,
  getCourseStudents,
  triggerCourseUpdate,
  getNotificationAnalytics
};