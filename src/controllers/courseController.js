import supabase from '../config/supabase.js';
import cloudinary from '../config/cloudinary.js';
import { generateId, handleSupabaseError, getCurrentTimestamp } from '../utils/supabaseHelpers.js';

export const getCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, level, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('courses')
      .select(`
        *,
        users!inner(firstName, lastName, avatar)
      `, { count: 'exact' })
      .eq('isPublished', true);

    if (category) query = query.eq('category', category);
    if (level) query = query.eq('level', level);
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: courses, count, error } = await query
      .range(offset, offset + parseInt(limit) - 1)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    // Calculate current ratings for each course
    const coursesWithRatings = await Promise.all(
      (courses || []).map(async (course) => {
        const { data: ratingData } = await supabase
          .from('ratings')
          .select('rating')
          .eq('courseId', course.id);

        let currentRating = 0;
        if (ratingData && ratingData.length > 0) {
          currentRating = ratingData.reduce((sum, r) => sum + r.rating, 0) / ratingData.length;
          currentRating = Math.round(currentRating * 10) / 10;
        }

        return {
          ...course,
          rating: currentRating
        };
      })
    );

    res.json({
      success: true,
      courses: coursesWithRatings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil((count || 0) / limit),
        totalCourses: count || 0
      }
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select(`
        *,
        users!inner(firstName, lastName, avatar)
      `)
      .eq('id', id)
      .single();

    if (courseError || !course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Fetch chapters with videos and resources
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select(`
        *,
        videos(*, duration),
        resources(*)
      `)
      .eq('courseId', id)
      .order('order', { ascending: true });

    // Try to fetch text lectures separately (table might not exist yet)
    let textLectures = [];
    try {
      const { data: textLectureData } = await supabase
        .from('text_lectures')
        .select('*')
        .eq('courseId', id)
        .order('order', { ascending: true });
      textLectures = textLectureData || [];
    } catch (error) {
      // text_lectures table doesn't exist yet, ignore
    }

    // Add text lectures to their respective chapters
    if (chapters && textLectures.length > 0) {
      chapters.forEach(chapter => {
        chapter.text_lectures = textLectures.filter(tl => tl.chapterId === chapter.id);
      });
    }

    if (chaptersError) throw chaptersError;

    // Get current rating from database (in case it was recently updated)
    const { data: ratingData } = await supabase
      .from('ratings')
      .select('rating')
      .eq('courseId', id);

    let currentRating = 0;
    if (ratingData && ratingData.length > 0) {
      currentRating = ratingData.reduce((sum, r) => sum + r.rating, 0) / ratingData.length;
      currentRating = Math.round(currentRating * 10) / 10; // Round to 1 decimal place
    }

    res.json({
      success: true,
      course: {
        ...course,
        rating: currentRating, // Use calculated rating instead of stored one
        chapters: chapters || []
      }
    });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const createCourse = async (req, res) => {
  try {

    
    const { title, shortDescription, description, category, level, price, language, discountPrice } = req.body;
    const instructorId = req.user.id;
    
    // Validate required fields
    if (!title || !description || !category) {
      return res.status(400).json({ 
        message: 'Missing required fields: title, description, category' 
      });
    }
    
    // Handle thumbnail upload (Cloudinary URL)
    const thumbnail = req.file ? req.file.path : null;

    const courseData = {
      title,
      shortDescription: shortDescription || null,
      description,
      category,
      level: level || 'beginner',
      price: parseFloat(price) || 0,
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      language: language || 'English',
      thumbnail,
      instructorId,
      isPublished: false
    };
    


    const { data: course, error } = await supabase
      .from('courses')
      .insert(courseData)
      .select()
      .single();
    
    if (error) throw error;

    res.status(201).json({
      success: true,
      course,
      message: 'Course created successfully'
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getInstructorCourses = async (req, res) => {
  try {
    const instructorId = req.user.id;

    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        *,
        users!inner(firstName, lastName, avatar)
      `)
      .eq('instructorId', instructorId)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    // Get enrollment stats and ratings for each course
    const coursesWithStats = await Promise.all(
      courses.map(async (course) => {
        const { count: enrollmentCount } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('courseId', course.id);

        // Get ratings for this course
        const { data: ratingData } = await supabase
          .from('ratings')
          .select('rating')
          .eq('courseId', course.id);

        let currentRating = 0;
        if (ratingData && ratingData.length > 0) {
          currentRating = ratingData.reduce((sum, r) => sum + r.rating, 0) / ratingData.length;
          currentRating = Math.round(currentRating * 10) / 10;
        }

        // Calculate revenue from actual prices paid
        const { data: courseEnrollments } = await supabase
          .from('enrollments')
          .select('pricePaid')
          .eq('courseId', course.id);
        
        const revenue = courseEnrollments?.reduce((sum, enrollment) => 
          sum + (enrollment.pricePaid || 0), 0
        ) || 0;

        return {
          ...course,
          rating: currentRating,
          students: enrollmentCount || 0,
          revenue: revenue
        };
      })
    );

    res.json({
      success: true,
      courses: coursesWithStats
    });
  } catch (error) {
    console.error('Get instructor courses error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getInstructorStats = async (req, res) => {
  try {
    const instructorId = req.user.id;

    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id')
      .eq('instructorId', instructorId);

    if (coursesError) throw coursesError;

    const courseIds = courses?.map(course => course.id) || [];
    
    const { count: totalStudents } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .in('courseId', courseIds);

    // Calculate total revenue across all courses
    let totalRevenue = 0;
    let totalRatingSum = 0;
    let totalRatedCourses = 0;

    for (const course of courses || []) {
      // Get enrollments with actual prices paid
      const { data: courseEnrollments } = await supabase
        .from('enrollments')
        .select('pricePaid')
        .eq('courseId', course.id);

      // Calculate revenue from actual prices paid
      const courseRevenue = courseEnrollments?.reduce((sum, enrollment) => 
        sum + (enrollment.pricePaid || 0), 0
      ) || 0;
      
      totalRevenue += courseRevenue;

      // Get ratings for average calculation
      const { data: ratingData } = await supabase
        .from('ratings')
        .select('rating')
        .eq('courseId', course.id);

      if (ratingData && ratingData.length > 0) {
        const courseRating = ratingData.reduce((sum, r) => sum + r.rating, 0) / ratingData.length;
        totalRatingSum += courseRating;
        totalRatedCourses++;
      }
    }

    const avgRating = totalRatedCourses > 0 ? Math.round((totalRatingSum / totalRatedCourses) * 10) / 10 : 0;

    res.json({
      success: true,
      stats: {
        totalCourses: courses?.length || 0,
        totalStudents: totalStudents || 0,
        totalRevenue: totalRevenue,
        avgRating: avgRating
      }
    });
  } catch (error) {
    console.error('Get instructor stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user.id;
    const { title, shortDescription, description, category, level, price, language, discountPrice } = req.body;

    const { data: course, error: findError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .eq('instructorId', instructorId)
      .single();

    if (findError || !course) {
      return res.status(404).json({ message: 'Course not found or unauthorized' });
    }

    // Handle thumbnail upload (Cloudinary URL)
    let thumbnailUrl = course.thumbnail;
    if (req.file) {
      // Delete old thumbnail from Cloudinary if it exists
      if (course.thumbnail && course.thumbnail.includes('cloudinary.com')) {
        try {
          const publicId = course.thumbnail.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`lms-thumbnails/${publicId}`);
        } catch (error) {
          console.warn('Could not delete old thumbnail from Cloudinary:', error.message);
        }
      }
      thumbnailUrl = req.file.path;
    }

    const updateData = {
      title,
      shortDescription,
      description,
      category,
      level,
      price: parseFloat(price) || course.price,
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      language,
      thumbnail: thumbnailUrl,
      updatedAt: getCurrentTimestamp()
    };

    const { data: updatedCourse, error: updateError } = await supabase
      .from('courses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      course: updatedCourse,
      message: 'Course updated successfully'
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const publishCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    const { data: course, error: findError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .eq('instructorId', instructorId)
      .single();

    if (findError || !course) {
      return res.status(404).json({ message: 'Course not found or unauthorized' });
    }

    const { data: updatedCourse, error: updateError } = await supabase
      .from('courses')
      .update({ 
        isPublished: !course.isPublished,
        updatedAt: getCurrentTimestamp()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      course: updatedCourse,
      message: `Course ${updatedCourse.isPublished ? 'published' : 'unpublished'} successfully`
    });
  } catch (error) {
    console.error('Publish course error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user.id;

    const { data: course, error: findError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', id)
      .eq('instructorId', instructorId)
      .single();

    if (findError || !course) {
      return res.status(404).json({ message: 'Course not found or unauthorized' });
    }

    const { error: deleteError } = await supabase
      .from('courses')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};