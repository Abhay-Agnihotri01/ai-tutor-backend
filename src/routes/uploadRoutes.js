import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit for recordings
  }
});

// Upload recording to Cloudinary
router.post('/recording', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { courseId, title, description } = req.body;

    // Upload to Cloudinary with metadata and tags
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: 'live-class-recordings',
          public_id: `recording_${Date.now()}`,
          tags: [`course_${courseId || 'general'}`, 'live_recording'],
          context: {
            title: title || `Live Class Recording - ${new Date().toLocaleDateString()}`,
            description: description || 'Screen recording from live class session',
            courseId: courseId || '',
            instructorId: req.user.id,
            uploadedAt: new Date().toISOString()
          }
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      
      uploadStream.end(req.file.buffer);
    });

    const recordingData = {
      id: uploadResult.public_id,
      courseId: courseId || null,
      instructorId: req.user.id,
      title: uploadResult.context?.title || title,
      description: uploadResult.context?.description || description,
      cloudinaryUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      duration: uploadResult.duration,
      fileSize: uploadResult.bytes,
      uploadedAt: uploadResult.context?.uploadedAt || new Date().toISOString()
    };

    res.json({
      message: 'Recording uploaded successfully',
      recording: recordingData
    });

  } catch (error) {
    console.error('Recording upload error:', error);
    res.status(500).json({ 
      message: 'Failed to upload recording',
      error: error.message 
    });
  }
});

// Get recordings for a course (for students)
router.get('/course/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Search Cloudinary for recordings with course tag
    const searchResult = await cloudinary.search
      .expression(`tags:course_${courseId} AND tags:live_recording`)
      .with_field('context')
      .max_results(50)
      .execute();
    
    const recordings = searchResult.resources.map(resource => ({
      id: resource.public_id,
      courseId: resource.context?.courseId || courseId,
      instructorId: resource.context?.instructorId,
      title: resource.context?.title || 'Live Class Recording',
      description: resource.context?.description || '',
      cloudinaryUrl: resource.secure_url,
      publicId: resource.public_id,
      duration: resource.duration,
      fileSize: resource.bytes,
      uploadedAt: resource.context?.uploadedAt || resource.created_at
    }));
    
    res.json({
      message: 'Recordings fetched successfully',
      recordings
    });
    
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({ 
      message: 'Failed to fetch recordings',
      error: error.message 
    });
  }
});

// Get all recordings for an instructor
router.get('/instructor', authenticate, async (req, res) => {
  try {
    // Search Cloudinary for all recordings by instructor
    const searchResult = await cloudinary.search
      .expression(`tags:live_recording`)
      .with_field('context')
      .max_results(100)
      .execute();
    
    const recordings = searchResult.resources
      .filter(resource => resource.context?.instructorId === req.user.id)
      .map(resource => ({
        id: resource.public_id,
        courseId: resource.context?.courseId,
        instructorId: resource.context?.instructorId,
        title: resource.context?.title || 'Live Class Recording',
        description: resource.context?.description || '',
        cloudinaryUrl: resource.secure_url,
        publicId: resource.public_id,
        duration: resource.duration,
        fileSize: resource.bytes,
        uploadedAt: resource.context?.uploadedAt || resource.created_at
      }));
    
    res.json({
      message: 'Recordings fetched successfully',
      recordings
    });
    
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({ 
      message: 'Failed to fetch recordings',
      error: error.message 
    });
  }
});

export default router;