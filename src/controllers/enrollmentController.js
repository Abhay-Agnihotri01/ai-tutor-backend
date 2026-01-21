import supabase from '../config/supabase.js';

// Helper function to calculate and save course progress
// Counts both videos and text lectures for accurate percentage
const calculateAndSaveProgress = async (userId, courseId) => {
  try {
    // Get all chapters for this course
    const { data: chapters } = await supabase
      .from('chapters')
      .select('id')
      .eq('courseId', courseId);

    const chapterIds = chapters?.map(c => c.id) || [];
    if (chapterIds.length === 0) return 0;

    // Count total videos
    const { count: totalVideos } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .in('chapterId', chapterIds);

    // Count total text lectures
    let totalTextLectures = 0;
    try {
      const { count } = await supabase
        .from('text_lectures')
        .select('*', { count: 'exact', head: true })
        .in('chapterId', chapterIds);
      totalTextLectures = count || 0;
    } catch (e) {
      // Table might not exist
    }

    const totalContent = (totalVideos || 0) + totalTextLectures;
    if (totalContent === 0) return 0;

    // Count completed videos
    const { count: completedVideos } = await supabase
      .from('video_progress')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId)
      .eq('courseId', courseId)
      .eq('completed', true);

    // Count completed text lectures
    let completedTextLectures = 0;
    try {
      const { count } = await supabase
        .from('text_lecture_progress')
        .select('*', { count: 'exact', head: true })
        .eq('userId', userId)
        .eq('courseId', courseId)
        .eq('completed', true);
      completedTextLectures = count || 0;
    } catch (e) {
      // Table might not exist
    }

    const completedContent = (completedVideos || 0) + completedTextLectures;
    const progress = Math.round((completedContent / totalContent) * 100);

    // Update enrollment with calculated progress
    await supabase
      .from('enrollments')
      .update({ progress, updatedAt: new Date().toISOString() })
      .eq('userId', userId)
      .eq('courseId', courseId);

    return progress;
  } catch (error) {
    console.error('Error calculating progress:', error);
    return 0;
  }
};

export const enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.body;

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const userId = req.user.id;

    // Validate courseId
    if (!courseId) {
      return res.status(400).json({ message: 'Course ID is required' });
    }

    // Check if already enrolled
    const { data: existingEnrollment } = await supabase
      .from('enrollments')
      .select('*')
      .eq('userId', userId)
      .eq('courseId', courseId)
      .single();

    if (existingEnrollment) {
      return res.status(400).json({ message: 'Already enrolled in this course' });
    }

    // Verify course exists and is published
    const { data: course } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .eq('isPublished', true)
      .single();

    if (!course) {
      return res.status(404).json({ message: 'Course not found or not published' });
    }

    // Calculate actual price paid (use discount price if available)
    const actualPrice = course.discountPrice || course.price || 0;

    // Create enrollment with actual price paid
    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .insert({
        userId,
        courseId,
        progress: 0,
        pricePaid: actualPrice,
        enrolledAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      enrollment,
      message: 'Successfully enrolled in course'
    });
  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getUserEnrollments = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        courses (
          *,
          users!courses_instructorId_fkey (
            firstName,
            lastName,
            avatar
          )
        )
      `)
      .eq('userId', userId)
      .order('enrolledAt', { ascending: false });

    if (error) throw error;

    // Format the response to match expected structure
    const enrollmentsWithCourses = await Promise.all(enrollments.map(async (enrollment) => {
      let actualDuration = 0;
      let actualLessons = 0;
      let totalTextLectures = 0;

      if (enrollment.courses) {
        // Fetch chapters and videos for duration calculation
        const { data: chapters } = await supabase
          .from('chapters')
          .select(`
            id,
            videos (duration)
          `)
          .eq('courseId', enrollment.courses.id);

        if (chapters) {
          chapters.forEach(chapter => {
            // Count videos
            if (chapter.videos) {
              actualLessons += chapter.videos.length;
              chapter.videos.forEach(video => {
                actualDuration += (video.duration || 0);
              });
            }
          });
        }

        // Count text lectures and add estimated reading time (10 min per text lecture)
        try {
          const { data: textLectures, count } = await supabase
            .from('text_lectures')
            .select('*', { count: 'exact' })
            .eq('courseId', enrollment.courses.id);
          totalTextLectures = count || 0;
          // Add 10 minutes (600 seconds) per text lecture as estimated reading time
          actualDuration += totalTextLectures * 600;
        } catch (e) {
          // Table might not exist
        }
      }

      // Check if course has actually started (any progress record exists)
      const { count: videoProgressCount } = await supabase
        .from('video_progress')
        .select('*', { count: 'exact', head: true })
        .eq('userId', userId)
        .eq('courseId', enrollment.courses.id);

      let textProgressCount = 0;
      try {
        const { count } = await supabase
          .from('text_lecture_progress')
          .select('*', { count: 'exact', head: true })
          .eq('userId', userId)
          .eq('courseId', enrollment.courses.id);
        textProgressCount = count || 0;
      } catch (e) {
        // Ignore if table issues
      }

      const hasStarted = (videoProgressCount > 0 || textProgressCount > 0);

      // Recalculate progress dynamically to ensure accuracy
      const dynamicProgress = await calculateAndSaveProgress(userId, enrollment.courses.id);

      const durationHours = Math.round((actualDuration / 3600) * 10) / 10;

      return {
        ...enrollment,
        progress: dynamicProgress, // Use dynamically calculated progress
        hasStarted, // Dynamic flag
        Course: enrollment.courses ? {
          ...enrollment.courses,
          instructor: enrollment.courses.users,
          actualDuration: durationHours,
          actualLessons: actualLessons + totalTextLectures // Include text lectures in lesson count
        } : null
      };
    }));

    res.json({
      success: true,
      enrollments: enrollmentsWithCourses
    });
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const markVideoComplete = async (req, res) => {
  try {
    const { videoId, courseId } = req.body;
    const userId = req.user.id;

    // Check if already completed
    const { data: existing } = await supabase
      .from('video_progress')
      .select('*')
      .eq('userId', userId)
      .eq('videoId', videoId)
      .single();

    if (!existing) {
      // Mark video as completed
      await supabase
        .from('video_progress')
        .insert({
          userId,
          videoId,
          courseId,
          completed: true,
          completedAt: new Date().toISOString()
        });
    }

    // Calculate overall course progress
    const { data: courseVideos } = await supabase
      .from('videos')
      .select('id')
      .eq('chapterId', 'in', `(
        SELECT id FROM chapters WHERE "courseId" = '${courseId}'
      )`);

    const { data: completedVideos } = await supabase
      .from('video_progress')
      .select('videoId')
      .eq('userId', userId)
      .eq('courseId', courseId)
      .eq('completed', true);

    const totalVideos = courseVideos?.length || 1;
    const completedCount = completedVideos?.length || 0;
    const progress = Math.round((completedCount / totalVideos) * 100);

    // Update enrollment progress
    await supabase
      .from('enrollments')
      .update({ progress })
      .eq('userId', userId)
      .eq('courseId', courseId);

    res.json({ success: true, progress });
  } catch (error) {
    console.error('Mark video complete error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateVideoProgress = async (req, res) => {
  try {
    const { videoId, courseId, watchTime, duration } = req.body;
    const userId = req.user.id;

    if (!videoId || !courseId || watchTime === undefined || duration === undefined) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const watchPercentage = duration > 0 ? (watchTime / duration) * 100 : 0;
    const shouldMarkComplete = watchPercentage >= 85;

    // Check if already completed
    const { data: existing } = await supabase
      .from('video_progress')
      .select('completed')
      .eq('"userId"', userId)
      .eq('"videoId"', videoId)
      .single();

    // Only mark as complete if not already completed or if reaching 85%
    const isCompleted = existing?.completed || shouldMarkComplete;

    // Upsert video progress
    const { error: upsertError } = await supabase
      .from('video_progress')
      .upsert({
        "userId": userId,
        "videoId": videoId,
        "courseId": courseId,
        completed: isCompleted,
        "completedAt": isCompleted && !existing?.completed ? new Date().toISOString() : undefined
      }, { onConflict: '"userId","videoId"' });



    // Update course progress if video completed
    if (isCompleted) {
      const { data: chapters } = await supabase
        .from('chapters')
        .select('id')
        .eq('courseId', courseId);

      const chapterIds = chapters?.map(ch => ch.id) || [];

      const { data: courseVideos } = await supabase
        .from('videos')
        .select('id')
        .in('chapterId', chapterIds);

      const { data: completedVideos } = await supabase
        .from('video_progress')
        .select('videoId')
        .eq('userId', userId)
        .eq('courseId', courseId)
        .eq('completed', true);

      const totalVideos = courseVideos?.length || 1;
      const completedCount = completedVideos?.length || 0;
      const courseProgress = Math.round((completedCount / totalVideos) * 100);

      await supabase
        .from('enrollments')
        .update({ progress: courseProgress })
        .eq('userId', userId)
        .eq('courseId', courseId);
    }

    res.json({ success: true, completed: isCompleted });
  } catch (error) {
    res.json({ success: true, message: 'Progress not saved' });
  }
};

export const getVideoProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Self-healing: Recalculate and save progress to ensure DB is in sync
    // This fixes issues where frontend calculation (dynamic) differs from DB value (static)
    // due to missed updates or legacy data.
    await calculateAndSaveProgress(userId, courseId);

    // Get video progress
    const { data: videoProgress } = await supabase
      .from('video_progress')
      .select('"videoId", completed')
      .eq('"userId"', userId)
      .eq('"courseId"', courseId);

    // Get text lecture progress
    const { data: textLectureProgress } = await supabase
      .from('text_lecture_progress')
      .select('"textLectureId", completed')
      .eq('"userId"', userId)
      .eq('"courseId"', courseId);

    // Combine both progress types
    const allProgress = [
      ...(videoProgress || []).map(p => ({ videoId: p.videoId, completed: p.completed })),
      ...(textLectureProgress || []).map(p => ({ videoId: p.textLectureId, completed: p.completed }))
    ];

    res.json({ success: true, progress: allProgress });
  } catch (error) {
    console.error('Get video progress error:', error);
    res.json({ success: true, progress: [] });
  }
};

export const markContentComplete = async (req, res) => {
  try {
    const { courseId, contentId, contentType } = req.body;
    const userId = req.user.id;

    if (contentType === 'text_lecture') {
      // Create a separate table for text lecture progress or use a generic content_progress table
      // For now, let's create a simple approach using a separate table
      const { error } = await supabase
        .from('text_lecture_progress')
        .upsert({
          userId,
          textLectureId: contentId,
          courseId,
          completed: true,
          completedAt: new Date().toISOString()
        }, { onConflict: '"userId","textLectureId"' });

      if (error) {
        console.error('Text lecture progress error:', error);
        return res.status(500).json({ message: 'Failed to save progress', error: error.message });
      }

      // Recalculate and save overall course progress
      const progress = await calculateAndSaveProgress(userId, courseId);
      return res.json({ success: true, progress });
    }

    // For other content types, still recalculate progress
    const progress = await calculateAndSaveProgress(userId, courseId);
    res.json({ success: true, progress });
  } catch (error) {
    console.error('Mark content complete error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


export const updateProgress = async (req, res) => {
  try {
    const { courseId, lessonId, progress } = req.body;
    const userId = req.user.id;

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('*')
      .eq('userId', userId)
      .eq('courseId', courseId)
      .single();

    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }

    const { data: updatedEnrollment, error } = await supabase
      .from('enrollments')
      .update({
        progress: progress || enrollment.progress
      })
      .eq('userId', userId)
      .eq('courseId', courseId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      enrollment: updatedEnrollment
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};