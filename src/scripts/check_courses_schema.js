import supabase from '../config/supabase.js';

const checkSchema = async () => {
    const { data } = await supabase.from('courses').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('KEYS:', Object.keys(data[0]).join(', '));
    }
};

checkSchema();
