import express from 'express';
import { body } from 'express-validator';
import { getCourses, getCourse, createCourse, updateCourse, publishCourse, deleteCourse } from '../controllers/courseController.js';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

// Cloudinary storage for course thumbnails
const thumbnailStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'lms-thumbnails',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 225, crop: 'fill', quality: 'auto' }]
  }
});

const uploadThumbnail = multer({
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
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getCourses);
router.get('/:id', getCourse);

router.post('/', authenticate, authorize('instructor', 'admin'), uploadThumbnail.single('thumbnail'), [
  body('title').trim().isLength({ min: 1 }),
  body('description').trim().isLength({ min: 10 }),
  body('category').trim().isLength({ min: 1 }),
  body('price').isNumeric()
], createCourse);

router.put('/:id', authenticate, authorize('instructor', 'admin'), uploadThumbnail.single('thumbnail'), updateCourse);
router.patch('/:id/publish', authenticate, authorize('instructor', 'admin'), publishCourse);
router.delete('/:id', authenticate, authorize('instructor', 'admin'), deleteCourse);

export default router;