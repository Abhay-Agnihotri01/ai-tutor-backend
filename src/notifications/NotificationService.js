import EmailProvider from './providers/EmailProvider.js';
import supabase from '../config/supabase.js';

class NotificationService {
  constructor() {
    this.emailProvider = new EmailProvider();
  }

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
    const { error } = await supabase
      .from('notifications')
      .insert({
        type: notificationData.type,
        courseId: notificationData.courseId,
        senderId: notificationData.senderId,
        subject: notificationData.subject,
        content: notificationData.content,
        metadata: notificationData.metadata,
        sentAt: new Date().toISOString()
      });

    if (error) console.error('Failed to store notification:', error);
  }
}

export default NotificationService;