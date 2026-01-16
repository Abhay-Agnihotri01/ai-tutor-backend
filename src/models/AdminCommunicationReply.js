import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AdminCommunicationReply = sequelize.define('AdminCommunicationReply', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  communicationId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'admin_communications',
      key: 'id'
    }
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  isFromAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'admin_communication_replies',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false
});

export default AdminCommunicationReply;