import supabase from './src/config/supabase.js';

async function disableRLS() {
  try {
    // Test insert without RLS
    const { data, error } = await supabase
      .from('admin_communications')
      .insert({
        senderId: '550e8400-e29b-41d4-a716-446655440000',
        receiverId: null,
        subject: 'Test Message',
        message: 'Test message content',
        priority: 'normal',
        category: 'general',
        isFromAdmin: false
      })
      .select()
      .single();

    if (error) {
      console.log('❌ Insert failed:', error);
    } else {
      console.log('✅ Insert successful:', data);
      
      // Clean up test record
      await supabase
        .from('admin_communications')
        .delete()
        .eq('id', data.id);
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

disableRLS();