-- Create notification_recipients table to track read status per user
CREATE TABLE IF NOT EXISTS notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "notificationId" UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "isRead" BOOLEAN DEFAULT FALSE,
  "readAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("notificationId", "userId")
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notification_recipients_user ON notification_recipients("userId");
CREATE INDEX IF NOT EXISTS idx_notification_recipients_unread ON notification_recipients("userId") WHERE "isRead" = FALSE;

-- RLS Policies
ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON notification_recipients
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "Users can update their own notifications" ON notification_recipients
  FOR UPDATE USING ("userId" = auth.uid());
