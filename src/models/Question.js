import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Question = sequelize.define('Question', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  quizId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Quizzes',
      key: 'id'
    }
  },
  question: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('mcq', 'true_false', 'short_answer'),
    allowNull: false,
    defaultValue: 'mcq'
  },
  options: {
    type: DataTypes.JSON,
    allowNull: true
  },
  correctAnswer: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  marks: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  }
});

export default Question;