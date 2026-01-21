import supabase from '../config/supabase.js';

const debugProgress = async () => {
    try {
        console.log('--- START DEBUG ---');
        // Find a user who has completed at least one video
        const { data: vp, error } = await supabase
            .from('video_progress')
            .select('userId, courseId')
            .eq('completed', true)
            .limit(1);

        if (error || !vp || vp.length === 0) {
            console.log('No completed video progress found in DB.');
            return;
        }

        const { userId, courseId } = vp[0];
        console.log(`User: ${userId}`);
        console.log(`Course: ${courseId}`);

        // Check DB enrollment
        const { data: enrollment } = await supabase
            .from('enrollments')
            .select('progress')
            .eq('userId', userId)
            .eq('courseId', courseId)
            .single();

        console.log(`DB Stored Progress: ${enrollment?.progress}%`);

        // Recalculate Logic
        console.log('--- RECALCULATION ---');

        // Total Videos
        const { data: chapters } = await supabase
            .from('chapters')
            .select('id')
            .eq('courseId', courseId);
        const chapterIds = chapters?.map(c => c.id) || [];

        const { count: totalVideos } = await supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .in('chapterId', chapterIds);

        // Total Text
        let totalText = 0;
        try {
            const { count } = await supabase.from('text_lectures').select('*', { count: 'exact', head: true }).eq('courseId', courseId);
            totalText = count || 0;
        } catch (e) { }

        const total = (totalVideos || 0) + totalText;
        console.log(`Total Content: ${total} (Videos: ${totalVideos}, Text: ${totalText})`);

        // Completed
        const { count: completedVideos } = await supabase
            .from('video_progress')
            .select('*', { count: 'exact', head: true })
            .eq('userId', userId)
            .eq('courseId', courseId)
            .eq('completed', true);

        let completedText = 0;
        try {
            const { count } = await supabase.from('text_lecture_progress').select('*', { count: 'exact', head: true }).eq('userId', userId).eq('courseId', courseId).eq('completed', true);
            completedText = count || 0;
        } catch (e) { }

        const completed = (completedVideos || 0) + completedText;
        console.log(`Completed: ${completed} (Videos: ${completedVideos}, Text: ${completedText})`);

        const calc = total > 0 ? Math.round((completed / total) * 100) : 0;
        console.log(`Calculated: ${calc}%`);

    } catch (error) {
        console.error('Error:', error);
    }
};

debugProgress();
