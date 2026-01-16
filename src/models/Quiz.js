import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Quiz = sequelize.define('Quiz', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  chapterId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Chapters',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('quiz', 'assignment'),
    allowNull: false,
    defaultValue: 'quiz'
  },
  position: {
    type: DataTypes.ENUM('after_video', 'end_of_chapter'),
    allowNull: false,
    defaultValue: 'end_of_chapter'
  },
  videoId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Videos',
      key: 'id'
    }
  },
  timeLimit: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  totalMarks: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  passingMarks: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

export default Quiz;