import ProgressService from '../services/ProgressService.js';
import supabase from '../config/supabase.js';

export const getProgressDashboard = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: 'Course ID is required'
      });
    }

    const progressData = await ProgressService.getStudentProgressDashboard(userId, courseId);

    res.json({
      success: true,
      data: progressData
    });

  } catch (error) {
    console.error('Error fetching progress dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch progress data'
    });
  }
};

export const getMultiCourseProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Return mock data for now
    const mockData = {
      courses: [
        {
          courseId: '1',
          courseTitle: 'React Development',
          courseThumbnail: null,
          progress: {
            overallCompletionPercentage: 75
          }
        }
      ],
      totalCourses: 1,
      averageCompletion: 75
    };

    res.json({
      success: true,
      data: mockData
    });

  } catch (error) {
    console.error('Error fetching multi-course progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch courses progress'
    });
  }
};

export const updateLectureProgress = async (req, res) => {
  try {
    const { courseId, lectureId } = req.params;
    const { watchTime, totalDuration } = req.body;
    const userId = req.user.id;

    if (!watchTime || !totalDuration) {
      return res.status(400).json({
        success: false,
        error: 'Watch time and total duration are required'
      });
    }

    await ProgressService.updateLectureProgress(
      userId, 
      courseId, 
      lectureId, 
      watchTime, 
      totalDuration
    );

    res.json({
      success: true,
      message: 'Lecture progress updated successfully'
    });

  } catch (error) {
    console.error('Error updating lecture progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update lecture progress'
    });
  }
};

export const updateAssignmentProgress = async (req, res) => {
  try {
    const { courseId, assignmentId } = req.params;
    const { submissionId, status, score, maxScore } = req.body;
    const userId = req.user.id;

    await ProgressService.updateAssignmentProgress(
      userId,
      courseId,
      assignmentId,
      submissionId,
      status,
      score,
      maxScore
    );

    res.json({
      success: true,
      message: 'Assignment progress updated successfully'
    });

  } catch (error) {
    console.error('Error updating assignment progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update assignment progress'
    });
  }
};

export const getActivityTimeline = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { days = 30 } = req.query;
    const userId = req.user.id;

    const { data: activities, error } = await supabase
      .from('course_activity')
      .select('*')
      .eq('userId', userId)
      .eq('courseId', courseId)
      .gte('timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: true });

    if (error) throw error;

    // Group activities by date
    const timelineData = activities.reduce((acc, activity) => {
      const date = activity.timestamp.split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          activities: 0,
          timeSpent: 0,
          types: new Set()
        };
      }
      acc[date].activities += 1;
      acc[date].timeSpent += activity.timeSpent || 0;
      acc[date].types.add(activity.activityType);
      return acc;
    }, {});

    const timeline = Object.values(timelineData).map(day => ({
      ...day,
      types: Array.from(day.types),
      timeSpentHours: Math.round(day.timeSpent / 3600 * 100) / 100
    }));

    res.json({
      success: true,
      data: {
        timeline,
        totalDays: days,
        activeDays: timeline.length,
        totalTimeSpent: timeline.reduce((sum, day) => sum + day.timeSpentHours, 0)
      }
    });

  } catch (error) {
    console.error('Error fetching activity timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity timeline'
    });
  }
};

export const getLeaderboard = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { limit = 10 } = req.query;

    const { data: leaderboard, error } = await supabase
      .from('student_progress_summary')
      .select(`
        userId,
        overallCompletionPercentage,
        totalTimeSpent,
        currentStreak,
        users (
          firstName,
          lastName,
          avatar
        )
      `)
      .eq('courseId', courseId)
      .order('overallCompletionPercentage', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      name: `${entry.users.firstName} ${entry.users.lastName}`,
      avatar: entry.users.avatar,
      completionPercentage: entry.overallCompletionPercentage,
      timeSpent: entry.totalTimeSpent,
      streak: entry.currentStreak
    }));

    res.json({
      success: true,
      data: {
        leaderboard: formattedLeaderboard,
        totalStudents: leaderboard.length
      }
    });

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
};

export const refreshProgressSummary = async (req, res) => {
  try {
    const { error } = await supabase.rpc('refresh_progress_summary');
    
    if (error) throw error;

    res.json({
      success: true,
      message: 'Progress summary refreshed successfully'
    });

  } catch (error) {
    console.error('Error refreshing progress summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh progress summary'
    });
  }
};