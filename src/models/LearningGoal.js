import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LearningGoal = sequelize.define('LearningGoal', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    dailyMinutesGoal: {
        type: DataTypes.INTEGER,
        defaultValue: 30,
        validate: {
            min: 5,
            max: 480
        }
    },
    weeklyMinutesGoal: {
        type: DataTypes.INTEGER,
        defaultValue: 150,
        validate: {
            min: 30,
            max: 2400
        }
    },
    reminderEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    reminderTime: {
        type: DataTypes.STRING(5),
        defaultValue: '09:00',
        // Format: HH:MM
    },
    timezone: {
        type: DataTypes.STRING(50),
        defaultValue: 'Asia/Kolkata'
    }
});

export default LearningGoal;
