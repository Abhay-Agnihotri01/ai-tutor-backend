-- Disable RLS on communication tables
ALTER TABLE admin_communications DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_communication_replies DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own communications" ON admin_communications;
DROP POLICY IF EXISTS "Users can create communications" ON admin_communications;
DROP POLICY IF EXISTS "Users can update their communications" ON admin_communications;
DROP POLICY IF EXISTS "Users can view accessible replies" ON admin_communication_replies;
DROP POLICY IF EXISTS "Users can create replies" ON admin_communication_replies;