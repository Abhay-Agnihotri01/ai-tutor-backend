import supabase from '../config/supabase.js';

export const getInstructorAnalytics = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { days = 30 } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    // Get instructor's courses
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id, title, category, price, viewCount')
      .eq('instructorId', instructorId);

    if (coursesError) throw coursesError;

    const courseIds = courses?.map(course => course.id) || [];

    if (courseIds.length === 0) {
      return res.json({
        success: true,
        analytics: {
          totalRevenue: 0,
          monthlyRevenue: 0,
          totalEnrollments: 0,
          monthlyEnrollments: 0,
          averageOrderValue: 0,
          topCourses: [],
          revenueChart: [],
          enrollmentChart: []
        }
      });
    }

    // Get revenue records for detailed analytics
    const { data: revenueRecords, error: revenueError } = await supabase
      .from('revenue_records')
      .select('*')
      .eq('instructor_id', instructorId)
      .gte('created_at', daysAgo.toISOString())
      .order('created_at', { ascending: true });

    // Get all enrollments with timestamps and actual price paid
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('enrollments')
      .select('*, enrolledAt, pricePaid')
      .in('courseId', courseIds);

    if (enrollmentsError) throw enrollmentsError;

    // Calculate metrics from revenue records if available, otherwise fallback to enrollments
    let totalRevenue = 0;
    let monthlyRevenue = 0;
    
    if (revenueRecords && revenueRecords.length > 0) {
      // Use actual revenue records
      const { data: allRevenue } = await supabase
        .from('revenue_records')
        .select('amount')
        .eq('instructor_id', instructorId);
      
      totalRevenue = allRevenue?.reduce((sum, record) => sum + parseFloat(record.amount), 0) || 0;
      monthlyRevenue = revenueRecords.reduce((sum, record) => sum + parseFloat(record.amount), 0);
    } else {
      // Use actual price paid from enrollments
      for (const enrollment of enrollments || []) {
        const pricePaid = enrollment.pricePaid || 0;
        totalRevenue += pricePaid;
        
        // Check if enrollment is within time range
        if (enrollment.enrolledAt && new Date(enrollment.enrolledAt) >= daysAgo) {
          monthlyRevenue += pricePaid;
        }
      }
    }

    const totalEnrollments = enrollments?.length || 0;
    const monthlyEnrollments = enrollments?.filter(e => 
      e.enrolledAt && new Date(e.enrolledAt) >= daysAgo
    ).length || 0;
    
    const averageOrderValue = totalEnrollments > 0 ? totalRevenue / totalEnrollments : 0;

    // Generate detailed chart data
    const revenueChart = [];
    const enrollmentChart = [];
    const chartDays = Math.min(parseInt(days), 30);
    
    // Check if we have any enrollments with timestamps
    const hasTimestamps = enrollments?.some(e => e.enrolledAt) || false;
    
    for (let i = chartDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      let dayRevenue = 0;
      let dayEnrollments = 0;

      if (revenueRecords && revenueRecords.length > 0) {
        // Use revenue records for accurate daily revenue
        dayRevenue = revenueRecords
          .filter(record => record.created_at.startsWith(dateStr))
          .reduce((sum, record) => sum + parseFloat(record.amount), 0);
      } else if (hasTimestamps) {
        // Use actual enrollment timestamps
        const dayEnrollmentsList = enrollments?.filter(enrollment => 
          enrollment.enrolledAt && enrollment.enrolledAt.startsWith(dateStr)
        ) || [];
        
        dayEnrollments = dayEnrollmentsList.length;
        dayRevenue = dayEnrollmentsList.reduce((sum, enrollment) => {
          return sum + (enrollment.pricePaid || 0);
        }, 0);
      } else {
        // Fallback: distribute data evenly for demo purposes
        if (totalRevenue > 0 || totalEnrollments > 0) {
          // Show data on the last few days to simulate recent activity
          if (i < 3) {
            dayRevenue = Math.floor(totalRevenue / 3);
            dayEnrollments = Math.floor(totalEnrollments / 3);
          }
        }
      }

      revenueChart.push({ date: dateStr, revenue: dayRevenue });
      enrollmentChart.push({ date: dateStr, enrollments: dayEnrollments });
    }

    // Calculate comprehensive course statistics
    const courseStats = [];
    
    for (const course of courses || []) {
      const courseEnrollments = enrollments?.filter(e => e.courseId === course.id) || [];
      const courseRevenue = courseEnrollments.reduce((sum, enrollment) => sum + (enrollment.pricePaid || 0), 0);
      
      // Get ratings
      const { data: ratings } = await supabase
        .from('ratings')
        .select('rating')
        .eq('courseId', course.id);

      const avgRating = ratings?.length > 0 
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
        : 0;

      // Calculate conversion rate (enrollments vs views)
      const views = course.viewCount || 0;
      const conversionRate = views > 0 ? courseEnrollments.length / views : 0;

      courseStats.push({
        id: course.id,
        title: course.title,
        category: course.category,
        enrollments: courseEnrollments.length,
        revenue: courseRevenue,
        rating: avgRating,
        conversionRate: Math.min(conversionRate, 1),
        views: views
      });
    }

    const topCourses = courseStats
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({
      success: true,
      analytics: {
        totalRevenue,
        monthlyRevenue,
        totalEnrollments,
        monthlyEnrollments,
        averageOrderValue,
        topCourses,
        revenueChart,
        enrollmentChart
      }
    });

  } catch (error) {
    console.error('Get instructor analytics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};