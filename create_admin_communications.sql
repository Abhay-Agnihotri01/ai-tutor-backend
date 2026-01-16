-- Create admin_communications table
CREATE TABLE IF NOT EXISTS admin_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "senderId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "receiverId" UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for broadcast messages
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('general', 'course_approval', 'payout', 'policy', 'technical', 'content')),
    status VARCHAR(20) DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'resolved')),
    "isFromAdmin" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admin_communication_replies table
CREATE TABLE IF NOT EXISTS admin_communication_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "communicationId" UUID NOT NULL REFERENCES admin_communications(id) ON DELETE CASCADE,
    "senderId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    "isFromAdmin" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_communications_sender ON admin_communications("senderId");
CREATE INDEX IF NOT EXISTS idx_admin_communications_receiver ON admin_communications("receiverId");
CREATE INDEX IF NOT EXISTS idx_admin_communications_status ON admin_communications(status);
CREATE INDEX IF NOT EXISTS idx_admin_communications_category ON admin_communications(category);
CREATE INDEX IF NOT EXISTS idx_admin_communication_replies_communication ON admin_communication_replies("communicationId");
CREATE INDEX IF NOT EXISTS idx_admin_communication_replies_sender ON admin_communication_replies("senderId");

-- Add RLS policies
ALTER TABLE admin_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_communication_replies ENABLE ROW LEVEL SECURITY;

-- Policy for admin_communications: Users can see messages they sent or received, admins can see all
CREATE POLICY "Users can view their own communications" ON admin_communications
    FOR SELECT USING (
        "senderId" = auth.uid() OR 
        "receiverId" = auth.uid() OR 
        "receiverId" IS NULL OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Policy for creating communications: Students, instructors can send to admins, admins can send to anyone
CREATE POLICY "Users can create communications" ON admin_communications
    FOR INSERT WITH CHECK (
        "senderId" = auth.uid() AND (
            EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('student', 'instructor', 'admin'))
        )
    );

-- Policy for updating communications: Only sender or admin can update
CREATE POLICY "Users can update their communications" ON admin_communications
    FOR UPDATE USING (
        "senderId" = auth.uid() OR 
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Policy for replies: Users can see replies to communications they have access to
CREATE POLICY "Users can view accessible replies" ON admin_communication_replies
    FOR SELECT USING (
        "communicationId" IN (
            SELECT id FROM admin_communications WHERE 
            "senderId" = auth.uid() OR 
            "receiverId" = auth.uid() OR 
            "receiverId" IS NULL OR
            EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
        )
    );

-- Policy for creating replies: Users can reply to communications they have access to
CREATE POLICY "Users can create replies" ON admin_communication_replies
    FOR INSERT WITH CHECK (
        "senderId" = auth.uid() AND
        "communicationId" IN (
            SELECT id FROM admin_communications WHERE 
            "senderId" = auth.uid() OR 
            "receiverId" = auth.uid() OR 
            "receiverId" IS NULL OR
            EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
        )
    );