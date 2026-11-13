// DTO của màn Phân tích học tập (/instructor/list-class/learning-analysis + /detail) theo HỢP ĐỒNG ĐỀ XUẤT cho backend chung
// (kế thừa learning-analysis.types.ts, online-course.type.ts và personalization.type.ts của HSK cũ; chuyển sang base của quiz grading).
// Backend chung LMS_IELTS CHƯA có các endpoint này (B0 OPEN): docs/api-requirements/learning-analysis.md.

// ---- bài tập (quiz) của riêng buổi học, đối chiếu với bài làm đã nộp của học viên (ghép ở frontend từ lesson-detail + attempts) ----

/** HSK cũ: endpoint chấm bài chỉ trả bài ĐÃ NỘP nên không phân biệt được "đang làm"; mọi quiz chưa có bài nộp đều là NOT_STARTED. */
export type AssignmentStatus = "DONE" | "IN_PROGRESS" | "NOT_STARTED";

export interface LearningAnalysisAssignment {
  quizId: string;
  label: string;
  /** Tên module/bài chứa quiz này (vd "#1 Quiz - Nghe"); thiếu => nhóm "Khác". */
  groupLabel?: string;
  status: AssignmentStatus;
  score?: number;
  maxScore?: number;
  gradingStatus?: string;
}

// ---- chuyên cần: GET /grading/classes/{classId}/schedules/{scheduleId}/students/{userId}/attendance-analysis ----

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface AttendanceTrendPoint {
  sessionNo: number;
  sessionLabel: string;
  /** Tỷ lệ LŨY KẾ (0..100) tới buổi này. null = chưa có dữ liệu tới mốc này => biểu đồ để trống điểm đó (khác 0%). */
  studentRate: number | null;
  classAverageRate: number | null;
}

export interface AttendanceLogEntry {
  sessionLabel: string;
  /** Ngày dạng chuỗi hiển thị nguyên văn (backend quyết định định dạng). */
  date?: string;
  /** Giá trị ngoài 4 trạng thái chuẩn được hiển thị nguyên văn (không ép thành "Vắng" như HSK cũ). */
  status: AttendanceStatus | string;
  note?: string;
}

export interface AttendanceAnalysisResponse {
  trend: AttendanceTrendPoint[];
  log: AttendanceLogEntry[];
}

// ---- điểm theo kỹ năng (tính ở frontend từ GradingStudentResponse[] của buổi, như HSK cũ) ----

export interface SkillScorePoint {
  skill: string;
  skillLabel: string;
  /** Phần trăm 0..100 (điểm đạt / điểm tối đa của các bài đã nộp thuộc kỹ năng). */
  studentScore: number;
  classAverageScore: number;
}

// ---- nhận xét của giáo viên gửi học viên: GET .../notes/latest, POST .../notes ----

export interface TeacherNoteResponse {
  content: string;
  sentAt?: string;
  author?: string;
}

export interface SendTeacherNoteRequest {
  content: string;
}

// ---- cá nhân hoá học tập (gợi ý AI): GET /grading/schedules/{scheduleId}/students/{userId}/personalization?classId= ----
// Chỉ giữ các trường PersonalizationPanel (HSK cũ) thực sự đọc; các trường khác của phản hồi cũ (weakAreas gốc, currentLearningState,
// historicalSnapshotMessage, lmsClassId...) bị bỏ qua khi chuẩn hoá.

export interface PersonalizationWeakArea {
  label: string;
  mastery?: number | null;
}

export interface PersonalizationRecommendation {
  label?: string | null;
  reason?: string | null;
  status?: string | null;
}

export interface PersonalizationTask {
  id: string;
  title: string;
  description?: string | null;
  /** ASSIGNED | IN_PROGRESS | COMPLETED | APPROVED | DRAFT | giá trị khác (hiển thị nguyên văn). */
  status: string;
  deadline?: string | null;
  assignedAt?: string | null;
  completedAt?: string | null;
  sourceSnapshotId?: string | null;
  sourceLmsScheduleId?: string | null;
  /** Liên kết bài tập củng cố; cùng `sessionCode` => một nhóm (một hành động) dù nhiều nội dung cần củng cố. */
  materialUrl?: string | null;
  kcLabel?: string | null;
}

export interface PersonalizationReport {
  id: string;
  /** DRAFT (giáo viên có thể duyệt) | APPROVED | giá trị khác. */
  state: string;
  generatedAt?: string;
  approvedAt?: string;
  summary?: string | null;
  snapshotWeakAreas?: PersonalizationWeakArea[];
}

export interface PersonalizationHistoricalSnapshot {
  id: string;
  version: number;
  generatedAt?: string;
  dataSufficiency?: {
    insufficient_data?: boolean;
    useful_answers?: number;
    distinct_supported_kcs?: number;
  };
  weakAreas: PersonalizationWeakArea[];
}

export interface PersonalizationView {
  /** false => dịch vụ AI tạm thời không trả được dữ liệu (panel hiện thông báo, không có nút tạo). */
  available: boolean;
  /** SUFFICIENT | INSUFFICIENT | INSUFFICIENT_DATA | UNKNOWN | giá trị khác. */
  dataSufficiency: string;
  dataSufficiencyMessage?: string | null;
  report: PersonalizationReport | null;
  historicalSnapshot: PersonalizationHistoricalSnapshot | null;
  recommendations: PersonalizationRecommendation[];
  /** Bài tập gắn với snapshot của buổi (ưu tiên); rỗng => dùng `currentTasks` lọc theo scheduleId. */
  tasks: PersonalizationTask[];
  currentTasks?: PersonalizationTask[];
}

/** POST .../personalization/snapshot?classId=&forceNewVersion= — backend PHẢI xác nhận đã tạo (CREATED) hay dùng lại (EXISTING) kèm id snapshot. */
export interface PersonalizationSnapshotResult {
  result: "CREATED" | "EXISTING" | string;
  snapshot?: { id: string; version?: number } | null;
}

/** POST .../personalization/reports/{reportId}/approve?classId= */
export interface PersonalizationApproveResult {
  reportId: string;
  state: string;
  approvedAt?: string;
}
