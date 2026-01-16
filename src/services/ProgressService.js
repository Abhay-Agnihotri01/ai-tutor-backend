import supabase from '../config/supabase.js';

class ProgressService {
  
  // Get comprehensive progress dashboard data
  async getStudentProgressDashboard(userId, courseId) {
    try {
      // Return mock data for now to avoid database errors
      return {
        summary: {
          userId,
          courseId,
          courseTitle: 'Sample Course',
          totalLectures: 10,
          completedLectures: 5,
          lectureCompletionPercentage: 50,
          totalAssignments: 3,
          submittedAssignments: 2,
          averageAssignmentScore: 85,
          totalQuizzes: 5,
          completedQuizzes: 3,
          averageQuizScore: 78,
          passedQuizzes: 3,
          totalLiveClasses: 2,
          attendedLiveClasses: 1,
          liveAttendancePercentage: 50,
          overallCompletionPercentage: 65,
          totalTimeSpent: 15.5,
          lastActivityDate: new Date().toISOString(),
          currentStreak: 3
        },
        lectureProgress: {
          lectures: [],
          chartData: { completed: 5, remaining: 5 }
        },
        assignmentProgress: {
          assignments: [],
          chartData: []
        },
        quizPerformance: {
          quizzes: [],
          chartData: [],
          performanceOverTime: []
        },
        liveAttendance: {
          attendance: [],
          chartData: { attended: 1, missed: 1 }
        },
        activityMetrics: {
          totalTimeSpent: 15.5,
          lastActivityDate: new Date().toISOString(),
          currentStreak: 3,
          totalActivities: 25
        }
      };
    } catch (error) {
      console.error('Error fetching progress dashboard:', error);
      throw error;
    }
  }

  // Update progress when activities occur
  async updateLectureProgress(userId, courseId, lectureId, watchTime, totalDuration) {
    const completionPercentage = Math.min((watchTime / totalDuration) * 100, 100);
    const isCompleted = completionPercentage >= 80; // 80% threshold for completion

    const { error } = await supabase
      .from('lecture_progress')
      .upsert({
        userId,
        courseId,
        lectureId,
        watchTime,
        totalDuration,
        completionPercentage,
        isCompleted,
        lastWatchedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, {
        onConflict: 'userId,lectureId'
      });

    if (error) throw error;

    // Log activity
    await this.logActivity(userId, courseId, 'lecture_view', lectureId, watchTime);
  }

  async updateAssignmentProgress(userId, courseId, assignmentId, submissionId, status, score, maxScore) {
    const { error } = await supabase
      .from('assignment_progress')
      .upsert({
        userId,
        courseId,
        assignmentId,
        submissionId,
        status,
        score,
        maxScore,
        submittedAt: ['submitted', 'graded'].includes(status) ? new Date().toISOString() : null,
        gradedAt: status === 'graded' ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      }, {
        onConflict: 'userId,assignmentId'
      });

    if (error) throw error;

    await this.logActivity(userId, courseId, 'assignment_submit', assignmentId);
  }

  async logActivity(userId, courseId, activityType, activityId, timeSpent = 0) {
    const { error } = await supabase
      .from('course_activity')
      .insert({
        userId,
        courseId,
        activityType,
        activityId,
        timeSpent,
        timestamp: new Date().toISOString()
      });

    if (error) console.error('Error logging activity:', error);

    // Update daily streak
    await this.updateDailyStreak(userId, courseId);
  }

  async updateDailyStreak(userId, courseId) {
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('learning_streaks')
      .upsert({
        userId,
        courseId,
        date: today,
        activitiesCount: 1,
        timeSpent: 0,
        isActive: true
      }, {
        onConflict: 'userId,courseId,date'
      });

    if (error) console.error('Error updating streak:', error);
  }
}

export default new ProgressService();