import supabase from '../config/supabase.js';

const checkSchema = async () => {
    console.log('Checking notifications table columns...');
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error selecting from notifications:', error);
    } else {
        if (data && data.length > 0) {
            console.log('Notifications Columns:', Object.keys(data[0]));
        } else {
            console.log('Notifications table is empty, cannot infer columns from data. Trying invalid select to get column error...');
            const { error: colError } = await supabase.from('notifications').select('non_existent_column');
            console.log('Column finding error hint:', colError?.message || colError);
        }
    }
};

checkSchema();
