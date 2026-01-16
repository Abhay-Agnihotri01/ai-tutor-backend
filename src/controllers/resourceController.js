import supabase from '../config/supabase.js';
import cloudinary from '../config/cloudinary.js';

export const createResource = async (req, res) => {
  try {
    console.log('Creating resource with data:', {
      body: req.body,
      file: req.file ? {
        originalname: req.file.originalname,
        size: req.file.size,
        path: req.file.path
      } : null,
      user: req.user?.id
    });

    const { chapterId, title } = req.body;
    const instructorId = req.user.id;

    if (!chapterId) {
      return res.status(400).json({ message: 'Chapter ID is required' });
    }

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    // Verify chapter belongs to instructor
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select(`
        *,
        courses!chapters_courseId_fkey (
          instructorId
        )
      `)
      .eq('id', chapterId)
      .single();

    if (chapterError) {
      console.error('Chapter query error:', chapterError);
      return res.status(500).json({ message: 'Error verifying chapter', error: chapterError.message });
    }

    if (!chapter || chapter.courses?.instructorId !== instructorId) {
      return res.status(404).json({ message: 'Chapter not found or unauthorized' });
    }

    // Get resource count for ordering
    const { count, error: countError } = await supabase
      .from('resources')
      .select('*', { count: 'exact', head: true })
      .eq('chapterId', chapterId);

    if (countError) {
      console.error('Count query error:', countError);
    }

    const order = (count || 0) + 1;

    // Create resource
    const resourceData = {
      chapterId,
      title,
      fileUrl: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      order
    };

    console.log('Inserting resource with data:', resourceData);

    const { data: resource, error } = await supabase
      .from('resources')
      .insert(resourceData)
      .select()
      .single();

    if (error) {
      console.error('Resource insert error:', error);
      throw error;
    }

    console.log('Resource created successfully:', resource);

    res.status(201).json({
      success: true,
      resource
    });
  } catch (error) {
    console.error('Create resource error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const reorderResources = async (req, res) => {
  try {
    const { resources } = req.body;
    const instructorId = req.user.id;

    // Verify all resources belong to instructor and update order
    for (const resourceUpdate of resources) {
      const { data: resource } = await supabase
        .from('resources')
        .select(`
          *,
          chapters!resources_chapterId_fkey (
            courses!chapters_courseId_fkey (
              instructorId
            )
          )
        `)
        .eq('id', resourceUpdate.id)
        .single();
      
      if (!resource || resource.chapters?.courses?.instructorId !== instructorId) {
        return res.status(404).json({ message: 'Resource not found or unauthorized' });
      }
      
      const { error } = await supabase
        .from('resources')
        .update({ order: resourceUpdate.order })
        .eq('id', resourceUpdate.id);
        
      if (error) throw error;
    }

    res.json({
      success: true,
      message: 'Resource order updated successfully'
    });
  } catch (error) {
    console.error('Reorder resources error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateResource = async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const instructorId = req.user.id;

    // Get resource with chapter and course info
    const { data: resource } = await supabase
      .from('resources')
      .select(`
        *,
        chapters!resources_chapterId_fkey (
          courses!chapters_courseId_fkey (
            instructorId
          )
        )
      `)
      .eq('id', id)
      .single();

    if (!resource || resource.chapters?.courses?.instructorId !== instructorId) {
      return res.status(404).json({ message: 'Resource not found or unauthorized' });
    }

    let updateData = { title: title || resource.title };

    // If new file is uploaded, replace the old one
    if (req.file) {
      // Delete old file from Cloudinary
      if (resource.fileUrl && resource.fileUrl.includes('cloudinary.com')) {
        try {
          const publicId = resource.fileUrl.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`lms-resources/${publicId}`, { resource_type: 'raw' });
        } catch (error) {
          console.warn('Could not delete old resource from Cloudinary:', error.message);
        }
      }
      
      updateData = {
        ...updateData,
        fileUrl: req.file.path,
        fileName: req.file.originalname,
        fileSize: req.file.size
      };
    }

    const { data: updatedResource, error } = await supabase
      .from('resources')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      resource: updatedResource,
      message: 'Resource updated successfully'
    });
  } catch (error) {
    console.error('Update resource error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const deleteResource = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    // Get resource with chapter and course info
    const { data: resource } = await supabase
      .from('resources')
      .select(`
        *,
        chapters!resources_chapterId_fkey (
          courses!chapters_courseId_fkey (
            instructorId
          )
        )
      `)
      .eq('id', id)
      .single();

    if (!resource || resource.chapters?.courses?.instructorId !== instructorId) {
      return res.status(404).json({ message: 'Resource not found or unauthorized' });
    }

    // Delete file from Cloudinary
    if (resource.fileUrl && resource.fileUrl.includes('cloudinary.com')) {
      try {
        const publicId = resource.fileUrl.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`lms-resources/${publicId}`, { resource_type: 'raw' });
      } catch (error) {
        console.warn('Could not delete resource from Cloudinary:', error.message);
      }
    }

    // Delete from database
    const { error } = await supabase
      .from('resources')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Resource deleted successfully'
    });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};