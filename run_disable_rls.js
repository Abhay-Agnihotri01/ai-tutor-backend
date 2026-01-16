import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const disableRLS = async () => {
  try {
    console.log('Disabling RLS on communication tables...');
    
    // Disable RLS
    const { error: rls1 } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE admin_communications DISABLE ROW LEVEL SECURITY;'
    });
    
    const { error: rls2 } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE admin_communication_replies DISABLE ROW LEVEL SECURITY;'
    });
    
    if (rls1) console.log('RLS disable error 1:', rls1);
    if (rls2) console.log('RLS disable error 2:', rls2);
    
    console.log('✅ RLS disabled successfully');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
};

disableRLS();