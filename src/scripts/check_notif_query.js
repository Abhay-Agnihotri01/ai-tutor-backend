import supabase from '../config/supabase.js';

const testQuery = async () => {
    console.log('Testing connection to Supabase...');

    // 1. Check if table exists and has snake_case columns
    const { data: tableCheck, error: tableError } = await supabase
        .from('notification_recipients')
        .select('user_id, notification_id')
        .limit(1);

    if (tableError) {
        console.error('ERROR: Table check or column check failed.', tableError);
        return;
    }
    console.log('Table structure seems correct (snake_case columns found).');

    // 2. Test the join query
    console.log('Testing the join query with snake_case FK...');
    // We need a valid user_id to test effectively, but even with invalid one, the query structure is checked.
    const { data, error } = await supabase
        .from('notification_recipients')
        .select(`
        id,
        notifications!notification_id (
          id,
          subject
        )
      `)
        .limit(1);

    if (error) {
        console.error('ERROR: Join Query failed!', error);
        process.exit(1);
    } else {
        console.log('SUCCESS: Query worked!', JSON.stringify(data, null, 2));
        process.exit(0);
    }
};

testQuery();
