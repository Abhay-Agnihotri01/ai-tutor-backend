import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
    createCoupon,
    getMyCoupons,
    getCouponDetails,
    updateCoupon,
    deleteCoupon,
    validateCoupon,
    getCouponAnalytics
} from '../controllers/couponController.js';

const router = express.Router();

// Student routes - validate coupon during checkout
router.post('/validate', authenticate, validateCoupon);

// Instructor routes
router.post('/', authenticate, authorize('instructor', 'admin'), createCoupon);
router.get('/', authenticate, authorize('instructor', 'admin'), getMyCoupons);
router.get('/analytics', authenticate, authorize('instructor', 'admin'), getCouponAnalytics);
router.get('/:id', authenticate, authorize('instructor', 'admin'), getCouponDetails);
router.put('/:id', authenticate, authorize('instructor', 'admin'), updateCoupon);
router.delete('/:id', authenticate, authorize('instructor', 'admin'), deleteCoupon);

export default router;
