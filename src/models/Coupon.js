import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Coupon = sequelize.define('Coupon', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    type: {
        type: DataTypes.ENUM('percentage', 'fixed', 'free'),
        allowNull: false,
        defaultValue: 'percentage'
    },
    value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        // For percentage: 10 = 10%, for fixed: 10 = ₹10 off
    },
    maxUses: {
        type: DataTypes.INTEGER,
        allowNull: true,
        // null = unlimited uses
    },
    usedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    validFrom: {
        type: DataTypes.DATE,
        allowNull: true
    },
    validTo: {
        type: DataTypes.DATE,
        allowNull: true
    },
    courseId: {
        type: DataTypes.UUID,
        allowNull: true,
        // null = applies to all courses by this instructor
        references: {
            model: 'Courses',
            key: 'id'
        }
    },
    instructorId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    minPurchaseAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    maxDiscountAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        // Cap for percentage discounts
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true
    }
});

// Helper method to check if coupon is valid
Coupon.prototype.isValid = function () {
    const now = new Date();

    if (!this.isActive) return { valid: false, reason: 'Coupon is inactive' };

    if (this.maxUses && this.usedCount >= this.maxUses) {
        return { valid: false, reason: 'Coupon usage limit reached' };
    }

    if (this.validFrom && now < new Date(this.validFrom)) {
        return { valid: false, reason: 'Coupon is not yet active' };
    }

    if (this.validTo && now > new Date(this.validTo)) {
        return { valid: false, reason: 'Coupon has expired' };
    }

    return { valid: true };
};

// Calculate discount amount
Coupon.prototype.calculateDiscount = function (originalPrice) {
    let discount = 0;

    if (this.type === 'percentage') {
        discount = (originalPrice * parseFloat(this.value)) / 100;
        if (this.maxDiscountAmount) {
            discount = Math.min(discount, parseFloat(this.maxDiscountAmount));
        }
    } else if (this.type === 'fixed') {
        discount = parseFloat(this.value);
    } else if (this.type === 'free') {
        discount = originalPrice;
    }

    return Math.min(discount, originalPrice);
};

export default Coupon;
