import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CouponUsage = sequelize.define('CouponUsage', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    couponId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Coupons',
            key: 'id'
        }
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    enrollmentId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Enrollments',
            key: 'id'
        }
    },
    discountAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    originalPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    finalPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    }
});

export default CouponUsage;
