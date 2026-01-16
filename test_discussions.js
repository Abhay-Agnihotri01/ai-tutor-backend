import supabase from './src/config/supabase.js';

async function testDiscussionsTable() {
  try {
    console.log('Testing discussions table...');
    
    // Test if table exists
    const { data, error } = await supabase
      .from('discussions')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Table error:', error);
      return;
    }
    
    console.log('✅ Discussions table exists and accessible');
    console.log('Sample data:', data);
    
    // Test insert
    const { data: insertData, error: insertError } = await supabase
      .from('discussions')
      .insert({
        courseId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001', 
        title: 'Test Discussion',
        content: 'Test content'
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Insert error:', insertError);
      return;
    }
    
    console.log('✅ Insert successful:', insertData);
    
    // Clean up
    await supabase.from('discussions').delete().eq('id', insertData.id);
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDiscussionsTable();