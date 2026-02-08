-- Gamification Tables
-- Run this SQL in your Supabase SQL Editor to create the required tables

-- User XP table
CREATE TABLE IF NOT EXISTS user_xp (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "totalXp" INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  "currentStreak" INTEGER DEFAULT 0,
  "longestStreak" INTEGER DEFAULT 0,
  "videosCompleted" INTEGER DEFAULT 0,
  "quizzesPassed" INTEGER DEFAULT 0,
  "coursesCompleted" INTEGER DEFAULT 0,
  "lastActivityDate" DATE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId")
);

-- Badges table
CREATE TABLE IF NOT EXISTS badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  category VARCHAR(50) DEFAULT 'achievement',
  requirement JSONB,
  "xpReward" INTEGER DEFAULT 0,
  "sortOrder" INTEGER DEFAULT 0,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- User badges (junction table)
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "badgeId" UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  "earnedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId", "badgeId")
);

-- Indexes for gamification
CREATE INDEX IF NOT EXISTS idx_user_xp_user ON user_xp("userId");
CREATE INDEX IF NOT EXISTS idx_user_xp_total ON user_xp("totalXp" DESC);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges("userId");

-----------------------------------------------------------
-- Coupon Tables
-----------------------------------------------------------

-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  type VARCHAR(20) DEFAULT 'percentage' CHECK (type IN ('percentage', 'fixed', 'free')),
  value DECIMAL(10,2) NOT NULL,
  "maxUses" INTEGER,
  "usedCount" INTEGER DEFAULT 0,
  "validFrom" TIMESTAMPTZ,
  "validTo" TIMESTAMPTZ,
  "courseId" UUID REFERENCES courses(id) ON DELETE SET NULL,
  "instructorId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description VARCHAR(255),
  "minPurchaseAmount" DECIMAL(10,2),
  "maxDiscountAmount" DECIMAL(10,2),
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Coupon usage table
CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "couponId" UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "originalPrice" DECIMAL(10,2),
  "discountAmount" DECIMAL(10,2),
  "finalPrice" DECIMAL(10,2),
  "usedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for coupons
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_instructor ON coupons("instructorId");
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage("couponId");
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON coupon_usage("userId");

-----------------------------------------------------------
-- Learning Goals Tables
-----------------------------------------------------------

-- Learning goals table
CREATE TABLE IF NOT EXISTS learning_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "dailyMinutesGoal" INTEGER DEFAULT 30,
  "weeklyMinutesGoal" INTEGER DEFAULT 150,
  "reminderEnabled" BOOLEAN DEFAULT true,
  "reminderTime" TIME DEFAULT '09:00',
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId")
);

-- Learning sessions table
CREATE TABLE IF NOT EXISTS learning_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "courseId" UUID REFERENCES courses(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  "durationMinutes" INTEGER DEFAULT 0,
  "videosWatched" INTEGER DEFAULT 0,
  "quizzesCompleted" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for learning
CREATE INDEX IF NOT EXISTS idx_learning_goals_user ON learning_goals("userId");
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user ON learning_sessions("userId");
CREATE INDEX IF NOT EXISTS idx_learning_sessions_date ON learning_sessions(date DESC);

-----------------------------------------------------------
-- Video Preview (add to existing videos table)
-----------------------------------------------------------

-- Add isFreePreview column to videos table if not exists
ALTER TABLE videos ADD COLUMN IF NOT EXISTS "isFreePreview" BOOLEAN DEFAULT false;

-----------------------------------------------------------
-- Notification Preferences Table
-----------------------------------------------------------

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Email notification preferences
  "emailEnrollment" BOOLEAN DEFAULT true,
  "emailPayment" BOOLEAN DEFAULT true,
  "emailProgress" BOOLEAN DEFAULT true,
  "emailQuizResults" BOOLEAN DEFAULT true,
  "emailCertificates" BOOLEAN DEFAULT true,
  "emailBadges" BOOLEAN DEFAULT true,
  "emailDiscussions" BOOLEAN DEFAULT true,
  "emailCourseUpdates" BOOLEAN DEFAULT true,
  "emailMarketing" BOOLEAN DEFAULT false,
  
  -- In-app notification preferences
  "inAppAll" BOOLEAN DEFAULT true,
  
  -- Email frequency (instant, daily, weekly)
  "emailFrequency" VARCHAR(20) DEFAULT 'instant',
  
  -- Notification quiet hours
  "quietHoursStart" TIME,
  "quietHoursEnd" TIME,
  
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId")
);

-- Index for preferences lookup
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences("userId");
