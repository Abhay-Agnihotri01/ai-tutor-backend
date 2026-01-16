import supabase from '../config/supabase.js';

// Create/Update Course Review
export const createOrUpdateReview = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { rating, reviewText } = req.body;
    const userId = req.user.id;

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Check if user is enrolled in the course
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('courseId', courseId)
      .eq('userId', userId)
      .single();

    if (!enrollment) {
      return res.status(403).json({ message: 'You must be enrolled to review this course' });
    }

    // Check if review already exists
    const { data: existingReview } = await supabase
      .from('course_reviews')
      .select('id')
      .eq('courseId', courseId)
      .eq('userId', userId)
      .single();

    let review;
    if (existingReview) {
      // Update existing review
      const { data, error } = await supabase
        .from('course_reviews')
        .update({
          rating,
          reviewText: reviewText,
          updatedAt: new Date().toISOString()
        })
        .eq('id', existingReview.id)
        .select(`
          *,
          users (firstName, lastName, avatar)
        `)
        .single();

      if (error) throw error;
      review = data;
    } else {
      // Create new review
      const { data, error } = await supabase
        .from('course_reviews')
        .insert({
          courseId: courseId,
          userId: userId,
          rating,
          reviewText: reviewText
        })
        .select(`
          *,
          users (firstName, lastName, avatar)
        `)
        .single();

      if (error) throw error;
      review = data;
    }

    // Update course rating
    await updateCourseRating(courseId);

    res.json({ success: true, review });
  } catch (error) {
    console.error('Create/Update review error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Course Reviews
export const getCourseReviews = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { data: reviews, error, count } = await supabase
      .from('course_reviews')
      .select(`
        *,
        users (firstName, lastName, avatar)
      `, { count: 'exact' })
      .eq('courseId', courseId)
      .eq('isPublished', true)
      .order('createdAt', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    // Get rating distribution
    const { data: ratingStats } = await supabase
      .from('course_reviews')
      .select('rating')
      .eq('courseId', courseId)
      .eq('isPublished', true);

    const ratingDistribution = {
      5: 0, 4: 0, 3: 0, 2: 0, 1: 0
    };

    ratingStats?.forEach(review => {
      ratingDistribution[review.rating]++;
    });

    const totalReviews = ratingStats?.length || 0;
    const averageRating = totalReviews > 0 
      ? ratingStats.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
      : 0;

    res.json({
      success: true,
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil((count || 0) / limit),
        totalReviews: count || 0
      },
      stats: {
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews,
        ratingDistribution
      }
    });
  } catch (error) {
    console.error('Get course reviews error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete Review
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    const { data: review } = await supabase
      .from('course_reviews')
      .select('courseId')
      .eq('id', reviewId)
      .eq('userId', userId)
      .single();

    if (!review) {
      return res.status(404).json({ message: 'Review not found or unauthorized' });
    }

    const { error } = await supabase
      .from('course_reviews')
      .delete()
      .eq('id', reviewId);

    if (error) throw error;

    // Update course rating
    await updateCourseRating(review.courseId);

    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper function to update course rating
const updateCourseRating = async (courseId) => {
  try {
    const { data: reviews } = await supabase
      .from('course_reviews')
      .select('rating')
      .eq('courseId', courseId)
      .eq('isPublished', true);

    if (reviews && reviews.length > 0) {
      const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      
      await supabase
        .from('courses')
        .update({ rating: Math.round(averageRating * 10) / 10 })
        .eq('id', courseId);
    } else {
      await supabase
        .from('courses')
        .update({ rating: 0 })
        .eq('id', courseId);
    }
  } catch (error) {
    console.error('Update course rating error:', error);
  }
};