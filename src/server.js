import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import path from 'path';
import dotenv from 'dotenv';
import multer from 'multer';
import { createServer } from 'http';
import supabase from './config/supabase.js';
import socketService from './services/socketService.js';
import { trackActivity } from './middleware/activityTracker.js';

import authRoutes from './routes/authRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import enrollmentRoutes from './routes/enrollmentRoutes.js';
import instructorRoutes from './routes/instructorRoutes.js';
import chapterRoutes from './routes/chapterRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';
import downloadRoutes from './routes/downloadRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import qaRoutes from './routes/qaRoutes.js';
import certificateRoutes from './routes/certificateRoutes.js';
import notesRoutes from './routes/notesRoutes.js';
import textLectureRoutes from './routes/textLectureRoutes.js';
import textLectureNotesRoutes from './routes/textLectureNotesRoutes.js';
import liveClassRoutes from './routes/liveClassRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import setupRoutes from './routes/setupRoutes.js';
import payoutRoutes from './routes/payoutRoutes.js';
import userRoutes from './routes/userRoutes.js';
import discussionRoutes from './routes/discussionRoutes.js';
import adminCommunicationRoutes from './routes/adminCommunication.js';
import groupChatRoutes from './routes/groupChatRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import tempSetupRoutes from './routes/tempSetupRoutes.js';
import activityRoutes from './routes/activityRoutes.js';

import passport from './config/passport.js';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Temp setup routes
app.use('/api/setup', tempSetupRoutes);

// Activity routes

// Test endpoints - MUST be first, before any middleware
app.get('/test-simple', (req, res) => {
  res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
});

app.post('/test-note-creation', async (req, res) => {
  try {
    const { data: note, error } = await supabase
      .from('text_lecture_notes')
      .insert([{
        textLectureId: 1,
        courseId: 1,
        userId: 1,
        content: 'Test note content',
        type: 'text',
        createdAt: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Test note creation error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, note });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:", "https://res.cloudinary.com"],
      frameAncestors: ["'self'", process.env.CLIENT_URL || "http://localhost:5173", "http://localhost:3000"]
    }
  }
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // increased limit for development
  skip: (req) => req.path.includes('/mock/') // skip rate limiting for mock endpoints
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Activity routes (must be after body parser)
app.use('/api/activity', cors({ origin: true, credentials: true }), activityRoutes);
app.use('/api/admin-communications', cors({ origin: true, credentials: true }), adminCommunicationRoutes);

// Session middleware for OAuth
app.use(session({
  secret: process.env.JWT_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Static files for existing thumbnails (legacy support)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Set proper MIME types for different file types
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
  }
}));



// Passport middleware
app.use(passport.initialize());

// Test endpoints (before auth middleware)
app.get('/api/test-text-lecture-notes', async (req, res) => {
  try {
    // Try to insert a test record to see the actual column types
    const { data, error } = await supabase
      .from('text_lecture_notes')
      .insert([{
        textLectureId: '550e8400-e29b-41d4-a716-446655440000',
        courseId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        content: 'Test content',
        type: 'text'
      }])
      .select()
      .single();

    if (error) {
      return res.json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details
      });
    }

    // Delete the test record
    await supabase.from('text_lecture_notes').delete().eq('id', data.id);

    res.json({
      success: true,
      message: 'Table has correct UUID columns',
      testData: data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/test-create-text-note', async (req, res) => {
  try {
    const { data: note, error } = await supabase
      .from('text_lecture_notes')
      .insert([{
        textLectureId: 1,
        courseId: 1,
        userId: 1,
        content: 'Test note content',
        type: 'text',
        createdAt: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Test note creation error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, note });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoints (before auth middleware)
app.get('/api/debug/question-table', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .limit(1);

    res.json({
      success: true,
      message: 'Questions table accessible',
      sampleData: data
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: 'Failed to access questions table'
    });
  }
});

app.post('/api/debug/test-submission', (req, res) => {
  console.log('=== TEST SUBMISSION RECEIVED ===');
  console.log('Body:', req.body);
  res.json({ success: true, message: 'Test submission received' });
});

app.get('/api/debug/test-question-model', async (req, res) => {
  try {
    const { Question, Quiz } = await import('./models/index.js');

    // First check if we have a valid quiz
    const quiz = await Quiz.findOne();
    if (!quiz) {
      return res.status(400).json({ error: 'No quiz found to test with' });
    }

    // Test basic question creation
    const testData = {
      quizId: quiz.id,
      question: 'Test question',
      type: 'mcq',
      options: ['Option A', 'Option B'],
      correctAnswer: 'Option A',
      marks: 1,
      order: 1
    };

    console.log('Testing question creation with:', testData);

    const question = await Question.create(testData);

    res.json({
      success: true,
      question,
      message: 'Question model test successful'
    });
  } catch (error) {
    console.error('Question model test error:', error);
    res.status(500).json({
      error: error.message,
      name: error.name,
      sql: error.sql,
      stack: error.stack
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test notification endpoint (no auth required)
app.get('/api/notifications/test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Notification system is working',
    timestamp: new Date().toISOString()
  });
});

// Test communication tables (no auth required)
app.get('/api/test/communication-tables', async (req, res) => {
  try {
    // Test if admin_communications table exists
    const { data: commTest, error: commError } = await supabase
      .from('admin_communications')
      .select('id')
      .limit(1);

    // Test if admin_communication_replies table exists
    const { data: repliesTest, error: repliesError } = await supabase
      .from('admin_communication_replies')
      .select('id')
      .limit(1);

    res.json({
      admin_communications: {
        exists: !commError || commError.code !== 'PGRST116',
        error: commError?.message
      },
      admin_communication_replies: {
        exists: !repliesError || repliesError.code !== 'PGRST116',
        error: repliesError?.message
      },
      message: 'Communication tables check completed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// Test creating a question manually
app.post('/api/debug/create-test-question/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;

    // First check if quiz exists
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('id, title')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      return res.status(404).json({ error: 'Quiz not found', quizError });
    }

    // Create a test question
    const { data: question, error: questionError } = await supabase
      .from('quiz_questions')
      .insert({
        "quizId": quizId,
        "questionText": 'Test question: What is 2+2?',
        "questionType": 'single_correct',
        points: 1
      })
      .select()
      .single();

    if (questionError) {
      return res.status(500).json({ error: 'Failed to create question', questionError });
    }

    // Create test options
    const optionsData = [
      { "questionId": question.id, "optionText": '3', "isCorrect": false, "orderIndex": 0 },
      { "questionId": question.id, "optionText": '4', "isCorrect": true, "orderIndex": 1 },
      { "questionId": question.id, "optionText": '5', "isCorrect": false, "orderIndex": 2 }
    ];

    const { data: options, error: optionsError } = await supabase
      .from('quiz_options')
      .insert(optionsData)
      .select();

    if (optionsError) {
      return res.status(500).json({ error: 'Failed to create options', optionsError });
    }

    // Update quiz totalMarks
    await supabase
      .from('quizzes')
      .update({ "totalMarks": 1 })
      .eq('id', quizId);

    res.json({
      success: true,
      quiz,
      question,
      options,
      message: 'Test question created successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test quiz tables
app.get('/api/debug/test-quiz-tables', async (req, res) => {
  try {
    // Test if tables exist
    const { data: quizzes, error: quizzesError } = await supabase
      .from('quizzes')
      .select('id, title')
      .limit(1);

    const { data: questions, error: questionsError } = await supabase
      .from('quiz_questions')
      .select('id, "questionText"')
      .limit(1);

    const { data: options, error: optionsError } = await supabase
      .from('quiz_options')
      .select('id, "optionText"')
      .limit(1);

    res.json({
      tablesExist: {
        quizzes: !quizzesError,
        quiz_questions: !questionsError,
        quiz_options: !optionsError
      },
      errors: {
        quizzes: quizzesError?.message,
        quiz_questions: questionsError?.message,
        quiz_options: optionsError?.message
      },
      sampleData: {
        quizzes: quizzes || [],
        questions: questions || [],
        options: options || []
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug quiz creation
app.get('/api/debug/quiz/:quizId', async (req, res) => {
  try {
    const { Quiz, Question, Chapter, Course } = await import('./models/index.js');
    const quiz = await Quiz.findByPk(req.params.quizId, {
      include: [{
        model: Chapter,
        as: 'chapter',
        include: [{
          model: Course,
          as: 'course'
        }]
      }, {
        model: Question,
        as: 'questions'
      }]
    });
    res.json({ quiz });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug database tables
app.get('/api/debug/tables', async (req, res) => {
  try {
    const tables = ['users', 'courses', 'chapters', 'videos', 'resources', 'enrollments', 'quizzes', 'questions', 'quiz_attempts', 'question_responses'];

    res.json({
      tables,
      message: 'Supabase tables listed successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test question creation
app.post('/api/debug/test-question', async (req, res) => {
  try {
    const { Question, Quiz } = await import('./models/index.js');
    const testQuestion = await Question.create({
      quizId: req.body.quizId,
      question: 'Test question',
      type: 'single_correct',
      options: ['Option 1', 'Option 2'],
      correctAnswer: 'Option 1',
      marks: 1,
      order: 1
    });

    // Update quiz total marks
    const quiz = await Quiz.findByPk(req.body.quizId);
    if (quiz) {
      await quiz.increment('totalMarks', { by: 1 });
    }

    res.json({ success: true, question: testQuestion });
  } catch (error) {
    console.error('Test question error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Test quiz readiness
app.get('/api/debug/quiz-ready/:quizId', async (req, res) => {
  try {
    const { Quiz, Question } = await import('./models/index.js');
    const quiz = await Quiz.findByPk(req.params.quizId, {
      include: [{
        model: Question,
        as: 'questions'
      }]
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const isReady = quiz.type === 'assignment' || (quiz.type === 'quiz' && quiz.questions && quiz.questions.length > 0);

    res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        type: quiz.type,
        totalMarks: quiz.totalMarks,
        questionCount: quiz.questions?.length || 0,
        isReady
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});





// Debug rating route (before other routes)
app.get('/api/ratings/test', (req, res) => {
  res.json({ message: 'Rating routes working', timestamp: new Date().toISOString() });
});

// Debug endpoint
app.get('/api/debug/user/:id', async (req, res) => {
  try {
    const { User } = await import('./models/index.js');
    const user = await User.findByPk(req.params.id);
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug video files
app.get('/api/debug/videos', (req, res) => {
  const fs = require('fs');
  const videoDir = path.join(process.cwd(), 'uploads', 'videos');
  try {
    const files = fs.readdirSync(videoDir);
    res.json({ videoFiles: files, videoDir });
  } catch (error) {
    res.json({ error: error.message, videoDir });
  }
});

// Debug assignment files
app.get('/api/debug/assignments', (req, res) => {
  const fs = require('fs');
  const assignmentDir = path.join(process.cwd(), 'uploads', 'assignments');
  try {
    const files = fs.readdirSync(assignmentDir);
    const fileDetails = files.map(file => {
      const filePath = path.join(assignmentDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        url: `/uploads/assignments/${file}`,
        fullUrl: `${req.protocol}://${req.get('host')}/uploads/assignments/${file}`
      };
    });
    res.json({ assignmentFiles: fileDetails, assignmentDir });
  } catch (error) {
    res.json({ error: error.message, assignmentDir });
  }
});

// Debug quiz totalMarks (public endpoint)
app.get('/api/debug/quiz-marks/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;

    const { data: quiz } = await supabase
      .from('quizzes')
      .select('id, title, type, totalMarks, createdAt, updatedAt')
      .eq('id', quizId)
      .single();

    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('id, userId, score, totalMarks, status, createdAt')
      .eq('quizId', quizId);

    res.json({
      quiz: quiz || null,
      attempts: attempts || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug chapters for specific course
app.get('/api/debug/chapters/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { data, error } = await supabase
      .from('chapters')
      .select(`
        *,
        videos (*),
        resources (*)
      `)
      .eq('courseId', courseId)
      .order('order', { ascending: true });

    res.json({
      success: true,
      message: 'Chapters data for course',
      courseId,
      chapters: data,
      error: error
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: 'Failed to get chapters'
    });
  }
});

// Debug videos table
app.get('/api/debug/videos-table', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('id, title, videoUrl, thumbnailUrl, duration')
      .limit(5);

    res.json({
      success: true,
      message: 'Videos table accessible',
      sampleData: data,
      error: error
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: 'Failed to access videos table'
    });
  }
});

// Debug resources table
app.get('/api/debug/resources-table', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .limit(10);

    res.json({
      success: true,
      message: 'Resources table accessible',
      sampleData: data,
      error: error
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: 'Failed to access resources table'
    });
  }
});

// Debug endpoint to fix resource URLs missing extensions
app.post('/api/debug/fix-resource-urls', async (req, res) => {
  try {
    // Get all resources with Cloudinary URLs
    const { data: resources, error } = await supabase
      .from('resources')
      .select('*')
      .like('fileUrl', '%cloudinary.com%');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const fixedResources = [];

    for (const resource of resources) {
      if (resource.fileUrl && resource.fileName) {
        const urlParts = resource.fileUrl.split('/');
        const filename = urlParts[urlParts.length - 1];

        // Check if URL is missing extension but fileName has one
        if (!filename.includes('.') && resource.fileName.includes('.')) {
          const extension = resource.fileName.split('.').pop();
          const newUrl = `${resource.fileUrl}.${extension}`;

          // Update the resource
          const { error: updateError } = await supabase
            .from('resources')
            .update({ fileUrl: newUrl })
            .eq('id', resource.id);

          if (!updateError) {
            fixedResources.push({
              id: resource.id,
              title: resource.title,
              oldUrl: resource.fileUrl,
              newUrl: newUrl
            });
          }
        }
      }
    }

    res.json({
      message: `Fixed ${fixedResources.length} resource URLs`,
      fixedResources
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test resource upload endpoint
app.post('/api/debug/test-resource-upload', (req, res) => {
  console.log('=== TEST RESOURCE UPLOAD ===');
  console.log('Body:', req.body);
  console.log('Files:', req.files);
  console.log('File:', req.file);
  console.log('Headers:', req.headers);
  res.json({
    success: true,
    body: req.body,
    hasFile: !!req.file,
    file: req.file ? {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    } : null
  });
});

// Check video progress table structure
app.get('/api/debug/video-progress-structure', async (req, res) => {
  try {
    // Try to select all columns to see what exists
    const { data: progressData, error } = await supabase
      .from('video_progress')
      .select('*')
      .limit(1);

    res.json({
      success: !error,
      columns: progressData?.[0] ? Object.keys(progressData[0]) : [],
      sampleData: progressData?.[0] || null,
      error: error?.message
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create live class tables (debug endpoint)
app.get('/api/debug/create-live-class-tables', async (req, res) => {
  try {
    // Create live_classes table
    const { error: error1 } = await supabase
      .from('live_classes')
      .select('id')
      .limit(1);

    if (error1 && error1.code === 'PGRST116') {
      // Table doesn't exist, create it using raw SQL
      const createTablesSQL = `
        CREATE TABLE IF NOT EXISTS live_classes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "courseId" UUID NOT NULL,
          "chapterId" UUID,
          "instructorId" UUID NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          "scheduledAt" TIMESTAMPTZ NOT NULL,
          duration INTEGER NOT NULL DEFAULT 60,
          "meetingUrl" VARCHAR(500),
          "meetingId" VARCHAR(100),
          status VARCHAR(20) DEFAULT 'scheduled',
          "maxParticipants" INTEGER DEFAULT 100,
          "isRecorded" BOOLEAN DEFAULT false,
          "recordingUrl" VARCHAR(500),
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS live_class_participants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "liveClassId" UUID NOT NULL,
          "userId" UUID NOT NULL,
          "joinedAt" TIMESTAMPTZ,
          "leftAt" TIMESTAMPTZ,
          "isPresent" BOOLEAN DEFAULT false,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE("liveClassId", "userId")
        );
      `;

      res.json({
        success: false,
        message: 'Tables need to be created manually in Supabase',
        sql: createTablesSQL,
        instructions: 'Copy the SQL above and run it in your Supabase SQL Editor'
      });
    } else {
      res.json({
        success: true,
        message: 'Live class tables already exist'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug assignment issue (public endpoint)
app.get('/api/debug/assignment/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;

    const { data: quiz } = await supabase
      .from('quizzes')
      .select('id, title, type, totalMarks, createdAt, updatedAt')
      .eq('id', quizId)
      .single();

    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('id, userId, score, totalMarks, status, createdAt')
      .eq('quizId', quizId);

    const { data: submissions } = await supabase
      .from('quiz_attempts')
      .select(`
        *,
        users (
          firstName,
          lastName,
          email
        ),
        quizzes (
          totalMarks
        )
      `)
      .eq('quizId', quizId)
      .in('status', ['completed', 'graded'])
      .order('submittedAt', { ascending: false });

    res.json({
      quiz: quiz || null,
      attempts: attempts || [],
      submissionsForGrading: submissions || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fix assignment totalMarks (public endpoint)
app.get('/api/debug/fix-assignment/:quizId/:totalMarks', async (req, res) => {
  try {
    const { quizId, totalMarks } = req.params;
    const marks = parseInt(totalMarks);

    if (isNaN(marks) || marks <= 0) {
      return res.status(400).json({ error: 'Invalid totalMarks value' });
    }

    // Update quiz totalMarks
    await supabase
      .from('quizzes')
      .update({ totalMarks: marks })
      .eq('id', quizId);

    // Get all attempts for this quiz
    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('id, score')
      .eq('quizId', quizId);

    // Update all attempts with new totalMarks and recalculated percentage
    for (const attempt of attempts || []) {
      const percentage = marks > 0 ? (attempt.score / marks) * 100 : 0;
      await supabase
        .from('quiz_attempts')
        .update({
          totalMarks: marks,
          percentage
        })
        .eq('id', attempt.id);
    }

    res.json({
      success: true,
      message: `Assignment totalMarks updated to ${marks}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/text-lecture-notes', textLectureNotesRoutes);
app.use('/api/text-lectures', textLectureRoutes);
app.use('/api/live-classes', liveClassRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/users', userRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/admin-communications', adminCommunicationRoutes);
app.use('/api/group-chat', groupChatRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/videos', videoRoutes);

// Test admin communications endpoint (no auth required)
app.get('/api/test/admin-communications', (req, res) => {
  res.json({
    message: 'Admin communications route is accessible',
    timestamp: new Date().toISOString()
  });
});

// Test the exact endpoint that's failing (no auth)
app.get('/api/admin-communications/test', (req, res) => {
  res.json({
    message: 'Admin communications /communications route is working',
    timestamp: new Date().toISOString()
  });
});

// Debug enrollments
app.get('/api/debug/enrollments', async (req, res) => {
  try {
    const { Enrollment, Course, User } = await import('./models/index.js');
    const enrollments = await Enrollment.findAll({
      include: [{
        model: Course,
        include: [{
          model: User,
          as: 'instructor',
          attributes: ['firstName', 'lastName']
        }]
      }]
    });
    res.json({
      count: enrollments.length,
      enrollments: enrollments.map(e => ({
        id: e.id,
        userId: e.userId,
        courseId: e.courseId,
        courseTitle: e.Course?.title,
        coursePublished: e.Course?.isPublished,
        enrolledAt: e.enrolledAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug specific user enrollments
app.get('/api/debug/enrollments/:userId', async (req, res) => {
  try {
    const { Enrollment, Course, User } = await import('./models/index.js');
    const { userId } = req.params;

    const enrollments = await Enrollment.findAll({
      where: { userId },
      include: [{
        model: Course,
        include: [{
          model: User,
          as: 'instructor',
          attributes: ['firstName', 'lastName']
        }]
      }]
    });

    res.json({
      userId,
      count: enrollments.length,
      enrollments: enrollments.map(e => ({
        id: e.id,
        courseTitle: e.Course?.title,
        coursePublished: e.Course?.isPublished,
        enrolledAt: e.enrolledAt,
        progress: e.progress
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Multer error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

// General error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Database connection and server start
const startServer = async () => {
  try {
    // Test Supabase connection
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist, which is fine
      throw error;
    }
    console.log('Supabase connected successfully');

    // Check and create live class tables if they don't exist
    try {
      const { error: checkError } = await supabase.from('live_classes').select('id').limit(1);
      if (checkError && checkError.code === 'PGRST116') {
        console.log('Live class tables not found. Please create them manually in Supabase:');
        console.log(`Visit: http://localhost:${PORT}/api/debug/create-live-class-tables for SQL`);
      }
    } catch (tableError) {
      // Ignore table check errors
    }

    // Initialize Socket.IO
    socketService.initialize(server);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Server accessible on all network interfaces');
      console.log('Socket.IO initialized for live classes');
      console.log('Note: Make sure to run the database migration script to create tables');
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();