import supabase from '../config/supabase.js';
import nodemailer from 'nodemailer';

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Get discussions for a course
export const getCourseDiscussions = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 10, videoId } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('discussions')
      .select(`
        *,
        users!inner(firstName, lastName, avatar, role),
        videos(title)
      `)
      .eq('courseid', courseId);

    if (videoId) {
      query = query.eq('videoid', videoId);
    }

    const { data: discussions, error, count } = await query
      .range(offset, offset + parseInt(limit) - 1)
      .order('createdat', { ascending: false });

    // Get reply counts for each discussion
    if (discussions && discussions.length > 0) {
      for (const discussion of discussions) {
        const { count: replyCount } = await supabase
          .from('discussion_replies')
          .select('*', { count: 'exact', head: true })
          .eq('discussionid', discussion.id);
        
        discussion.replyCount = replyCount || 0;
      }
    }

    if (error) throw error;

    res.json({
      success: true,
      discussions: discussions || [],
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil((count || 0) / limit),
        totalDiscussions: count || 0
      }
    });
  } catch (error) {
    console.error('Get discussions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create new discussion
export const createDiscussion = async (req, res) => {
  try {
    const { courseId, videoId, title, content } = req.body;
    const userId = req.user.id;

    const { data: discussion, error } = await supabase
      .from('discussions')
      .insert({
        courseid: courseId,
        videoid: videoId || null,
        userid: userId,
        title,
        content
      })
      .select(`
        *,
        users!inner(firstName, lastName, avatar, role),
        videos(title)
      `)
      .single();

    if (error) throw error;

    // Send email notification to instructor
    await notifyInstructor(courseId, discussion, 'new_discussion');

    res.status(201).json({
      success: true,
      discussion,
      message: 'Discussion created successfully'
    });
  } catch (error) {
    console.error('Create discussion error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get discussion with replies
export const getDiscussion = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: discussion, error: discussionError } = await supabase
      .from('discussions')
      .select(`
        *,
        users!inner(firstName, lastName, avatar, role),
        videos(title)
      `)
      .eq('id', id)
      .single();

    if (discussionError || !discussion) {
      return res.status(404).json({ message: 'Discussion not found' });
    }

    const { data: replies, error: repliesError } = await supabase
      .from('discussion_replies')
      .select(`
        *,
        users!inner(firstName, lastName, avatar, role)
      `)
      .eq('discussionid', id)
      .order('createdat', { ascending: true });

    if (repliesError) throw repliesError;

    res.json({
      success: true,
      discussion: {
        ...discussion,
        replies: replies || []
      }
    });
  } catch (error) {
    console.error('Get discussion error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create reply
export const createReply = async (req, res) => {
  try {
    const { discussionId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Get discussion details
    const { data: discussion } = await supabase
      .from('discussions')
      .select('courseid, userid, title')
      .eq('id', discussionId)
      .single();

    // Check if user is instructor
    const { data: course } = await supabase
      .from('courses')
      .select('instructorId')
      .eq('id', discussion.courseid)
      .single();

    const isInstructorReply = course.instructorId === userId;

    const { data: reply, error } = await supabase
      .from('discussion_replies')
      .insert({
        discussionid: discussionId,
        userid: userId,
        content,
        isinstructorreply: isInstructorReply
      })
      .select(`
        *,
        users!inner(firstName, lastName, avatar, role)
      `)
      .single();

    if (error) throw error;

    // Send email notifications
    if (isInstructorReply) {
      // Notify original question author
      await notifyStudent(discussion.userid, discussion, reply, 'instructor_reply');
    } else {
      // Notify instructor about student reply
      await notifyInstructor(discussion.courseid, discussion, 'student_reply', reply);
    }

    res.status(201).json({
      success: true,
      reply,
      message: 'Reply added successfully'
    });
  } catch (error) {
    console.error('Create reply error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Mark discussion as resolved
export const markResolved = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is the discussion author or instructor
    const { data: discussion } = await supabase
      .from('discussions')
      .select('userid, courseid')
      .eq('id', id)
      .single();

    const { data: course } = await supabase
      .from('courses')
      .select('instructorId')
      .eq('id', discussion.courseid)
      .single();

    if (discussion.userid !== userId && course.instructorId !== userId) {
      return res.status(403).json({ message: 'Not authorized to resolve this discussion' });
    }

    const { data: updatedDiscussion, error } = await supabase
      .from('discussions')
      .update({ isresolved: true, updatedat: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      discussion: updatedDiscussion,
      message: 'Discussion marked as resolved'
    });
  } catch (error) {
    console.error('Mark resolved error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Email notification functions
const notifyInstructor = async (courseId, discussion, type, reply = null) => {
  try {
    const { data: course } = await supabase
      .from('courses')
      .select(`
        title,
        users!inner(email, firstName, lastName)
      `)
      .eq('id', courseId)
      .single();

    if (!course) return;

    const instructor = course.users;
    let subject, html;

    if (type === 'new_discussion') {
      subject = `New Question: ${discussion.title}`;
      html = `
        <h2>New Question in ${course.title}</h2>
        <p><strong>Student:</strong> ${discussion.users.firstName} ${discussion.users.lastName}</p>
        <p><strong>Question:</strong> ${discussion.title}</p>
        <p><strong>Details:</strong></p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
          ${discussion.content}
        </div>
        <p><a href="${process.env.CLIENT_URL}/instructor/course/${courseId}/discussions/${discussion.id}">View & Reply</a></p>
      `;
    } else if (type === 'student_reply') {
      subject = `New Reply: ${discussion.title}`;
      html = `
        <h2>New Reply in ${course.title}</h2>
        <p><strong>Student:</strong> ${reply.users.firstName} ${reply.users.lastName}</p>
        <p><strong>Question:</strong> ${discussion.title}</p>
        <p><strong>Reply:</strong></p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
          ${reply.content}
        </div>
        <p><a href="${process.env.CLIENT_URL}/instructor/course/${courseId}/discussions/${discussion.id}">View Discussion</a></p>
      `;
    }

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: instructor.email,
      subject,
      html
    });
  } catch (error) {
    console.error('Email notification error:', error);
  }
};

const notifyStudent = async (studentId, discussion, reply, type) => {
  try {
    const { data: student } = await supabase
      .from('users')
      .select('email, firstName, lastName')
      .eq('id', studentId)
      .single();

    if (!student) return;

    const subject = `Your Question Answered: ${discussion.title}`;
    const html = `
      <h2>Your Question Has Been Answered!</h2>
      <p>Hi ${student.firstName},</p>
      <p><strong>Your Question:</strong> ${discussion.title}</p>
      <p><strong>Instructor's Answer:</strong></p>
      <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; border-left: 4px solid #4caf50;">
        ${reply.content}
      </div>
      <p><a href="${process.env.CLIENT_URL}/learn/${discussion.courseId}/discussions/${discussion.id}">View Full Discussion</a></p>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: student.email,
      subject,
      html
    });
  } catch (error) {
    console.error('Email notification error:', error);
  }
};