-- Add lastReadAt columns to admin_communications table to track unread messages properly
ALTER TABLE admin_communications 
ADD COLUMN IF NOT EXISTS "userLastReadAt" TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS "adminLastReadAt" TIMESTAMPTZ DEFAULT NOW();
