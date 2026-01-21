import supabase from '../config/supabase.js';

class ProgressService {

  // Get comprehensive progress dashboard data
  async getStudentProgressDashboard(userId, courseId) {
    try {
      let coursesFilter = {};
      if (courseId !== 'all') {
        coursesFilter = { id: courseId };
      } else {
        // For 'all', we first need all enrolled course IDs
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('courseId')
          .eq('userId', userId);

        if (!enrollments || enrollments.length === 0) {
          return this._getEmptyStats(userId, courseId);
        }
        coursesFilter = { id: enrollments.map(e => e.courseId) }; // Allow matching any of these
      }

      // 1. Fetch Course(s) Info to count totals
      let query = supabase
        .from('courses')
        .select(`
          id,
          title,
          chapters (
            id,
            videos (id),
            text_lectures (id),
            quizzes (id, type, title, totalMarks)
          )
        `);

      if (courseId !== 'all') {
        query = query.eq('id', courseId);
      } else {
        // If "all", ideally we filter by the enrolled IDs we found
        // But "in" expects an array.
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('courseId')
          .eq('userId', userId);

        const enrolledIds = enrollments?.map(e => e.courseId) || [];
        if (enrolledIds.length === 0) return this._getEmptyStats(userId, courseId);

        query = query.in('id', enrolledIds);
      }

      const { data: courses, error: courseError } = await query;
      if (courseError) throw courseError;

      // Calculate Totals
      let totalLectures = 0;
      let totalAssignments = 0;
      let totalQuizzes = 0;
      let totalLiveClasses = 0; // Info not yet available in schema, keep 0

      const courseIds = courses.map(c => c.id);
      const quizMap = {}; // id -> title, type

      courses.forEach(c => {
        c.chapters?.forEach(ch => {
          totalLectures += (ch.videos?.length || 0) + (ch.text_lectures?.length || 0);
          ch.quizzes?.forEach(q => {
            quizMap[q.id] = q;
            if (q.type === 'assignment') totalAssignments++;
            else totalQuizzes++;
          });
        });
      });

      // 2. Fetch User Progress (Lectures)
      const { count: completedVideos } = await supabase
        .from('video_progress')
        .select('*', { count: 'exact', head: true })
        .eq('userId', userId)
        .eq('completed', true)
        .in('courseId', courseIds);

      const { count: completedTexts } = await supabase
        .from('text_lecture_progress')
        .select('*', { count: 'exact', head: true })
        .eq('userId', userId)
        .eq('completed', true)
        .in('courseId', courseIds);

      const completedLectures = (completedVideos || 0) + (completedTexts || 0);
      const lectureCompletionPercentage = totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0;

      // 3. Fetch User Progress (Quizzes/Assignments)
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('userId', userId)
        .order('createdAt', { ascending: true }); // Order by date for timeline

      // Process attempts
      let submittedAssignments = 0;
      let completedQuizzes = 0; // Attempts on 'quiz' type
      let passedQuizzes = 0;
      let totalAssignmentScore = 0;
      let totalQuizScore = 0;
      let quizAttemptsCount = 0;

      // For charts
      const assignmentChartData = [];
      const quizPerformanceOverTime = [];

      // We need to filter attempts relevant to our courses
      const relevantAttempts = attempts?.filter(a => quizMap[a.quizId]) || [];

      relevantAttempts.forEach(a => {
        const quizDef = quizMap[a.quizId];
        if (quizDef.type === 'assignment') {
          submittedAssignments++;
          const pct = (a.score / (a.totalPoints || quizDef.totalMarks || 100)) * 100;
          totalAssignmentScore += pct;

          // Add to chart (only latest or all? dashboard usually shows list)
          // Fix: avoid duplicates if multiple attempts? Assignments usually 1 attempt? 
          assignmentChartData.push({
            name: quizDef.title,
            percentage: Math.round(pct),
            status: a.status || 'submitted'
          });
        } else {
          // Quiz
          completedQuizzes++;
          if (a.isPassed) passedQuizzes++;
          const pct = (a.score / (a.totalPoints || quizDef.totalMarks || 100)) * 100;
          totalQuizScore += pct;
          quizAttemptsCount++;

          quizPerformanceOverTime.push({
            attempt: `Quiz ${completedQuizzes}`, // Simple label
            score: Math.round(pct),
            date: a.createdAt,
            quizTitle: quizDef.title
          });
        }
      });

      const averageAssignmentScore = submittedAssignments > 0 ? Math.round(totalAssignmentScore / submittedAssignments) : 0;
      const averageQuizScore = quizAttemptsCount > 0 ? Math.round(totalQuizScore / quizAttemptsCount) : 0;

      // 4. Overall Completion (from Enrollment table for accuracy)
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select('progress')
        .eq('userId', userId)
        .in('courseId', courseIds);

      let overallCompletionPercentage = 0;
      if (enrollmentsData && enrollmentsData.length > 0) {
        const sum = enrollmentsData.reduce((acc, curr) => acc + (curr.progress || 0), 0);
        overallCompletionPercentage = Math.round(sum / enrollmentsData.length);
      }

      // 5. Activity Metrics
      // We can fetch from course_activity
      const { data: activities } = await supabase
        .from('course_activity')
        .select('*')
        .eq('userId', userId)
        .in('courseId', courseIds)
        .order('timestamp', { ascending: false });

      const totalTimeSpent = activities?.reduce((acc, curr) => acc + (curr.timeSpent || 0), 0) / 3600 || 0; // Hours
      const lastActivityDate = activities?.[0]?.timestamp || null;

      // Calculate streak (simplified)
      // use learning_streaks table if available or calc from activities
      const { data: streaks } = await supabase.from('learning_streaks').select('*').eq('userId', userId).order('date', { ascending: false });
      // This is a bit complex for now, assume single streak logic or fetch just current
      const currentStreak = streaks?.[0]?.isActive ? 1 : 0; // Placeholder strictly unless we calc query

      return {
        summary: {
          userId,
          courseId,
          courseTitle: courses.length === 1 ? courses[0].title : 'All Courses',
          totalLectures,
          completedLectures,
          lectureCompletionPercentage,
          totalAssignments,
          submittedAssignments,
          averageAssignmentScore,
          totalQuizzes,
          completedQuizzes,
          averageQuizScore,
          passedQuizzes,
          totalLiveClasses,
          attendedLiveClasses: 0,
          liveAttendancePercentage: 0,
          overallCompletionPercentage,
          totalTimeSpent: parseFloat(totalTimeSpent.toFixed(1)),
          lastActivityDate,
          currentStreak
        },
        lectureProgress: {
          lectures: [], // Populate if specific course needed
          chartData: { completed: completedLectures, remaining: Math.max(0, totalLectures - completedLectures) }
        },
        assignmentProgress: {
          assignments: [],
          chartData: assignmentChartData.slice(0, 10) // Limit to 10
        },
        quizPerformance: {
          quizzes: [],
          chartData: [],
          performanceOverTime: quizPerformanceOverTime
        },
        liveAttendance: {
          attendance: [],
          chartData: { attended: 0, missed: 0 }
        },
        activityMetrics: {
          totalTimeSpent: parseFloat(totalTimeSpent.toFixed(1)),
          lastActivityDate,
          currentStreak,
          totalActivities: activities?.length || 0
        }
      };
    } catch (error) {
      console.error('Error fetching progress dashboard:', error);
      throw error;
    }
  }

  _getEmptyStats(userId, courseId) {
    return {
      summary: {
        userId, courseId, courseTitle: 'No Courses',
        totalLectures: 0, completedLectures: 0, lectureCompletionPercentage: 0,
        totalAssignments: 0, submittedAssignments: 0, averageAssignmentScore: 0,
        totalQuizzes: 0, completedQuizzes: 0, averageQuizScore: 0, passedQuizzes: 0,
        totalLiveClasses: 0, attendedLiveClasses: 0, liveAttendancePercentage: 0,
        overallCompletionPercentage: 0, totalTimeSpent: 0,
        lastActivityDate: null, currentStreak: 0
      },
      lectureProgress: { chartData: { completed: 0, remaining: 0 } },
      assignmentProgress: { chartData: [] },
      quizPerformance: { performanceOverTime: [] },
      liveAttendance: { chartData: { attended: 0, missed: 0 } },
      activityMetrics: { totalTimeSpent: 0, lastActivityDate: null, currentStreak: 0, totalActivities: 0 }
    };
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