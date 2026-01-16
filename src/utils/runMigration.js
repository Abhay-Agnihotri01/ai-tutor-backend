import supabase from '../config/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
  try {
    const migrationPath = path.join(__dirname, '../migrations/add_discount_price.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Migration failed:', error);
    } else {
      console.log('Migration completed successfully');
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
};

runMigration();