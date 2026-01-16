-- Complete LMS Database Schema Migration
-- Run this file in Supabase SQL Editor to create all required tables

-- =============================================
-- CORE TABLES
-- =============================================

-- Users table (should already exist from Supabase Auth)
-- courses, chapters, videos, resources, enrollments tables (should already exist)

-- =============================================
-- TEXT LECTURES
-- =============================================

-- Create text_lectures table
CREATE TABLE IF NOT EXISTS text_lectures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  "chapterId" UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  "courseId" UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  "filePath" TEXT NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "uploadType" VARCHAR(10) CHECK ("uploadType" IN ('file', 'url')) NOT NULL,
  "order" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Create text_lecture_notes table
CREATE TABLE IF NOT EXISTS text_lecture_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "textLectureId" UUID NOT NULL REFERENCES text_lectures(id) ON DELETE CASCADE,
  "courseId" UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'text' CHECK (type IN ('text', 'drawing')),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Create text_lecture_progress table
CREATE TABLE IF NOT EXISTS text_lecture_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "textLectureId" UUID NOT NULL REFERENCES text_lectures(id) ON DELETE CASCADE,
  "courseId" UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  "isCompleted" BOOLEAN DEFAULT false,
  "completedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("userId", "textLectureId")
);

-- Create text_lecture_bookmarks table
CREATE TABLE IF NOT EXISTS text_lecture_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "textLectureId" UUID NOT NULL REFERENCES text_lectures(id) ON DELETE CASCADE,
  "courseId" UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("userId", "textLectureId")
);

-- =============================================
-- LIVE CLASSES
-- =============================================

-- Create live_classes table
CREATE TABLE IF NOT EXISTS live_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "courseId" UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    "chapterId" UUID REFERENCES chapters(id) ON DELETE SET NULL,
    "instructorId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    "scheduledAt" TIMESTAMPTZ NOT NULL,
    duration INTEGER NOT NULL DEFAULT 60,
    "meetingUrl" VARCHAR(500),
    "meetingId" VARCHAR(100),
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
    "maxParticipants" INTEGER DEFAULT 100,
    "isRecorded" BOOLEAN DEFAULT false,
    "recordingUrl" VARCHAR(500),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Create live_class_participants table
CREATE TABLE IF NOT EXISTS live_class_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "liveClassId" UUID NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "joinedAt" TIMESTAMPTZ,
    "leftAt" TIMESTAMPTZ,
    "isPresent" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("liveClassId", "userId")
);

-- Create live_class_recordings table
CREATE TABLE IF NOT EXISTS live_class_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "liveClassId" UUID NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
    "courseId" UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    "recordingUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    duration INTEGER DEFAULT 0,
    "fileSize" BIGINT DEFAULT 0,
    "uploadedBy" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Create live_class_signals table for real-time communication
CREATE TABLE IF NOT EXISTS live_class_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "liveClassId" UUID NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
    "fromUserId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "toUserId" UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    data JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- STUDENT NOTES (for video and live class recordings)
-- =============================================

-- Create student_notes table for video notes (including live class recordings)
CREATE TABLE IF NOT EXISTS student_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "videoId" UUID, -- No foreign key constraint to allow live class recording IDs
    "courseId" UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    "textLectureId" UUID REFERENCES text_lectures(id) ON DELETE CASCADE,
    type VARCHAR(50) DEFAULT 'text' CHECK (type IN ('text', 'drawing')),
    content TEXT NOT NULL,
    timestamp INTEGER DEFAULT 0, -- Video timestamp in seconds
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS
-- =============================================

-- Create notifications table for tracking sent notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  "courseId" UUID REFERENCES courses(id) ON DELETE CASCADE,
  "senderId" UUID REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  content TEXT,
  metadata JSONB,
  "sentAt" TIMESTAMPTZ DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Create notification_recipients table for tracking individual recipients
CREATE TABLE IF NOT EXISTS notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "notificationId" UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'sent',
  "deliveredAt" TIMESTAMPTZ,
  "readAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CERTIFICATES
-- =============================================

-- Create certificates table
CREATE TABLE IF NOT EXISTS certificates (
  id VARCHAR(50) PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "courseId" UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  "certificateUrl" TEXT NOT NULL,
  "issuedAt" TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId", "courseId")
);

-- =============================================
-- CART AND WISHLIST
-- =============================================

-- Create cart table
CREATE TABLE IF NOT EXISTS cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "courseId" UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  "addedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId", "courseId")
);

-- Create wishlist table
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "courseId" UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  "addedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId", "courseId")
);

-- =============================================
-- ENROLLMENT ENHANCEMENTS
-- =============================================

-- Add price_paid column to enrollments if it doesn't exist
ALTER TABLE enrollments 
ADD COLUMN IF NOT EXISTS "pricePaid" DECIMAL(10,2) DEFAULT 0;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Text Lectures indexes
CREATE INDEX IF NOT EXISTS idx_text_lectures_chapter_id ON text_lectures("chapterId");
CREATE INDEX IF NOT EXISTS idx_text_lectures_course_id ON text_lectures("courseId");
CREATE INDEX IF NOT EXISTS idx_text_lectures_order ON text_lectures("order");

-- Text Lecture Notes indexes
CREATE INDEX IF NOT EXISTS idx_text_lecture_notes_text_lecture_id ON text_lecture_notes("textLectureId");
CREATE INDEX IF NOT EXISTS idx_text_lecture_notes_user_id ON text_lecture_notes("userId");
CREATE INDEX IF NOT EXISTS idx_text_lecture_notes_course_id ON text_lecture_notes("courseId");

-- Text Lecture Progress indexes
CREATE INDEX IF NOT EXISTS idx_text_lecture_progress_user_id ON text_lecture_progress("userId");
CREATE INDEX IF NOT EXISTS idx_text_lecture_progress_text_lecture_id ON text_lecture_progress("textLectureId");
CREATE INDEX IF NOT EXISTS idx_text_lecture_progress_course_id ON text_lecture_progress("courseId");

-- Text Lecture Bookmarks indexes
CREATE INDEX IF NOT EXISTS idx_text_lecture_bookmarks_user_id ON text_lecture_bookmarks("userId");
CREATE INDEX IF NOT EXISTS idx_text_lecture_bookmarks_text_lecture_id ON text_lecture_bookmarks("textLectureId");

-- Live Classes indexes
CREATE INDEX IF NOT EXISTS idx_live_classes_course_id ON live_classes("courseId");
CREATE INDEX IF NOT EXISTS idx_live_classes_instructor_id ON live_classes("instructorId");
CREATE INDEX IF NOT EXISTS idx_live_classes_scheduled_at ON live_classes("scheduledAt");
CREATE INDEX IF NOT EXISTS idx_live_class_participants_class_id ON live_class_participants("liveClassId");
CREATE INDEX IF NOT EXISTS idx_live_class_participants_user_id ON live_class_participants("userId");

-- Live Class Recordings indexes
CREATE INDEX IF NOT EXISTS idx_live_class_recordings_live_class_id ON live_class_recordings("liveClassId");
CREATE INDEX IF NOT EXISTS idx_live_class_recordings_course_id ON live_class_recordings("courseId");
CREATE INDEX IF NOT EXISTS idx_live_class_recordings_uploaded_by ON live_class_recordings("uploadedBy");

-- Student Notes indexes
CREATE INDEX IF NOT EXISTS idx_student_notes_user_id ON student_notes("userId");
CREATE INDEX IF NOT EXISTS idx_student_notes_video_id ON student_notes("videoId");
CREATE INDEX IF NOT EXISTS idx_student_notes_course_id ON student_notes("courseId");
CREATE INDEX IF NOT EXISTS idx_student_notes_text_lecture_id ON student_notes("textLectureId");

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_course_id ON notifications("courseId");
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON notifications("senderId");
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications("sentAt");
CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification_id ON notification_recipients("notificationId");
CREATE INDEX IF NOT EXISTS idx_notification_recipients_user_id ON notification_recipients("userId");
CREATE INDEX IF NOT EXISTS idx_notification_recipients_status ON notification_recipients(status);

-- Certificates indexes
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates("userId");
CREATE INDEX IF NOT EXISTS idx_certificates_course_id ON certificates("courseId");
CREATE INDEX IF NOT EXISTS idx_certificates_issued_at ON certificates("issuedAt");

-- Cart and Wishlist indexes
CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart("userId");
CREATE INDEX IF NOT EXISTS idx_cart_course_id ON cart("courseId");
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist("userId");
CREATE INDEX IF NOT EXISTS idx_wishlist_course_id ON wishlist("courseId");

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on tables
ALTER TABLE text_lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_lecture_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_lecture_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_lecture_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_class_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_class_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

-- Text Lectures policies
CREATE POLICY "Users can view text lectures for enrolled courses" ON text_lectures
  FOR SELECT USING (
    "courseId" IN (
      SELECT "courseId" FROM enrollments WHERE "userId" = auth.uid()
    ) OR 
    "courseId" IN (
      SELECT id FROM courses WHERE "instructorId" = auth.uid()
    )
  );

CREATE POLICY "Instructors can manage their course text lectures" ON text_lectures
  FOR ALL USING (
    "courseId" IN (
      SELECT id FROM courses WHERE "instructorId" = auth.uid()
    )
  );

-- Student Notes policies
CREATE POLICY "Users can manage their own notes" ON student_notes
  FOR ALL USING ("userId" = auth.uid());

-- Cart policies
CREATE POLICY "Users can manage their own cart" ON cart
  FOR ALL USING ("userId" = auth.uid());

-- Wishlist policies
CREATE POLICY "Users can manage their own wishlist" ON wishlist
  FOR ALL USING ("userId" = auth.uid());

-- Live Classes policies
CREATE POLICY "Users can view live classes for enrolled courses" ON live_classes
  FOR SELECT USING (
    "courseId" IN (
      SELECT "courseId" FROM enrollments WHERE "userId" = auth.uid()
    ) OR 
    "instructorId" = auth.uid()
  );

CREATE POLICY "Instructors can manage their live classes" ON live_classes
  FOR ALL USING ("instructorId" = auth.uid());

-- =============================================
-- COMPLETION MESSAGE
-- =============================================

-- Insert a completion record (optional)
INSERT INTO notifications (type, subject, content, "createdAt") 
VALUES ('system', 'Database Migration Complete', 'All LMS tables have been created successfully', NOW())
ON CONFLICT DO NOTHING;