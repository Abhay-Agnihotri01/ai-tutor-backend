import Razorpay from 'razorpay';
import crypto from 'crypto';
// Removed Sequelize import
import supabase from '../config/supabase.js';
import { trackInstructorEarning } from './payoutController.js';

// Initialize Razorpay instance
const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured');
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

export const createOrder = async (req, res) => {
  try {
    const { courseId, courses, totalAmount } = req.body;
    const userId = req.user.id;

    let razorpay;
    try {
      razorpay = getRazorpayInstance();
    } catch (error) {
      return res.status(500).json({ message: 'Payment gateway not configured', error: error.message });
    }

    // Handle single course (existing functionality)
    if (courseId && !courses) {
      // Check if course exists
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError || !course) {
        return res.status(404).json({ message: 'Course not found' });
      }

      // Check if already enrolled
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('userId', userId)
        .eq('courseId', courseId)
        .single();

      if (existingEnrollment) {
        return res.status(400).json({ message: 'Already enrolled in this course' });
      }

      // For free courses, enroll directly
      const finalPrice = course.discountPrice !== null ? course.discountPrice : course.price;
      const numericPrice = parseFloat(finalPrice);

      if (numericPrice === 0) {
        const { data: enrollment, error: enrollError } = await supabase
          .from('enrollments')
          .insert({
            userId,
            courseId,
            progress: 0
          })
          .select()
          .single();

        if (enrollError) throw enrollError;

        return res.json({
          success: true,
          enrollment,
          message: 'Enrolled in free course successfully'
        });
      }

      // Create Razorpay order for single course
      const amount = Math.round((course.discountPrice || course.price) * 100);
      const options = {
        amount,
        currency: 'INR',
        receipt: `course_${Date.now()}`,
        notes: {
          courseId,
          userId,
          courseTitle: course.title
        }
      };

      const order = await razorpay.orders.create(options);

      return res.json({
        success: true,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          courseId,
          courseTitle: course.title,
          coursePrice: course.discountPrice || course.price
        }
      });
    }

    // Handle multiple courses (cart checkout)
    if (courses && Array.isArray(courses)) {
      // Validate all courses exist and user not enrolled
      const courseIds = courses.map(c => c.courseId);
      
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .in('id', courseIds);

      if (coursesError || !coursesData || coursesData.length !== courses.length) {
        return res.status(404).json({ message: 'One or more courses not found' });
      }

      // Check for existing enrollments
      const { data: existingEnrollments } = await supabase
        .from('enrollments')
        .select('courseId')
        .eq('userId', userId)
        .in('courseId', courseIds);

      if (existingEnrollments && existingEnrollments.length > 0) {
        const enrolledCourseIds = existingEnrollments.map(e => e.courseId);
        const enrolledCourses = coursesData.filter(c => enrolledCourseIds.includes(c.id));
        return res.status(400).json({ 
          message: `Already enrolled in: ${enrolledCourses.map(c => c.title).join(', ')}` 
        });
      }

      // Create Razorpay order for cart
      const amount = Math.round(totalAmount * 100);
      const options = {
        amount,
        currency: 'INR',
        receipt: `cart_${Date.now()}`,
        notes: {
          userId,
          courseCount: courses.length,
          courseIds: courseIds.join(',')
        }
      };

      const order = await razorpay.orders.create(options);

      return res.json({
        success: true,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          courses: coursesData.map(course => ({
            id: course.id,
            title: course.title,
            price: course.discountPrice || course.price
          }))
        }
      });
    }

    return res.status(400).json({ message: 'Invalid request parameters' });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Failed to create order', error: error.message });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      courseId,
      courses
    } = req.body;
    const userId = req.user.id;

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    // Get payment details from Razorpay
    const razorpay = getRazorpayInstance();
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    
    if (payment.status !== 'captured') {
      return res.status(400).json({ message: 'Payment not captured' });
    }

    // Handle single course enrollment
    if (courseId && !courses) {
      // Check if already enrolled (double-check)
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('userId', userId)
        .eq('courseId', courseId)
        .single();

      if (existingEnrollment) {
        return res.status(400).json({ message: 'Already enrolled in this course' });
      }

      // Get course price for revenue tracking
      const { data: courseData } = await supabase
        .from('courses')
        .select('price, discountPrice')
        .eq('id', courseId)
        .single();
      
      const pricePaid = courseData?.discountPrice || courseData?.price || 0;

      // Create enrollment with price paid
      const { data: enrollment, error: enrollError } = await supabase
        .from('enrollments')
        .insert({
          userId,
          courseId,
          progress: 0,
          pricePaid: parseFloat(pricePaid)
        })
        .select()
        .single();

      if (enrollError) throw enrollError;

      // Track instructor earning
      await trackInstructorEarning(courseId, parseFloat(pricePaid), userId);

      return res.json({
        success: true,
        enrollment,
        message: 'Payment verified and enrollment completed successfully'
      });
    }

    // Handle multiple course enrollments (cart)
    if (courses && Array.isArray(courses)) {
      // Check for existing enrollments
      const { data: existingEnrollments } = await supabase
        .from('enrollments')
        .select('courseId')
        .eq('userId', userId)
        .in('courseId', courses);

      const alreadyEnrolled = existingEnrollments?.map(e => e.courseId) || [];
      const coursesToEnroll = courses.filter(courseId => !alreadyEnrolled.includes(courseId));

      if (coursesToEnroll.length === 0) {
        return res.status(400).json({ message: 'Already enrolled in all courses' });
      }

      // Get course prices for revenue tracking
      const { data: coursePrices } = await supabase
        .from('courses')
        .select('id, price, discountPrice')
        .in('id', coursesToEnroll);

      // Create enrollments for all courses with price paid
      const enrollmentData = coursesToEnroll.map(courseId => {
        const coursePrice = coursePrices?.find(c => c.id === courseId);
        const pricePaid = coursePrice?.discountPrice || coursePrice?.price || 0;
        
        return {
          userId,
          courseId,
          progress: 0,
          pricePaid: parseFloat(pricePaid)
        };
      });

      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .insert(enrollmentData)
        .select();

      if (enrollError) throw enrollError;

      // Track instructor earnings for each course
      for (const enrollment of enrollments) {
        const coursePrice = coursePrices?.find(c => c.id === enrollment.courseId);
        const pricePaid = coursePrice?.discountPrice || coursePrice?.price || 0;
        await trackInstructorEarning(enrollment.courseId, parseFloat(pricePaid), userId);
      }

      // Clear cart after successful enrollment
      await supabase
        .from('cart')
        .delete()
        .eq('userId', userId)
        .in('courseId', courses);

      return res.json({
        success: true,
        enrollments,
        enrolledCount: enrollments.length,
        message: `Successfully enrolled in ${enrollments.length} course${enrollments.length > 1 ? 's' : ''}`
      });
    }

    return res.status(400).json({ message: 'Invalid request parameters' });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ message: 'Payment verification failed', error: error.message });
  }
};

export const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        courses(title, thumbnail, price, discountPrice)
      `)
      .eq('userId', userId)
      .order('enrolledAt', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      payments: enrollments.map(enrollment => ({
        id: enrollment.id,
        course: enrollment.courses,
        enrolledAt: enrollment.enrolledAt
      }))
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ message: 'Failed to fetch payment history', error: error.message });
  }
};