import supabase from '../config/supabase.js';
import cloudinary from '../config/cloudinary.js';

// Thumbnail generation is now handled by Cloudinary

export const createChapter = async (req, res) => {
  try {
    const { courseId, title } = req.body;
    const instructorId = req.user.id;

    // Verify course ownership
    const { data: course } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .eq('instructorId', instructorId)
      .single();

    if (!course) {
      return res.status(404).json({ message: 'Course not found or unauthorized' });
    }

    // Get chapter count for ordering
    const { count } = await supabase
      .from('chapters')
      .select('*', { count: 'exact', head: true })
      .eq('courseId', courseId);

    const order = (count || 0) + 1;

    // Create chapter
    const { data: chapter, error } = await supabase
      .from('chapters')
      .insert({
        courseId,
        title,
        order
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      chapter
    });
  } catch (error) {
    console.error('Create chapter error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getCourseChapters = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Get chapters with videos, resources, and text lectures
    const { data: chapters, error } = await supabase
      .from('chapters')
      .select(`
        *,
        videos (
          *
        ),
        resources (
          *
        )
      `)
      .eq('courseId', courseId)
      .order('order', { ascending: true });

    // Get text lectures separately and add to chapters
    let textLectures = [];
    try {
      const { data: textLectureData } = await supabase
        .from('text_lectures')
        .select('*')
        .eq('courseId', courseId)
        .order('order', { ascending: true });
      textLectures = textLectureData || [];
    } catch (error) {
      // text_lectures table might not exist yet
    }

    if (error) throw error;

    // Sort videos, resources, and add text lectures by order
    const chaptersWithSortedContent = chapters.map(chapter => ({
      ...chapter,
      videos: (chapter.videos || []).sort((a, b) => (a.order || 0) - (b.order || 0)),
      resources: (chapter.resources || []).sort((a, b) => (a.order || 0) - (b.order || 0)),
      text_lectures: textLectures.filter(tl => tl.chapterId === chapter.id).sort((a, b) => (a.order || 0) - (b.order || 0))
    }));

    res.json({
      success: true,
      chapters: chaptersWithSortedContent
    });
  } catch (error) {
    console.error('Get course chapters error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const instructorId = req.user.id;

    // Verify chapter belongs to instructor
    const { data: chapter } = await supabase
      .from('chapters')
      .select(`
        *,
        courses!chapters_courseId_fkey (
          instructorId
        )
      `)
      .eq('id', id)
      .single();

    if (!chapter || chapter.courses?.instructorId !== instructorId) {
      return res.status(404).json({ message: 'Chapter not found or unauthorized' });
    }

    const { data: updatedChapter, error } = await supabase
      .from('chapters')
      .update({ title })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      chapter: updatedChapter,
      message: 'Chapter updated successfully'
    });
  } catch (error) {
    console.error('Update chapter error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const instructorId = req.user.id;

    // Verify video belongs to instructor
    const { data: video } = await supabase
      .from('videos')
      .select(`
        *,
        chapters!videos_chapterId_fkey (
          courses!chapters_courseId_fkey (
            instructorId
          )
        )
      `)
      .eq('id', id)
      .single();

    if (!video || video.chapters?.courses?.instructorId !== instructorId) {
      return res.status(404).json({ message: 'Video not found or unauthorized' });
    }

    const { data: updatedVideo, error } = await supabase
      .from('videos')
      .update({ 
        title: title || video.title,
        description: description !== undefined ? description : video.description
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      video: updatedVideo,
      message: 'Video updated successfully'
    });
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const replaceVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, duration } = req.body;
    const instructorId = req.user.id;
    const newVideoUrl = req.file ? req.file.path : null;
    // Generate thumbnail from video frame at 10 seconds as JPG image
    const newThumbnailUrl = req.file ? req.file.path.replace('/video/upload/', '/video/upload/so_10,w_400,h_225,c_fill,q_auto,f_jpg/').replace('.mp4', '.jpg') : null;

    if (!req.file) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    // Verify video belongs to instructor
    const { data: video } = await supabase
      .from('videos')
      .select(`
        *,
        chapters!videos_chapterId_fkey (
          courses!chapters_courseId_fkey (
            instructorId
          )
        )
      `)
      .eq('id', id)
      .single();

    if (!video || video.chapters?.courses?.instructorId !== instructorId) {
      return res.status(404).json({ message: 'Video not found or unauthorized' });
    }

    // Delete old video from Cloudinary
    if (video.videoUrl && video.videoUrl.includes('cloudinary.com')) {
      try {
        const publicId = video.videoUrl.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`lms-videos/${publicId}`, { resource_type: 'video' });
      } catch (error) {
        console.warn('Could not delete old video from Cloudinary:', error.message);
      }
    }

    // Update video with new file and details
    const { data: updatedVideo, error } = await supabase
      .from('videos')
      .update({
        title: title || video.title,
        videoUrl: newVideoUrl,
        thumbnailUrl: newThumbnailUrl,
        duration: parseInt(duration) || video.duration
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      video: updatedVideo,
      message: 'Video replaced successfully'
    });
  } catch (error) {
    console.error('Replace video error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const createVideo = async (req, res) => {
  try {
    const { chapterId, title, duration, description } = req.body;
    const instructorId = req.user.id;
    const videoUrl = req.file ? req.file.path : null;
    // Generate thumbnail from video frame at 10 seconds as JPG image
    const thumbnailUrl = req.file ? req.file.path.replace('/video/upload/', '/video/upload/so_10,w_400,h_225,c_fill,q_auto,f_jpg/').replace('.mp4', '.jpg') : null;
    
    if (!videoUrl) {
      return res.status(400).json({ message: 'No video file provided' });
    }
    
    // Verify chapter belongs to instructor
    const { data: chapter } = await supabase
      .from('chapters')
      .select(`
        *,
        courses!chapters_courseId_fkey (
          instructorId
        )
      `)
      .eq('id', chapterId)
      .single();

    if (!chapter || chapter.courses?.instructorId !== instructorId) {
      return res.status(404).json({ message: 'Chapter not found or unauthorized' });
    }
    
    // Use duration from frontend, fallback to 0 if not provided
    const videoDuration = parseInt(duration) || 0;
    
    // Get video count for ordering
    const { count } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('chapterId', chapterId);
    
    const order = (count || 0) + 1;

    // Cloudinary automatically generates thumbnails

    const { data: video, error } = await supabase
      .from('videos')
      .insert({
        chapterId,
        title,
        videoUrl,
        thumbnailUrl,
        description,
        duration: videoDuration,
        order
      })
      .select()
      .single();

    if (error) throw error;
    
    res.status(201).json({
      success: true,
      video
    });
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    // Get video with chapter and course info
    const { data: video } = await supabase
      .from('videos')
      .select(`
        *,
        chapters!videos_chapterId_fkey (
          courses!chapters_courseId_fkey (
            instructorId
          )
        )
      `)
      .eq('id', id)
      .single();

    if (!video || video.chapters?.courses?.instructorId !== instructorId) {
      return res.status(404).json({ message: 'Video not found or unauthorized' });
    }

    // Delete video from Cloudinary
    if (video.videoUrl && video.videoUrl.includes('cloudinary.com')) {
      try {
        const publicId = video.videoUrl.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`lms-videos/${publicId}`, { resource_type: 'video' });
      } catch (error) {
        console.warn('Could not delete video from Cloudinary:', error.message);
      }
    }

    // Delete from database
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Video deleted successfully'
    });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const deleteChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    // Get chapter with videos and course info
    const { data: chapter } = await supabase
      .from('chapters')
      .select(`
        *,
        courses!chapters_courseId_fkey (
          instructorId
        ),
        videos (*)
      `)
      .eq('id', id)
      .single();

    if (!chapter || chapter.courses?.instructorId !== instructorId) {
      return res.status(404).json({ message: 'Chapter not found or unauthorized' });
    }

    // Delete all videos from Cloudinary
    for (const video of chapter.videos || []) {
      if (video.videoUrl && video.videoUrl.includes('cloudinary.com')) {
        try {
          const publicId = video.videoUrl.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`lms-videos/${publicId}`, { resource_type: 'video' });
        } catch (error) {
          console.warn('Could not delete video from Cloudinary:', error.message);
        }
      }
    }

    // Delete from database (cascade will handle videos and resources)
    const { error } = await supabase
      .from('chapters')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Chapter deleted successfully'
    });
  } catch (error) {
    console.error('Delete chapter error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const reorderChapters = async (req, res) => {
  try {
    const { chapters } = req.body;
    const instructorId = req.user.id;

    // Verify all chapters belong to instructor and update order
    for (const chapterUpdate of chapters) {
      const { data: chapter } = await supabase
        .from('chapters')
        .select(`
          *,
          courses!chapters_courseId_fkey (
            instructorId
          )
        `)
        .eq('id', chapterUpdate.id)
        .single();
      
      if (!chapter || chapter.courses?.instructorId !== instructorId) {
        return res.status(404).json({ message: 'Chapter not found or unauthorized' });
      }
      
      const { error } = await supabase
        .from('chapters')
        .update({ order: chapterUpdate.order })
        .eq('id', chapterUpdate.id);
        
      if (error) throw error;
    }

    res.json({
      success: true,
      message: 'Chapter order updated successfully'
    });
  } catch (error) {
    console.error('Reorder chapters error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const reorderVideos = async (req, res) => {
  try {
    const { videos } = req.body;
    const instructorId = req.user.id;

    // Verify all videos belong to instructor and update order
    for (const videoUpdate of videos) {
      const { data: video } = await supabase
        .from('videos')
        .select(`
          *,
          chapters!videos_chapterId_fkey (
            courses!chapters_courseId_fkey (
              instructorId
            )
          )
        `)
        .eq('id', videoUpdate.id)
        .single();
      
      if (!video || video.chapters?.courses?.instructorId !== instructorId) {
        return res.status(404).json({ message: 'Video not found or unauthorized' });
      }
      
      const { error } = await supabase
        .from('videos')
        .update({ order: videoUpdate.order })
        .eq('id', videoUpdate.id);
        
      if (error) throw error;
    }

    res.json({
      success: true,
      message: 'Video order updated successfully'
    });
  } catch (error) {
    console.error('Reorder videos error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};