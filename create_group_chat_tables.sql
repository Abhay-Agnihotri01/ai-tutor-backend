-- Group Chat Tables Migration
-- Run this SQL in your Supabase SQL Editor

-- Create chat_rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'public', -- 'public', 'private', 'course'
  "createdBy" UUID REFERENCES users(id),
  "courseId" UUID REFERENCES courses(id), -- Optional: link to specific course
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "roomId" UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  "messageType" VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'file'
  "isEdited" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Create chat_room_members table (for private rooms)
CREATE TABLE IF NOT EXISTS chat_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "roomId" UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id),
  role VARCHAR(20) DEFAULT 'member', -- 'admin', 'moderator', 'member'
  "joinedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("roomId", "userId")
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages("roomId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages("userId");
CREATE INDEX IF NOT EXISTS idx_chat_room_members_room ON chat_room_members("roomId");
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user ON chat_room_members("userId");

-- Insert default chat rooms
INSERT INTO chat_rooms (name, description, type, "isActive") VALUES
('General', 'General discussion for all students', 'public', true),
('Study Group', 'Study together and share resources', 'public', true),
('Help & Support', 'Get help from peers and instructors', 'public', true)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Chat rooms: Everyone can read public rooms
CREATE POLICY "Public chat rooms are viewable by everyone" ON chat_rooms
  FOR SELECT USING (type = 'public' AND "isActive" = true);

-- Chat rooms: Only admins can create/modify rooms
CREATE POLICY "Only admins can modify chat rooms" ON chat_rooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'instructor')
    )
  );

-- Chat messages: Users can read messages from rooms they have access to
CREATE POLICY "Users can read messages from accessible rooms" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_rooms 
      WHERE chat_rooms.id = chat_messages."roomId" 
      AND (
        chat_rooms.type = 'public' 
        OR EXISTS (
          SELECT 1 FROM chat_room_members 
          WHERE chat_room_members."roomId" = chat_rooms.id 
          AND chat_room_members."userId" = auth.uid()
        )
      )
    )
  );

-- Chat messages: Authenticated users can send messages
CREATE POLICY "Authenticated users can send messages" ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = "userId" 
    AND EXISTS (
      SELECT 1 FROM chat_rooms 
      WHERE chat_rooms.id = chat_messages."roomId" 
      AND chat_rooms."isActive" = true
      AND (
        chat_rooms.type = 'public' 
        OR EXISTS (
          SELECT 1 FROM chat_room_members 
          WHERE chat_room_members."roomId" = chat_rooms.id 
          AND chat_room_members."userId" = auth.uid()
        )
      )
    )
  );

-- Chat messages: Users can update their own messages
CREATE POLICY "Users can update their own messages" ON chat_messages
  FOR UPDATE USING (auth.uid() = "userId");

-- Chat room members: Users can view memberships
CREATE POLICY "Users can view room memberships" ON chat_room_members
  FOR SELECT USING (true);

-- Chat room members: Admins can manage memberships
CREATE POLICY "Admins can manage room memberships" ON chat_room_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'instructor')
    )
  );