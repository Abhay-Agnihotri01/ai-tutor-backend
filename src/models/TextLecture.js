import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TextLecture = sequelize.define('TextLecture', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  chapterId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'chapters',
      key: 'id'
    }
  },
  courseId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'courses',
      key: 'id'
    }
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  uploadType: {
    type: DataTypes.ENUM('file', 'url'),
    allowNull: false
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'text_lectures',
  timestamps: true
});

export default TextLecture;