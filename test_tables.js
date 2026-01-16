import supabase from './src/config/supabase.js';

async function testTables() {
  try {
    const { data, error } = await supabase
      .from('admin_communications')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ Tables do not exist:', error.message);
      console.log('Create tables manually in Supabase SQL Editor');
    } else {
      console.log('✅ Tables exist');
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

testTables();