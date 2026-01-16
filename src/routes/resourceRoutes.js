import express from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { createResource, updateResource, deleteResource, reorderResources } from '../controllers/resourceController.js';
import { resourceStorage } from '../config/cloudinary.js';

const router = express.Router();

const upload = multer({
  storage: resourceStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Allow common document and archive formats
    const allowedTypes = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip|rar|txt|md)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only documents and archives are allowed.'));
    }
  }
});

router.post('/', authenticate, (req, res, next) => {
  upload.single('resource')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      
      // Handle specific error types
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          message: 'File too large. Maximum size is 50MB.' 
        });
      }
      
      if (err.message && err.message.includes('File size too large')) {
        return res.status(400).json({ 
          message: 'File too large. Maximum size is 50MB. Please use a smaller file.' 
        });
      }
      
      if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({ 
          message: 'Invalid file type. Only PDF, DOC, PPT, XLS, ZIP, TXT files are allowed.' 
        });
      }
      
      return res.status(400).json({ message: err.message || 'File upload failed' });
    }
    next();
  });
}, createResource);
router.put('/reorder', authenticate, reorderResources);
router.put('/:id', authenticate, upload.single('resource'), updateResource);
router.delete('/:id', authenticate, deleteResource);

export default router;