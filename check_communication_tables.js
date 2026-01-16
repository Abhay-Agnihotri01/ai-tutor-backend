import supabase from './src/config/supabase.js';

const checkAndCreateTables = async () => {
  try {
    console.log('Checking communication tables...');
    
    // Test if admin_communications table exists
    const { data: commTest, error: commError } = await supabase
      .from('admin_communications')
      .select('id')
      .limit(1);
    
    if (commError && commError.code === 'PGRST116') {
      console.log('❌ admin_communications table does not exist');
      console.log('Please run the SQL from create_admin_communications.sql in your Supabase SQL Editor');
      return;
    } else if (commError) {
      console.log('❌ Error checking admin_communications:', commError.message);
      return;
    } else {
      console.log('✅ admin_communications table exists');
    }
    
    // Test if admin_communication_replies table exists
    const { data: repliesTest, error: repliesError } = await supabase
      .from('admin_communication_replies')
      .select('id')
      .limit(1);
    
    if (repliesError && repliesError.code === 'PGRST116') {
      console.log('❌ admin_communication_replies table does not exist');
      console.log('Please run the SQL from create_admin_communications.sql in your Supabase SQL Editor');
      return;
    } else if (repliesError) {
      console.log('❌ Error checking admin_communication_replies:', repliesError.message);
      return;
    } else {
      console.log('✅ admin_communication_replies table exists');
    }
    
    console.log('✅ All communication tables exist and are accessible');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
};

checkAndCreateTables();