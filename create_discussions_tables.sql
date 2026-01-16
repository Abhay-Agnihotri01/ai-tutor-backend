-- Create discussions table
CREATE TABLE IF NOT EXISTS discussions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courseId UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    videoId UUID REFERENCES videos(id) ON DELETE CASCADE,
    userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    isResolved BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create discussion_replies table
CREATE TABLE IF NOT EXISTS discussion_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discussionId UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    isInstructorReply BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_discussions_course ON discussions(courseId);
CREATE INDEX IF NOT EXISTS idx_discussions_video ON discussions(videoId);
CREATE INDEX IF NOT EXISTS idx_discussions_user ON discussions(userId);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_discussion ON discussion_replies(discussionId);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_user ON discussion_replies(userId);

-- Add RLS policies
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_replies ENABLE ROW LEVEL SECURITY;

-- Policy for discussions: Users can see discussions for courses they're enrolled in or own
CREATE POLICY "Users can view discussions for enrolled courses" ON discussions
    FOR SELECT USING (
        courseId IN (
            SELECT "courseId" FROM enrollments WHERE "userId" = auth.uid()
            UNION
            SELECT id FROM courses WHERE "instructorId" = auth.uid()
        )
    );

-- Policy for creating discussions: Only enrolled students and course instructors
CREATE POLICY "Users can create discussions for enrolled courses" ON discussions
    FOR INSERT WITH CHECK (
        courseId IN (
            SELECT "courseId" FROM enrollments WHERE "userId" = auth.uid()
            UNION
            SELECT id FROM courses WHERE "instructorId" = auth.uid()
        )
    );

-- Policy for updating discussions: Only the author can update
CREATE POLICY "Users can update their own discussions" ON discussions
    FOR UPDATE USING (userId = auth.uid());

-- Policy for discussion replies: Users can see replies for discussions they can see
CREATE POLICY "Users can view replies for accessible discussions" ON discussion_replies
    FOR SELECT USING (
        discussionId IN (
            SELECT id FROM discussions WHERE 
            courseId IN (
                SELECT "courseId" FROM enrollments WHERE "userId" = auth.uid()
                UNION
                SELECT id FROM courses WHERE "instructorId" = auth.uid()
            )
        )
    );

-- Policy for creating replies: Users can reply to discussions they can see
CREATE POLICY "Users can create replies for accessible discussions" ON discussion_replies
    FOR INSERT WITH CHECK (
        discussionId IN (
            SELECT id FROM discussions WHERE 
            courseId IN (
                SELECT "courseId" FROM enrollments WHERE "userId" = auth.uid()
                UNION
                SELECT id FROM courses WHERE "instructorId" = auth.uid()
            )
        )
    );

-- Policy for updating replies: Only the author can update
CREATE POLICY "Users can update their own replies" ON discussion_replies
    FOR UPDATE USING (userId = auth.uid());