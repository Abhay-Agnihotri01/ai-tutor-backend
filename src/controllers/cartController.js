import supabase from '../config/supabase.js';

// Add course to cart
const addToCart = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.id;

    // Check if course exists and is published
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, price, discountPrice, isPublished')
      .eq('id', courseId)
      .eq('isPublished', true)
      .single();

    if (courseError || !course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found or not available'
      });
    }

    // Check if user already enrolled
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('userId', userId)
      .eq('courseId', courseId)
      .single();

    if (enrollment) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in this course'
      });
    }

    // Add to cart (will ignore if already exists due to unique constraint)
    const { data, error } = await supabase
      .from('cart')
      .insert({ userId, courseId })
      .select()
      .single();

    if (error && error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Course already in cart'
      });
    }

    if (error) throw error;

    res.json({
      success: true,
      message: 'Course added to cart',
      item: data
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add course to cart'
    });
  }
};

// Get user's cart
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    // First get cart items
    const { data: cartItems, error: cartError } = await supabase
      .from('cart')
      .select('id, courseId, addedAt')
      .eq('userId', userId)
      .order('addedAt', { ascending: false });

    if (cartError) throw cartError;

    if (!cartItems || cartItems.length === 0) {
      return res.json({
        success: true,
        cart: [],
        total: '0.00',
        count: 0
      });
    }

    // Get course details for each cart item
    const courseIds = cartItems.map(item => item.courseId);
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

    // Combine cart items with course data and instructor info
    const cartWithCourses = cartItems.map(cartItem => {
      const course = courses?.find(c => c.id === cartItem.courseId);
      if (!course) return null;
      
      const instructor = instructors.find(i => i.id === course.instructorId);
      return {
        id: cartItem.id,
        addedAt: cartItem.addedAt,
        courses: {
          ...course,
          users: instructor || null
        }
      };
    }).filter(Boolean); // Remove items where course not found

    const total = cartWithCourses.reduce((sum, item) => {
      const price = item.courses.discountPrice || item.courses.price || 0;
      return sum + parseFloat(price);
    }, 0);

    res.json({
      success: true,
      cart: cartWithCourses,
      total: total.toFixed(2),
      count: cartWithCourses.length
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cart'
    });
  }
};

// Remove from cart
const removeFromCart = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from('cart')
      .delete()
      .eq('userId', userId)
      .eq('courseId', courseId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Course removed from cart'
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove course from cart'
    });
  }
};

// Clear entire cart
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('cart')
      .delete()
      .eq('userId', userId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Cart cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart'
    });
  }
};

export {
  addToCart,
  getCart,
  removeFromCart,
  clearCart
};