import supabase from '../config/supabase.js';
import { sendEmail } from '../utils/emailService.js';

// Get all communications for a user
const getCommunications = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    let query = supabase
      .from('admin_communications')
      .select(`
        *,
        sender:users!senderId(id, firstName, lastName, email, role),
        receiver:users!receiverId(id, firstName, lastName, email, role),
        admin_communication_replies(count)
      `, { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);

    // Admins see all, others see only their own communications
    if (userRole === 'admin') {
      // Admin sees all communications
    } else {
      // Students and instructors only see communications they sent or received
      query = query.or(`senderId.eq.${userId},receiverId.eq.${userId}`);
    }

    const { data: communications, error, count } = await query
      .order('createdAt', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Format communications with proper names and reply count
    const formattedCommunications = (communications || []).map(comm => ({
      ...comm,
      sender: comm.sender ? {
        ...comm.sender,
        name: `${comm.sender.firstName} ${comm.sender.lastName}`
      } : null,
      receiver: comm.receiver ? {
        ...comm.receiver,
        name: `${comm.receiver.firstName} ${comm.receiver.lastName}`
      } : null,
      replyCount: comm.admin_communication_replies?.[0]?.count || 0
    }));

    res.json({
      communications: formattedCommunications,
      totalPages: Math.ceil((count || 0) / limit),
      currentPage: parseInt(page),
      total: count || 0
    });
  } catch (error) {
    console.error('getCommunications error:', error);
    res.status(500).json({ message: 'Error fetching communications', error: error.message });
  }
};

// Create new communication
const createCommunication = async (req, res) => {
  try {
    const { receiverId, subject, message, priority = 'normal', category = 'general' } = req.body;
    const senderId = req.user?.id;
    const isFromAdmin = req.user?.role === 'admin';

    if (!senderId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Verify user exists
    const { data: userExists } = await supabase
      .from('users')
      .select('id')
      .eq('id', senderId)
      .single();

    if (!userExists) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    console.log('Creating communication:', { senderId, receiverId, subject, isFromAdmin });

    const { data: communication, error } = await supabase
      .from('admin_communications')
      .insert({
        senderId,
        receiverId,
        subject,
        message,
        priority,
        category,
        isFromAdmin
      })
      .select('*')
      .single();

    if (error) {
      console.error('Insert error:', error);
      throw error;
    }

    console.log('Communication created:', communication);
    res.status(201).json(communication);
  } catch (error) {
    console.error('createCommunication error:', error);
    res.status(500).json({ message: 'Error creating communication', error: error.message });
  }
};

// Get communication with replies
const getCommunicationWithReplies = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: communication, error: commError } = await supabase
      .from('admin_communications')
      .select(`
        *,
        sender:users!senderId(id, firstName, lastName, email, role),
        receiver:users!receiverId(id, firstName, lastName, email, role)
      `)
      .eq('id', id)
      .single();

    if (commError || !communication) {
      console.error('Communication not found:', commError);
      return res.status(404).json({ message: 'Communication not found' });
    }

    const { data: replies, error: repliesError } = await supabase
      .from('admin_communication_replies')
      .select(`
        *,
        sender:users!senderId(id, firstName, lastName, email, role)
      `)
      .eq('communicationId', id)
      .order('createdAt', { ascending: true });

    if (repliesError) {
      console.error('Replies error:', repliesError);
    }

    // Format communication and replies with proper names
    const formattedCommunication = {
      ...communication,
      sender: communication.sender ? {
        ...communication.sender,
        name: `${communication.sender.firstName} ${communication.sender.lastName}`
      } : null,
      receiver: communication.receiver ? {
        ...communication.receiver,
        name: `${communication.receiver.firstName} ${communication.receiver.lastName}`
      } : null,
      replies: (replies || []).map(reply => ({
        ...reply,
        sender: reply.sender ? {
          ...reply.sender,
          name: `${reply.sender.firstName} ${reply.sender.lastName}`
        } : null
      }))
    };

    res.json({ communication: formattedCommunication });
  } catch (error) {
    console.error('getCommunicationWithReplies error:', error);
    res.status(500).json({ message: 'Error fetching communication', error: error.message });
  }
};

// Reply to communication
const replyToCommunication = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const senderId = req.user?.id;
    const isFromAdmin = req.user?.role === 'admin';

    if (!senderId || !message) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    console.log('Creating reply:', { id, senderId, message, isFromAdmin });

    const { data: communication, error: commError } = await supabase
      .from('admin_communications')
      .select('*')
      .eq('id', id)
      .single();

    if (commError || !communication) {
      console.error('Communication not found:', commError);
      return res.status(404).json({ message: 'Communication not found' });
    }

    const { data: reply, error: replyError } = await supabase
      .from('admin_communication_replies')
      .insert({
        communicationId: id,
        senderId,
        message,
        isFromAdmin
      })
      .select('*')
      .single();

    if (replyError) {
      console.error('Reply error:', replyError);
      throw replyError;
    }

    // Update communication status
    await supabase
      .from('admin_communications')
      .update({ status: 'replied', updatedAt: new Date().toISOString() })
      .eq('id', id);

    console.log('Reply created:', reply);
    res.status(201).json(reply);
  } catch (error) {
    console.error('replyToCommunication error:', error);
    res.status(500).json({ message: 'Error creating reply', error: error.message });
  }
};

// Update communication status
const updateCommunicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { error } = await supabase
      .from('admin_communications')
      .update({ status, updatedAt: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating status', error: error.message });
  }
};

// Get all instructors (for admin to send messages)
const getInstructors = async (req, res) => {
  try {
    const { data: instructors, error } = await supabase
      .from('users')
      .select('id, firstName, lastName, email')
      .eq('role', 'instructor');

    if (error) {
      console.error('getInstructors error:', error);
      throw error;
    }

    const formattedInstructors = (instructors || []).map(instructor => ({
      id: instructor.id,
      name: `${instructor.firstName} ${instructor.lastName}`,
      email: instructor.email
    }));

    res.json(formattedInstructors);
  } catch (error) {
    console.error('getInstructors error:', error);
    res.status(500).json({ message: 'Error fetching instructors', error: error.message });
  }
};

export {
  getCommunications,
  createCommunication,
  getCommunicationWithReplies,
  replyToCommunication,
  updateCommunicationStatus,
  getInstructors
};