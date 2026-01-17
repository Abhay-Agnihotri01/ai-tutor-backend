import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getChatRooms,
  getMessages,
  sendMessage,
  getOnlineUsers,
  createChatRoom,
  markRoomAsRead
} from '../controllers/groupChatController.js';

const router = express.Router();

// Get all chat rooms
router.get('/rooms', authenticateToken, getChatRooms);

// Get messages for a specific room
router.get('/rooms/:roomId/messages', authenticateToken, getMessages);

// Send a message to a room
router.post('/rooms/:roomId/messages', authenticateToken, sendMessage);

// Mark room as read
router.post('/rooms/:roomId/read', authenticateToken, markRoomAsRead);

// Get online users
router.get('/online-users', authenticateToken, getOnlineUsers);

// Create a new chat room (admin/instructor only)
router.post('/rooms', authenticateToken, createChatRoom);

export default router;