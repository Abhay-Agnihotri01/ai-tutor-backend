import express from 'express';
import supabase from '../config/supabase.js';

const router = express.Router();

// Debug: Check enrollments for a user
router.get('/debug/enrollments/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select('*')
      .eq('userId', userId);

    res.json({
      success: true,
      userId,
      enrollments: enrollments || [],
      count: enrollments?.length || 0,
      error: error?.message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug: Get all users (for testing)
router.get('/debug/all-users', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, firstName, lastName, email, role')
      .limit(10);

    res.json({
      success: true,
      users: users || [],
      count: users?.length || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Get public profile
router.get('/public-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    // Get user basic info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, firstName, lastName, email, role, avatar, bio, location, createdAt')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: userError?.message
      });
    }

    // Get user's enrollments
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('enrollments')
      .select('id, progress, enrolledAt, courseId')
      .eq('userId', userId);

    // Get course details for each enrollment
    const enrichedEnrollments = [];
    if (enrollments && enrollments.length > 0) {
      for (const enrollment of enrollments) {
        const { data: course } = await supabase
          .from('courses')
          .select('id, title, thumbnail')
          .eq('id', enrollment.courseId)
          .single();
        
        enrichedEnrollments.push({
          ...enrollment,
          Course: course
        });
      }
    }

    res.json({
      success: true,
      user,
      enrollments: enrichedEnrollments || [],
      achievements: [] // Can be expanded later
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch public profile',
      error: error.message
    });
  }
});

export default router;