import supabase from '../config/supabase.js';

// Track instructor earnings when course is purchased
export const trackInstructorEarning = async (courseId, grossAmount, userId) => {
  try {
    // Get course instructor
    const { data: course } = await supabase
      .from('courses')
      .select('instructorId')
      .eq('id', courseId)
      .single();

    if (!course) return;

    // Get commission rate from settings (default 10%)
    const commissionRate = 0.10; // 10%
    const commission = grossAmount * commissionRate;
    const netAmount = grossAmount - commission;

    // Create instructor earning record
    const { data: earning, error } = await supabase
      .from('instructor_earnings')
      .insert({
        instructorId: course.instructorId,
        courseId,
        userId, // student who purchased
        grossAmount,
        commission,
        netAmount,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error tracking instructor earning:', error);
    }

    return earning;
  } catch (error) {
    console.error('Track instructor earning error:', error);
  }
};

// Get instructor earnings dashboard
export const getInstructorEarnings = async (req, res) => {
  try {
    const instructorId = req.user.id;

    // Get total earnings
    const { data: totalEarnings } = await supabase
      .from('instructor_earnings')
      .select('netAmount')
      .eq('instructorId', instructorId);

    const totalEarned = totalEarnings?.reduce((sum, earning) => sum + earning.netAmount, 0) || 0;

    // Get pending earnings (not yet paid out)
    const { data: pendingEarnings } = await supabase
      .from('instructor_earnings')
      .select('netAmount')
      .eq('instructorId', instructorId)
      .eq('status', 'pending');

    const pendingAmount = pendingEarnings?.reduce((sum, earning) => sum + earning.netAmount, 0) || 0;

    // Get paid earnings
    const { data: paidEarnings } = await supabase
      .from('instructor_earnings')
      .select('netAmount')
      .eq('instructorId', instructorId)
      .eq('status', 'paid');

    const paidAmount = paidEarnings?.reduce((sum, earning) => sum + earning.netAmount, 0) || 0;

    // Get recent earnings with course details
    const { data: recentEarnings } = await supabase
      .from('instructor_earnings')
      .select(`
        *,
        courses (title),
        users (firstName, lastName)
      `)
      .eq('instructorId', instructorId)
      .order('createdAt', { ascending: false })
      .limit(10);

    res.json({
      success: true,
      earnings: {
        totalEarned,
        pendingAmount,
        paidAmount,
        recentEarnings: recentEarnings || []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings',
      error: error.message
    });
  }
};

// Admin: Get all instructor earnings for payout management
export const getAllInstructorEarnings = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const { data: earnings } = await supabase
      .from('instructor_earnings')
      .select(`
        *,
        users!instructor_earnings_instructorId_fkey (firstName, lastName, email),
        courses (title)
      `)
      .eq('status', status)
      .order('createdAt', { ascending: false });

    // Group by instructor
    const instructorEarnings = {};
    earnings?.forEach(earning => {
      const instructorId = earning.instructorId;
      if (!instructorEarnings[instructorId]) {
        instructorEarnings[instructorId] = {
          instructor: earning.users,
          totalPending: 0,
          earnings: []
        };
      }
      instructorEarnings[instructorId].totalPending += earning.netAmount;
      instructorEarnings[instructorId].earnings.push(earning);
    });

    res.json({
      success: true,
      instructorEarnings: Object.values(instructorEarnings)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch instructor earnings',
      error: error.message
    });
  }
};

// Admin: Process payout for instructor
export const processInstructorPayout = async (req, res) => {
  try {
    const { instructorId, earningIds, payoutAmount } = req.body;

    if (!instructorId || !earningIds || !payoutAmount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Update earnings status to 'paid'
    const { error } = await supabase
      .from('instructor_earnings')
      .update({ 
        status: 'paid',
        paidAt: new Date().toISOString()
      })
      .eq('instructorId', instructorId)
      .in('id', earningIds);

    if (error) throw error;

    // Create payout record
    const { data: payout } = await supabase
      .from('instructor_payouts')
      .insert({
        instructorId,
        amount: payoutAmount,
        status: 'completed',
        payoutMethod: 'manual', // In future: 'razorpay', 'bank_transfer'
        processedBy: req.user.id
      })
      .select()
      .single();

    res.json({
      success: true,
      message: 'Payout processed successfully',
      payout
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process payout',
      error: error.message
    });
  }
};

export default {
  trackInstructorEarning,
  getInstructorEarnings,
  getAllInstructorEarnings,
  processInstructorPayout
};