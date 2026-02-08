import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LearningSession = sequelize.define('LearningSession', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    courseId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Courses',
            key: 'id'
        }
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    durationMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    videosWatched: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    quizzesCompleted: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    indexes: [
        {
            fields: ['userId', 'date']
        },
        {
            fields: ['userId', 'courseId', 'date']
        }
    ]
});

export default LearningSession;
