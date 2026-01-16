import supabase from './src/config/supabase.js';

async function testReply() {
  try {
    console.log('Testing reply creation...');
    
    // First get a real discussion
    const { data: discussions } = await supabase
      .from('discussions')
      .select('*')
      .limit(1);
    
    if (!discussions || discussions.length === 0) {
      console.log('No discussions found');
      return;
    }
    
    const discussion = discussions[0];
    console.log('Found discussion:', discussion);
    
    // Test getting discussion details (what createReply does first)
    const { data: discussionDetails, error: discussionError } = await supabase
      .from('discussions')
      .select('courseid, userid, title')
      .eq('id', discussion.id)
      .single();
    
    console.log('Discussion details:', { discussionDetails, discussionError });
    
    if (discussionError) return;
    
    // Test getting course details
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('instructorid')
      .eq('id', discussionDetails.courseid)
      .single();
    
    console.log('Course details:', { course, courseError });
    
    if (courseError) return;
    
    // Test creating a reply
    const { data: reply, error: replyError } = await supabase
      .from('discussion_replies')
      .insert({
        discussionid: discussion.id,
        userid: discussionDetails.userid,
        content: 'Test reply',
        isinstructorreply: false
      })
      .select(`
        *,
        users!inner(firstName, lastName, avatar, role)
      `)
      .single();
    
    console.log('Reply creation:', { reply, replyError });
    
    // Clean up
    if (reply) {
      await supabase.from('discussion_replies').delete().eq('id', reply.id);
      console.log('Cleaned up test reply');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testReply();