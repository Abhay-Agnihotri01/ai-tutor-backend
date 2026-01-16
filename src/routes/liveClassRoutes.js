import express from 'express';
import {
  createLiveClass,
  getLiveClassesByCourse,
  getLiveClassByMeetingId,
  generateLiveKitToken,
  startLiveClass,
  endLiveClass,
  deleteLiveClass,
  updateLiveClass,
  removeParticipant,
  startRecording,
  stopRecording,
  publishRecording,
  getRecordings,
  downloadRecording,
  getPublishedRecordings,
  getInstructorRecordings,
  deleteRecording,
  updateRecording
} from '../controllers/liveClassController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Live Class features are currently disabled
router.use((req, res) => {
  res.status(503).json({
    success: false,
    message: 'Live class features are currently disabled',
    marketingMessage: 'Live Classes are Coming Soon!'
  });
});

/*
// Test route (no auth required)
router.get('/test', (req, res) => {
  res.json({ message: 'Live class routes working', timestamp: new Date().toISOString() });
});

// Direct test for start route (no auth required)
router.patch('/test-start/:id', (req, res) => {
  res.json({ 
    message: 'Start route pattern matched', 
    id: req.params.id,
    timestamp: new Date().toISOString() 
  });
});

// Debug route to check table existence
router.get('/debug/tables', async (req, res) => {
  try {
    const { default: supabase } = await import('../config/supabase.js');
    
    const { data: liveClasses, error: liveClassError } = await supabase
      .from('live_classes')
      .select('id')
      .limit(1);
    
    const { data: participants, error: participantsError } = await supabase
      .from('live_class_participants')
      .select('id')
      .limit(1);
    
    res.json({
      tablesExist: {
        live_classes: !liveClassError,
        live_class_participants: !participantsError
      },
      errors: {
        live_classes: liveClassError?.message,
        live_class_participants: participantsError?.message
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug auth endpoint (with auth required)
router.get('/debug/auth', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Authentication working',
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      firstName: req.user.firstName,
      lastName: req.user.lastName
    },
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to test the exact start route with auth
router.patch('/debug/start/:id', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Start route with auth working',
    liveClassId: req.params.id,
    user: {
      id: req.user.id,
      role: req.user.role
    },
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to check if a live class exists (no auth required)
router.get('/debug/exists/:id', async (req, res) => {
  try {
    const { default: supabase } = await import('../config/supabase.js');
    
    const { data: liveClass, error } = await supabase
      .from('live_classes')
      .select('id, title, status, instructorId')
      .eq('id', req.params.id)
      .single();
    
    res.json({
      exists: !error && !!liveClass,
      liveClass: liveClass || null,
      error: error?.message || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log(`=== LIVE CLASS ROUTE: ${req.method} ${req.path} ===`);
  console.log('Params:', req.params);
  console.log('Query:', req.query);
  console.log('Auth header:', req.headers.authorization ? 'Present' : 'Missing');
  next();
});

// All routes below require authentication
router.use(authenticate);

// Recording routes - MUST come before generic /:id routes
router.post('/:id/recording/start', startRecording);
router.post('/:id/recording/stop', stopRecording);
router.get('/:id/recordings', getRecordings);
router.post('/recordings/:recordingId/publish', publishRecording);
router.get('/recordings/:recordingId/download', downloadRecording);
router.put('/recordings/:recordingId', updateRecording);
router.delete('/recordings/:recordingId', deleteRecording);
router.get('/instructor/recordings', getInstructorRecordings);
router.get('/course/:courseId/published-recordings', getPublishedRecordings);

// Specific action routes MUST come before generic /:id routes
router.patch('/:id/start', startLiveClass);
router.patch('/:id/end', endLiveClass);

// Create live class
router.post('/', createLiveClass);

// Get live classes by course
router.get('/course/:courseId', getLiveClassesByCourse);

// Get live class by meeting ID
router.get('/meeting/:meetingId', getLiveClassByMeetingId);

// Generate LiveKit token for joining
router.post('/token/:meetingId', generateLiveKitToken);

// Update live class
router.put('/:id', updateLiveClass);

// Remove participant from live class
router.post('/:id/remove-participant', removeParticipant);

// Delete live class
router.delete('/:id', deleteLiveClass);
*/

export default router;