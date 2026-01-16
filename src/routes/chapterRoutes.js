import express from 'express';
import multer from 'multer';
import { createChapter, getCourseChapters, createVideo, deleteVideo, deleteChapter, updateChapter, updateVideo, replaceVideo, reorderChapters, reorderVideos } from '../controllers/chapterController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { videoStorage } from '../config/cloudinary.js';

const router = express.Router();

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

router.use(authenticate);
router.use(authorize('instructor', 'admin'));

router.post('/', createChapter);
router.put('/reorder', reorderChapters);
router.get('/courses/:courseId', getCourseChapters);
router.put('/:id', updateChapter);
router.delete('/:id', deleteChapter);
router.post('/videos', uploadVideo.single('video'), createVideo);
router.put('/videos/reorder', reorderVideos);
// Replace route must come BEFORE the generic :id route
router.post('/videos/:id/replace', uploadVideo.single('video'), replaceVideo);
router.put('/videos/:id', updateVideo);
router.delete('/videos/:id', deleteVideo);

export default router;