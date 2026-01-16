import supabase from '../config/supabase.js';

// Create Question
export const createQuestion = async (req, res) => {
  try {
    const { courseId, chapterId, videoId, title, questionText } = req.body;
    const userId = req.user.id;

    // Verify user is enrolled in the course
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('courseId', courseId)
      .eq('userId', userId)
      .single();

    if (!enrollment) {
      return res.status(403).json({ message: 'You must be enrolled to ask questions' });
    }

    const { data: question, error } = await supabase
      .from('course_questions')
      .insert({
        course_id: courseId,
        chapter_id: chapterId,
        video_id: videoId,
        user_id: userId,
        title,
        question_text: questionText
      })
      .select(`
        *,
        users (firstName, lastName, avatar)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, question });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Course Questions
export const getCourseQuestions = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 10, chapterId, videoId } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('course_questions')
      .select(`
        *,
        users (firstName, lastName, avatar),
        question_answers (
          *,
          users (firstName, lastName, avatar)
        )
      `, { count: 'exact' })
      .eq('course_id', courseId);

    if (chapterId) query = query.eq('chapter_id', chapterId);
    if (videoId) query = query.eq('video_id', videoId);

    const { data: questions, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      success: true,
      questions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil((count || 0) / limit),
        totalQuestions: count || 0
      }
    });
  } catch (error) {
    console.error('Get course questions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create Answer
export const createAnswer = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { answerText } = req.body;
    const userId = req.user.id;

    // Get question details
    const { data: question } = await supabase
      .from('course_questions')
      .select(`
        *,
        courses (instructorId)
      `)
      .eq('id', questionId)
      .single();

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user is enrolled or is the instructor
    const isInstructor = question.courses.instructorId === userId;
    
    if (!isInstructor) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('courseId', question.course_id)
        .eq('userId', userId)
        .single();

      if (!enrollment) {
        return res.status(403).json({ message: 'You must be enrolled to answer questions' });
      }
    }

    const { data: answer, error } = await supabase
      .from('question_answers')
      .insert({
        question_id: questionId,
        user_id: userId,
        answer_text: answerText,
        is_instructor_answer: isInstructor
      })
      .select(`
        *,
        users (firstName, lastName, avatar)
      `)
      .single();

    if (error) throw error;

    // Mark question as answered if this is an instructor answer
    if (isInstructor) {
      await supabase
        .from('course_questions')
        .update({ is_answered: true })
        .eq('id', questionId);
    }

    res.status(201).json({ success: true, answer });
  } catch (error) {
    console.error('Create answer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Mark Answer as Best
export const markBestAnswer = async (req, res) => {
  try {
    const { answerId } = req.params;
    const userId = req.user.id;

    // Get answer and question details
    const { data: answer } = await supabase
      .from('question_answers')
      .select(`
        *,
        course_questions (
          *,
          courses (instructorId)
        )
      `)
      .eq('id', answerId)
      .single();

    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    // Only question author or instructor can mark best answer
    const isInstructor = answer.course_questions.courses.instructorId === userId;
    const isQuestionAuthor = answer.course_questions.user_id === userId;

    if (!isInstructor && !isQuestionAuthor) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Remove best answer from other answers
    await supabase
      .from('question_answers')
      .update({ is_best_answer: false })
      .eq('question_id', answer.question_id);

    // Mark this answer as best
    const { error } = await supabase
      .from('question_answers')
      .update({ is_best_answer: true })
      .eq('id', answerId);

    if (error) throw error;

    res.json({ success: true, message: 'Answer marked as best' });
  } catch (error) {
    console.error('Mark best answer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Upvote Question/Answer
export const upvoteContent = async (req, res) => {
  try {
    const { type, id } = req.params; // type: 'question' or 'answer'
    
    const table = type === 'question' ? 'course_questions' : 'question_answers';
    
    const { error } = await supabase
      .from(table)
      .update({ upvotes: supabase.raw('upvotes + 1') })
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Upvoted successfully' });
  } catch (error) {
    console.error('Upvote content error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};