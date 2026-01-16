import supabase from '../config/supabase.js';

export const getChatRooms = async (req, res) => {
  try {
    const { data: rooms, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('isActive', true)
      .order('createdAt', { ascending: true });

    if (error) throw error;

    res.json({ success: true, rooms: rooms || [] });
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

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

    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getOnlineUsers = async (req, res) => {
  try {
    // For now, return mock data. In a real implementation, you'd track online users
    const mockOnlineUsers = [
      { id: 1, name: 'Alice Johnson', status: 'online' },
      { id: 2, name: 'Bob Smith', status: 'online' },
      { id: 3, name: 'Carol Davis', status: 'away' },
      { id: 4, name: 'David Wilson', status: 'online' }
    ];

    res.json({ success: true, users: mockOnlineUsers });
  } catch (error) {
    console.error('Error fetching online users:', error);
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