import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Badge = sequelize.define('Badge', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    icon: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '🏆'
    },
    category: {
        type: DataTypes.ENUM('achievement', 'streak', 'milestone', 'special'),
        defaultValue: 'achievement'
    },
    requirement: {
        type: DataTypes.JSON,
        allowNull: false,
        // Format: { type: 'videos_completed', value: 10 }
        // Types: videos_completed, quizzes_passed, courses_completed, streak_days, total_xp
    },
    xpReward: {
        type: DataTypes.INTEGER,
        defaultValue: 50
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
});

export default Badge;
