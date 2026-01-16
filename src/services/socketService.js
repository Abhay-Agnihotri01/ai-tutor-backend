import { Server } from 'socket.io';

class SocketService {
  constructor() {
    this.io = null;
    this.rooms = new Map(); // roomId -> Map(userId -> {socketId, userType, userName})
    this.chatHistory = new Map(); // roomId -> Array of messages
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        methods: ["GET", "POST"]
      }
    });

    this.io.on('connection', (socket) => {
      socket.on('join-room', ({ roomId, userId, userType, userName }) => {
        socket.join(roomId);
        socket.userId = userId;
        socket.userType = userType;
        socket.userName = userName;
        socket.roomId = roomId;

        if (!this.rooms.has(roomId)) {
          this.rooms.set(roomId, new Map());
          this.chatHistory.set(roomId, []);
        }
        
        const room = this.rooms.get(roomId);
        
        // Get existing participants before adding new user
        const existingParticipants = Array.from(room.entries())
          .filter(([id]) => id !== userId)
          .map(([id, data]) => ({ 
            userId: id, 
            userType: data.userType,
            userName: data.userName
          }));
        
        // Add new user to room
        room.set(userId, { 
          socketId: socket.id, 
          userType, 
          userName,
          joinedAt: new Date().toISOString()
        });

        console.log(`User ${userName} (${userId}) joining room ${roomId}. Existing participants:`, existingParticipants.length);
        
        // Notify existing participants about new user
        socket.to(roomId).emit('user-joined', { userId, userType, userName });

        // Send existing participants to new user
        socket.emit('existing-participants', existingParticipants);
        
        // Send chat history to new participant
        const history = this.chatHistory.get(roomId) || [];
        if (history.length > 0) {
          socket.emit('chat-history', history.slice(-50)); // Last 50 messages
        }
        
        console.log(`User ${userName} (${userId}) successfully joined room ${roomId}. Total participants: ${room.size}`);
      });

      socket.on('offer', ({ offer, targetUserId }) => {
        const room = this.rooms.get(socket.roomId);
        if (room && room.has(targetUserId)) {
          const targetSocketId = room.get(targetUserId).socketId;
          this.io.to(targetSocketId).emit('offer', {
            offer,
            fromUserId: socket.userId
          });
        }
      });

      socket.on('answer', ({ answer, targetUserId }) => {
        const room = this.rooms.get(socket.roomId);
        if (room && room.has(targetUserId)) {
          const targetSocketId = room.get(targetUserId).socketId;
          this.io.to(targetSocketId).emit('answer', {
            answer,
            fromUserId: socket.userId
          });
        }
      });

      socket.on('ice-candidate', ({ candidate, targetUserId }) => {
        const room = this.rooms.get(socket.roomId);
        if (room && room.has(targetUserId)) {
          const targetSocketId = room.get(targetUserId).socketId;
          this.io.to(targetSocketId).emit('ice-candidate', {
            candidate,
            fromUserId: socket.userId
          });
        }
      });

      socket.on('toggle-camera', ({ isOn }) => {
        socket.to(socket.roomId).emit('user-camera-toggle', {
          userId: socket.userId,
          isOn
        });
      });

      socket.on('toggle-screen-share', ({ isSharing }) => {
        socket.to(socket.roomId).emit('user-screen-share', {
          userId: socket.userId,
          isSharing
        });
      });

      socket.on('chat-message', ({ roomId, message }) => {
        // Use the message object sent from frontend
        const chatMessage = {
          ...message,
          // Ensure server timestamp for consistency
          timestamp: new Date().toISOString()
        };

        // Store in chat history
        if (!this.chatHistory.has(roomId)) {
          this.chatHistory.set(roomId, []);
        }
        this.chatHistory.get(roomId).push(chatMessage);

        // Keep only last 100 messages
        const history = this.chatHistory.get(roomId);
        if (history.length > 100) {
          this.chatHistory.set(roomId, history.slice(-100));
        }

        // Broadcast to all participants in room
        this.io.to(roomId).emit('chat-message', chatMessage);
      });

      socket.on('disconnect', () => {
        if (socket.roomId && socket.userId) {
          const room = this.rooms.get(socket.roomId);
          if (room) {
            room.delete(socket.userId);
            if (room.size === 0) {
              this.rooms.delete(socket.roomId);
              // Clean up chat history after 1 hour of empty room
              setTimeout(() => {
                if (!this.rooms.has(socket.roomId)) {
                  this.chatHistory.delete(socket.roomId);
                }
              }, 3600000);
            }
          }
          socket.to(socket.roomId).emit('user-left', { userId: socket.userId });
          console.log(`User ${socket.userName} (${socket.userId}) left room ${socket.roomId}`);
        }
      });
    });
  }

  getIO() {
    return this.io;
  }
}

export default new SocketService();