import supabase from '../config/supabase.js';

// Get user's learning goals
export const getMyGoals = async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: goals } = await supabase
            .from('learning_goals')
            .select('*')
            .eq('userId', userId)
            .single();

        if (!goals) {
            // Return default goals
            return res.json({
                success: true,
                data: {
                    dailyMinutesGoal: 30,
                    weeklyMinutesGoal: 150,
                    reminderEnabled: true,
                    reminderTime: '09:00',
                    timezone: 'Asia/Kolkata'
                }
            });
        }

        res.json({ success: true, data: goals });
    } catch (error) {
        console.error('Error getting goals:', error);
        res.status(500).json({ success: false, message: 'Failed to get goals' });
    }
};

// Update learning goals
export const updateMyGoals = async (req, res) => {
    try {
        const userId = req.user.id;
        const { dailyMinutesGoal, weeklyMinutesGoal, reminderEnabled, reminderTime, timezone } = req.body;

        const { data: existing } = await supabase
            .from('learning_goals')
            .select('id')
            .eq('userId', userId)
            .single();

        let goals;
        if (existing) {
            const { data, error } = await supabase
                .from('learning_goals')
                .update({
                    dailyMinutesGoal: dailyMinutesGoal || 30,
                    weeklyMinutesGoal: weeklyMinutesGoal || 150,
                    reminderEnabled: reminderEnabled !== undefined ? reminderEnabled : true,
                    reminderTime: reminderTime || '09:00',
                    timezone: timezone || 'Asia/Kolkata'
                })
                .eq('userId', userId)
                .select()
                .single();
            if (error) throw error;
            goals = data;
        } else {
            const { data, error } = await supabase
                .from('learning_goals')
                .insert({
                    userId,
                    dailyMinutesGoal: dailyMinutesGoal || 30,
                    weeklyMinutesGoal: weeklyMinutesGoal || 150,
                    reminderEnabled: reminderEnabled !== undefined ? reminderEnabled : true,
                    reminderTime: reminderTime || '09:00',
                    timezone: timezone || 'Asia/Kolkata'
                })
                .select()
                .single();
            if (error) throw error;
            goals = data;
        }

        res.json({ success: true, data: goals });
    } catch (error) {
        console.error('Error updating goals:', error);
        res.status(500).json({ success: false, message: 'Failed to update goals' });
    }
};

// Log learning session
export const logSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const { courseId, durationMinutes, videosWatched = 0, quizzesCompleted = 0 } = req.body;
        const today = new Date().toISOString().split('T')[0];

        // Check for existing session today
        const { data: existing } = await supabase
            .from('learning_sessions')
            .select('*')
            .eq('userId', userId)
            .eq('date', today)
            .eq('courseId', courseId || null)
            .single();

        let session;
        if (existing) {
            const { data, error } = await supabase
                .from('learning_sessions')
                .update({
                    durationMinutes: existing.durationMinutes + (durationMinutes || 0),
                    videosWatched: existing.videosWatched + videosWatched,
                    quizzesCompleted: existing.quizzesCompleted + quizzesCompleted
                })
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            session = data;
        } else {
            const { data, error } = await supabase
                .from('learning_sessions')
                .insert({
                    userId,
                    courseId: courseId || null,
                    date: today,
                    durationMinutes: durationMinutes || 0,
                    videosWatched,
                    quizzesCompleted
                })
                .select()
                .single();
            if (error) throw error;
            session = data;
        }

        res.json({ success: true, data: session });
    } catch (error) {
        console.error('Error logging session:', error);
        res.status(500).json({ success: false, message: 'Failed to log session' });
    }
};

// Get learning stats
export const getMyStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        // Get all sessions
        const { data: sessions } = await supabase
            .from('learning_sessions')
            .select('*')
            .eq('userId', userId)
            .gte('date', weekAgo.toISOString().split('T')[0])
            .order('date', { ascending: false });

        // Get goals
        const { data: goals } = await supabase
            .from('learning_goals')
            .select('*')
            .eq('userId', userId)
            .single();

        const dailyGoal = goals?.dailyMinutesGoal || 30;
        const weeklyGoal = goals?.weeklyMinutesGoal || 150;

        // Calculate stats
        const todayStr = today.toISOString().split('T')[0];
        const todaySessions = sessions?.filter(s => s.date === todayStr) || [];
        const todayMinutes = todaySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
        const weekMinutes = sessions?.reduce((sum, s) => sum + s.durationMinutes, 0) || 0;

        // Calculate streak
        let streak = 0;
        const uniqueDates = [...new Set(sessions?.map(s => s.date) || [])].sort().reverse();
        for (let i = 0; i < uniqueDates.length; i++) {
            const expectedDate = new Date(today);
            expectedDate.setDate(expectedDate.getDate() - i);
            const expectedStr = expectedDate.toISOString().split('T')[0];
            if (uniqueDates.includes(expectedStr)) {
                streak++;
            } else {
                break;
            }
        }

        res.json({
            success: true,
            data: {
                todayMinutes,
                dailyGoal,
                dailyProgress: Math.min(100, Math.round((todayMinutes / dailyGoal) * 100)),
                weekMinutes,
                weeklyGoal,
                weeklyProgress: Math.min(100, Math.round((weekMinutes / weeklyGoal) * 100)),
                currentStreak: streak,
                totalSessions: sessions?.length || 0,
                recentSessions: sessions?.slice(0, 7) || []
            }
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ success: false, message: 'Failed to get stats' });
    }
};

// Get recent activity
export const getRecentActivity = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 10 } = req.query;

        const { data: sessions } = await supabase
            .from('learning_sessions')
            .select(`
        *,
        courses (
          id,
          title,
          thumbnail
        )
      `)
            .eq('userId', userId)
            .order('date', { ascending: false })
            .limit(parseInt(limit));

        res.json({ success: true, data: sessions });
    } catch (error) {
        console.error('Error getting activity:', error);
        res.status(500).json({ success: false, message: 'Failed to get activity' });
    }
};
