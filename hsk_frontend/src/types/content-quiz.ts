// Mục nội dung của module BÀI TẬP (`/quiz/quizzes`) và cấp CÂU HỎI (`/quiz/questions/{quizId}`) — hợp đồng ĐỀ XUẤT rút gọn từ core/types/quiz.type.ts
// của LMS_Frontend cũ (QuizResponse/QuestionResponse/CreateQuestionRequest). Khác bản cũ có chủ đích: tên trường thống nhất với nền content-tree
// (`skill` thay skillType, `durationMinutes` thay timeLimitSeconds, `audioFileId`/`passageImageFileId` là id tệp repo-storage), câu hỏi gom
// options/blanks/pairs thành mảng JSON thuần (không còn hai tên trường song song `content`/`text`, `prompt`/`leftItem`...). Chi tiết: docs/api-requirements/content-tree.md (mục quiz).
import type { ContentItemBase, ContentItemInput } from "@/types/content";

export type QuizDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface QuizItem extends ContentItemBase {
  title: string;
  description?: string;
  /** Hướng dẫn làm bài (instruction của bản cũ). */
  instruction?: string;
  /** Kỹ năng (QUIZ_SKILLS), bắt buộc khi lưu; trống chỉ gặp ở bài tạo trước khi có quy định này. Lưu trong `layout.meta` của QuizContent. */
  skill?: string;
  difficulty?: QuizDifficulty;
  /** Thời gian làm bài (phút); 0/trống = không giới hạn (bản cũ: timeLimitSeconds). */
  durationMinutes?: number;
  /** Điểm đạt (%), mặc định 80 như bản cũ. */
  passingScore?: number;
  shuffleQuestions?: boolean;
  /** Audio bài nghe (id tệp repo-storage). */
  audioFileId?: string;
  /** Đoạn văn đọc hiểu. */
  passageText?: string;
  passageImageFileId?: string;
  /** Do máy chủ tính (số câu hỏi hiện có). */
  questionCount?: number;
}

export type QuizItemInput = ContentItemInput<QuizItem>;

/** Loại câu hỏi. SENTENCE_BUILDER có trong bản cũ nhưng CHƯA chuyển form soạn (chỉ hiển thị khi backend trả về). */
export type QuizQuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_IN_BLANK" | "MATCHING_PAIRS" | "SHORT_ANSWER" | "AUDIO_RESPONSE" | "SENTENCE_BUILDER" | "MULTIPLE_SELECT" | "FILE_UPLOAD";

export type QuizFillBlankMode = "TYPE" | "SELECT";

/** Chế độ chấm cho câu tự luận/ghi âm; AI_ASSIST của bản cũ (kèm aiGradingSubtype) chưa chuyển. */
export type QuizGradingMode = "AUTO" | "MANUAL" | "AI_ASSIST";

export interface QuizQuestionOption {
  text: string;
  isCorrect: boolean;
  /** Ảnh của lựa chọn (đường dẫn storage). */
  mediaUrl?: string;
}

export interface QuizQuestionBlank {
  /** Thứ tự chỗ trống trong câu mẫu (từ 0). */
  index: number;
  answer: string;
  /** Các đáp án khác cũng được chấp nhận. */
  acceptable?: string[];
}

export interface QuizQuestionPair {
  left: string;
  right: string;
  /** Ảnh vế trái (promptMediaUrl) và ảnh vế phải (ảnh của lựa chọn đúng). */
  leftMediaUrl?: string;
  rightMediaUrl?: string;
}

/** Thân POST/PUT của một câu hỏi: trường chung + trường theo loại (chỉ gửi trường của loại đang chọn). */
export interface QuizQuestionBody {
  type: QuizQuestionType;
  /** Nội dung câu hỏi; với FILL_IN_BLANK là câu mẫu chứa `{blank}` cho mỗi chỗ trống. */
  prompt: string;
  points: number;
  difficulty?: QuizDifficulty;
  explanation?: string;
  imageFileId?: string;
  audioFileId?: string;
  index?: number;
  // MULTIPLE_CHOICE
  options?: QuizQuestionOption[];
  // TRUE_FALSE
  correctAnswer?: boolean;
  // FILL_IN_BLANK
  fillBlankMode?: QuizFillBlankMode;
  blanks?: QuizQuestionBlank[];
  /** Danh sách lựa chọn khi fillBlankMode = SELECT. */
  choices?: string[];
  // MATCHING_PAIRS
  pairs?: QuizQuestionPair[];
  // SHORT_ANSWER / AUDIO_RESPONSE
  gradingMode?: QuizGradingMode;
  referenceAnswer?: string;
}

export interface QuizQuestion extends QuizQuestionBody {
  /** Câu gốc backend trả về (không dịch). Khi lưu, các field HSK không sửa (gợi ý, rubric AI, tệp...) được lấy lại từ đây để không bị mất. */
  source?: unknown;
  id: string;
  quizId: string;
  index: number;
  createdAt?: string;
  updatedAt?: string;
}
