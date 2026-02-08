import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const UserXP = sequelize.define('UserXP', {
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
    totalXp: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    currentStreak: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    longestStreak: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    lastActivityDate: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    videosCompleted: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    quizzesPassed: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    coursesCompleted: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
});

// Level thresholds: Level N requires (N-1) * 100 + sum of previous thresholds
// Level 1: 0 XP, Level 2: 100 XP, Level 3: 300 XP, Level 4: 600 XP, etc.
UserXP.getLevelThreshold = (level) => {
    if (level <= 1) return 0;
    return (level - 1) * 100 + UserXP.getLevelThreshold(level - 1);
};

UserXP.calculateLevel = (totalXp) => {
    let level = 1;
    while (UserXP.getLevelThreshold(level + 1) <= totalXp) {
        level++;
    }
    return level;
};

export default UserXP;
