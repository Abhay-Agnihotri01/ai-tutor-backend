import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const UserBadge = sequelize.define('UserBadge', {
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
    badgeId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Badges',
            key: 'id'
        }
    },
    earnedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ['userId', 'badgeId']
        }
    ]
});

export default UserBadge;
