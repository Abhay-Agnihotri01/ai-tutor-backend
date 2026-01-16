# Database Migrations

This folder contains the complete database schema for the Learning Management System.

## Setup Instructions

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor

2. **Run the Complete Schema**
   - Copy the contents of `complete_schema.sql`
   - Paste it into the SQL Editor
   - Execute the script

3. **Verify Tables Created**
   - Check the Table Editor to ensure all tables are created
   - Verify that indexes and policies are in place

## What's Included

The `complete_schema.sql` file creates:

### Core Tables
- `text_lectures` - PDF/document lectures
- `text_lecture_notes` - Student notes on text lectures
- `text_lecture_progress` - Reading progress tracking
- `text_lecture_bookmarks` - Bookmarked lectures

### Live Classes
- `live_classes` - Live class sessions
- `live_class_participants` - Attendance tracking
- `live_class_recordings` - Recording metadata
- `live_class_signals` - Real-time communication

### Student Features
- `student_notes` - Video and recording notes
- `cart` - Shopping cart items
- `wishlist` - Wishlist items
- `notifications` - System notifications
- `notification_recipients` - Notification delivery tracking

### Enhancements
- Adds `pricePaid` column to existing `enrollments` table
- Creates all necessary indexes for performance
- Sets up Row Level Security (RLS) policies
- Configures proper foreign key relationships

## Notes

- All tables use UUID primary keys
- Timestamps are in UTC with timezone support
- RLS policies ensure data security
- Indexes are optimized for common query patterns
- Foreign key constraints maintain data integrity

## Troubleshooting

If you encounter errors:
1. Ensure you have proper permissions in Supabase
2. Check that core tables (users, courses, chapters, etc.) exist
3. Run the script in sections if needed
4. Contact support if tables already exist with different schemas