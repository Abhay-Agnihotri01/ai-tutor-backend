import supabase from '../config/supabase.js';

const debugService = async () => {
    console.log('--- START DEBUG ---');
    try {
        // 1. Get a userId from notification_recipients
        const { data: recipient, error: rError } = await supabase
            .from('notification_recipients')
            .select('user_id')
            .limit(1)
            .single();

        if (rError) {
            console.error('Could not get recipient:', rError);
            return;
        }
        const userId = recipient.user_id;
        console.log('Testing with User ID:', userId);

        // 2. Run the EXACT query from NotificationService
        console.log('Running main query...');
        const { data, error } = await supabase
            .from('notification_recipients')
            .select(`
                id,
                isRead,
                readAt,
                createdAt,
                notifications!notification_id (
                    id,
                    type,
                    courseId,
                    senderId,
                    subject,
                    content,
                    metadata,
                    sentAt,
                    sender:users!senderId (firstName, lastName, avatar) 
                )
            `)
            .eq('user_id', userId)
            //.range(0, 19); // Comment out range to just test select
            .limit(5);

        if (error) {
            console.error('MAIN QUERY FAILED:', JSON.stringify(error, null, 2));

            // 2b. Debugging the inner join if main fails
            console.log('Attempting simpler join to isolate issue...');
            const { error: simpleError } = await supabase
                .from('notification_recipients')
                .select(`
                    id,
                    notifications!notification_id (id)
                `)
                .eq('user_id', userId)
                .limit(1);
            if (simpleError) console.error('Simple Join (notifications) Failed:', simpleError);
            else console.log('Simple Join (notifications) SUCCESS');

            // 2c. Debugging the sender join
            console.log('Checking notifications table columns...');
            const { data: notifSample, error: notifError } = await supabase
                .from('notifications')
                .select('*')
                .limit(1);
            if (notifSample) console.log('Notifications Sample keys:', Object.keys(notifSample[0]));

        } else {
            console.log('MAIN QUERY SUCCESS!');
            console.log('Loaded', data.length, 'records.');
            if (data.length > 0) {
                console.log('Sample Notification:', JSON.stringify(data[0].notifications, null, 2));
            }
        }

    } catch (e) {
        console.error('Script Crash:', e);
    }
    process.exit(0);
};

debugService();
