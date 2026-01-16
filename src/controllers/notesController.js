import supabase from '../config/supabase.js';

export const createNote = async (req, res) => {
  try {
    const { videoId, courseId, type, content, timestamp, textLectureId } = req.body;
    const userId = req.user.id;

    console.log('Creating note:', { videoId, textLectureId, courseId, type, userId });

    // Handle recording IDs that may not be UUIDs
    let actualVideoId = videoId;
    
    if (videoId) {
      // Check if videoId is a valid UUID format
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(videoId);
      
      if (!isUUID) {
        // For non-UUID IDs (like recording IDs), create a consistent hash-based UUID
        const crypto = await import('crypto');
        const hash = crypto.createHash('md5').update(videoId).digest('hex');
        actualVideoId = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
        console.log(`Converted recording ID ${videoId} to UUID ${actualVideoId}`);
      }
    }

    // For live class recordings, store the original recording ID in content metadata
    let noteContent = content;
    let noteVideoId = actualVideoId;
    
    // If this is a live class recording (non-UUID original videoId), set videoId to null
    // and store the recording ID in the content metadata
    if (videoId && !(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(videoId))) {
      noteVideoId = null;
      // Add recording metadata to content for live class recordings
      if (type === 'text') {
        noteContent = JSON.stringify({
          text: content,
          recordingId: videoId,
          isLiveClassRecording: true
        });
      } else {
        // For drawings, we'll store the recording ID separately
        noteContent = JSON.stringify({
          drawing: content,
          recordingId: videoId,
          isLiveClassRecording: true
        });
      }
    }

    const { data: note, error } = await supabase
      .from('student_notes')
      .insert({
        userId: userId,
        videoId: noteVideoId,
        courseId: courseId,
        textLectureId: textLectureId || null,
        type,
        content: noteContent,
        timestamp: timestamp || 0,
        createdAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating note:', error);
      throw error;
    }

    console.log('Note created successfully:', note.id);
    res.json({ success: true, note });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ message: 'Failed to save note', error: error.message });
  }
};

export const getNotes = async (req, res) => {
  try {
    const { videoId: encodedVideoId } = req.params;
    const videoId = decodeURIComponent(encodedVideoId);
    const userId = req.user.id;

    console.log('Getting notes for videoId:', videoId, 'userId:', userId);

    // Handle recording IDs that may not be UUIDs
    let actualVideoId = videoId;
    
    if (videoId) {
      // Check if videoId is a valid UUID format
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(videoId);
      
      if (!isUUID) {
        // For non-UUID IDs (like recording IDs), create a consistent hash-based UUID
        const crypto = await import('crypto');
        const hash = crypto.createHash('md5').update(videoId).digest('hex');
        actualVideoId = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
        console.log(`Converted recording ID ${videoId} to UUID ${actualVideoId} for retrieval`);
      }
    }

    let notes = [];
    
    // Check if this is a live class recording (non-UUID)
    const isLiveClassRecording = videoId && !(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(videoId));
    
    if (isLiveClassRecording) {
      // For live class recordings, get notes where videoId is null and content contains the recording ID
      // We need to get all notes with null videoId to filter by recordingId since we can't query JSON content directly
      const { data: allNotes, error } = await supabase
        .from('student_notes')
        .select('*')
        .eq('userId', userId)
        .is('videoId', null)
        .order('timestamp', { ascending: true });
      
      console.log('Found notes with null videoId:', allNotes?.length || 0);
      
      if (error) {
        console.error('Error getting notes:', error);
        throw error;
      }
      
      // Filter notes that match this recording ID
      notes = (allNotes || []).filter(note => {
        try {
          const contentObj = JSON.parse(note.content);
          const matches = contentObj.recordingId === videoId;
          if (matches) {
            console.log('Found matching note for recording:', videoId, 'noteId:', note.id);
          }
          return matches;
        } catch (e) {
          console.log('Failed to parse note content:', note.id, e.message);
          return false;
        }
      });
      
      console.log('Filtered notes for recording', videoId, ':', notes.length);
      
      // Transform the content back to original format for frontend
      notes = notes.map(note => {
        try {
          const contentObj = JSON.parse(note.content);
          return {
            ...note,
            content: contentObj.text || contentObj.drawing || note.content
          };
        } catch {
          return note;
        }
      });
    } else {
      // For regular videos, use the normal query
      const { data: regularNotes, error } = await supabase
        .from('student_notes')
        .select('*')
        .eq('userId', userId)
        .eq('videoId', actualVideoId)
        .order('timestamp', { ascending: true });
      
      if (error) {
        console.error('Error getting notes:', error);
        throw error;
      }
      
      notes = regularNotes || [];
    }

    console.log('Found notes:', notes?.length || 0);
    res.json({ success: true, notes });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ message: 'Failed to load notes', error: error.message });
  }
};

export const getTextLectureNotes = async (req, res) => {
  try {
    const { textLectureId } = req.params;
    const userId = req.user.id;

    console.log('Getting text lecture notes for:', { textLectureId, userId });

    const { data: notes, error } = await supabase
      .from('student_notes')
      .select('*')
      .eq('"userId"', userId)
      .eq('"textLectureId"', textLectureId)
      .order('"createdAt"', { ascending: false });

    if (error) {
      console.error('Error getting text lecture notes:', error);
      throw error;
    }

    console.log('Found text lecture notes:', notes?.length || 0);
    res.json({ success: true, notes: notes || [] });
  } catch (error) {
    console.error('Text lecture notes error:', error);
    res.status(500).json({ message: 'Failed to load text lecture notes', error: error.message });
  }
};

export const deleteNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from('student_notes')
      .delete()
      .eq('id', noteId)
      .eq('"userId"', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete note', error: error.message });
  }
};

export const getCourseNotes = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const { data: notes, error } = await supabase
      .from('student_notes')
      .select('*')
      .eq('"userId"', userId)
      .eq('"courseId"', courseId)
      .order('"createdAt"', { ascending: false });

    if (error) throw error;

    res.json({ success: true, notes: notes || [] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load course notes', error: error.message });
  }
};

export const getCourseTextLectureNotes = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const { data: notes, error } = await supabase
      .from('student_notes')
      .select('*')
      .eq('"userId"', userId)
      .eq('"courseId"', courseId)
      .is('"videoId"', null)
      .not('"textLectureId"', 'is', null)
      .order('"createdAt"', { ascending: false });

    if (error) throw error;

    res.json({ success: true, notes: notes || [] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load course text lecture notes', error: error.message });
  }
};

export const getChapterNotes = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const userId = req.user.id;

    // First get all videos in this chapter
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('id')
      .eq('"chapterId"', chapterId);

    if (videosError) throw videosError;

    if (!videos || videos.length === 0) {
      return res.json({ success: true, notes: [] });
    }

    const videoIds = videos.map(v => v.id);

    // Get notes for all videos in this chapter
    const { data: notes, error } = await supabase
      .from('student_notes')
      .select('*')
      .eq('"userId"', userId)
      .in('"videoId"', videoIds)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    res.json({ success: true, notes: notes || [] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load chapter notes', error: error.message });
  }
};