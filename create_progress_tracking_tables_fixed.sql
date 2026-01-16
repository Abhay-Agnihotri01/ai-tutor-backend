-- Progress Tracking Database Schema (Fixed)
-- Run this in your Supabase SQL Editor

-- 1. Lecture Progress Tracking
CREATE TABLE IF NOT EXISTS lecture_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id),
  "courseId" UUID NOT NULL REFERENCES courses(id),
  "lectureId" UUID NOT NULL REFERENCES videos(id),
  "watchTime" INTEGER DEFAULT 0,
  "totalDuration" INTEGER NOT NULL,
  "completionPercentage" DECIMAL(5,2) DEFAULT 0,
  "isCompleted" BOOLEAN DEFAULT false,
  "firstWatchedAt" TIMESTAMPTZ,
  "lastWatchedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId", "lectureId")
);

-- 2. Assignment Progress Tracking
CREATE TABLE IF NOT EXISTS assignment_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id),
  "courseId" UUID NOT NULL REFERENCES courses(id),
  "assignmentId" UUID NOT NULL REFERENCES quizzes(id),
  "submissionId" UUID REFERENCES quiz_attempts(id),
  "status" VARCHAR(20) DEFAULT 'not_started',
  "score" DECIMAL(5,2),
  "maxScore" DECIMAL(5,2),
  "submittedAt" TIMESTAMPTZ,
  "gradedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId", "assignmentId")
);

-- 3. Quiz Performance Tracking
CREATE TABLE IF NOT EXISTS quiz_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id),
  "courseId" UUID NOT NULL REFERENCES courses(id),
  "quizId" UUID NOT NULL REFERENCES quizzes(id),
  "attemptId" UUID REFERENCES quiz_attempts(id),
  "score" DECIMAL(5,2),
  "maxScore" DECIMAL(5,2),
  "percentage" DECIMAL(5,2),
  "isPassed" BOOLEAN DEFAULT false,
  "timeSpent" INTEGER,
  "attemptNumber" INTEGER DEFAULT 1,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId", "quizId", "attemptNumber")
);

-- 4. Live Lecture Attendance
CREATE TABLE IF NOT EXISTS live_lecture_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id),
  "courseId" UUID NOT NULL REFERENCES courses(id),
  "liveClassId" UUID NOT NULL REFERENCES live_classes(id),
  "joinedAt" TIMESTAMPTZ,
  "leftAt" TIMESTAMPTZ,
  "duration" INTEGER,
  "totalDuration" INTEGER,
  "attendancePercentage" DECIMAL(5,2),
  "isPresent" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId", "liveClassId")
);

-- 5. Course Activity Tracking
CREATE TABLE IF NOT EXISTS course_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id),
  "courseId" UUID NOT NULL REFERENCES courses(id),
  "activityType" VARCHAR(50) NOT NULL,
  "activityId" UUID,
  "timeSpent" INTEGER DEFAULT 0,
  "timestamp" TIMESTAMPTZ DEFAULT NOW(),
  "metadata" JSONB
);

-- 6. Daily Learning Streaks
CREATE TABLE IF NOT EXISTS learning_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id),
  "courseId" UUID NOT NULL REFERENCES courses(id),
  "date" DATE NOT NULL,
  "activitiesCount" INTEGER DEFAULT 0,
  "timeSpent" INTEGER DEFAULT 0,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId", "courseId", "date")
);

-- 7. Create materialized view (production-safe)
CREATE MATERIALIZED VIEW IF NOT EXISTS student_progress_summary AS
SELECT 
  e."userId",
  e."courseId",
  c.title as "courseTitle",
  COALESCE(lp.total_lectures, 0) as "totalLectures",
  COALESCE(lp.completed_lectures, 0) as "completedLectures",
  COALESCE(lp.avg_completion, 0) as "lectureCompletionPercentage",
  COALESCE(ap.total_assignments, 0) as "totalAssignments",
  COALESCE(ap.submitted_assignments, 0) as "submittedAssignments",
  COALESCE(ap.avg_assignment_score, 0) as "averageAssignmentScore",
  COALESCE(qp.total_quizzes, 0) as "totalQuizzes",
  COALESCE(qp.completed_quizzes, 0) as "completedQuizzes",
  COALESCE(qp.avg_quiz_score, 0) as "averageQuizScore",
  COALESCE(qp.passed_quizzes, 0) as "passedQuizzes",
  COALESCE(lla.total_live_classes, 0) as "totalLiveClasses",
  COALESCE(lla.attended_classes, 0) as "attendedLiveClasses",
  COALESCE(lla.avg_attendance, 0) as "liveAttendancePercentage",
  CASE 
    WHEN (COALESCE(lp.total_lectures, 0) + COALESCE(ap.total_assignments, 0) + 
          COALESCE(qp.total_quizzes, 0) + COALESCE(lla.total_live_classes, 0)) = 0 
    THEN 0
    ELSE (
      (COALESCE(lp.completed_lectures, 0) * 0.4) +
      (COALESCE(ap.submitted_assignments, 0) * 0.3) +
      (COALESCE(qp.completed_quizzes, 0) * 0.2) +
      (COALESCE(lla.attended_classes, 0) * 0.1)
    ) * 100 / (
      (COALESCE(lp.total_lectures, 0) * 0.4) +
      (COALESCE(ap.total_assignments, 0) * 0.3) +
      (COALESCE(qp.total_quizzes, 0) * 0.2) +
      (COALESCE(lla.total_live_classes, 0) * 0.1)
    )
  END as "overallCompletionPercentage",
  COALESCE(ca.total_time_spent, 0) as "totalTimeSpent",
  ca.last_activity as "lastActivityDate",
  COALESCE(ls.current_streak, 0) as "currentStreak",
  NOW() as "lastUpdated"
FROM enrollments e
JOIN courses c ON e."courseId" = c.id
LEFT JOIN (
  SELECT "userId", "courseId", COUNT(*) as total_lectures,
    COUNT(CASE WHEN "isCompleted" = true THEN 1 END) as completed_lectures,
    AVG("completionPercentage") as avg_completion
  FROM lecture_progress GROUP BY "userId", "courseId"
) lp ON e."userId" = lp."userId" AND e."courseId" = lp."courseId"
LEFT JOIN (
  SELECT "userId", "courseId", COUNT(*) as total_assignments,
    COUNT(CASE WHEN status IN ('submitted', 'graded') THEN 1 END) as submitted_assignments,
    AVG(CASE WHEN "score" IS NOT NULL THEN ("score" / "maxScore") * 100 END) as avg_assignment_score
  FROM assignment_progress GROUP BY "userId", "courseId"
) ap ON e."userId" = ap."userId" AND e."courseId" = ap."courseId"
LEFT JOIN (
  SELECT "userId", "courseId", COUNT(DISTINCT "quizId") as total_quizzes,
    COUNT(CASE WHEN "completedAt" IS NOT NULL THEN 1 END) as completed_quizzes,
    AVG("percentage") as avg_quiz_score,
    COUNT(CASE WHEN "isPassed" = true THEN 1 END) as passed_quizzes
  FROM quiz_performance GROUP BY "userId", "courseId"
) qp ON e."userId" = qp."userId" AND e."courseId" = qp."courseId"
LEFT JOIN (
  SELECT "userId", "courseId", COUNT(*) as total_live_classes,
    COUNT(CASE WHEN "isPresent" = true THEN 1 END) as attended_classes,
    AVG("attendancePercentage") as avg_attendance
  FROM live_lecture_attendance GROUP BY "userId", "courseId"
) lla ON e."userId" = lla."userId" AND e."courseId" = lla."courseId"
LEFT JOIN (
  SELECT "userId", "courseId", SUM("timeSpent") as total_time_spent,
    MAX("timestamp") as last_activity
  FROM course_activity GROUP BY "userId", "courseId"
) ca ON e."userId" = ca."userId" AND e."courseId" = ca."courseId"
LEFT JOIN (
  SELECT "userId", "courseId", COUNT(*) as current_streak
  FROM learning_streaks
  WHERE "isActive" = true AND "date" >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY "userId", "courseId"
) ls ON e."userId" = ls."userId" AND e."courseId" = ls."courseId";

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_progress_summary_unique 
ON student_progress_summary ("userId", "courseId");

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lecture_progress_user_course ON lecture_progress("userId", "courseId");
CREATE INDEX IF NOT EXISTS idx_assignment_progress_user_course ON assignment_progress("userId", "courseId");
CREATE INDEX IF NOT EXISTS idx_quiz_performance_user_course ON quiz_performance("userId", "courseId");
CREATE INDEX IF NOT EXISTS idx_live_attendance_user_course ON live_lecture_attendance("userId", "courseId");
CREATE INDEX IF NOT EXISTS idx_course_activity_user_course_time ON course_activity("userId", "courseId", "timestamp");
CREATE INDEX IF NOT EXISTS idx_learning_streaks_user_course_date ON learning_streaks("userId", "courseId", "date");

-- Refresh function (production-safe)
CREATE OR REPLACE FUNCTION refresh_progress_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY student_progress_summary;
END;
$$ LANGUAGE plpgsql;