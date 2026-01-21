import NotificationService from '../notifications/NotificationService.js';
import supabase from '../config/supabase.js';

const simulate = async () => {
    console.log('Starting simulation...');
    try {
        // 1. Get a random user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email')
            .limit(1)
            .single();

        if (userError || !user) {
            console.error('No user found to test with.');
            return;
        }
        console.log('Testing with User:', user.email, user.id);

        // 2. Instantiate Service
        const service = new NotificationService();
        console.log('Service instantiated.');

        // 3. Call getUserNotifications
        console.log('Calling getUserNotifications...');
        const result = await service.getUserNotifications(user.id);
        console.log('Result Success!', Object.keys(result));
        console.log('Notifications found:', result.notifications.length);

    } catch (err) {
        console.error('SIMULATION FAILED:', err);
    }
    process.exit(0);
};

simulate();
