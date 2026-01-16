import supabase from '../config/supabase.js';

export const trackEvent = async (eventType, data) => {
  try {
    const eventData = {
      event_type: eventType,
      user_id: data.userId || null,
      course_id: data.courseId || null,
      chapter_id: data.chapterId || null,
      video_id: data.videoId || null,
      metadata: data.metadata || {}
    };

    await supabase
      .from('analytics_events')
      .insert(eventData);
  } catch (error) {
    console.error('Analytics tracking error:', error);
  }
};

export const trackCourseView = async (courseId, userId) => {
  try {
    // Track the event
    await trackEvent('course_view', { courseId, userId });
    
    // Update course view count
    await supabase
      .from('courses')
      .update({ 
        viewCount: supabase.raw('COALESCE("viewCount", 0) + 1'),
        lastViewedAt: new Date().toISOString()
      })
      .eq('id', courseId);
  } catch (error) {
    console.error('Course view tracking error:', error);
  }
};

export const trackEnrollment = async (courseId, studentId, instructorId, amount) => {
  try {
    // Track analytics event
    await trackEvent('enrollment', { 
      courseId, 
      userId: studentId,
      metadata: { amount, instructorId }
    });
    
    // Create revenue record
    await supabase
      .from('revenue_records')
      .insert({
        instructor_id: instructorId,
        course_id: courseId,
        student_id: studentId,
        amount: amount,
        status: 'completed'
      });
  } catch (error) {
    console.error('Enrollment tracking error:', error);
  }
};

export const trackVideoWatch = async (videoId, chapterId, courseId, userId, watchTime) => {
  try {
    await trackEvent('video_watch', {
      videoId,
      chapterId,
      courseId,
      userId,
      metadata: { watchTime }
    });
  } catch (error) {
    console.error('Video watch tracking error:', error);
  }
};

export const trackCourseCompletion = async (courseId, userId) => {
  try {
    await trackEvent('course_complete', {
      courseId,
      userId,
      metadata: { completedAt: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Course completion tracking error:', error);
  }
};