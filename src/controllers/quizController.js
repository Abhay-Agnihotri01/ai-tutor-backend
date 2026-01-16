import supabase from '../config/supabase.js';

// Create Quiz
export const createQuiz = async (req, res) => {
  try {
    const { chapterId, title, description, timeLimit, passingScore, maxAttempts, type, totalMarks, passingMarks } = req.body;
    const instructorId = req.user.id;

    // Get chapter and verify instructor owns the course
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select(`
        *,
        courses!inner (
          id,
          "instructorId"
        )
      `)
      .eq('id', chapterId)
      .single();

    if (chapterError) throw chapterError;
    if (!chapter || chapter.courses.instructorId !== instructorId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const courseId = chapter.courses.id;

    const { data: quiz, error } = await supabase
      .from('quizzes')
      .insert({
        "courseId": courseId,
        "chapterId": chapterId,
        title,
        description,
        type: type || 'quiz',
        "timeLimit": timeLimit || null,
        "totalMarks": totalMarks || 0,
        "passingMarks": passingMarks || 60,
        "isActive": true
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, quiz });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add Question to Quiz
export const addQuizQuestion = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { question, type, marks, options, correctAnswer } = req.body;
    

    
    // Check if quiz exists first
    const { data: existingQuiz, error: quizCheckError } = await supabase
      .from('quizzes')
      .select('id, title, "totalMarks"')
      .eq('id', quizId)
      .single();
    
    if (quizCheckError || !existingQuiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const questionInsertData = {
      "quizId": quizId,
      "questionText": question,
      "questionType": type || 'single_correct',
      points: marks || 1
    };
    
    const { data: questionData, error: questionError } = await supabase
      .from('quiz_questions')
      .insert(questionInsertData)
      .select()
      .single();

    if (questionError) {
      throw questionError;
    }

    // Add options for multiple choice questions
    if (options && options.length > 0) {
      const optionsData = options.map((option, index) => {
        let isCorrect = false;
        
        if (type === 'single_correct') {
          isCorrect = correctAnswer === option;
        } else if (type === 'multiple_correct') {
          isCorrect = Array.isArray(correctAnswer) && correctAnswer.includes(option);
        }
        
        return {
          "questionId": questionData.id,
          "optionText": option,
          "isCorrect": isCorrect,
          "orderIndex": index
        };
      });

      const { data: insertedOptions, error: optionsError } = await supabase
        .from('quiz_options')
        .insert(optionsData)
        .select();

      if (optionsError) {
        throw optionsError;
      }
    }

    // Update quiz totalMarks
    const newTotalMarks = (existingQuiz?.totalMarks || 0) + (marks || 1);
    
    const { data: updatedQuiz, error: updateError } = await supabase
      .from('quizzes')
      .update({ "totalMarks": newTotalMarks })
      .eq('id', quizId)
      .select()
      .single();
    
    if (updateError) {
      // Quiz update failed but question was added
    }
    res.status(201).json({ success: true, question: questionData });
  } catch (error) {
    console.error('Add quiz question error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Quiz with Questions
export const getQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    // First check if quiz exists
    const { data: basicQuiz, error: basicError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (basicError || !basicQuiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    // Get full quiz with questions
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select(`
        *,
        quiz_questions (
          id,
          "questionText",
          "questionType",
          points,
          quiz_options (
            id,
            "optionText",
            "isCorrect",
            "orderIndex"
          )
        )
      `)
      .eq('id', id)
      .single();

    if (quizError) {
      throw quizError;
    }



    // Transform questions to match frontend expectations
    const transformedQuestions = (quiz.quiz_questions || []).map((q, index) => {

      
      return {
        id: q.id,
        question: q.questionText,
        type: q.questionType,
        marks: q.points,
        options: q.quiz_options ? q.quiz_options.map(opt => opt.optionText) : [],
        correctAnswer: q.quiz_options ? 
          (q.questionType === 'multiple_correct' ? 
            q.quiz_options.filter(opt => opt.isCorrect).map(opt => opt.optionText) :
            q.quiz_options.find(opt => opt.isCorrect)?.optionText
          ) : null
      };
    });

    // CRITICAL FIX: Always set questions property
    const finalQuiz = {
      ...quiz,
      questions: transformedQuestions
    };
    
    // Remove the raw quiz_questions to avoid confusion
    delete finalQuiz.quiz_questions;
    


    res.json({ success: true, quiz: finalQuiz });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Submit Quiz Attempt
export const submitQuizAttempt = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers, timeTaken } = req.body;
    const userId = req.user.id;

    // Get quiz with questions and correct answers
    const { data: quiz } = await supabase
      .from('quizzes')
      .select(`
        *,
        quiz_questions (
          *,
          quiz_options (*)
        )
      `)
      .eq('id', quizId)
      .single();

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check attempt limit
    const { count: attemptCount } = await supabase
      .from('quiz_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('"quizId"', quizId)
      .eq('"userId"', userId);

    if (attemptCount >= quiz.max_attempts) {
      return res.status(400).json({ message: 'Maximum attempts exceeded' });
    }

    // Calculate score
    let score = 0;
    let totalPoints = 0;
    


    quiz.quiz_questions.forEach((question, index) => {
      totalPoints += question.points;
      const userAnswer = answers[question.id];
      

      
      if (question.questionType === 'single_correct') {
        const correctOptions = question.quiz_options.filter(opt => opt.isCorrect);
        const correctOption = correctOptions[0];
        
        // Compare by option text, not ID
        if (correctOption && userAnswer === correctOption.optionText) {
          score += question.points;
        }
      } else if (question.questionType === 'multiple_correct') {
        const userAnswers = Array.isArray(userAnswer) ? userAnswer : [];
        const correctOptions = question.quiz_options.filter(opt => opt.isCorrect);
        const correctTexts = correctOptions.map(opt => opt.optionText);
        
        if (correctTexts.length === userAnswers.length && 
            correctTexts.every(text => userAnswers.includes(text))) {
          score += question.points;
        }
      } else if (question.questionType === 'true_false') {
        if (userAnswer === 'true' || userAnswer === 'false') {
          // For true/false, check against correct options
          const correctOption = question.quiz_options.find(opt => opt.isCorrect);
          if (correctOption && userAnswer === correctOption.optionText) {
            score += question.points;
          }
        }
      }
    });
    


    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const isPassed = percentage >= quiz.passingMarks;

    // Save attempt
    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .insert({
        "quizId": quizId,
        "userId": userId,
        score,
        "totalPoints": totalPoints,
        "timeTaken": timeTaken || 0,
        "isPassed": isPassed,
        "completedAt": new Date().toISOString(),
        answers
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      attempt: {
        ...attempt,
        percentage,
        passed: isPassed
      }
    });
  } catch (error) {
    console.error('Submit quiz attempt error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Quizzes by Chapter
export const getQuizzesByChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { data: quizzes, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('"chapterId"', chapterId)
      .order('"createdAt"', { ascending: false });

    if (error) {
      throw error;
    }

    // Get question counts and questions for quizzes
    const quizzesWithStatus = [];
    for (const quiz of quizzes || []) {

      
      let isReady = quiz.isActive;
      let questionCount = 0;
      let questions = [];
      
      if (quiz.type === 'quiz') {
        // For quizzes, get questions with options
        const { data: questionsData, error: questionsError } = await supabase
          .from('quiz_questions')
          .select(`
            id,
            "questionText",
            "questionType",
            points,
            quiz_options (
              id,
              "optionText",
              "isCorrect",
              "orderIndex"
            )
          `)
          .eq('"quizId"', quiz.id);
        
        if (!questionsError && questionsData) {
          questionCount = questionsData.length;
          // Transform questions to match frontend expectations
          questions = questionsData.map(q => ({
            id: q.id,
            question: q.questionText,
            type: q.questionType,
            marks: q.points,
            options: q.quiz_options ? q.quiz_options.map(opt => opt.optionText) : [],
            correctAnswer: q.quiz_options ? 
              (q.questionType === 'multiple_correct' ? 
                q.quiz_options.filter(opt => opt.isCorrect).map(opt => opt.optionText) :
                q.quiz_options.find(opt => opt.isCorrect)?.optionText
              ) : null
          }));
        }
        

        
        isReady = isReady && questionCount > 0;
      }
      

      
      // Calculate total marks from questions if it's a quiz type
      let actualTotalMarks = quiz.totalMarks;
      if (quiz.type === 'quiz' && questionCount > 0) {
        actualTotalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
        
        // Update quiz totalMarks if different
        if (actualTotalMarks !== quiz.totalMarks) {
          await supabase
            .from('quizzes')
            .update({ "totalMarks": actualTotalMarks })
            .eq('id', quiz.id);
        }
      }
      
      quizzesWithStatus.push({
        ...quiz,
        isReady,
        questionCount,
        questions, // Include questions array for frontend
        totalMarks: actualTotalMarks // Use calculated total marks
      });
    }
    


    res.json({ success: true, quizzes: quizzesWithStatus });
  } catch (error) {
    console.error('Get quizzes by chapter error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Quiz Attempt Status
export const getQuizAttemptStatus = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;

    // Get quiz info including type
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('"updatedAt", "isActive", type')
      .eq('id', quizId)
      .single();

    if (quizError) throw quizError;

    // Get latest attempt
    const { data: attempts, error } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('"quizId"', quizId)
      .eq('"userId"', userId)
      .order('"createdAt"', { ascending: false })
      .limit(1);

    if (error) throw error;

    const latestAttempt = attempts?.[0] || null;
    
    // Check if quiz was updated after last attempt (allow retake ONLY for quiz type, NOT assignments)
    let canRetake = false;
    if (latestAttempt && quiz.updatedAt && quiz.type === 'quiz') {
      const quizUpdated = new Date(quiz.updatedAt);
      const attemptDate = new Date(latestAttempt.createdAt);
      canRetake = quizUpdated > attemptDate;
    }
    
    res.json({ 
      success: true, 
      attempt: latestAttempt,
      hasAttempted: !!latestAttempt,
      canRetake,
      quizVersion: quiz.updatedAt
    });
  } catch (error) {
    console.error('Get quiz attempt status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Start Quiz Attempt
export const startQuizAttempt = async (req, res) => {
  try {
    const { quizId } = req.body;
    const userId = req.user.id;
    


    // Get quiz with questions using the same logic as getQuiz
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select(`
        *,
        quiz_questions (
          id,
          "questionText",
          "questionType",
          points,
          quiz_options (
            id,
            "optionText",
            "isCorrect",
            "orderIndex"
          )
        )
      `)
      .eq('id', quizId)
      .single();

    if (quizError) {
      throw quizError;
    }
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    


    // Transform questions to match frontend expectations (same as getQuiz)
    const transformedQuestions = (quiz.quiz_questions || []).map(q => ({
      id: q.id,
      question: q.questionText,
      type: q.questionType,
      marks: q.points,
      options: q.quiz_options ? q.quiz_options.map(opt => opt.optionText) : [],
      correctAnswer: q.quiz_options ? 
        (q.questionType === 'multiple_correct' ? 
          q.quiz_options.filter(opt => opt.isCorrect).map(opt => opt.optionText) :
          q.quiz_options.find(opt => opt.isCorrect)?.optionText
        ) : null
    }));
    
    // Create final quiz object with questions property
    const finalQuiz = {
      ...quiz,
      questions: transformedQuestions
    };
    
    // Remove the raw quiz_questions to avoid confusion
    delete finalQuiz.quiz_questions;
    


    // Create attempt record
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .insert({
        "quizId": quizId,
        "userId": userId,
        "startedAt": new Date().toISOString()
      })
      .select()
      .single();

    if (attemptError) {
      throw attemptError;
    }

    res.json({
      success: true,
      attempt: {
        id: attempt.id,
        quiz: finalQuiz
      }
    });
  } catch (error) {
    console.error('Start quiz attempt error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Submit Assignment
export const submitAssignment = async (req, res) => {
  try {
    const { quizId } = req.body;
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Create assignment submission
    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .insert({
        "quizId": quizId,
        "userId": userId,
        status: 'completed',
        "fileUrl": `/uploads/assignments/${file.filename}`,
        "completedAt": new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, submission: attempt });
  } catch (error) {
    console.error('Submit assignment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get User Quiz Attempts
export const getUserQuizAttempts = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;

    const { data: attempts, error } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('"quizId"', quizId)
      .eq('"userId"', userId)
      .order('"startedAt"', { ascending: false });

    if (error) throw error;

    res.json({ success: true, attempts });
  } catch (error) {
    console.error('Get user quiz attempts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Quiz Details (for editing)
export const getQuizDetails = async (req, res) => {
  try {
    const { quizId } = req.params;
    const instructorId = req.user.id;

    // Get quiz with questions and verify ownership
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select(`
        *,
        courses!inner (
          "instructorId"
        ),
        quiz_questions (
          id,
          "questionText",
          "questionType",
          points,
          quiz_options (
            id,
            "optionText",
            "isCorrect",
            "orderIndex"
          )
        )
      `)
      .eq('id', quizId)
      .single();

    if (quizError) throw quizError;
    if (!quiz || quiz.courses.instructorId !== instructorId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Transform questions to match frontend expectations
    const transformedQuestions = (quiz.quiz_questions || []).map(q => ({
      id: q.id,
      question: q.questionText,
      type: q.questionType,
      marks: q.points,
      options: q.quiz_options ? q.quiz_options.map(opt => opt.optionText) : [],
      correctAnswer: q.quiz_options ? 
        (q.questionType === 'multiple_correct' ? 
          q.quiz_options.filter(opt => opt.isCorrect).map(opt => opt.optionText) :
          q.quiz_options.find(opt => opt.isCorrect)?.optionText
        ) : null
    }));

    // CRITICAL FIX: Always set questions property
    const finalQuiz = {
      ...quiz,
      questions: transformedQuestions
    };
    
    // Remove the raw quiz_questions to avoid confusion
    delete finalQuiz.quiz_questions;
    


    res.json({ success: true, quiz: finalQuiz });
  } catch (error) {
    console.error('Get quiz details error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update Quiz
export const updateQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const instructorId = req.user.id;
    const { title, description, timeLimit, totalMarks, passingMarks } = req.body;

    // Verify instructor owns the quiz
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select(`
        *,
        courses!inner (
          "instructorId"
        )
      `)
      .eq('id', quizId)
      .single();

    if (quizError) throw quizError;
    if (!quiz || quiz.courses.instructorId !== instructorId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Update quiz with isActive true (ready for students)
    const { data: updatedQuiz, error: updateError } = await supabase
      .from('quizzes')
      .update({
        title,
        description,
        "timeLimit": timeLimit,
        "totalMarks": totalMarks,
        "passingMarks": passingMarks,
        "isActive": true, // Mark as ready
        "updatedAt": new Date().toISOString()
      })
      .eq('id', quizId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ success: true, quiz: updatedQuiz, message: 'Quiz updated and is now available to students' });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Quiz Submissions
export const getQuizSubmissions = async (req, res) => {
  try {
    const { quizId } = req.params;
    const instructorId = req.user.id;

    // Verify instructor owns the quiz
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select(`
        *,
        courses!inner (
          "instructorId"
        )
      `)
      .eq('id', quizId)
      .single();

    if (quizError) throw quizError;
    if (!quiz || quiz.courses.instructorId !== instructorId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Get all submissions for this quiz
    const { data: submissions, error: submissionsError } = await supabase
      .from('quiz_attempts')
      .select(`
        *,
        users!inner (
          "firstName",
          "lastName",
          email
        ),
        quizzes!inner (
          "totalMarks"
        )
      `)
      .eq('"quizId"', quizId)
      .not('"completedAt"', 'is', null)
      .order('"createdAt"', { ascending: false });

    if (submissionsError) throw submissionsError;

    // Transform submissions to include totalMarks at root level
    const transformedSubmissions = (submissions || []).map(submission => ({
      ...submission,
      totalMarks: submission.quizzes?.totalMarks || submission.totalPoints || 100
    }));

    res.json({ success: true, submissions: transformedSubmissions });
  } catch (error) {
    console.error('Get quiz submissions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Grade Assignment Submission
export const gradeSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { score, feedback } = req.body;
    const instructorId = req.user.id;

    // Verify instructor owns the quiz through course
    const { data: submission, error: submissionError } = await supabase
      .from('quiz_attempts')
      .select(`
        *,
        quizzes!inner (
          courses!inner (
            "instructorId"
          )
        )
      `)
      .eq('id', submissionId)
      .single();

    if (submissionError) throw submissionError;
    if (!submission || submission.quizzes.courses.instructorId !== instructorId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Update submission with grade
    const { data: updatedSubmission, error: updateError } = await supabase
      .from('quiz_attempts')
      .update({
        score: parseInt(score),
        feedback: feedback || null,
        status: 'graded',
        "gradedAt": new Date().toISOString()
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ success: true, submission: updatedSubmission });
  } catch (error) {
    console.error('Grade submission error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete Quiz
export const deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const instructorId = req.user.id;

    // Verify instructor owns the quiz through course
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select(`
        *,
        courses!inner (
          "instructorId"
        )
      `)
      .eq('id', quizId)
      .single();

    if (quizError) throw quizError;
    if (!quiz || quiz.courses.instructorId !== instructorId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Delete quiz (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId);

    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};