import supabase from '../config/supabase.js';

// Add course to wishlist
const addToWishlist = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.id;

    // Check if course exists
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Add to wishlist (will ignore if already exists due to unique constraint)
    const { data, error } = await supabase
      .from('wishlist')
      .insert({ userId, courseId })
      .select()
      .single();

    if (error && error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Course already in wishlist'
      });
    }

    if (error) throw error;

    res.json({
      success: true,
      message: 'Course added to wishlist',
      item: data
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add course to wishlist'
    });
  }
};

// Get user's wishlist
const getWishlist = async (req, res) => {
  try {
    const userId = req.user.id;

    // First get wishlist items
    const { data: wishlistItems, error: wishlistError } = await supabase
      .from('wishlist')
      .select('id, courseId, addedAt')
      .eq('userId', userId)
      .order('addedAt', { ascending: false });

    if (wishlistError) throw wishlistError;

    if (!wishlistItems || wishlistItems.length === 0) {
      return res.json({
        success: true,
        wishlist: [],
        count: 0
      });
    }

    // Get course details for each wishlist item
    const courseIds = wishlistItems.map(item => item.courseId);
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select(`
        id,
        title,
        shortDescription,
        price,
        discountPrice,
        thumbnail,
        level,
        category,
        isPublished,
        instructorId
      `)
      .in('id', courseIds);

    if (coursesError) throw coursesError;

    // Get instructor details separately
    const instructorIds = [...new Set(courses?.map(c => c.instructorId).filter(Boolean))];
    let instructors = [];
    if (instructorIds.length > 0) {
      const { data: instructorData } = await supabase
        .from('users')
        .select('id, firstName, lastName')
        .in('id', instructorIds);
      instructors = instructorData || [];
    }

    // Combine wishlist items with course data and instructor info
    const wishlistWithCourses = wishlistItems.map(wishlistItem => {
      const course = courses?.find(c => c.id === wishlistItem.courseId);
      if (!course) return null;
      
      const instructor = instructors.find(i => i.id === course.instructorId);
      return {
        id: wishlistItem.id,
        addedAt: wishlistItem.addedAt,
        courses: {
          ...course,
          users: instructor || null
        }
      };
    }).filter(Boolean); // Remove items where course not found

    res.json({
      success: true,
      wishlist: wishlistWithCourses,
      count: wishlistWithCourses.length
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wishlist'
    });
  }
};

// Remove from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('userId', userId)
      .eq('courseId', courseId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Course removed from wishlist'
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove course from wishlist'
    });
  }
};

// Check if course is in wishlist
const checkWishlistStatus = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('wishlist')
      .select('id')
      .eq('userId', userId)
      .eq('courseId', courseId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({
      success: true,
      inWishlist: !!data
    });
  } catch (error) {
    console.error('Error checking wishlist status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check wishlist status'
    });
  }
};

export {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  checkWishlistStatus
};