import express from 'express';
import { createNote, getNotes, deleteNote, getCourseNotes, getChapterNotes, getTextLectureNotes, getCourseTextLectureNotes } from '../controllers/notesController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticate, createNote);
router.get('/:videoId', authenticate, getNotes);
router.get('/text-lecture/:textLectureId', authenticate, getTextLectureNotes);
router.get('/text-lecture/course/:courseId', authenticate, getCourseTextLectureNotes);
router.delete('/:noteId', authenticate, deleteNote);
router.get('/course/:courseId', authenticate, getCourseNotes);
router.get('/chapter/:chapterId', authenticate, getChapterNotes);

export default router;