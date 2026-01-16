import supabase from '../config/supabase.js';

export const createOrUpdateRating = async (req, res) => {
  try {
    const { courseId, rating, review } = req.body;
    const userId = req.user.id;

    // Check if rating exists
    const { data: existingRating } = await supabase
      .from('ratings')
      .select('*')
      .eq('userId', userId)
      .eq('courseId', courseId)
      .single();

    let ratingRecord;
    let created = false;

    if (existingRating) {
      // Update existing rating
      const { data, error } = await supabase
        .from('ratings')
        .update({ rating, review })
        .eq('userId', userId)
        .eq('courseId', courseId)
        .select()
        .single();
      
      if (error) throw error;
      ratingRecord = data;
    } else {
      // Create new rating
      const { data, error } = await supabase
        .from('ratings')
        .insert({ userId, courseId, rating, review })
        .select()
        .single();
      
      if (error) throw error;
      ratingRecord = data;
      created = true;
    }

    // Update course average rating
    await updateCourseRating(courseId);

    res.json({
      success: true,
      rating: ratingRecord,
      message: created ? 'Rating submitted successfully' : 'Rating updated successfully'
    });
  } catch (error) {
    console.error('Create/Update rating error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getCourseRatings = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get total count
    const { count } = await supabase
      .from('ratings')
      .select('*', { count: 'exact', head: true })
      .eq('courseId', courseId);

    // Get ratings with user info
    const { data: ratings, error } = await supabase
      .from('ratings')
      .select(`
        *,
        users (
          firstName,
          lastName,
          avatar
        )
      `)
      .eq('courseId', courseId)
      .order('createdAt', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    // Format response to match expected structure
    const formattedRatings = ratings.map(rating => ({
      ...rating,
      user: rating.users
    }));

    res.json({
      success: true,
      ratings: formattedRatings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalRatings: count
      }
    });
  } catch (error) {
    console.error('Get course ratings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get course reviews for instructor
export const getInstructorCourseReviews = async (req, res) => {
  try {
    const { courseId } = req.params;
    const instructorId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Verify course belongs to instructor
    const { data: course } = await supabase
      .from('courses')
      .select('id, title')
      .eq('id', courseId)
      .eq('instructorId', instructorId)
      .single();

    if (!course) {
      return res.status(404).json({ message: 'Course not found or unauthorized' });
    }

    // Get total count
    const { count } = await supabase
      .from('ratings')
      .select('*', { count: 'exact', head: true })
      .eq('courseId', courseId);

    // Get ratings with user info
    const { data: ratings, error } = await supabase
      .from('ratings')
      .select(`
        *,
        users (
          firstName,
          lastName,
          avatar
        )
      `)
      .eq('courseId', courseId)
      .order('createdAt', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    // Calculate rating statistics
    const allRatings = await supabase
      .from('ratings')
      .select('rating')
      .eq('courseId', courseId);

    let stats = {
      averageRating: 0,
      totalReviews: count || 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };

    if (allRatings.data && allRatings.data.length > 0) {
      const ratingValues = allRatings.data.map(r => r.rating);
      stats.averageRating = Math.round((ratingValues.reduce((sum, r) => sum + r, 0) / ratingValues.length) * 10) / 10;
      
      // Calculate distribution
      ratingValues.forEach(rating => {
        stats.ratingDistribution[rating]++;
      });
    }

    res.json({
      success: true,
      course: {
        id: course.id,
        title: course.title
      },
      stats,
      reviews: ratings.map(rating => ({
        ...rating,
        user: rating.users
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil((count || 0) / limit),
        totalReviews: count || 0
      }
    });
  } catch (error) {
    console.error('Get instructor course reviews error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getUserRating = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const { data: rating, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('userId', userId)
      .eq('courseId', courseId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"

    res.json({
      success: true,
      rating
    });
  } catch (error) {
    console.error('Get user rating error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const deleteRating = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from('ratings')
      .delete()
      .eq('userId', userId)
      .eq('courseId', courseId);

    if (error) throw error;

    // Update course average rating
    await updateCourseRating(courseId);

    res.json({
      success: true,
      message: 'Rating deleted successfully'
    });
  } catch (error) {
    console.error('Delete rating error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper function to update course average rating
const updateCourseRating = async (courseId) => {
  try {
    const { data: ratings, error } = await supabase
      .from('ratings')
      .select('rating')
      .eq('courseId', courseId);

    if (error) throw error;

    if (ratings.length === 0) {
      await supabase
        .from('courses')
        .update({ rating: 0 })
        .eq('id', courseId);
      return;
    }

    const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    await supabase
      .from('courses')
      .update({ 
        rating: Math.round(averageRating * 10) / 10 // Round to 1 decimal place
      })
      .eq('id', courseId);
  } catch (error) {
    console.error('Update course rating error:', error);
  }
};