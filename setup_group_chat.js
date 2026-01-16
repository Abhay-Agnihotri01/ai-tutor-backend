import supabase from '../src/config/supabase.js';
import fs from 'fs';
import path from 'path';

const setupGroupChatTables = async () => {
  try {
    console.log('Setting up group chat tables...');

    // Read the SQL file
    const sqlPath = path.join(process.cwd(), 'create_group_chat_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement.trim() + ';' });
          if (error) {
            console.error('Error executing statement:', error);
          }
        } catch (err) {
          console.error('Error with statement:', statement.substring(0, 100) + '...', err.message);
        }
      }
    }

    console.log('Group chat tables setup completed!');
    console.log('Please run the SQL manually in your Supabase SQL Editor if this script fails.');
    
  } catch (error) {
    console.error('Error setting up group chat tables:', error);
    console.log('\nPlease manually run the SQL from create_group_chat_tables.sql in your Supabase SQL Editor.');
  }
};

setupGroupChatTables();