import supabase from '../config/supabase.js';

// Log activity (public or protected)
export const logActivity = async (req, res) => {
    try {
        const { action, resource, details, role = 'visitor' } = req.body;

        // Get user info if authenticated
        const userId = req.user ? req.user.id : null;
        const userRole = req.user ? req.user.role : role;

        console.log('LOG ACTIVITY REQ.USER:', req.user); // DEBUG
        console.log('LOG ACTIVITY INSERT:', { userId, action, role: userRole }); // DEBUG

        // Get client info
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        const { data, error } = await supabase
            .from('activity_logs')
            .insert({
                user_id: userId,
                action,
                resource,
                details,
                ip_address: ipAddress?.split(',')[0].trim(), // Handle forwarded IP list
                user_agent: userAgent,
                role: userRole
            })
            .select()
            .single();

        if (error) {
            console.error('Error logging activity:', error);
            // Don't fail the request if logging fails, just log the error
            return res.status(200).json({ success: true, logged: false });
        }

        res.status(201).json({ success: true, activity: data });
    } catch (error) {
        console.error('Error in logActivity controller:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Get activities (Admin only)
export const getActivities = async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store'); // Force fresh fetch
        console.log('GET ACTIVITIES CONTROLLER HIT'); // Entry debug

        const { page = 1, limit = 50, userId, action, resource, search } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('activity_logs')
            .select('*', { count: 'exact' }); // Fetch only raw logs, no broken joins

        // Apply filters
        if (userId) query = query.eq('user_id', userId);
        if (action) query = query.eq('action', action);
        if (resource) query = query.eq('resource', resource);

        // Search logic (rudimentary search on action or resource)
        if (search) {
            query = query.or(`action.ilike.%${search}%,resource.ilike.%${search}%`);
        }

        console.log('GET ACTIVITIES HEADERS:', req.headers); // Debug

        // Pagination
        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data: activities, count, error } = await query;

        if (error) {
            console.error('Error fetching activities:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch activities' });
        }

        let populatedActivities = activities || [];

        // Manual Join: Fetch users for the activities
        if (populatedActivities.length > 0) {
            // Support both user_id (new) and userId (old) just in case
            const userIds = [...new Set(populatedActivities.map(a => a.user_id || a.userId).filter(id => id))];

            if (userIds.length > 0) {
                const { data: users } = await supabase
                    .from('users')
                    .select('id, firstName, lastName, email, role')
                    .in('id', userIds);

                // Map users to activities
                const userMap = (users || []).reduce((acc, user) => {
                    acc[user.id] = user;
                    return acc;
                }, {});

                populatedActivities = populatedActivities.map(activity => ({
                    ...activity,
                    User: userMap[activity.user_id || activity.userId] || null
                }));
            }
        }

        // Debug Log
        if (populatedActivities.length > 0) {
            console.log('GET ACTIVITIES RESULT SAMPLE:', {
                id: populatedActivities[0].id,
                user_id: populatedActivities[0].user_id || populatedActivities[0].userId,
                User: populatedActivities[0].User
            });
        }

        res.json({
            success: true,
            activities: populatedActivities,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Error in getActivities controller:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
