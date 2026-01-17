-- Add table to track when a user last read a specific chat room
CREATE TABLE IF NOT EXISTS chat_last_read (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "roomId" UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "lastReadAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("roomId", "userId")
);


-- Policy: Users can see and update their own read status
ALTER TABLE chat_last_read ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own read status" ON chat_last_read
  FOR ALL USING (auth.uid() = "userId");

-- Add lastReadAt columns to admin_communications table to track unread messages properly
ALTER TABLE admin_communications 
ADD COLUMN IF NOT EXISTS "userLastReadAt" TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS "adminLastReadAt" TIMESTAMPTZ DEFAULT NOW();
