import supabase from '../config/supabase.js';



export const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        users (
          id,
          firstName,
          lastName,
          avatar
        )
      `)
      .eq('roomId', roomId)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      success: true,
      messages: (messages || []).reverse() // Reverse to show oldest first
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

import socketService from '../services/socketService.js';

export const sendMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty' });
    }

    const { data: newMessage, error } = await supabase
      .from('chat_messages')
      .insert([{
        roomId,
        userId,
        message: message.trim(),
        createdAt: new Date().toISOString()
      }])
      .select(`
        *,
        users (
          id,
          firstName,
          lastName,
          avatar
        )
      `)
      .single();

    if (error) throw error;

    // Broadcast valid message structure to the room
    const io = socketService.getIO();
    if (io) {
      // Broadcast to all users so unread counts update globally
      io.emit('chat-message', newMessage);
    }

    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getOnlineUsers = async (req, res) => {
  try {
    // Get users active in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // We also include the current user to ensure they see themselves
    const { data: users, error } = await supabase
      .from('users')
      .select('id, firstName, lastName, avatar, last_seen')
      .or(`last_seen.gt.${fiveMinutesAgo},id.eq.${req.user.id}`)
      .limit(50); // Limit to avoid massive lists

    if (error) throw error;

    // Format for frontend
    const onlineUsers = users.map(user => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      status: 'online', // for now we consider them online if seen recently
      lastActive: user.last_seen,
      avatar: user.avatar
    }));

    res.json({ success: true, users: onlineUsers });
  } catch (error) {
    console.error('Error fetching online users:', error);
    // Silent fail to empty list or keep mock if DB fails? 
    // Let's return empty list but log error
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getChatRooms = async (req, res) => {
  try {
    const { data: rooms, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('isActive', true)
      .order('createdAt', { ascending: true });

    if (error) throw error;

    // Fetch unread message counts for each room
    const roomsWithCounts = await Promise.all((rooms || []).map(async (room) => {
      // Get last read timestamp for this user
      const { data: lastRead } = await supabase
        .from('chat_last_read')
        .select('lastReadAt')
        .eq('roomId', room.id)
        .eq('userId', req.user.id)
        .single();

      const lastReadAt = lastRead?.lastReadAt || '1970-01-01T00:00:00Z';

      // Count messages created after lastReadAt
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('roomId', room.id)
        .gt('createdAt', lastReadAt);

      return {
        ...room,
        unreadCount: count || 0
      };
    }));

    res.json({ success: true, rooms: roomsWithCounts });
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const markRoomAsRead = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from('chat_last_read')
      .upsert({
        roomId,
        userId,
        lastReadAt: new Date().toISOString()
      }, { onConflict: 'roomId, userId' });

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking room as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createChatRoom = async (req, res) => {
  try {
    const { name, description, type = 'public' } = req.body;
    const createdBy = req.user.id;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Room name is required' });
    }

    const { data: room, error } = await supabase
      .from('chat_rooms')
      .insert([{
        name: name.trim(),
        description: description?.trim() || '',
        type,
        createdBy,
        isActive: true,
        createdAt: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, room });
  } catch (error) {
    console.error('Error creating chat room:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};