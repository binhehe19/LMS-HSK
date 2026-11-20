// DTO của API chấm bài/lớp học (hợp đồng ĐỀ XUẤT cho backend chung, lấy NGUYÊN VĂN từ LMS_Frontend/src/core/types/quiz.type.ts — các màn chấm bài được chuyển
// nguyên giao diện nên giữ cùng hình dạng dữ liệu; `any` của bản cũ đổi thành `unknown`). Backend chung LMS_IELTS CHƯA có các endpoint này (B0 OPEN):
// docs/api-requirements/*.md, docs/B0-P0-SECURITY-REVIEW.md mục 9. Mọi trường trừ khoá chính đều tuỳ chọn.

export interface GradingClassResponse {
  classId: string;
  classCode?: string;
  className?: string;
  startDate?: string;
  endDate?: string;
  studentCount?: number;
  courseId?: string;
  courseName?: string;
  teacherName?: string;
  teacherEmail?: string;
  scheduleDays?: string;
  scheduleSlots?: { day?: string; startTime?: string; endTime?: string }[];
  startTime?: string;
  duration?: number | string;
  actualEndDate?: string;
  ungradedCount?: number;
  hasPendingGrading?: boolean;
  classStatus?: string;
  totalSessions?: number;
  assistantName?: string;
}

/**
 * Buổi học của một lớp (danh sách bài học ở /instructor/list-class/list-lesson). Hợp đồng chi tiết gửi backend: docs/api-requirements/instructor-list-lesson.md
 */
export interface GradingScheduleResponse {
  sessionId: string;
  sessionNo?: number;
  title?: string;
  topic?: string;
  date?: string;
  sessionDate?: string;
  startTime?: string;
  endTime?: string;
  /** Khoá buổi học dùng ở các màn kế tiếp (scheduleId trong query của submissions/lesson-detail/learning-analysis). */
  syllabusScheduleId?: string;
  ungradedCount?: number;
  hasPendingGrading?: boolean;
  /** true => tiêu đề đỏ sẫm (#800020), false/thiếu => xanh nhạt (#71A6D2). */
  hasAssignment?: boolean;
}

export type QuizSkillType = "LISTENING" | "READING" | "WRITING" | "SPEAKING" | "PHONETICS" | "TRANSLATION" | "GRAMMAR_3_0" | "PRACTICE";
export type QuizGradingStatus = "IN_PROGRESS" | "SUBMITTED" | "AUTO_GRADED" | "AI_SUGGESTED" | "GRADED" | "RETURNED";
export type AiGradingJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "TIMEOUT";

export interface GradingSkillStatus {
  submittedCount?: number;
  gradedCount?: number;
  totalScore?: number;
}

/** Một bài tập (quiz) đã giao trong buổi, với bài làm của một học viên nếu có. */
export interface GradingStudentModuleResponse {
  moduleId: string;
  attemptId?: string;
  quizId?: string;
  label: string;
  skillType?: QuizSkillType | string;
  submitted: boolean;
  /** Trạng thái hiển thị: submitted | graded | returned (chữ thường như HSK cũ), hoặc QuizGradingStatus. */
  status?: QuizGradingStatus | string;
  score?: number;
  maxScore?: number;
  // Module (OnlineScheduleModule) chứa bài này: "#1 Quiz - A. Nghe" + thứ tự.
  groupId?: string;
  groupName?: string;
  groupOrder?: number;
  quizOrder?: number;
}

/** Một học viên trong danh sách nộp bài của buổi (GET /grading/schedules/{scheduleId}/students). */
export interface GradingStudentResponse {
  userId: string;
  email?: string;
  name?: string;
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  studentCode?: string;
  completionRate?: number;
  totalScore?: number;
  answeredQuestions?: number;
  totalQuestions?: number;
  submittedAny?: boolean;
  ungradedCount?: number;
  modules?: GradingStudentModuleResponse[];
  statusBySkill?: Record<string, GradingSkillStatus>;
}

export interface GradingAttemptSummaryResponse {
  attemptId: string;
  quizId: string;
  quizTitle?: string;
  moduleId?: string;
  skillType?: QuizSkillType | string;
  gradingStatus?: QuizGradingStatus;
  autoScore?: number;
  finalScore?: number;
  totalPoints?: number;
  totalQuestions?: number;
  submittedAt?: string;
  groupId?: string;
  groupName?: string;
  groupOrder?: number;
  quizOrder?: number;
}

export interface GradingAttemptOption {
  id: string;
  content?: string;
  mediaUrl?: string;
  isCorrect?: boolean;
}

export interface GradingAttemptPair {
  id: string;
  prompt?: string;
  answer?: string;
  promptMediaUrl?: string;
  answerMediaUrl?: string;
}

export interface GradingAttemptChunk {
  id: string;
  content?: string;
  isDistractor?: boolean;
}

export interface GradingAttemptBlank {
  index?: number;
  correctAnswer?: string;
}

export interface GradingAttemptQuestion {
  answerId?: string;
  questionId: string;
  questionType?: string;
  questionText?: string;
  questionMediaUrl?: string;
  correctAnswer?: unknown;
  studentAnswer?: unknown;
  isCorrect?: boolean | null;
  autoScore?: number | null;
  teacherScore?: number | null;
  maxScore?: number | null;
  explanation?: string;
  teacherComment?: string;
  // Dữ liệu hiển thị đầy đủ để màn chấm render đúng (đáp án/cặp nối/ghi âm) thay vì ID thô.
  options?: GradingAttemptOption[];
  matchingPairs?: GradingAttemptPair[];
  sentenceChunks?: GradingAttemptChunk[];
  blanks?: GradingAttemptBlank[];
  studentAudioId?: string;
  /** Đã gửi kết quả câu này cho học viên (chấm từng phần). */
  returnedAt?: string | null;
  // FEAT-AI-GRADING: gợi ý của AI — chỉ để GV tham khảo, không tự áp vào điểm cuối.
  aiScore?: number | null;
  aiFeedback?: string | null;
  aiJobStatus?: AiGradingJobStatus | null;
}

export interface GradingAttemptDetailResponse {
  attemptId: string;
  userId?: string;
  quizId: string;
  quizTitle?: string;
  scheduleId?: string;
  moduleId?: string;
  skillType?: QuizSkillType | string;
  gradingStatus?: QuizGradingStatus;
  autoScore?: number;
  finalScore?: number;
  totalPoints?: number;
  teacherComment?: string;
  submittedAt?: string;
  audioFileId?: string;
  passageText?: string;
  passageImageFileId?: string;
  questions?: GradingAttemptQuestion[];
}

export interface GradeAnswerRequest {
  teacherScore?: number | null;
  teacherComment?: string;
}

export interface FinalizeAttemptRequest {
  finalScore?: number;
  teacherComment?: string;
}

// ---- Chi tiết bài học (nội dung bài tập của buổi; HSK cũ ghép từ 3 endpoint onl-learning + quiz, ở đây đề xuất MỘT endpoint gộp) ----

export interface LessonOption {
  label: string;
  correct?: boolean;
}

export interface LessonQuestion {
  no: number;
  type: string;
  text?: string;
  options?: LessonOption[];
  score?: number;
}

export interface LessonExercise {
  name?: string;
  audioName?: string;
  questions?: LessonQuestion[];
  /** ID quiz đứng sau bài này — màn Phân tích học tập đối chiếu với attempt đã nộp để suy ra "chưa làm". */
  quizId?: string;
}

export interface LessonModule {
  id: string;
  label: string;
  topicType?: string;
  materialType?: string;
  locked?: boolean;
  exercises?: LessonExercise[];
  slideName?: string;
}

export interface LessonDetailResponse {
  lessonTitle: string;
  modules: LessonModule[];
}
