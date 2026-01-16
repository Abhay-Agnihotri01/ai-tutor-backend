import express from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createQuiz,
  addQuizQuestion,
  getQuiz,
  getQuizzesByChapter,
  getQuizAttemptStatus,
  getQuizDetails,
  updateQuiz,
  getQuizSubmissions,
  startQuizAttempt,
  submitAssignment,
  submitQuizAttempt,
  getUserQuizAttempts,
  gradeSubmission,
  deleteQuiz
} from '../controllers/quizController.js';

const router = express.Router();

// Configure multer for assignment file uploads
const assignmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/assignments/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'assignment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadAssignment = multer({
  storage: assignmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|txt|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, TXT, ZIP, and RAR files are allowed'));
    }
  }
});

router.use(authenticate);

// Quiz management (instructors only)
router.post('/', authorize('instructor', 'admin'), createQuiz);
router.post('/:quizId/questions', authorize('instructor', 'admin'), addQuizQuestion);
router.get('/quizzes/:quizId', authorize('instructor', 'admin'), getQuizDetails);
router.put('/quizzes/:quizId', authorize('instructor', 'admin'), updateQuiz);
router.get('/submissions/:quizId', authorize('instructor', 'admin'), getQuizSubmissions);
router.put('/grade/:submissionId', authorize('instructor', 'admin'), gradeSubmission);
router.delete('/quizzes/:quizId', authorize('instructor', 'admin'), deleteQuiz);

// Quiz taking (students and instructors)
router.get('/:id', getQuiz);
router.get('/chapter/:chapterId', getQuizzesByChapter);
router.get('/attempt/status/:quizId', getQuizAttemptStatus);
router.post('/attempt/start', startQuizAttempt);
router.post('/assignment/submit', uploadAssignment.single('assignment'), submitAssignment);
router.post('/:quizId/attempts', submitQuizAttempt);
router.get('/:quizId/attempts/user', getUserQuizAttempts);

export default router;