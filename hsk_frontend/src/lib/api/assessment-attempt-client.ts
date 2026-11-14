"use client";
// Sao chép từ frontend/ (cùng hợp đồng backend); sửa ở một nơi thì sửa nơi kia.

import { getLmsApiBaseUrl, lmsClient } from "@/lib/api/lms-client";
import { bearerHeaders } from "@/lib/auth/dev-token-session";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssessmentAttemptStatus = "IN_PROGRESS" | "TIME_OUT" | "SUBMITTED";

// Một câu hỏi trong attempt: content là QuestionPublicContent (không có đáp án đúng).
export interface QuizQuestionItem {
  questionId: string;
  displayOrder: number;
  content: any;
}

export interface AssessmentAttemptResponse {
  attemptId: string;
  contentPackageVersionId: string;
  learningResourceId: string;
  sessionId: string;
  sessionNo: number;
  status: AssessmentAttemptStatus;
  startedAt: string;
  endsAt: string | null;
  remainingSeconds: number | null;
  timeLimitSeconds: number | null;
  questions: QuizQuestionItem[];
  savedAnswers: SavedAnswerItem[];
}

export interface SavedAnswerItem {
  answerId: string;
  questionId: string;
  answerJson: string;
}

export interface AssessmentLockResponse {
  acquired: boolean;
  holderUserId: string | null;
  lockExpiresAt: string | null;
  serverNow: string;
  endsAt: string | null;
}

export interface HeartbeatAssessmentAttemptResponse {
  lockRenewed: boolean;
  lockExpiresAt: string | null;
  serverNow: string;
  endsAt: string | null;
  remainingSeconds: number | null;
  effectiveStatus: AssessmentAttemptStatus;
  savedAnswerIds: string[];
}

export interface SubmitAssessmentAttemptResponse {
  attemptId: string;
  answersIgnored: boolean;
  submittedAt: string;
}

export interface AnswerItem {
  questionId: string;
  answerJson: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export function startOrResumeAttempt(req: {
  sessionId: string;
  /** Lớp chứa buổi học; server dùng để tra buổi nhanh hơn. Số buổi do server lấy từ CMS, không cần gửi. */
  classId?: string | null;
  contentPackageVersionId: string;
  learningResourceId: string;
}) {
  return lmsClient.post<AssessmentAttemptResponse>("/assessment-attempts", req);
}

// Một lần làm trong lịch sử của học sinh (mới nhất trước). attemptNo tính theo thứ tự thời gian, bắt đầu từ 1.
export interface AssessmentAttemptHistoryItem {
  attemptId: string;
  attemptNo: number;
  status: AssessmentAttemptStatus;
  gradingStatus: AssessmentGradingStatus;
  startedAt: string;
  submittedAt: string | null;
  earnedPoints: number | null;
  totalPoints: number | null;
  percent: number | null;
  /** Chỉ có với lần đang làm dở và bài có giới hạn giờ. */
  remainingSeconds: number | null;
}

export interface AssessmentAttemptHistory {
  attempts: AssessmentAttemptHistoryItem[];
}

export function listAttempts(params: {
  learningResourceId: string;
  sessionId: string;
}) {
  const query = new URLSearchParams(params).toString();
  return lmsClient.get<AssessmentAttemptHistory>(`/assessment-attempts?${query}`);
}

export function getAttempt(attemptId: string) {
  return lmsClient.get<AssessmentAttemptResponse>(`/assessment-attempts/${attemptId}`);
}

export function acquireLock(attemptId: string, sessionToken: string, force = false) {
  return lmsClient.post<AssessmentLockResponse>(`/assessment-attempts/${attemptId}/lock`, { sessionToken, force });
}

export function releaseLock(attemptId: string, sessionToken: string) {
  return lmsClient.delete<AssessmentLockResponse>(
    `/assessment-attempts/${attemptId}/lock?sessionToken=${encodeURIComponent(sessionToken)}`
  );
}

/**
 * Nhả khoá khi tab bị đóng đột ngột (sự kiện `pagehide`): `fetch` với `keepalive` (kèm cookie phiên và method DELETE, điều
 * `sendBeacon` không làm được). Best-effort — khoá vẫn tự hết hạn sau 60 giây nếu request không kịp gửi.
 */
export function releaseLockOnUnload(attemptId: string, sessionToken: string): void {
  try {
    fetch(`${getLmsApiBaseUrl()}/assessment-attempts/${attemptId}/lock?sessionToken=${encodeURIComponent(sessionToken)}`, {
      method: "DELETE",
      credentials: "include",
      headers: bearerHeaders(), // máy dev không có cookie của gateway; ngoài dev là {}
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Bỏ qua: khoá tự hết hạn theo TTL.
  }
}

export function heartbeat(attemptId: string, sessionToken: string, answers?: AnswerItem[]) {
  return lmsClient.post<HeartbeatAssessmentAttemptResponse>(`/assessment-attempts/${attemptId}/heartbeat`, {
    sessionToken,
    answers: answers ?? [],
  });
}

export function submitAttempt(attemptId: string, sessionToken: string, answers?: AnswerItem[]) {
  return lmsClient.post<SubmitAssessmentAttemptResponse>(`/assessment-attempts/${attemptId}/submit`, {
    sessionToken,
    answers: answers ?? [],
  });
}

// ── Kết quả bài làm ───────────────────────────────────────────────────────────

export type AssessmentGradingStatus = "NOT_SUBMITTED" | "PENDING" | "GRADING" | "MANUAL_GRADING" | "GRADED";

export type AssessmentAnswerGradingStatus =
  | "UNGRADED"
  | "AUTO_GRADED"
  | "AI_PENDING"
  | "AI_GRADED"
  | "MANUAL_PENDING"
  | "MANUAL_GRADED"
  | "SCORE_UPDATED";

// Nội dung câu hỏi trong kết quả: đầy đủ (kèm đáp án đúng, giải thích) khi câu đã có điểm, còn lại chỉ có phần
// hiển thị. Các trường đáp án đúng đều tuỳ chọn.
export interface ResultQuestionContent {
  questionType: string;
  questionText: string;
  explanation?: string;
  options?: { optionIndex: number; content: string; correct?: boolean }[];
  matchingPairs?: { pairIndex: number; prompt: string; answer?: string }[];
  blanks?: { blankIndex: number; hint?: string; correctAnswer?: string; acceptedAnswers?: string[] }[];
  sentenceChunks?: { content: string; correctPosition?: number; distractor?: boolean }[];
}

export interface AssessmentAttemptResultQuestion {
  answerId: string | null;
  questionId: string;
  displayOrder: number;
  question: ResultQuestionContent | null;
  answerJson: string | null;
  gradingStatus: AssessmentAnswerGradingStatus;
  earnedPoints: number | null;
  maxPoints: number | null;
  graderComment: string | null;
  /** Đúng/sai từng dòng của câu nối / từng chỗ trống của câu điền (`index` = pairIndex/blankIndex). Null với câu loại khác hoặc câu chưa có điểm. */
  parts?: { index: number; correct: boolean }[] | null;
  // scoreSource, provisional: dành cho phía quản trị, màn học sinh không đọc.
}

export interface AssessmentAttemptResultResponse {
  attemptId: string;
  attemptStatus: AssessmentAttemptStatus;
  gradingStatus: AssessmentGradingStatus;
  earnedPoints: number;
  totalPoints: number;
  percent: number | null;
  submittedAt: string | null;
  progress: { gradedQuestions: number; totalQuestions: number };
  // Nhịp gọi lại (ms) do server quyết định; null = không cần gọi thêm.
  nextPollMs: number | null;
  questions: AssessmentAttemptResultQuestion[];
}

// Server trả ETag + Cache-Control: no-cache nên trình duyệt tự gửi If-None-Match và dùng lại bản cũ khi 304.
export function getAttemptResult(attemptId: string, signal?: AbortSignal) {
  return lmsClient.get<AssessmentAttemptResultResponse>(`/assessment-attempts/${attemptId}/result`, { signal });
}
