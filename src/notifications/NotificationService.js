import EmailProvider from './providers/EmailProvider.js';
import supabase from '../config/supabase.js';
import socketService from '../services/socketService.js';

class NotificationService {
  constructor() {
    this.emailProvider = new EmailProvider();
  }

  // Check if user wants this notification type
  async shouldNotify(userId, notificationType, channel = 'email') {
    try {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('userId', userId)
        .single();

      if (!prefs) return true; // Default: notify if no preferences set

      const prefMap = {
        enrollment: prefs.emailEnrollment,
        payment: prefs.emailPayment,
        progress: prefs.emailProgress,
        quiz: prefs.emailQuizResults,
        certificate: prefs.emailCertificates,
        badge: prefs.emailBadges,
        discussion: prefs.emailDiscussions
      };

      return prefMap[notificationType] !== false;
    } catch {
      return true; // Default to sending
    }
  }

  // ==========================================
  // NEW: Activity-Based Notifications
  // ==========================================

  // Send enrollment welcome notification
  async sendEnrollmentNotification(userId, courseId) {
    try {
      if (!(await this.shouldNotify(userId, 'enrollment'))) return { success: true, skipped: true };

      const { data: user } = await supabase
        .from('users')
        .select('id, firstName, lastName, email')
        .eq('id', userId)
        .single();

      const { data: course } = await supabase
        .from('courses')
        .select('title, instructor:users(firstName, lastName)')
        .eq('id', courseId)
        .single();

      if (!user || !course) return { success: false, error: 'User or course not found' };

      const subject = `Welcome to ${course.title}! 🎉`;
      const html = this.generateEnrollmentEmail({
        userName: user.firstName,
        courseName: course.title,
        instructorName: `${course.instructor?.firstName} ${course.instructor?.lastName}`,
        courseId
      });

      await this.storeNotification({
        type: 'enrollment',
        courseId,
        recipients: [userId],
        subject,
        content: html,
        metadata: { courseName: course.title }
      });

      await this.emailProvider.sendEmail(user.email, subject, html);
      return { success: true };
    } catch (error) {
      console.error('Enrollment notification error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send payment receipt notification
  async sendPaymentNotification(userId, courses, totalAmount, paymentId) {
    try {
      if (!(await this.shouldNotify(userId, 'payment'))) return { success: true, skipped: true };

      const { data: user } = await supabase
        .from('users')
        .select('id, firstName, lastName, email')
        .eq('id', userId)
        .single();

      if (!user) return { success: false, error: 'User not found' };

      const subject = `Payment Confirmed - LearnHub Receipt`;
      const html = this.generatePaymentEmail({
        userName: user.firstName,
        courses,
        totalAmount,
        paymentId,
        date: new Date().toLocaleDateString()
      });

      await this.storeNotification({
        type: 'payment',
        recipients: [userId],
        subject,
        content: html,
        metadata: { totalAmount, paymentId, courseCount: courses.length }
      });

      await this.emailProvider.sendEmail(user.email, subject, html);
      return { success: true };
    } catch (error) {
      console.error('Payment notification error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send progress milestone notification (25%, 50%, 75%, 100%)
  async sendProgressMilestoneNotification(userId, courseId, milestone) {
    try {
      if (!(await this.shouldNotify(userId, 'progress'))) return { success: true, skipped: true };

      const { data: user } = await supabase
        .from('users')
        .select('id, firstName, email')
        .eq('id', userId)
        .single();

      const { data: course } = await supabase
        .from('courses')
        .select('title')
        .eq('id', courseId)
        .single();

      if (!user || !course) return { success: false };

      const milestoneMessages = {
        25: "You're 25% through the course! Keep going! 💪",
        50: "Halfway there! You're doing amazing! 🌟",
        75: "Almost done! Just 25% left! 🔥",
        100: "Congratulations! You completed the course! 🎉"
      };

      const subject = milestone === 100
        ? `Congratulations! You completed ${course.title}! 🎓`
        : `${milestone}% Complete - ${course.title}`;

      const html = this.generateMilestoneEmail({
        userName: user.firstName,
        courseName: course.title,
        milestone,
        message: milestoneMessages[milestone],
        courseId
      });

      await this.storeNotification({
        type: 'progress_milestone',
        courseId,
        recipients: [userId],
        subject,
        content: html,
        metadata: { milestone }
      });

      await this.emailProvider.sendEmail(user.email, subject, html);
      return { success: true };
    } catch (error) {
      console.error('Milestone notification error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send quiz result notification
  async sendQuizResultNotification(userId, quizId, score, passed) {
    try {
      if (!(await this.shouldNotify(userId, 'quiz'))) return { success: true, skipped: true };

      const { data: user } = await supabase
        .from('users')
        .select('id, firstName, email')
        .eq('id', userId)
        .single();

      const { data: quiz } = await supabase
        .from('quizzes')
        .select('title, courseId, courses(title)')
        .eq('id', quizId)
        .single();

      if (!user || !quiz) return { success: false };

      const subject = passed
        ? `🎉 You passed: ${quiz.title}!`
        : `Quiz Results: ${quiz.title}`;

      const html = this.generateQuizResultEmail({
        userName: user.firstName,
        quizTitle: quiz.title,
        courseName: quiz.courses?.title,
        score,
        passed,
        courseId: quiz.courseId
      });

      await this.storeNotification({
        type: 'quiz_result',
        courseId: quiz.courseId,
        recipients: [userId],
        subject,
        content: html,
        metadata: { quizId, score, passed }
      });

      await this.emailProvider.sendEmail(user.email, subject, html);
      return { success: true };
    } catch (error) {
      console.error('Quiz result notification error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send certificate ready notification
  async sendCertificateNotification(userId, courseId, certificateId) {
    try {
      if (!(await this.shouldNotify(userId, 'certificate'))) return { success: true, skipped: true };

      const { data: user } = await supabase
        .from('users')
        .select('id, firstName, email')
        .eq('id', userId)
        .single();

      const { data: course } = await supabase
        .from('courses')
        .select('title')
        .eq('id', courseId)
        .single();

      if (!user || !course) return { success: false };

      const subject = `🎓 Your Certificate is Ready! - ${course.title}`;
      const html = this.generateCertificateEmail({
        userName: user.firstName,
        courseName: course.title,
        certificateId,
        courseId
      });

      await this.storeNotification({
        type: 'certificate',
        courseId,
        recipients: [userId],
        subject,
        content: html,
        metadata: { certificateId }
      });

      await this.emailProvider.sendEmail(user.email, subject, html);
      return { success: true };
    } catch (error) {
      console.error('Certificate notification error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send badge earned notification
  async sendBadgeEarnedNotification(userId, badgeId) {
    try {
      if (!(await this.shouldNotify(userId, 'badge'))) return { success: true, skipped: true };

      const { data: user } = await supabase
        .from('users')
        .select('id, firstName, email')
        .eq('id', userId)
        .single();

      const { data: badge } = await supabase
        .from('badges')
        .select('name, description, icon, xpReward')
        .eq('id', badgeId)
        .single();

      if (!user || !badge) return { success: false };

      const subject = `🏆 New Badge Earned: ${badge.name}!`;
      const html = this.generateBadgeEmail({
        userName: user.firstName,
        badgeName: badge.name,
        badgeDescription: badge.description,
        xpReward: badge.xpReward
      });

      await this.storeNotification({
        type: 'badge_earned',
        recipients: [userId],
        subject,
        content: html,
        metadata: { badgeId, badgeName: badge.name, xpReward: badge.xpReward }
      });

      await this.emailProvider.sendEmail(user.email, subject, html);
      return { success: true };
    } catch (error) {
      console.error('Badge notification error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send discussion reply notification
  async sendDiscussionReplyNotification(originalUserId, replyUserId, discussionId, courseId) {
    try {
      if (!(await this.shouldNotify(originalUserId, 'discussion'))) return { success: true, skipped: true };
      if (originalUserId === replyUserId) return { success: true, skipped: true }; // Don't notify self

      const { data: originalUser } = await supabase
        .from('users')
        .select('id, firstName, email')
        .eq('id', originalUserId)
        .single();

      const { data: replyUser } = await supabase
        .from('users')
        .select('firstName, lastName')
        .eq('id', replyUserId)
        .single();

      const { data: course } = await supabase
        .from('courses')
        .select('title')
        .eq('id', courseId)
        .single();

      if (!originalUser || !replyUser) return { success: false };

      const subject = `New Reply in ${course?.title || 'Discussion'}`;
      const html = this.generateDiscussionReplyEmail({
        userName: originalUser.firstName,
        replierName: `${replyUser.firstName} ${replyUser.lastName}`,
        courseName: course?.title,
        courseId,
        discussionId
      });

      await this.storeNotification({
        type: 'discussion_reply',
        courseId,
        recipients: [originalUserId],
        subject,
        content: html,
        metadata: { discussionId, replierName: `${replyUser.firstName} ${replyUser.lastName}` }
      });

      await this.emailProvider.sendEmail(originalUser.email, subject, html);
      return { success: true };
    } catch (error) {
      console.error('Discussion reply notification error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // Original Methods Below
  // ==========================================

  // Get enrolled students for a course
  async getCourseStudents(courseId) {
    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select(`
        userId,
        users (
          id,
          firstName,
          lastName,
          email
        )
      `)
      .eq('courseId', courseId);

    if (error) throw error;
    return enrollments?.map(e => e.users).filter(Boolean) || [];
  }

  // Send course update notification
  async sendCourseUpdate(courseId, updateType, updateData) {
    try {
      const students = await this.getCourseStudents(courseId);
      if (students.length === 0) return { success: true, sent: 0 };

      const { data: course } = await supabase
        .from('courses')
        .select('title, instructor:users(firstName, lastName)')
        .eq('id', courseId)
        .single();

      const emailData = {
        courseName: course?.title || 'Course',
        instructorName: `${course?.instructor?.firstName} ${course?.instructor?.lastName}`,
        updateType,
        ...updateData
      };

      const { subject, html } = this.generateUpdateEmail(emailData);
      const recipients = students.map(s => s.email);

      // Store notification in database
      await this.storeNotification({
        type: 'course_update',
        courseId,
        recipients: students.map(s => s.id),
        subject,
        content: html,
        metadata: { updateType, ...updateData }
      });

      // Send emails
      const results = await this.emailProvider.sendBulkEmail(recipients, subject, html);
      const successCount = results.filter(r => !r.error).length;

      return { success: true, sent: successCount, total: recipients.length };
    } catch (error) {
      console.error('Failed to send course update:', error);
      return { success: false, error: error.message };
    }
  }

  // Send custom message to enrolled students
  async sendCustomMessage(courseId, subject, message, instructorId) {
    try {
      const students = await this.getCourseStudents(courseId);
      if (students.length === 0) return { success: true, sent: 0 };

      const { data: course } = await supabase
        .from('courses')
        .select('title')
        .eq('id', courseId)
        .single();

      const { data: instructor } = await supabase
        .from('users')
        .select('firstName, lastName')
        .eq('id', instructorId)
        .single();

      const emailData = {
        courseName: course?.title || 'Course',
        instructorName: `${instructor?.firstName} ${instructor?.lastName}`,
        customMessage: message,
        subject
      };

      const html = this.generateCustomMessageEmail(emailData);
      const recipients = students.map(s => s.email);

      // Store notification
      await this.storeNotification({
        type: 'custom_message',
        courseId,
        senderId: instructorId,
        recipients: students.map(s => s.id),
        subject,
        content: html,
        metadata: { message }
      });

      // Send emails
      const results = await this.emailProvider.sendBulkEmail(recipients, subject, html);
      const successCount = results.filter(r => !r.error).length;

      return { success: true, sent: successCount, total: recipients.length };
    } catch (error) {
      console.error('Failed to send custom message:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate update email template
  generateUpdateEmail(data) {
    const { courseName, instructorName, updateType, updateData } = data;

    let updateMessage = '';
    let subject = '';

    switch (updateType) {
      case 'new_video':
        subject = `New Video Added - ${courseName}`;
        updateMessage = `A new video "${updateData.title}" has been added to your course.`;
        break;
      case 'live_class':
        subject = `Live Class Scheduled - ${courseName}`;
        updateMessage = `A live class "${updateData.title}" has been scheduled for ${new Date(updateData.scheduledAt).toLocaleString()}.`;
        break;
      case 'new_assignment':
        subject = `New Assignment - ${courseName}`;
        updateMessage = `A new assignment "${updateData.title}" has been posted.`;
        break;
      case 'course_update':
        subject = `Course Updated - ${courseName}`;
        updateMessage = `Your course has been updated with new content.`;
        break;
      default:
        subject = `Course Update - ${courseName}`;
        updateMessage = `There's a new update in your course.`;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">LearnHub</h1>
          <p style="color: #f0f0f0; margin: 10px 0 0 0;">Learning Management System</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
          <h2 style="color: #333; margin-top: 0;">${subject}</h2>
          
          <p>Hello!</p>
          
          <p>${updateMessage}</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">Course: ${courseName}</h3>
            <p style="margin-bottom: 0;"><strong>Instructor:</strong> ${instructorName}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/learn/${data.courseId || ''}" 
               style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              View Course
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Best regards,<br>
            The LearnHub Team
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>© 2024 LearnHub. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return { subject, html };
  }

  // Generate custom message email template
  generateCustomMessageEmail(data) {
    const { courseName, instructorName, customMessage, subject } = data;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">LearnHub</h1>
          <p style="color: #f0f0f0; margin: 10px 0 0 0;">Message from your Instructor</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
          <h2 style="color: #333; margin-top: 0;">${subject}</h2>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">Course: ${courseName}</h3>
            <p style="margin-bottom: 0;"><strong>From:</strong> ${instructorName}</p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; white-space: pre-line;">${customMessage}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/learn/${data.courseId || ''}" 
               style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              View Course
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Best regards,<br>
            ${instructorName}
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>© 2024 LearnHub. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  // Store notification in database for tracking
  async storeNotification(notificationData) {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        type: notificationData.type,
        courseId: notificationData.courseId,
        senderId: notificationData.senderId,
        subject: notificationData.subject,
        content: notificationData.content, // HTML content
        metadata: notificationData.metadata,
        sentAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to store notification:', error);
      return;
    }

    // Create recipient records
    if (notificationData.recipients && notificationData.recipients.length > 0) {
      const recipientRecords = notificationData.recipients.map(userId => ({
        notification_id: notification.id,
        user_id: userId,
        isRead: false
      }));

      const { error: recipientError } = await supabase
        .from('notification_recipients')
        .insert(recipientRecords);

      if (recipientError) {
        console.error('Failed to store notification recipients:', recipientError);
      } else {
        // Send real-time notifications via Socket.IO
        notificationData.recipients.forEach(userId => {
          socketService.sendNotificationToUser(userId, {
            ...notification,
            isRead: false
          });
        });
      }
    }

    return notification;
  }

  // Get notifications for a user
  async getUserNotifications(userId, limit = 20, offset = 0) {
    // Join notification_recipients with notifications
    const { data, error, count } = await supabase
      .from('notification_recipients')
      .select(`
        id,
        isRead,
        readAt,
        createdAt,
        notifications!notification_id (
          id,
          type,
          courseId,
          senderId,
          subject,
          content,
          metadata,
          sentAt,
          sender:users (firstName, lastName, avatar) 
        )
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('CRITICAL NOTIFICATION ERROR:', JSON.stringify(error, null, 2));
      console.error('Query Params:', { userId, limit, offset });
      throw error;
    }

    // Also get unread count
    const { count: unreadCount, error: countError } = await supabase
      .from('notification_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('isRead', false);

    if (countError) {
      console.error('Error fetching unread count:', countError);
    }

    return {
      notifications: data,
      total: count,
      unreadCount: unreadCount || 0
    };
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    // Note: notificationId here refers to the ID of the notification_recipients record (the link)
    // or the actual notification ID?
    // Based on previous logic, we might have been passing the notification ID.
    // But logically, for a specific user read status, we update a row in notification_recipients.
    // If we pass the actual notification.id, we filter by notification_id AND user_id.

    const { error } = await supabase
      .from('notification_recipients')
      .update({ isRead: true, readAt: new Date().toISOString() })
      .eq('notification_id', notificationId) // Assuming input is notification ID
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  }

  // Mark all as read
  async markAllAsRead(userId) {
    const { error } = await supabase
      .from('notification_recipients')
      .update({ isRead: true, readAt: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('isRead', false);

    if (error) throw error;
    return { success: true };
  }

  // ==========================================
  // NEW: Email Template Generators
  // ==========================================

  generateEnrollmentEmail(data) {
    const { userName, courseName, instructorName, courseId } = data;
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Your Course! 🎉</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
          <p>Hi ${userName},</p>
          <p>Congratulations! You've successfully enrolled in:</p>
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">${courseName}</h3>
            <p style="margin-bottom: 0;"><strong>Instructor:</strong> ${instructorName}</p>
          </div>
          <p>Start learning now and achieve your goals!</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/learn/${courseId}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Start Learning</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generatePaymentEmail(data) {
    const { userName, courses, totalAmount, paymentId, date } = data;
    const courseList = courses.map(c => `<li>${c.title} - ₹${c.price}</li>`).join('');
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Payment Confirmed ✓</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
          <p>Hi ${userName},</p>
          <p>Thank you for your purchase!</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Order ID:</strong> ${paymentId}</p>
            <p><strong>Date:</strong> ${date}</p>
            <hr style="border: none; border-top: 1px solid #eee;">
            <p><strong>Courses Purchased:</strong></p>
            <ul>${courseList}</ul>
            <hr style="border: none; border-top: 1px solid #eee;">
            <h3 style="text-align: right; color: #10b981;">Total: ₹${totalAmount}</h3>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/my-learning" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Start Learning</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateMilestoneEmail(data) {
    const { userName, courseName, milestone, message, courseId } = data;
    const progressColor = milestone === 100 ? '#10b981' : '#667eea';
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${progressColor} 0%, ${milestone === 100 ? '#059669' : '#764ba2'} 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${milestone}% Complete!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
          <p>Hi ${userName},</p>
          <p style="font-size: 18px;">${message}</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">${courseName}</h3>
            <div style="background: #e5e7eb; border-radius: 10px; height: 20px; overflow: hidden;">
              <div style="background: ${progressColor}; height: 100%; width: ${milestone}%; border-radius: 10px;"></div>
            </div>
            <p style="text-align: center; margin-top: 10px; font-weight: bold;">${milestone}% Complete</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/learn/${courseId}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">${milestone === 100 ? 'View Certificate' : 'Continue Learning'}</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateQuizResultEmail(data) {
    const { userName, quizTitle, courseName, score, passed, courseId } = data;
    const resultColor = passed ? '#10b981' : '#ef4444';
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${resultColor} 0%, ${passed ? '#059669' : '#dc2626'} 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${passed ? 'You Passed! 🎉' : 'Quiz Results'}</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
          <p>Hi ${userName},</p>
          <p>Here are your quiz results:</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h3 style="margin-top: 0;">${quizTitle}</h3>
            <p style="color: #666;">${courseName}</p>
            <div style="font-size: 48px; font-weight: bold; color: ${resultColor};">${score}%</div>
            <p style="font-size: 18px; color: ${resultColor};">${passed ? '✓ PASSED' : '✗ Not Passed'}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/learn/${courseId}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">${passed ? 'Continue Course' : 'Try Again'}</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateCertificateEmail(data) {
    const { userName, courseName, certificateId, courseId } = data;
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎓 Certificate Ready!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
          <p>Hi ${userName},</p>
          <p>Congratulations on completing the course! Your certificate of completion is ready.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; border: 2px dashed #f59e0b; margin: 20px 0; text-align: center;">
            <h3 style="margin-top: 0; color: #d97706;">Certificate of Completion</h3>
            <p style="font-size: 18px; font-weight: bold;">${courseName}</p>
            <p style="color: #666;">Certificate ID: ${certificateId}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/certificates" style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Certificate</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateBadgeEmail(data) {
    const { userName, badgeName, badgeDescription, xpReward } = data;
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🏆 New Badge Earned!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
          <p>Hi ${userName},</p>
          <p>You've earned a new badge!</p>
          <div style="background: white; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 10px;">🏆</div>
            <h2 style="margin: 10px 0; color: #8b5cf6;">${badgeName}</h2>
            <p style="color: #666;">${badgeDescription}</p>
            ${xpReward ? `<p style="color: #10b981; font-weight: bold;">+${xpReward} XP</p>` : ''}
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/profile" style="background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View All Badges</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateDiscussionReplyEmail(data) {
    const { userName, replierName, courseName, courseId, discussionId } = data;
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">💬 New Reply</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
          <p>Hi ${userName},</p>
          <p><strong>${replierName}</strong> replied to your discussion in <strong>${courseName || 'your course'}</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/learn/${courseId}?discussion=${discussionId}" style="background: #06b6d4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Reply</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export default NotificationService;