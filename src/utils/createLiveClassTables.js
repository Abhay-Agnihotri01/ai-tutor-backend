import supabase from '../config/supabase.js';

export const createLiveClassTables = async () => {
  try {
    // Create live_classes table
    const { error: liveClassError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS live_classes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "courseId" UUID NOT NULL,
          "chapterId" UUID,
          "instructorId" UUID NOT NULL,
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
      `
    });

    // Create live_class_participants table
    const { error: participantsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS live_class_participants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "liveClassId" UUID NOT NULL,
          "userId" UUID NOT NULL,
          "joinedAt" TIMESTAMPTZ,
          "leftAt" TIMESTAMPTZ,
          "isPresent" BOOLEAN DEFAULT false,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE("liveClassId", "userId")
        );
      `
    });

    // Create indexes
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_live_classes_course_id ON live_classes("courseId");
        CREATE INDEX IF NOT EXISTS idx_live_classes_instructor_id ON live_classes("instructorId");
        CREATE INDEX IF NOT EXISTS idx_live_classes_scheduled_at ON live_classes("scheduledAt");
        CREATE INDEX IF NOT EXISTS idx_live_class_participants_class_id ON live_class_participants("liveClassId");
        CREATE INDEX IF NOT EXISTS idx_live_class_participants_user_id ON live_class_participants("userId");
      `
    });

    if (liveClassError || participantsError || indexError) {
      console.error('Error creating tables:', { liveClassError, participantsError, indexError });
      return false;
    }

    console.log('Live class tables created successfully');
    return true;
  } catch (error) {
    console.error('Failed to create live class tables:', error);
    return false;
  }
};