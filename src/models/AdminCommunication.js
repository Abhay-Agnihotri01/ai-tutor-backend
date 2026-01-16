import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AdminCommunication = sequelize.define('AdminCommunication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  receiverId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  subject: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  priority: {
    type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
    defaultValue: 'normal'
  },
  category: {
    type: DataTypes.ENUM('general', 'course_approval', 'payout', 'policy', 'technical', 'content'),
    defaultValue: 'general'
  },
  status: {
    type: DataTypes.ENUM('unread', 'read', 'replied', 'resolved'),
    defaultValue: 'unread'
  },
  isFromAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'admin_communications',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

export default AdminCommunication;