import supabase from '../config/supabase.js';
import CloudinaryService from '../services/CloudinaryService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create live class
export const createLiveClass = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { courseId, chapterId, title, description, scheduledAt, duration, maxParticipants, isRecorded } = req.body;
    const instructorId = req.user.id;

    // Validate instructor owns the course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, instructorId')
      .eq('id', courseId)
      .eq('instructorId', instructorId)
      .single();

    if (courseError || !course) {
      return res.status(403).json({
        success: false,
        message: 'You can only create live classes for your own courses'
      });
    }

    // Generate unique room name
    const roomName = `class-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create live class in database
    const { data: liveClass, error } = await supabase
      .from('live_classes')
      .insert({
        courseId,
        chapterId,
        instructorId,
        title,
        description,
        scheduledAt,
        duration: duration || 60,
        meetingId: roomName, // Using roomName as meetingId
        maxParticipants: maxParticipants || 50,
        isRecorded: isRecorded || false,
        status: 'scheduled'
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create live class'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Live class created successfully',
      liveClass
    });
  } catch (error) {
    console.error('Error creating live class:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get live classes for a course
export const getLiveClassesByCourse = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has access to the course
    let hasAccess = false;

    if (userRole === 'instructor') {
      const { data: course } = await supabase
        .from('courses')
        .select('id')
        .eq('id', courseId)
        .eq('instructorId', userId)
        .single();
      hasAccess = !!course;
    } else {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('courseId', courseId)
        .eq('userId', userId)
        .single();
      hasAccess = !!enrollment;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get live classes - handle missing table gracefully
    const { data: liveClasses, error } = await supabase
      .from('live_classes')
      .select('*')
      .eq('courseId', courseId)
      .order('scheduledAt', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      // If table doesn't exist, return empty array
      if (error.code === 'PGRST106' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return res.json({
          success: true,
          liveClasses: [],
          message: 'Live classes feature is not yet set up. Please contact administrator.'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch live classes'
      });
    }

    res.json({
      success: true,
      liveClasses: liveClasses || []
    });
  } catch (error) {
    console.error('Error fetching live classes:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get live class by meeting ID
export const getLiveClassByMeetingId = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    console.log(`Getting live class by meetingId: ${meetingId} for user: ${userId}`);

    // Get live class without joins first
    const { data: liveClass, error } = await supabase
      .from('live_classes')
      .select('*')
      .eq('meetingId', meetingId)
      .single();

    console.log('Live class query result:', { liveClass, error });

    if (error || !liveClass) {
      console.log('Live class not found:', error);
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    // Get course info separately
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('title, instructorId')
      .eq('id', liveClass.courseId)
      .single();

    console.log('Course query result:', { course, courseError });

    // Check access permissions and determine role
    let hasAccess = false;
    let userRole = 'student';

    console.log('Role determination:', {
      liveClassInstructorId: liveClass.instructorId,
      courseInstructorId: course?.instructorId,
      currentUserId: userId,
      userFromToken: req.user
    });

    // Check if user is admin
    if (req.user.role === 'admin') {
      hasAccess = true;
      userRole = 'admin';
      console.log('User identified as admin');
    }
    // Check if user is instructor (either live class creator or course owner)
    else if (liveClass.instructorId === userId || (course && course.instructorId === userId)) {
      hasAccess = true;
      userRole = 'instructor';
      console.log('User identified as instructor');
    } else {
      // Check if student is enrolled
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('courseId', liveClass.courseId)
        .eq('userId', userId)
        .single();
      hasAccess = !!enrollment;
      userRole = 'student';
      console.log('User identified as student, enrolled:', !!enrollment);
    }


    console.log('Access check:', { hasAccess, userRole, userId, instructorId: liveClass.instructorId });

    if (!hasAccess) {
      console.log('Access denied for user:', userId);
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    console.log('Access granted, returning live class data');
    res.json({
      success: true,
      liveClass: {
        ...liveClass,
        courses: course ? { title: course.title, instructorId: course.instructorId } : null,
        userRole
      }
    });
  } catch (error) {
    console.error('Error fetching live class:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Generate LiveKit token for joining
export const generateLiveKitToken = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;
    const user = req.user;

    console.log(`Generating LiveKit token for meetingId: ${meetingId}, userId: ${userId}`);

    // Get live class without joins first
    const { data: liveClass, error } = await supabase
      .from('live_classes')
      .select('*')
      .eq('meetingId', meetingId)
      .single();

    console.log('LiveKit token - Live class query result:', { liveClass, error });

    if (error || !liveClass) {
      console.log('LiveKit token - Live class not found:', error);
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    // Get course info separately
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('instructorId')
      .eq('id', liveClass.courseId)
      .single();

    console.log('LiveKit token - Course query result:', { course, courseError });

    // Determine user role
    let role = 'student';

    console.log('Token generation - Role determination:', {
      liveClassInstructorId: liveClass.instructorId,
      courseInstructorId: course?.instructorId,
      currentUserId: userId,
      userFromToken: req.user
    });

    // Check if user is admin
    if (req.user.role === 'admin') {
      role = 'admin';
      console.log('Token generation - User identified as admin');
    }
    else if (liveClass.instructorId === userId || (course && course.instructorId === userId)) {
      role = 'instructor';
      console.log('Token generation - User identified as instructor');
    } else {
      // Check if student is enrolled
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('courseId', liveClass.courseId)
        .eq('userId', userId)
        .single();

      console.log('Token generation - Enrollment check:', { enrollment });

      if (!enrollment) {
        console.log('Token generation - User not enrolled');
        return res.status(403).json({
          success: false,
          message: 'You must be enrolled in this course to join the live class'
        });
      }
      role = 'student';
      console.log('Token generation - User identified as student');
    }

    console.log('LiveKit token - Role determined:', role);

    // Generate meeting configuration (feature disabled)
    const participantName = `${user.firstName} ${user.lastName}`;

    console.log('Meeting config - Generating config for:', { meetingId, participantName, userId, role });

    const meetingConfig = {
      roomName: meetingId,
      userInfo: { displayName: participantName }
    };

    console.log('Meeting config - Generated meeting configuration:', {
      roomName: meetingConfig.roomName,
      displayName: meetingConfig.userInfo?.displayName
    });

    // For 8x8.vc, no JWT needed - it works without authentication

    // Record participation
    const { error: participationError } = await supabase
      .from('live_class_participants')
      .upsert({
        liveClassId: liveClass.id,
        userId: userId,
        joinedAt: new Date().toISOString(),
        isPresent: true
      }, {
        onConflict: 'liveClassId,userId'
      });

    if (participationError) {
      console.error('Failed to record participation:', participationError);
    }

    console.log('Meeting config - Sending response with config');
    res.json({
      success: true,
      meetingConfig: meetingConfig,
      roomName: meetingId,
      participantName,
      role,
      liveClass
    });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate meeting configuration'
    });
  }
};

// Start live class
export const startLiveClass = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    console.log(`Starting live class ${id} by instructor ${instructorId}`);

    // Get live class without join first
    const { data: liveClass, error } = await supabase
      .from('live_classes')
      .select('*')
      .eq('id', id)
      .single();

    console.log('Live class query result:', { liveClass, error });

    if (error || !liveClass) {
      console.log('Live class not found:', error);
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    // Get course separately to check instructor
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('instructorId')
      .eq('id', liveClass.courseId)
      .single();

    console.log('Course query result:', { course, courseError });

    // Check if user is the instructor
    if (liveClass.instructorId !== instructorId && (!course || course.instructorId !== instructorId)) {
      console.log('Access denied - not instructor');
      console.log('Live class instructor ID:', liveClass.instructorId);
      console.log('Course instructor ID:', course?.instructorId);
      console.log('Current user ID:', instructorId);
      return res.status(403).json({
        success: false,
        message: 'Only the instructor can start the live class. Please log in as the course instructor.'
      });
    }

    console.log('Access granted - user is instructor');

    // Update live class status
    const { data: updatedLiveClass, error: updateError } = await supabase
      .from('live_classes')
      .update({
        status: 'live',
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update live class status:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to start live class'
      });
    }

    console.log('Live class started successfully:', updatedLiveClass);
    res.json({
      success: true,
      message: 'Live class started successfully',
      liveClass: updatedLiveClass
    });
  } catch (error) {
    console.error('Error starting live class:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// End live class
export const endLiveClass = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    console.log(`Ending live class ${id} by instructor ${instructorId}`);

    // Get live class without join first
    const { data: liveClass, error } = await supabase
      .from('live_classes')
      .select('*')
      .eq('id', id)
      .single();

    console.log('Live class query result:', { liveClass, error });

    if (error || !liveClass) {
      console.log('Live class not found:', error);
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    // Get course separately to check instructor
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('instructorId')
      .eq('id', liveClass.courseId)
      .single();

    console.log('Course query result:', { course, courseError });

    // Check if user is the instructor
    if (liveClass.instructorId !== instructorId && (!course || course.instructorId !== instructorId)) {
      console.log('Access denied - not instructor');
      return res.status(403).json({
        success: false,
        message: 'Only the instructor can end the live class'
      });
    }

    console.log('Access granted - user is instructor');

    // Update live class status
    const { data: updatedLiveClass, error: updateError } = await supabase
      .from('live_classes')
      .update({
        status: 'ended',
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update live class status:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to end live class'
      });
    }

    console.log('Live class ended successfully:', updatedLiveClass);
    res.json({
      success: true,
      message: 'Live class ended successfully',
      liveClass: updatedLiveClass
    });
  } catch (error) {
    console.error('Error ending live class:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete live class
export const deleteLiveClass = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    console.log(`Attempting to delete live class ${id} by user ${instructorId}`);

    // Get live class
    const { data: liveClass, error } = await supabase
      .from('live_classes')
      .select('*')
      .eq('id', id)
      .single();

    console.log('Live class query result:', { liveClass, error });

    if (error || !liveClass) {
      console.log('Live class not found:', error);
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    // Check if user is the instructor
    if (liveClass.instructorId !== instructorId) {
      return res.status(403).json({
        success: false,
        message: 'Only the instructor can delete the live class'
      });
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('live_classes')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete live class:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete live class'
      });
    }

    console.log(`Live class ${id} deleted successfully`);
    res.json({
      success: true,
      message: 'Live class deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting live class:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Remove participant from live class
export const removeParticipant = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { id } = req.params;
    const { participantId } = req.body;
    const instructorId = req.user.id;

    // Get live class
    const { data: liveClass, error } = await supabase
      .from('live_classes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    // Check if user is the instructor
    if (liveClass.instructorId !== instructorId) {
      return res.status(403).json({
        success: false,
        message: 'Only the instructor can remove participants'
      });
    }

    // Use LiveKit server SDK to remove participant
    const { RoomServiceClient } = await import('livekit-server-sdk');
    const roomService = new RoomServiceClient(
      process.env.LIVEKIT_WS_URL,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET
    );

    await roomService.removeParticipant(liveClass.meetingId, participantId);

    res.json({
      success: true,
      message: 'Participant removed successfully'
    });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove participant'
    });
  }
};

// Get published recordings for a course
export const getPublishedRecordings = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check access to course
    let hasAccess = false;

    if (userRole === 'instructor') {
      const { data: course } = await supabase
        .from('courses')
        .select('id')
        .eq('id', courseId)
        .eq('instructorId', userId)
        .single();
      hasAccess = !!course;
    } else {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('courseId', courseId)
        .eq('userId', userId)
        .single();
      hasAccess = !!enrollment;
    }

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { data: recordings, error } = await supabase
      .from('live_class_recordings')
      .select(`
        *,
        live_classes (
          id,
          title,
          description,
          scheduledAt,
          courseId
        )
      `)
      .eq('isPublished', true)
      .eq('live_classes.courseId', courseId)
      .order('publishedAt', { ascending: false });

    if (error) {
      console.error('Error fetching published recordings:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch recordings' });
    }

    res.json({ success: true, recordings: recordings || [] });
  } catch (error) {
    console.error('Error fetching published recordings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update live class
// Update recording details
export const updateRecording = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { recordingId } = req.params;
    const { title, description } = req.body;
    const instructorId = req.user.id;

    const { data: recording, error } = await supabase
      .from('live_class_recordings')
      .select('*, live_classes(instructorId)')
      .eq('id', recordingId)
      .single();

    if (error || !recording || recording.live_classes.instructorId !== instructorId) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    const { data: updatedRecording, error: updateError } = await supabase
      .from('live_class_recordings')
      .update({
        title: title || recording.title,
        description: description || recording.description,
        updatedAt: new Date().toISOString()
      })
      .eq('id', recordingId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating recording:', updateError);
      return res.status(500).json({ success: false, message: 'Failed to update recording' });
    }

    res.json({
      success: true,
      message: 'Recording updated successfully',
      recording: updatedRecording
    });
  } catch (error) {
    console.error('Error updating recording:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateLiveClass = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { id } = req.params;
    const { title, description, scheduledAt, duration, maxParticipants, isRecorded } = req.body;
    const instructorId = req.user.id;

    // Get live class
    const { data: liveClass, error } = await supabase
      .from('live_classes')
      .select(`
        *,
        courses (instructorId)
      `)
      .eq('id', id)
      .single();

    if (error || !liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    // Check if user is the instructor
    if (liveClass.instructorId !== instructorId && liveClass.courses.instructorId !== instructorId) {
      return res.status(403).json({
        success: false,
        message: 'Only the instructor can update the live class'
      });
    }

    // Don't allow updates if class is live
    if (liveClass.status === 'live') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update live class while it is in progress'
      });
    }

    // Update live class
    const { data: updatedLiveClass, error: updateError } = await supabase
      .from('live_classes')
      .update({
        title,
        description,
        scheduledAt,
        duration,
        maxParticipants,
        isRecorded,
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update live class:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update live class'
      });
    }

    res.json({
      success: true,
      message: 'Live class updated successfully',
      liveClass: updatedLiveClass
    });
  } catch (error) {
    console.error('Error updating live class:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Start recording
export const startRecording = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    console.log(`Starting recording for live class ${id} by instructor ${instructorId}`);

    const { data: liveClass, error } = await supabase
      .from('live_classes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database error fetching live class:', error);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (!liveClass) {
      return res.status(404).json({ success: false, message: 'Live class not found' });
    }

    if (liveClass.instructorId !== instructorId) {
      return res.status(403).json({ success: false, message: 'Only the instructor can start recording' });
    }

    // Allow recording for any status in development
    console.log(`Live class status: ${liveClass.status}`);

    // Check if already recording
    if (liveClass.recordingId) {
      return res.status(400).json({ success: false, message: 'Recording already in progress' });
    }

    const recordingId = `recording-${liveClass.id}-${Date.now()}`;
    console.log(`Starting LiveKit recording with ID: ${recordingId}`);

    // Recording feature disabled
    const recordingResponse = { recordingId };

    const { data: recording, error: insertError } = await supabase
      .from('live_class_recordings')
      .insert({
        liveClassId: liveClass.id,
        recordingId: recordingResponse.recordingId,
        title: `${liveClass.title} - Recording`,
        status: 'processing'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting recording:', insertError);
      return res.status(500).json({ success: false, message: 'Failed to save recording info' });
    }

    const { error: updateError } = await supabase
      .from('live_classes')
      .update({ recordingId: recordingResponse.recordingId })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating live class:', updateError);
    }

    console.log('Recording started successfully:', recording);
    res.json({ success: true, message: 'Recording started successfully', recording });
  } catch (error) {
    console.error('Error starting recording:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start recording',
      error: error.message
    });
  }
};

// Stop recording
export const stopRecording = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    const { data: liveClass, error } = await supabase
      .from('live_classes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !liveClass || !liveClass.recordingId || liveClass.instructorId !== instructorId) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    // Stop recording (feature disabled)

    // Get recording info to store download URL
    let downloadUrl = null;
    try {
      // Recording info (feature disabled)
      const recordingInfo = null;
      if (recordingInfo && recordingInfo.file) {
        downloadUrl = recordingInfo.file.download_url || recordingInfo.file.filename;
      }
    } catch (infoError) {
      console.log('Could not get recording info:', infoError.message);
    }

    // Update recording status and store download URL
    await supabase
      .from('live_class_recordings')
      .update({
        status: 'ready',
        downloadUrl: downloadUrl,
        updatedAt: new Date().toISOString()
      })
      .eq('recordingId', liveClass.recordingId);

    await supabase
      .from('live_classes')
      .update({ recordingId: null })
      .eq('id', id);

    res.json({ success: true, message: 'Recording stopped and ready for review' });
  } catch (error) {
    console.error('Error stopping recording:', error);
    res.status(500).json({ success: false, message: 'Failed to stop recording' });
  }
};

// Publish recording
export const publishRecording = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { recordingId } = req.params;
    const { title, description } = req.body;
    const instructorId = req.user.id;

    const { data: recording, error } = await supabase
      .from('live_class_recordings')
      .select('*, live_classes(instructorId)')
      .eq('id', recordingId)
      .single();

    if (error || !recording || recording.live_classes.instructorId !== instructorId) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    if (recording.status !== 'ready') {
      return res.status(400).json({ success: false, message: 'Recording not ready for publishing' });
    }

    try {
      // Recording info (feature disabled)
      const recordingInfo = { file: { filename: null } };
      const publicId = `live-class-${recording.liveClassId}-${Date.now()}`;

      const cloudinaryResult = await CloudinaryService.uploadVideo(
        recordingInfo.file.filename,
        publicId
      );

      // Generate thumbnail
      const thumbnailUrl = await CloudinaryService.generateThumbnail(cloudinaryResult.publicId);

      const { data: updatedRecording } = await supabase
        .from('live_class_recordings')
        .update({
          title: title || recording.title,
          description,
          cloudinaryUrl: cloudinaryResult.url,
          cloudinaryPublicId: cloudinaryResult.publicId,
          thumbnailUrl,
          duration: cloudinaryResult.duration,
          fileSize: cloudinaryResult.bytes,
          status: 'published',
          isPublished: true,
          publishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .eq('id', recordingId)
        .select()
        .single();

      res.json({
        success: true,
        message: 'Recording published successfully',
        recording: updatedRecording
      });
    } catch (uploadError) {
      console.error('Error uploading to Cloudinary:', uploadError);

      // Update status to failed
      await supabase
        .from('live_class_recordings')
        .update({
          status: 'failed',
          updatedAt: new Date().toISOString()
        })
        .eq('id', recordingId);

      res.status(500).json({
        success: false,
        message: 'Failed to upload recording to cloud storage'
      });
    }
  } catch (error) {
    console.error('Error publishing recording:', error);
    res.status(500).json({ success: false, message: 'Failed to publish recording' });
  }
};

// Get recordings for a live class
export const getRecordings = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const { data: liveClass, error } = await supabase
      .from('live_classes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !liveClass) {
      return res.status(404).json({ success: false, message: 'Live class not found' });
    }

    // Get course info separately
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('instructorId')
      .eq('id', liveClass.courseId)
      .single();

    let hasAccess = liveClass.instructorId === userId || (course && course.instructorId === userId);
    let isInstructor = hasAccess;

    if (!hasAccess) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('courseId', liveClass.courseId)
        .eq('userId', userId)
        .single();
      hasAccess = !!enrollment;
    }

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Students can only see published recordings
    let query = supabase
      .from('live_class_recordings')
      .select('*')
      .eq('liveClassId', id);

    if (!isInstructor) {
      query = query.eq('isPublished', true);
    }

    const { data: recordings } = await query.order('createdAt', { ascending: false });

    res.json({
      success: true,
      recordings: recordings || [],
      userRole: isInstructor ? 'instructor' : 'student'
    });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get instructor's recordings for review
export const getInstructorRecordings = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const instructorId = req.user.id;
    const { status } = req.query;

    let query = supabase
      .from('live_class_recordings')
      .select(`
        *,
        live_classes (
          id,
          title,
          courseId,
          courses (
            title
          )
        )
      `)
      .eq('live_classes.instructorId', instructorId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: recordings, error } = await query
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('Error fetching instructor recordings:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch recordings' });
    }

    res.json({ success: true, recordings: recordings || [] });
  } catch (error) {
    console.error('Error fetching instructor recordings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Delete recording
export const deleteRecording = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { recordingId } = req.params;
    const instructorId = req.user.id;

    const { data: recording, error } = await supabase
      .from('live_class_recordings')
      .select('*, live_classes(instructorId)')
      .eq('id', recordingId)
      .single();

    if (error || !recording || recording.live_classes.instructorId !== instructorId) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    // Delete from Cloudinary if exists
    if (recording.cloudinaryPublicId) {
      try {
        await CloudinaryService.deleteVideo(recording.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.error('Error deleting from Cloudinary:', cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('live_class_recordings')
      .delete()
      .eq('id', recordingId);

    if (deleteError) {
      console.error('Error deleting recording from database:', deleteError);
      return res.status(500).json({ success: false, message: 'Failed to delete recording' });
    }

    res.json({ success: true, message: 'Recording deleted successfully' });
  } catch (error) {
    console.error('Error deleting recording:', error);
    res.status(500).json({ success: false, message: 'Failed to delete recording' });
  }
};

// Download recording
export const downloadRecording = async (req, res) => {
  return res.status(503).json({ success: false, message: 'Live class feature is currently disabled' });
  try {
    const { recordingId } = req.params;
    const instructorId = req.user.id;

    const { data: recording, error } = await supabase
      .from('live_class_recordings')
      .select('*, live_classes(instructorId)')
      .eq('id', recordingId)
      .single();

    if (error || !recording || recording.live_classes.instructorId !== instructorId) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    if (recording.status === 'processing') {
      return res.status(400).json({
        success: false,
        message: 'Recording is still processing. Please try again later.'
      });
    }

    // Priority 1: Use Cloudinary URL if available (published recordings)
    if (recording.cloudinaryUrl) {
      return res.json({
        success: true,
        downloadUrl: recording.cloudinaryUrl,
        filename: `${recording.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`,
        fileSize: recording.fileSize,
        duration: recording.duration
      });
    }

    // Priority 2: Use stored download URL (ready recordings)
    if (recording.downloadUrl) {
      return res.json({
        success: true,
        downloadUrl: recording.downloadUrl,
        filename: `${recording.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`,
        fileSize: recording.fileSize,
        duration: recording.duration
      });
    }

    // Priority 3: Feature disabled - no fallback available
    const recordingInfo = null;

    if (recordingInfo && recordingInfo.file) {
      return res.json({
        success: true,
        downloadUrl: recordingInfo.file.download_url || recordingInfo.file.filename,
        filename: `${recording.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`,
        fileSize: recording.fileSize,
        duration: recording.duration
      });
    }

    // No download available
    return res.status(404).json({
      success: false,
      message: 'Recording file not available.'
    });
  } catch (error) {
    console.error('Error getting download URL:', error);
    res.status(500).json({ success: false, message: 'Failed to get download URL' });
  }
};