import supabase from '../config/supabase.js';

// Create coupon
export const createCoupon = async (req, res) => {
    try {
        const instructorId = req.user.id;
        const {
            code,
            type = 'percentage',
            value,
            maxUses,
            validFrom,
            validTo,
            courseId,
            description,
            minPurchaseAmount,
            maxDiscountAmount
        } = req.body;

        // Validate code uniqueness
        const { data: existing } = await supabase
            .from('coupons')
            .select('id')
            .eq('code', code.toUpperCase())
            .single();

        if (existing) {
            return res.status(400).json({ success: false, message: 'Coupon code already exists' });
        }

        const { data: coupon, error } = await supabase
            .from('coupons')
            .insert({
                code: code.toUpperCase(),
                type,
                value: parseFloat(value),
                maxUses: maxUses || null,
                usedCount: 0,
                validFrom: validFrom || null,
                validTo: validTo || null,
                courseId: courseId || null,
                instructorId,
                description: description || null,
                minPurchaseAmount: minPurchaseAmount || null,
                maxDiscountAmount: maxDiscountAmount || null,
                isActive: true
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data: coupon });
    } catch (error) {
        console.error('Error creating coupon:', error);
        res.status(500).json({ success: false, message: 'Failed to create coupon' });
    }
};

// Get instructor's coupons
export const getMyCoupons = async (req, res) => {
    try {
        const instructorId = req.user.id;

        const { data: coupons, error } = await supabase
            .from('coupons')
            .select(`
        *,
        courses (
          id,
          title
        )
      `)
            .eq('instructorId', instructorId)
            .order('createdAt', { ascending: false });

        if (error) throw error;

        res.json({ success: true, data: coupons });
    } catch (error) {
        console.error('Error getting coupons:', error);
        res.status(500).json({ success: false, message: 'Failed to get coupons' });
    }
};

// Get single coupon details
export const getCouponDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const instructorId = req.user.id;

        const { data: coupon, error } = await supabase
            .from('coupons')
            .select(`
        *,
        courses (id, title)
      `)
            .eq('id', id)
            .eq('instructorId', instructorId)
            .single();

        if (error || !coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        res.json({ success: true, data: coupon });
    } catch (error) {
        console.error('Error getting coupon:', error);
        res.status(500).json({ success: false, message: 'Failed to get coupon' });
    }
};

// Update coupon
export const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const instructorId = req.user.id;
        const updates = req.body;

        // Verify ownership
        const { data: existing } = await supabase
            .from('coupons')
            .select('id')
            .eq('id', id)
            .eq('instructorId', instructorId)
            .single();

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        const { data: coupon, error } = await supabase
            .from('coupons')
            .update({
                ...updates,
                code: updates.code?.toUpperCase()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data: coupon });
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(500).json({ success: false, message: 'Failed to update coupon' });
    }
};

// Delete (deactivate) coupon
export const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const instructorId = req.user.id;

        const { error } = await supabase
            .from('coupons')
            .update({ isActive: false })
            .eq('id', id)
            .eq('instructorId', instructorId);

        if (error) throw error;

        res.json({ success: true, message: 'Coupon deactivated' });
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({ success: false, message: 'Failed to delete coupon' });
    }
};

// Validate coupon
export const validateCoupon = async (req, res) => {
    try {
        const { code, courseId } = req.body;
        const userId = req.user.id;

        const { data: coupon } = await supabase
            .from('coupons')
            .select('*')
            .eq('code', code.toUpperCase())
            .eq('isActive', true)
            .single();

        if (!coupon) {
            return res.status(400).json({ success: false, message: 'Invalid coupon code' });
        }

        // Check validity dates
        const now = new Date();
        if (coupon.validFrom && new Date(coupon.validFrom) > now) {
            return res.status(400).json({ success: false, message: 'Coupon not yet valid' });
        }
        if (coupon.validTo && new Date(coupon.validTo) < now) {
            return res.status(400).json({ success: false, message: 'Coupon has expired' });
        }

        // Check max uses
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
            return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
        }

        // Check course restriction
        if (coupon.courseId && coupon.courseId !== courseId) {
            return res.status(400).json({ success: false, message: 'Coupon not valid for this course' });
        }

        // Check if user already used this coupon
        const { data: existingUsage } = await supabase
            .from('coupon_usage')
            .select('id')
            .eq('couponId', coupon.id)
            .eq('userId', userId)
            .single();

        if (existingUsage) {
            return res.status(400).json({ success: false, message: 'You have already used this coupon' });
        }

        // Get course price
        const { data: course } = await supabase
            .from('courses')
            .select('price, discountPrice')
            .eq('id', courseId)
            .single();

        const originalPrice = course?.discountPrice || course?.price || 0;

        // Check minimum purchase
        if (coupon.minPurchaseAmount && originalPrice < coupon.minPurchaseAmount) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase amount is ₹${coupon.minPurchaseAmount}`
            });
        }

        // Calculate discount
        let discountAmount = 0;
        if (coupon.type === 'percentage') {
            discountAmount = (originalPrice * coupon.value) / 100;
        } else if (coupon.type === 'fixed') {
            discountAmount = parseFloat(coupon.value);
        } else if (coupon.type === 'free') {
            discountAmount = originalPrice;
        }

        // Apply max discount cap
        if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
            discountAmount = parseFloat(coupon.maxDiscountAmount);
        }

        const finalPrice = Math.max(0, originalPrice - discountAmount);

        res.json({
            success: true,
            data: {
                couponId: coupon.id,
                code: coupon.code,
                type: coupon.type,
                value: coupon.value,
                originalPrice,
                discountAmount,
                finalPrice
            }
        });
    } catch (error) {
        console.error('Error validating coupon:', error);
        res.status(500).json({ success: false, message: 'Failed to validate coupon' });
    }
};

// Apply coupon (call during successful payment)
export const applyCoupon = async (couponId, userId, courseId, originalPrice, discountAmount, finalPrice) => {
    try {
        // Record usage
        await supabase
            .from('coupon_usage')
            .insert({
                couponId,
                userId,
                originalPrice,
                discountAmount,
                finalPrice
            });

        // Increment used count
        const { data: coupon } = await supabase
            .from('coupons')
            .select('usedCount')
            .eq('id', couponId)
            .single();

        await supabase
            .from('coupons')
            .update({ usedCount: (coupon?.usedCount || 0) + 1 })
            .eq('id', couponId);

        return true;
    } catch (error) {
        console.error('Error applying coupon:', error);
        return false;
    }
};

// Get coupon analytics
export const getCouponAnalytics = async (req, res) => {
    try {
        const instructorId = req.user.id;

        const { data: coupons } = await supabase
            .from('coupons')
            .select('id, isActive, usedCount')
            .eq('instructorId', instructorId);

        const { data: usage } = await supabase
            .from('coupon_usage')
            .select('discountAmount, couponId')
            .in('couponId', coupons?.map(c => c.id) || []);

        const totalCoupons = coupons?.length || 0;
        const activeCoupons = coupons?.filter(c => c.isActive).length || 0;
        const totalRedemptions = usage?.length || 0;
        const totalDiscountGiven = usage?.reduce((sum, u) => sum + parseFloat(u.discountAmount || 0), 0) || 0;

        res.json({
            success: true,
            data: {
                totalCoupons,
                activeCoupons,
                totalRedemptions,
                totalDiscountGiven
            }
        });
    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({ success: false, message: 'Failed to get analytics' });
    }
};
