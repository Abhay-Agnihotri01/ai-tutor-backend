import supabase from '../config/supabase.js';

// Get user notification preferences
const getMyPreferences = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get existing preferences or return defaults
        let { data: preferences, error } = await supabase
            .from('notification_preferences')
            .select('*')
            .eq('userId', userId)
            .single();

        if (error && error.code === 'PGRST116') {
            // No preferences found, return defaults
            preferences = {
                emailEnrollment: true,
                emailPayment: true,
                emailProgress: true,
                emailQuizResults: true,
                emailCertificates: true,
                emailBadges: true,
                emailDiscussions: true,
                emailCourseUpdates: true,
                emailMarketing: false,
                inAppAll: true,
                emailFrequency: 'instant'
            };
        } else if (error) {
            throw error;
        }

        res.json({
            success: true,
            preferences
        });
    } catch (error) {
        console.error('Error fetching preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notification preferences'
        });
    }
};

// Update user notification preferences
const updateMyPreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            emailEnrollment,
            emailPayment,
            emailProgress,
            emailQuizResults,
            emailCertificates,
            emailBadges,
            emailDiscussions,
            emailCourseUpdates,
            emailMarketing,
            inAppAll,
            emailFrequency,
            quietHoursStart,
            quietHoursEnd
        } = req.body;

        // Upsert preferences (insert or update)
        const { data: preferences, error } = await supabase
            .from('notification_preferences')
            .upsert({
                userId,
                emailEnrollment,
                emailPayment,
                emailProgress,
                emailQuizResults,
                emailCertificates,
                emailBadges,
                emailDiscussions,
                emailCourseUpdates,
                emailMarketing,
                inAppAll,
                emailFrequency,
                quietHoursStart,
                quietHoursEnd,
                updatedAt: new Date().toISOString()
            }, {
                onConflict: 'userId'
            })
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Notification preferences updated',
            preferences
        });
    } catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update notification preferences'
        });
    }
};

export {
    getMyPreferences,
    updateMyPreferences
};
