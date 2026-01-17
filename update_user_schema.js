import supabase from './src/config/supabase.js';

const addLastSeenColumn = async () => {
    try {
        console.log('Adding last_seen column to users table...');

        // We can't execute DDL via the Supabase JS client directly on some setups if RLS is strict or if using the service key with limited permissions,
        // but usually we can use .rpc() if we have a function, or just rely on the user having access to the SQL editor.
        // However, since I am an AI, I should try to use the raw query if possible or inform the user.
        // The previous 'manage_db.js' attempt failed.

        // Actually, I can try to use a specialized RPC function if it exists, but I'll assume I can't easily run DDL from here without a specific function.
        // BUT, I can try the `check_columns.js` approach - maybe I can see how they run queries?
        // Wait, I can try to use the supabase client's .rpc() if a 'exec_sql' function exists (common pattern).

        // If not, I only have the `supabase-js` client.
        // I recall `create_group_chat_tables.sql` exists, which suggests the user runs SQL manually or there's a migration tool.
        // But since I need to do this now, I will try to use the `node-postgres` (pg) client if it's installed, or just ask the user.
        // Let's check package.json first.

        console.log("Please run this SQL in your Supabase SQL Editor:");
        console.log(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "last_seen" TIMESTAMPTZ DEFAULT NOW();`);

    } catch (error) {
        console.error('Error:', error);
    }
};

addLastSeenColumn();
