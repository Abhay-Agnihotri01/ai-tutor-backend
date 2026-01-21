import supabase from '../config/supabase.js';

const checkSchema = async () => {
    console.log('Checking enrollments table columns...');
    const { data, error } = await supabase
        .from('enrollments')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error selecting from enrollments:', error);
    } else {
        if (data && data.length > 0) {
            console.log('Enrollments Columns:', Object.keys(data[0]));
        } else {
            console.log('Enrollments table is empty or fetch returned no data.');
        }
    }
};

checkSchema();
