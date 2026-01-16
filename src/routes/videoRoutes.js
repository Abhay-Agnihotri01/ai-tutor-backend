import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { uploadVideo, getVideosByChapter, deleteVideo, upload } from '../controllers/videoController.js';

const router = express.Router();

// Upload video (POST /api/videos)
router.post('/', authenticateToken, upload.single('video'), uploadVideo);

// Get videos by chapter
router.get('/chapter/:chapterId', authenticateToken, getVideosByChapter);

// Delete video
router.delete('/:videoId', authenticateToken, deleteVideo);

export default router;