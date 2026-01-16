import supabase from './src/config/supabase.js';

async function checkColumns() {
  try {
    // Try to get table structure by attempting to select with wrong column
    const { data, error } = await supabase
      .from('discussions')
      .select('*')
      .limit(0);
    
    console.log('Query result:', { data, error });
    
    // Try with lowercase columns
    const { data: testData, error: testError } = await supabase
      .from('discussions')
      .insert({
        courseid: '550e8400-e29b-41d4-a716-446655440000',
        userid: '550e8400-e29b-41d4-a716-446655440001', 
        title: 'Test Discussion',
        content: 'Test content'
      })
      .select()
      .single();
    
    console.log('Lowercase test:', { testData, testError });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkColumns();