// DTO của backend chung LMS_IELTS/backend/repo-lms (đọc từ pl.co.lms.dto.response, 2026-10-27). Khác HSK cũ: PageResponse ra JSON snake_case
// (total_elements, total_pages); dữ liệu lớp/học viên/giáo trình là proxy chỉ đọc từ ERP (CMS) nên chuỗi ngày giữ nguyên định dạng ERP.
// Mọi trường ngoài `id` để tuỳ chọn: ERP có thể bỏ trống bất kỳ trường nào.

export interface PageResponse<T> {
  items: T[];
  total_elements: number;
  total_pages: number;
  /** Trang hiện tại, đếm từ 0. */
  page: number;
  size: number;
  warning?: string;
}

export interface SchedulePattern {
  /** ERP: tên ngày (MONDAY…) hoặc số; adapter hiển thị "2, 4, 6" như HSK cũ. */
  dayOfWeek?: string | number;
  startTime?: string;
  endTime?: string;
}

export interface TeacherSummaryResponse {
  id: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
  status?: string;
  roles?: string[];
  tags?: string[];
}

export interface ClassSummaryResponse {
  id: string;
  code?: string;
  name?: string;
  courseId?: string;
  courseName?: string;
  classType?: string;
  track?: string;
  startDate?: string;
  lifecycleStatus?: string;
  /** Sĩ số DỰ KIẾN — không phải số học viên thực tế (lấy từ /enrollments). */
  expectedSize?: number;
  teacherId?: string;
  teacher?: TeacherSummaryResponse;
  schedulePatterns?: SchedulePattern[];
  educationLevelId?: string;
  educationLevelCode?: string;
  educationLevelName?: string;
}

export interface ClassDetailResponse extends ClassSummaryResponse {
  syllabusId?: string;
  syllabusVersionId?: string;
  syllabusVersionNo?: number;
  syllabusName?: string;
  note?: string;
  meetingLink?: string;
  price?: number;
  baseTeacherPay?: number;
  mentorId?: string;
  mentor?: TeacherSummaryResponse;
  studentManagerId?: string;
  studentManager?: TeacherSummaryResponse;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClassSessionResponse {
  id: string;
  sessionNo?: number;
  startAt?: string;
  endAt?: string;
  teacherId?: string;
  teacher?: TeacherSummaryResponse;
  room?: string;
  meetingLink?: string;
  status?: string;
  percentCompleted?: number;
  note?: string;
  evaluationStars?: number;
  evaluationNote?: string;
}

export interface EnrollmentResponse {
  id: string;
  studentId: string;
  studentFullName?: string;
  studentEmail?: string;
  studentAvatarUrl?: string;
  studentUserCode?: string;
  studentPhone?: string;
  status?: string;
  enrolledAt?: string;
  withdrawnAt?: string;
  scoreSummary?: { scoreOnTen?: number; percentage?: number; gradedItemCount?: number; totalItemCount?: number };
  attendanceSummary?: { presentCount?: number; totalCount?: number; percentage?: number };
  note?: string;
}

export interface SyllabusSummaryResponse {
  id: string;
  name?: string;
  code?: string;
  educationLevelId?: string;
  educationLevelCode?: string;
  educationLevelName?: string;
  type?: string;
  author?: string;
  latestVersionNo?: number;
  createdAt?: string;
}

export interface SyllabusVersionResponse {
  id: string;
  versionNo?: number;
  status?: string;
  publishedAt?: string;
  publishedBy?: string;
  changeNote?: string;
}

export interface SyllabusScheduleItem {
  sessionNo?: number;
  id: string;
  topic?: string;
  content?: string;
  delivery?: string;
  sessionLo?: string;
  coreCloId?: string[];
  supportingCloId?: string[];
  evidence?: string;
  itu?: string;
  studentMaterials?: { materialTitle?: string; materialLink?: string }[];
  teacherMaterials?: { materialTitle?: string; materialLink?: string }[];
  moduleOnLuyen?: { moduleType?: string; moduleContent?: string }[];
  studentTasks?: string;
  teacherTasks?: string;
}

export interface SyllabusDetailResponse extends SyllabusSummaryResponse {
  status?: string;
  updatedAt?: string;
  documentType?: string;
  trainingProgram?: string;
  prerequisite?: string;
  distributionHours?: string;
  teachingMethods?: string;
  learningTools?: string;
  minimumPassingScore?: string | number;
  scoreRange?: string;
  description?: string;
  studentResponsibilities?: string;
  notes?: string;
  clo?: { id: string; code?: string; name?: string; description?: string }[];
  materials?: { id: string; title?: string; type?: string; isbn?: string; author?: string; publisher?: string; year?: string | number; edition?: string }[];
  schedule?: SyllabusScheduleItem[];
  gradingStructure?: { id: string; item?: string; type?: string; weight?: string | number; timing?: string; duration?: string; cloIds?: string[]; organizationalForm?: string; criteria?: string; contentScope?: string }[];
  testTemplate?: { id?: string; midtermFormat?: string; finalFormat?: string; notes?: string };
  versions?: SyllabusVersionResponse[];
}
