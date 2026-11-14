"use client";
// Sao chép từ frontend/ (cùng hợp đồng backend); sửa ở một nơi thì sửa nơi kia.
// Client cho API chấm bài của quản trị (AssessmentGradingManagementController, chỉ ROLE_ADMIN): danh sách bài cần chấm,
// chi tiết bài, khoá chấm (một người chấm một bài tại một thời điểm) và lưu điểm.

import { lmsClient } from "@/lib/api/lms-client";
import type {
  AssessmentAnswerGradingStatus,
  AssessmentAttemptStatus,
  AssessmentGradingStatus,
  AssessmentLockResponse,
  ResultQuestionContent,
} from "@/lib/api/assessment-attempt-client";

const BASE = "/management/assessment-attempts";

export interface GradingListItem {
  attemptId: string;
  studentId: string;
  /** Rỗng với bài tự luyện. */
  sessionId: string | null;
  sessionNo: number | null;
  contentPackageVersionId: string | null;
  status: AssessmentAttemptStatus;
  gradingStatus: AssessmentGradingStatus;
  earnedPoints: number | null;
  totalPoints: number | null;
  submittedAt: string | null;
  /** Còn câu điểm AI chưa được duyệt. */
  hasProvisionalScore: boolean;
  assessmentType: AssessmentType;
  contextType: GradingContextType;
  title: string | null;
  /** Tra ở dịch vụ Auth lúc xem danh sách; null khi tra không được (khi đó chỉ có studentId). */
  studentName: string | null;
  studentEmail: string | null;
  studentCode: string | null;
}

/** CLASS_SESSION = bài trong buổi học của lớp; SELF_STUDY = học sinh tự luyện đề ở /practice. */
export type GradingContextType = "CLASS_SESSION" | "SELF_STUDY";

/** Nhãn phân loại của bài (chỉ để lọc/hiển thị). */
export type AssessmentType = "QUIZ" | "READING" | "LISTENING" | "WRITING" | "SPEAKING"
  | "PLACEMENT_IELTS" | "PLACEMENT_PACE" | "FOUNDATION_PRON" | "FOUNDATION_VOCAB" | "FOUNDATION_GRAMMAR";

/** Một tiêu chí chấm (VD 4 tiêu chí IELTS Writing/Speaking). */
export interface RubricCriterion {
  id: string;
  label?: string;
  bandScore: number | null;
  feedback?: string;
}
/** Điểm theo tiêu chí — JSON mờ với backend; frontend tự tính điểm câu từ đây (lib/assessment/rubric). */
export interface RubricScores {
  bandScore?: number;
  feedback?: string;
  criteria: RubricCriterion[];
}

export interface GradingListPage {
  items: GradingListItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  /** Từ khoá học sinh khớp quá nhiều người nên kết quả có thể chưa đầy đủ. */
  studentSearchTruncated?: boolean;
}

// Câu hỏi đầy đủ (có đáp án đúng) mà admin được xem.
export type GradingQuestion = ResultQuestionContent & { points?: number | null };

export interface GradingAnswerItem {
  answerId: string | null;
  questionId: string;
  displayOrder: number;
  question: GradingQuestion;
  answerJson: string | null;
  gradingStatus: AssessmentAnswerGradingStatus;
  earnedPoints: number | null;
  maxPoints: number | null;
  graderComment: string | null;
  graderId: string | null;
  scoreSource: "AUTO" | "AI" | "MANUAL" | null;
  provisional: boolean;
  rubricScores: RubricScores | null;
  /** Đúng/sai từng dòng của câu nối / từng chỗ trống của câu điền (`index` = pairIndex/blankIndex). Null với câu loại khác hoặc câu chưa có điểm. */
  parts?: { index: number; correct: boolean }[] | null;
  /** Tiêu chí chấm do người soạn đặt cho câu (chỉ để tham khảo); không có thì bỏ trống hoặc null. */
  gradingCriteria?: { label: string; description?: string; maxPoints?: number | null }[] | null;
}

export interface GradingDetail {
  attemptId: string;
  studentId: string;
  sessionId: string | null;
  sessionNo: number | null;
  status: AssessmentAttemptStatus;
  gradingStatus: AssessmentGradingStatus;
  earnedPoints: number | null;
  totalPoints: number | null;
  submittedAt: string | null;
  answers: GradingAnswerItem[];
  assessmentType: AssessmentType;
  contextType: GradingContextType;
  title: string | null;
  /** Bố cục đầy đủ (kể cả khoá grading và explanation). */
  layout: unknown;
  /** Tra ở dịch vụ Auth; null khi tra không được. */
  studentName: string | null;
  studentEmail: string | null;
  studentCode: string | null;
}

export interface SaveGradingItem {
  answerId: string;
  /** Điểm của câu (tối đa maxPoints); với chấm theo tiêu chí, frontend đã quy từ band ra điểm. */
  earnedPoints: number;
  graderComment?: string;
  rubricScores?: RubricScores;
}

export function listGradingAttempts(params: {
  gradingStatus?: AssessmentGradingStatus;
  /** Mọi bài đã nộp, mọi trạng thái chấm (bỏ qua gradingStatus). */
  allStatuses?: boolean;
  assessmentType?: AssessmentType;
  /** Tách bài trong lớp (CLASS_SESSION) khỏi bài tự luyện (SELF_STUDY); bỏ trống = cả hai. */
  contextType?: GradingContextType;
  /** Một từ khoá tìm chung: khớp tên / email / mã học sinh hoặc tên bài. */
  keyword?: string;
  /** Chỉ bài làm trong các buổi của lớp này. */
  classId?: string;
  /** Chỉ bài làm ở buổi số N (số thứ tự buổi trong lớp). */
  sessionNo?: number;
  /** Khoảng ngày bắt đầu làm bài (yyyy-MM-dd, gồm cả hai đầu, giờ Việt Nam). */
  startedFrom?: string;
  startedTo?: string;
  provisionalOnly?: boolean;
  page?: number;
  size?: number;
}) {
  const query = new URLSearchParams();
  if (params.allStatuses) query.set("allStatuses", "true");
  else if (params.gradingStatus) query.set("gradingStatus", params.gradingStatus);
  if (params.assessmentType) query.set("assessmentType", params.assessmentType);
  if (params.contextType) query.set("contextType", params.contextType);
  if (params.keyword?.trim()) query.set("keyword", params.keyword.trim());
  if (params.classId) query.set("classId", params.classId);
  if (params.sessionNo) query.set("sessionNo", String(params.sessionNo));
  if (params.startedFrom) query.set("startedFrom", params.startedFrom);
  if (params.startedTo) query.set("startedTo", params.startedTo);
  if (params.provisionalOnly) query.set("provisionalOnly", "true");
  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 20));
  return lmsClient.get<GradingListPage>(`${BASE}?${query.toString()}`);
}

export function getGradingDetail(attemptId: string) {
  return lmsClient.get<GradingDetail>(`${BASE}/${attemptId}`);
}

export function acquireGradingLock(attemptId: string, sessionToken: string, force = false) {
  return lmsClient.post<AssessmentLockResponse>(`${BASE}/${attemptId}/lock`, { sessionToken, force });
}

export function releaseGradingLock(attemptId: string, sessionToken: string) {
  return lmsClient.delete<AssessmentLockResponse>(`${BASE}/${attemptId}/lock?sessionToken=${encodeURIComponent(sessionToken)}`);
}

export function saveGrading(attemptId: string, sessionToken: string, items: SaveGradingItem[]) {
  return lmsClient.put<GradingDetail>(`${BASE}/${attemptId}/grading`, { sessionToken, items });
}
