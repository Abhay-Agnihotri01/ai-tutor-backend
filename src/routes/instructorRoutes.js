import express from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';
import { createCourse, getInstructorCourses, getInstructorStats, updateCourse, deleteCourse, publishCourse } from '../controllers/courseController.js';
import { getInstructorAnalytics } from '../controllers/analyticsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Cloudinary storage for course thumbnails
const thumbnailStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'lms-thumbnails',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 225, crop: 'fill', quality: 'auto' }]
  }
});

const upload = multer({
  storage: thumbnailStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// All routes require instructor role
router.use(authenticate);
router.use(authorize('instructor', 'admin'));

router.post('/courses', upload.single('thumbnail'), createCourse);
router.get('/courses', getInstructorCourses);
router.get('/stats', getInstructorStats);
router.get('/analytics', getInstructorAnalytics);
router.put('/courses/:id', updateCourse);
router.patch('/courses/:id/publish', publishCourse);
router.delete('/courses/:id', deleteCourse);

export default router;