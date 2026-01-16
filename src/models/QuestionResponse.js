import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const QuestionResponse = sequelize.define('QuestionResponse', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  attemptId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'QuizAttempts',
      key: 'id'
    }
  },
  questionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Questions',
      key: 'id'
    }
  },
  answer: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isCorrect: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  marksAwarded: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});

export default QuestionResponse;