import User from './User.js';
import Course from './Course.js';
import Enrollment from './Enrollment.js';
import Chapter from './Chapter.js';
import Video from './Video.js';
import Rating from './Rating.js';
import Resource from './Resource.js';
import Quiz from './Quiz.js';
import Question from './Question.js';
import QuizAttempt from './QuizAttempt.js';
import QuestionResponse from './QuestionResponse.js';
import TextLecture from './TextLecture.js';
import AdminCommunication from './AdminCommunication.js';
import AdminCommunicationReply from './AdminCommunicationReply.js';
import ActivityLog from './ActivityLog.js';
import AdminSession from './AdminSession.js';

// New models for features
import UserXP from './UserXP.js';
import Badge from './Badge.js';
import UserBadge from './UserBadge.js';
import Coupon from './Coupon.js';
import CouponUsage from './CouponUsage.js';
import LearningGoal from './LearningGoal.js';
import LearningSession from './LearningSession.js';

// Define associations
User.hasMany(Course, { foreignKey: 'instructorId', as: 'courses' });
Course.belongsTo(User, { foreignKey: 'instructorId', as: 'instructor' });

User.hasMany(Enrollment, { foreignKey: 'userId', as: 'enrollments' });
Enrollment.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Course.hasMany(Enrollment, { foreignKey: 'courseId', as: 'enrollments' });
Enrollment.belongsTo(Course, { foreignKey: 'courseId', as: 'Course' });

Course.hasMany(Chapter, { foreignKey: 'courseId', as: 'chapters' });
Chapter.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

Chapter.hasMany(Video, { foreignKey: 'chapterId', as: 'videos' });
Video.belongsTo(Chapter, { foreignKey: 'chapterId', as: 'chapter' });

Chapter.hasMany(Resource, { foreignKey: 'chapterId', as: 'resources' });
Resource.belongsTo(Chapter, { foreignKey: 'chapterId', as: 'chapter' });

// Rating associations
User.hasMany(Rating, { foreignKey: 'userId', as: 'ratings' });
Rating.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Course.hasMany(Rating, { foreignKey: 'courseId', as: 'ratings' });
Rating.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

// Quiz associations
Chapter.hasMany(Quiz, { foreignKey: 'chapterId', as: 'quizzes' });
Quiz.belongsTo(Chapter, { foreignKey: 'chapterId', as: 'chapter' });

Video.hasMany(Quiz, { foreignKey: 'videoId', as: 'quizzes' });
Quiz.belongsTo(Video, { foreignKey: 'videoId', as: 'video' });

Quiz.hasMany(Question, { foreignKey: 'quizId', as: 'questions' });
Question.belongsTo(Quiz, { foreignKey: 'quizId', as: 'quiz' });

Quiz.hasMany(QuizAttempt, { foreignKey: 'quizId', as: 'attempts' });
QuizAttempt.belongsTo(Quiz, { foreignKey: 'quizId', as: 'quiz' });

User.hasMany(QuizAttempt, { foreignKey: 'userId', as: 'quizAttempts' });
QuizAttempt.belongsTo(User, { foreignKey: 'userId', as: 'user' });

QuizAttempt.hasMany(QuestionResponse, { foreignKey: 'attemptId', as: 'responses' });
QuestionResponse.belongsTo(QuizAttempt, { foreignKey: 'attemptId', as: 'attempt' });

Question.hasMany(QuestionResponse, { foreignKey: 'questionId', as: 'responses' });
QuestionResponse.belongsTo(Question, { foreignKey: 'questionId', as: 'question' });

// TextLecture associations
Chapter.hasMany(TextLecture, { foreignKey: 'chapterId', as: 'textLectures' });
TextLecture.belongsTo(Chapter, { foreignKey: 'chapterId', as: 'chapter' });

Course.hasMany(TextLecture, { foreignKey: 'courseId', as: 'textLectures' });
TextLecture.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

// Admin Communication associations
User.hasMany(AdminCommunication, { foreignKey: 'senderId', as: 'sentCommunications' });
AdminCommunication.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

User.hasMany(AdminCommunication, { foreignKey: 'receiverId', as: 'receivedCommunications' });
AdminCommunication.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });

AdminCommunication.hasMany(AdminCommunicationReply, { foreignKey: 'communicationId', as: 'replies' });
AdminCommunicationReply.belongsTo(AdminCommunication, { foreignKey: 'communicationId', as: 'communication' });

User.hasMany(AdminCommunicationReply, { foreignKey: 'senderId', as: 'communicationReplies' });
AdminCommunicationReply.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

// Activity Log associations
User.hasMany(ActivityLog, { foreignKey: 'userId', as: 'activities' });
ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'User' });

// Admin Session associations
User.hasMany(AdminSession, { foreignKey: 'adminId', as: 'adminSessions' });
AdminSession.belongsTo(User, { foreignKey: 'adminId', as: 'admin' });

// ============================================
// NEW FEATURE ASSOCIATIONS
// ============================================

// Gamification - UserXP associations
User.hasOne(UserXP, { foreignKey: 'userId', as: 'xpStats' });
UserXP.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Gamification - Badge associations
User.belongsToMany(Badge, { through: UserBadge, foreignKey: 'userId', as: 'badges' });
Badge.belongsToMany(User, { through: UserBadge, foreignKey: 'badgeId', as: 'users' });

User.hasMany(UserBadge, { foreignKey: 'userId', as: 'userBadges' });
UserBadge.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Badge.hasMany(UserBadge, { foreignKey: 'badgeId', as: 'userBadges' });
UserBadge.belongsTo(Badge, { foreignKey: 'badgeId', as: 'badge' });

// Coupon associations
User.hasMany(Coupon, { foreignKey: 'instructorId', as: 'coupons' });
Coupon.belongsTo(User, { foreignKey: 'instructorId', as: 'instructor' });

Course.hasMany(Coupon, { foreignKey: 'courseId', as: 'coupons' });
Coupon.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

// CouponUsage associations
Coupon.hasMany(CouponUsage, { foreignKey: 'couponId', as: 'usages' });
CouponUsage.belongsTo(Coupon, { foreignKey: 'couponId', as: 'coupon' });

User.hasMany(CouponUsage, { foreignKey: 'userId', as: 'couponUsages' });
CouponUsage.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Enrollment.hasOne(CouponUsage, { foreignKey: 'enrollmentId', as: 'couponUsage' });
CouponUsage.belongsTo(Enrollment, { foreignKey: 'enrollmentId', as: 'enrollment' });

// Learning Goal associations
User.hasOne(LearningGoal, { foreignKey: 'userId', as: 'learningGoal' });
LearningGoal.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Learning Session associations
User.hasMany(LearningSession, { foreignKey: 'userId', as: 'learningSessions' });
LearningSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Course.hasMany(LearningSession, { foreignKey: 'courseId', as: 'learningSessions' });
LearningSession.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

export {
    User,
    Course,
    Enrollment,
    Chapter,
    Video,
    Rating,
    Resource,
    Quiz,
    Question,
    QuizAttempt,
    QuestionResponse,
    TextLecture,
    AdminCommunication,
    AdminCommunicationReply,
    ActivityLog,
    AdminSession,
    // New models
    UserXP,
    Badge,
    UserBadge,
    Coupon,
    CouponUsage,
    LearningGoal,
    LearningSession
};