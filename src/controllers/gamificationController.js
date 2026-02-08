import supabase from '../config/supabase.js';
import NotificationService from '../notifications/NotificationService.js';

const notificationService = new NotificationService();

// XP amounts for different actions
const XP_VALUES = {
    VIDEO_COMPLETE: 10,
    QUIZ_PASS: 25,
    COURSE_COMPLETE: 100,
    FIRST_COURSE: 50,
    STREAK_BONUS: 5  // per day
};

// Level thresholds
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 20000];

const calculateLevel = (totalXp) => {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (totalXp >= LEVEL_THRESHOLDS[i]) {
            return i + 1;
        }
    }
    return 1;
};

// Get or create user XP record
const getOrCreateUserXP = async (userId) => {
    const { data: existing } = await supabase
        .from('user_xp')
        .select('*')
        .eq('userId', userId)
        .single();

    if (existing) return existing;

    const { data: newRecord, error } = await supabase
        .from('user_xp')
        .insert({
            userId,
            totalXp: 0,
            level: 1,
            currentStreak: 0,
            longestStreak: 0,
            videosCompleted: 0,
            quizzesPassed: 0,
            coursesCompleted: 0
        })
        .select()
        .single();

    if (error) throw error;
    return newRecord;
};

// Award XP to user
export const awardXP = async (userId, amount, reason) => {
    try {
        const userXP = await getOrCreateUserXP(userId);
        const oldLevel = userXP.level;

        const newTotalXp = userXP.totalXp + amount;
        const newLevel = calculateLevel(newTotalXp);

        // Update streak
        const today = new Date().toISOString().split('T')[0];
        const lastActivity = userXP.lastActivityDate;
        let newStreak = userXP.currentStreak;

        if (lastActivity) {
            const lastDate = new Date(lastActivity);
            const todayDate = new Date(today);
            const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                newStreak = userXP.currentStreak + 1;
            } else if (diffDays > 1) {
                newStreak = 1;
            }
        } else {
            newStreak = 1;
        }

        const longestStreak = Math.max(newStreak, userXP.longestStreak);

        const { data: updated, error } = await supabase
            .from('user_xp')
            .update({
                totalXp: newTotalXp,
                level: newLevel,
                currentStreak: newStreak,
                longestStreak,
                lastActivityDate: today
            })
            .eq('userId', userId)
            .select()
            .single();

        if (error) throw error;

        // Check for badges
        await checkAndAwardBadges(userId, updated);

        return {
            xpGained: amount,
            totalXp: newTotalXp,
            oldLevel,
            newLevel,
            leveledUp: newLevel > oldLevel,
            streak: newStreak
        };
    } catch (error) {
        console.error('Error awarding XP:', error);
        throw error;
    }
};

// Check and award badges
const checkAndAwardBadges = async (userId, userXP) => {
    try {
        const { data: badges } = await supabase
            .from('badges')
            .select('*')
            .eq('isActive', true);

        const { data: earnedBadges } = await supabase
            .from('user_badges')
            .select('badgeId')
            .eq('userId', userId);

        const earnedIds = new Set(earnedBadges?.map(b => b.badgeId) || []);

        for (const badge of badges || []) {
            if (earnedIds.has(badge.id)) continue;

            const req = badge.requirement;
            let earned = false;

            switch (req?.type) {
                case 'videos_completed':
                    earned = userXP.videosCompleted >= req.value;
                    break;
                case 'quizzes_passed':
                    earned = userXP.quizzesPassed >= req.value;
                    break;
                case 'courses_completed':
                    earned = userXP.coursesCompleted >= req.value;
                    break;
                case 'streak':
                    earned = userXP.currentStreak >= req.value;
                    break;
                case 'level':
                    earned = userXP.level >= req.value;
                    break;
                case 'xp':
                    earned = userXP.totalXp >= req.value;
                    break;
            }

            if (earned) {
                await supabase
                    .from('user_badges')
                    .insert({ userId, badgeId: badge.id });

                // Award badge XP
                if (badge.xpReward > 0) {
                    await supabase
                        .from('user_xp')
                        .update({ totalXp: userXP.totalXp + badge.xpReward })
                        .eq('userId', userId);
                }

                // Send badge notification
                notificationService.sendBadgeEarnedNotification(userId, badge.id).catch(console.error);
            }
        }
    } catch (error) {
        console.error('Error checking badges:', error);
    }
};

// Get user stats
export const getMyStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const userXP = await getOrCreateUserXP(userId);

        const currentLevelXP = LEVEL_THRESHOLDS[userXP.level - 1] || 0;
        const nextLevelXP = LEVEL_THRESHOLDS[userXP.level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
        const progressToNextLevel = ((userXP.totalXp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;

        res.json({
            success: true,
            data: {
                totalXp: userXP.totalXp,
                level: userXP.level,
                currentStreak: userXP.currentStreak,
                longestStreak: userXP.longestStreak,
                videosCompleted: userXP.videosCompleted,
                quizzesPassed: userXP.quizzesPassed,
                coursesCompleted: userXP.coursesCompleted,
                currentLevelXP,
                nextLevelXP,
                progressToNextLevel: Math.min(100, Math.round(progressToNextLevel)),
                xpToNextLevel: nextLevelXP - userXP.totalXp
            }
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ success: false, message: 'Failed to get stats' });
    }
};

// Get all badges
export const getAllBadges = async (req, res) => {
    try {
        const { data: badges, error } = await supabase
            .from('badges')
            .select('*')
            .eq('isActive', true)
            .order('sortOrder', { ascending: true });

        if (error) throw error;

        res.json({ success: true, data: badges });
    } catch (error) {
        console.error('Error getting badges:', error);
        res.status(500).json({ success: false, message: 'Failed to get badges' });
    }
};

// Get user badges
export const getMyBadges = async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: allBadges } = await supabase
            .from('badges')
            .select('*')
            .eq('isActive', true)
            .order('sortOrder', { ascending: true });

        const { data: earnedBadges } = await supabase
            .from('user_badges')
            .select('badgeId, earnedAt')
            .eq('userId', userId);

        const earnedMap = new Map(earnedBadges?.map(b => [b.badgeId, b.earnedAt]) || []);

        const badgesWithStatus = allBadges?.map(badge => ({
            ...badge,
            earned: earnedMap.has(badge.id),
            earnedAt: earnedMap.get(badge.id) || null
        })) || [];

        res.json({ success: true, data: badgesWithStatus });
    } catch (error) {
        console.error('Error getting user badges:', error);
        res.status(500).json({ success: false, message: 'Failed to get badges' });
    }
};

// Get leaderboard
export const getLeaderboard = async (req, res) => {
    try {
        const { period = 'all', limit = 50 } = req.query;
        const userId = req.user?.id;

        const { data: leaderboard, error } = await supabase
            .from('user_xp')
            .select(`
        userId,
        totalXp,
        level,
        currentStreak,
        users (
          id,
          firstName,
          lastName,
          avatar
        )
      `)
            .order('totalXp', { ascending: false })
            .limit(parseInt(limit));

        if (error) throw error;

        const formattedLeaderboard = leaderboard?.map((entry, index) => ({
            rank: index + 1,
            userId: entry.userId,
            totalXp: entry.totalXp,
            level: entry.level,
            currentStreak: entry.currentStreak,
            user: entry.users,
            isCurrentUser: entry.userId === userId
        })) || [];

        // Find current user's rank
        let currentUserRank = null;
        if (userId) {
            const userEntry = formattedLeaderboard.find(e => e.userId === userId);
            currentUserRank = userEntry?.rank || null;
        }

        res.json({
            success: true,
            data: {
                leaderboard: formattedLeaderboard,
                currentUserRank
            }
        });
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        res.status(500).json({ success: false, message: 'Failed to get leaderboard' });
    }
};

// Initialize default badges
export const initializeBadges = async (req, res) => {
    try {
        const defaultBadges = [
            { name: 'First Steps', description: 'Complete your first video', icon: '👣', category: 'achievement', requirement: { type: 'videos_completed', value: 1 }, xpReward: 10, sortOrder: 1 },
            { name: 'Video Novice', description: 'Complete 10 videos', icon: '📹', category: 'achievement', requirement: { type: 'videos_completed', value: 10 }, xpReward: 25, sortOrder: 2 },
            { name: 'Video Pro', description: 'Complete 50 videos', icon: '🎬', category: 'achievement', requirement: { type: 'videos_completed', value: 50 }, xpReward: 100, sortOrder: 3 },
            { name: 'Quiz Starter', description: 'Pass your first quiz', icon: '✅', category: 'achievement', requirement: { type: 'quizzes_passed', value: 1 }, xpReward: 15, sortOrder: 4 },
            { name: 'Quiz Master', description: 'Pass 10 quizzes', icon: '🏆', category: 'achievement', requirement: { type: 'quizzes_passed', value: 10 }, xpReward: 50, sortOrder: 5 },
            { name: 'Graduate', description: 'Complete your first course', icon: '🎓', category: 'milestone', requirement: { type: 'courses_completed', value: 1 }, xpReward: 100, sortOrder: 6 },
            { name: 'Scholar', description: 'Complete 5 courses', icon: '📚', category: 'milestone', requirement: { type: 'courses_completed', value: 5 }, xpReward: 250, sortOrder: 7 },
            { name: 'Streak Starter', description: 'Maintain a 3-day streak', icon: '🔥', category: 'streak', requirement: { type: 'streak', value: 3 }, xpReward: 20, sortOrder: 8 },
            { name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '💪', category: 'streak', requirement: { type: 'streak', value: 7 }, xpReward: 50, sortOrder: 9 },
            { name: 'Dedicated', description: 'Maintain a 30-day streak', icon: '⭐', category: 'streak', requirement: { type: 'streak', value: 30 }, xpReward: 200, sortOrder: 10 },
            { name: 'Level 5', description: 'Reach level 5', icon: '5️⃣', category: 'milestone', requirement: { type: 'level', value: 5 }, xpReward: 100, sortOrder: 11 },
            { name: 'Level 10', description: 'Reach level 10', icon: '🔟', category: 'milestone', requirement: { type: 'level', value: 10 }, xpReward: 250, sortOrder: 12 }
        ];

        for (const badge of defaultBadges) {
            const { data: existing } = await supabase
                .from('badges')
                .select('id')
                .eq('name', badge.name)
                .single();

            if (!existing) {
                await supabase.from('badges').insert({ ...badge, isActive: true });
            }
        }

        res.json({ success: true, message: 'Badges initialized' });
    } catch (error) {
        console.error('Error initializing badges:', error);
        res.status(500).json({ success: false, message: 'Failed to initialize badges' });
    }
};

// Record video completion (called from enrollmentController)
export const recordVideoComplete = async (userId) => {
    try {
        const userXP = await getOrCreateUserXP(userId);

        await supabase
            .from('user_xp')
            .update({ videosCompleted: userXP.videosCompleted + 1 })
            .eq('userId', userId);

        return await awardXP(userId, XP_VALUES.VIDEO_COMPLETE, 'video_complete');
    } catch (error) {
        console.error('Error recording video complete:', error);
    }
};

// Record quiz pass
export const recordQuizPass = async (userId) => {
    try {
        const userXP = await getOrCreateUserXP(userId);

        await supabase
            .from('user_xp')
            .update({ quizzesPassed: userXP.quizzesPassed + 1 })
            .eq('userId', userId);

        return await awardXP(userId, XP_VALUES.QUIZ_PASS, 'quiz_pass');
    } catch (error) {
        console.error('Error recording quiz pass:', error);
    }
};

// Record course completion
export const recordCourseComplete = async (userId) => {
    try {
        const userXP = await getOrCreateUserXP(userId);
        const isFirstCourse = userXP.coursesCompleted === 0;

        await supabase
            .from('user_xp')
            .update({ coursesCompleted: userXP.coursesCompleted + 1 })
            .eq('userId', userId);

        let xpAmount = XP_VALUES.COURSE_COMPLETE;
        if (isFirstCourse) xpAmount += XP_VALUES.FIRST_COURSE;

        return await awardXP(userId, xpAmount, isFirstCourse ? 'first_course' : 'course_complete');
    } catch (error) {
        console.error('Error recording course complete:', error);
    }
};
