import express from 'express';
import { authenticate } from '../middleware/auth.js';
import supabase from '../config/supabase.js';

const router = express.Router();

// Get notes for a text lecture
router.get('/text-lecture/:textLectureId', authenticate, async (req, res) => {
  try {
    const { textLectureId } = req.params;
    const userId = req.user.id;

    const { data: notes, error } = await supabase
      .from('text_lecture_notes')
      .select('*')
      .eq('textLectureId', textLectureId)
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json({ success: true, notes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch notes' });
  }
});

// Create a new text lecture note
router.post('/text-lecture', authenticate, async (req, res) => {
  try {
    console.log('Creating text lecture note:', req.body);
    console.log('User:', req.user.id);
    
    const { textLectureId, courseId, content, type } = req.body;
    const userId = req.user.id;

    const { data: note, error } = await supabase
      .from('text_lecture_notes')
      .insert([{
        textLectureId,
        courseId,
        userId,
        content,
        type,
        createdAt: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log('Note created successfully:', note);
    res.json({ success: true, note });
  } catch (error) {
    console.error('Text lecture note creation error:', error);
    res.status(500).json({ success: false, message: 'Failed to create note', error: error.message });
  }
});

// Delete a text lecture note
router.delete('/text-lecture/:noteId', authenticate, async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from('text_lecture_notes')
      .delete()
      .eq('id', noteId)
      .eq('userId', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete note' });
  }
});

// Get bookmarks for a text lecture
router.get('/bookmarks/text-lecture/:textLectureId', authenticate, async (req, res) => {
  try {
    const { textLectureId } = req.params;
    const userId = req.user.id;

    const { data: bookmarks, error } = await supabase
      .from('text_lecture_bookmarks')
      .select('*')
      .eq('textLectureId', textLectureId)
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json({ success: true, bookmarks });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch bookmarks' });
  }
});

// Create a new text lecture bookmark
router.post('/bookmarks/text-lecture', authenticate, async (req, res) => {
  try {
    const { textLectureId, courseId, title, description } = req.body;
    const userId = req.user.id;

    const { data: bookmark, error } = await supabase
      .from('text_lecture_bookmarks')
      .insert([{
        textLectureId,
        courseId,
        userId,
        title,
        description,
        createdAt: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, bookmark });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create bookmark' });
  }
});

// Delete a text lecture bookmark
router.delete('/bookmarks/text-lecture/:bookmarkId', authenticate, async (req, res) => {
  try {
    const { bookmarkId } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from('text_lecture_bookmarks')
      .delete()
      .eq('id', bookmarkId)
      .eq('userId', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete bookmark' });
  }
});

// Get all text lecture notes for a course
router.get('/text-lecture/course/:courseId', authenticate, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const { data: notes, error } = await supabase
      .from('text_lecture_notes')
      .select('*')
      .eq('courseId', courseId)
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json({ success: true, notes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch course text lecture notes' });
  }
});

// Test endpoint to check table structure (public for testing)
router.get('/test-table', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('text_lecture_notes')
      .select('*')
      .limit(1);
    
    res.json({ 
      success: true, 
      tableExists: !error,
      error: error?.message,
      sampleData: data 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;