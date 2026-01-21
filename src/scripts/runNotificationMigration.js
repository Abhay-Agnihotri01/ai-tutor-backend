import supabase from '../config/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
    try {
        const migrationPath = path.join(__dirname, '../../migrations/create_notification_recipients.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Running migration from:', migrationPath);

        const { error } = await supabase.rpc('exec_sql', { sql: sql });

        if (error) {
            console.error('Migration failed:', error);
            process.exit(1);
        } else {
            console.log('Migration completed successfully');
            process.exit(0);
        }
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
};

runMigration();
