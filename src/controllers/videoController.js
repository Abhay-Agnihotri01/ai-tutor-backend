import supabase from '../config/supabase.js';
import multer from 'multer';
import path from 'path';

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/videos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|avi|mov|wmv|flv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Upload video
export const uploadVideo = async (req, res) => {
  try {
    const { chapterId, title, description } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    // Get chapter and course info
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('courseId, courses(instructorId)')
      .eq('id', chapterId)
      .single();

    if (chapterError || !chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    // Check if user is the instructor
    if (chapter.courses.instructorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to upload videos to this course' });
    }

    const videoUrl = `/uploads/videos/${req.file.filename}`;

    // Insert video into database
    const { data: video, error } = await supabase
      .from('videos')
      .insert({
        chapterId,
        courseId: chapter.courseId,
        title,
        description,
        videoUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        uploadedBy: userId
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      video,
      message: 'Video uploaded successfully'
    });

  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
};

// Get videos by chapter
export const getVideosByChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;

    const { data: videos, error } = await supabase
      .from('videos')
      .select('*')
      .eq('chapterId', chapterId)
      .order('order', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      videos
    });

  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Failed to get videos' });
  }
};

// Delete video
export const deleteVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.user.id;

    // Check if user owns the video
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*, chapters(courses(instructorId))')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (video.chapters.courses.instructorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this video' });
    }

    // Delete from database
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      message: 'Video deleted successfully'
    });

  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
};