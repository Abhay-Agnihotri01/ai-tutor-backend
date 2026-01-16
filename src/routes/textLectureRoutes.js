import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import supabase from '../config/supabase.js';
import { generateId } from '../utils/supabaseHelpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/text-lectures');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `text-lecture-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
    }
  }
});

// Create text lecture
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { title, chapterId, courseId, uploadType, url } = req.body;
    
    if (!title || !chapterId || !courseId) {
      return res.status(400).json({
        success: false,
        message: 'Title, chapter ID, and course ID are required'
      });
    }

    let filePath = null;
    let fileName = null;

    if (uploadType === 'file' && req.file) {
      filePath = `/uploads/text-lectures/${req.file.filename}`;
      fileName = req.file.originalname;
    } else if (uploadType === 'url' && url) {
      // For URL-based content, we'll store the URL
      // In a real implementation, you might want to convert the webpage to PDF
      filePath = url;
      fileName = 'Web Content';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a file or URL'
      });
    }

    // Save to Supabase database
    const { data: textLecture, error } = await supabase
      .from('text_lectures')
      .insert({
        id: generateId(),
        title,
        chapterId,
        courseId,
        filePath,
        fileName,
        uploadType,
        order: 0
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Text lecture created successfully',
      lecture: textLecture
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create text lecture',
      error: error.message
    });
  }
});

// Reorder text lectures
router.put('/reorder', authenticate, async (req, res) => {
  try {
    const { textLectures } = req.body;
    
    for (const textLecture of textLectures) {
      const { error } = await supabase
        .from('text_lectures')
        .update({ order: textLecture.order })
        .eq('id', textLecture.id);
      
      if (error) throw error;
    }
    
    res.json({
      success: true,
      message: 'Text lecture order updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reorder text lectures',
      error: error.message
    });
  }
});

// Delete text lecture
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('text_lectures')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Text lecture deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete text lecture',
      error: error.message
    });
  }
});

// Serve uploaded text lecture files
router.get('/file/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads/text-lectures', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to serve file',
      error: error.message
    });
  }
});

export default router;