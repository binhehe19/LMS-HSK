// Logic thuần của màn Phân tích học tập (learning-analysis.api.ts + learning-analysis-detail-page.tsx + learning-analysis-list-page.tsx của HSK cũ):
// ghép bài tập của buổi với bài làm đã nộp, nhóm theo module, điểm theo kỹ năng, chuẩn hoá chuyên cần, cấu hình biểu đồ, liên kết.
import type { ApexOptions } from "apexcharts";
import type { GradingAttemptSummaryResponse, GradingStudentResponse, LessonDetailResponse } from "@/types/grading";
import type { AttendanceAnalysisResponse, AttendanceLogEntry, AttendanceStatus, AttendanceTrendPoint, LearningAnalysisAssignment, SkillScorePoint, TeacherNoteResponse } from "@/types/learning-analysis";

// ---- màu/nhãn của HSK cũ (giữ nguyên) ----
export const SERIES_COLOR_STUDENT = "#b10019";
export const SERIES_COLOR_CLASS_AVG = "#9a9690";
const STATUS_GOOD = "#0ca30c";
const STATUS_WARNING = "#fab219";
const STATUS_BAD = "#d03b3b";

/** Khớp nhãn kỹ năng của Quản lý bài tập (QUIZ_SKILL_OPTIONS ở HSK cũ) — không tự đặt nhãn khác. */
export const SKILL_LABELS: Record<string, string> = {
  PRACTICE: "Ôn tập",
  LISTENING: "Nghe",
  READING: "Đọc",
  WRITING: "Viết",
  SPEAKING: "Nói",
  PHONETICS: "Ngữ âm",
  TRANSLATION: "Dịch",
  GRAMMAR_3_0: "Ngữ pháp 3.0",
};

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = { PRESENT: "Có mặt", ABSENT: "Vắng", LATE: "Đi muộn", EXCUSED: "Nghỉ có phép" };

const isAttendanceStatus = (s: string): s is AttendanceStatus => s in ATTENDANCE_STATUS_LABEL;

/** Nhãn tiếng Việt; giá trị lạ hiển thị nguyên văn (như view cũ `LABEL[status] || status`). */
export const attendanceLabel = (status: string): string => (isAttendanceStatus(status) ? ATTENDANCE_STATUS_LABEL[status] : status);

export type AttendanceTone = "good" | "bad" | "warning";

/** PRESENT xanh, ABSENT đỏ, còn lại (LATE/EXCUSED/lạ) vàng — đúng ba nhánh của bản cũ. */
export const attendanceTone = (status: string): AttendanceTone => (status === "PRESENT" ? "good" : status === "ABSENT" ? "bad" : "warning");

export const ATTENDANCE_CHIP_COLOR: Record<AttendanceTone, string> = { good: STATUS_GOOD, bad: STATUS_BAD, warning: STATUS_WARNING };
export const ATTENDANCE_BADGE_CLASS: Record<AttendanceTone, string> = { good: "bg-success-subtle text-success", bad: "bg-danger-subtle text-danger", warning: "bg-warning-subtle text-warning" };

/** Chữ trong ô vuông điểm danh: chỉ phần số của nhãn buổi ("Buổi 12" => "12"), không có số => "?". */
export const attendanceChipText = (sessionLabel: string): string => sessionLabel.replace(/[^0-9]/g, "") || "?";

/** Điểm hiển thị: số nguyên giữ nguyên, lẻ lấy 2 chữ số; thiếu => "-" (class-management.helpers.ts cũ). */
export const formatScore = (value?: number | null): string => (value === null || value === undefined ? "-" : Number.isInteger(value) ? String(value) : value.toFixed(2));

// ---- bài tập của buổi ----

/**
 * Ghép toàn bộ quiz của buổi (chi tiết bài học) với bài làm đã nộp của học viên (như `getAssignments` cũ). Quiz không có bài nộp => NOT_STARTED
 * (không suy đoán "đang làm"). Điểm: `finalScore` (đã chốt) rồi `autoScore`; điểm tối đa: `totalPoints`. Chỉ xét bài tập có `quizId`.
 */
export function buildAssignments(lesson: Pick<LessonDetailResponse, "modules">, attempts: readonly GradingAttemptSummaryResponse[]): LearningAnalysisAssignment[] {
  const byQuiz = new Map<string, GradingAttemptSummaryResponse>();
  for (const a of attempts) if (a.quizId && !byQuiz.has(a.quizId)) byQuiz.set(a.quizId, a);
  const out: LearningAnalysisAssignment[] = [];
  for (const mod of lesson.modules ?? []) {
    for (const ex of mod.exercises ?? []) {
      if (!ex.quizId) continue;
      const submitted = byQuiz.get(ex.quizId);
      out.push({
        quizId: ex.quizId,
        label: ex.name || "Bài quiz",
        groupLabel: mod.label,
        status: submitted ? "DONE" : "NOT_STARTED",
        score: submitted ? (submitted.finalScore ?? submitted.autoScore) : undefined,
        maxScore: submitted?.totalPoints,
        gradingStatus: submitted?.gradingStatus,
      });
    }
  }
  return out;
}

export interface AssignmentGroup {
  label: string;
  items: LearningAnalysisAssignment[];
}

/** Nhóm theo `groupLabel` giữ thứ tự xuất hiện; thiếu nhãn => "Khác". */
export function groupAssignments(items: readonly LearningAnalysisAssignment[]): AssignmentGroup[] {
  const groups = new Map<string, AssignmentGroup>();
  for (const a of items) {
    const key = a.groupLabel || "Khác";
    const g = groups.get(key);
    if (g) g.items.push(a);
    else groups.set(key, { label: key, items: [a] });
  }
  return [...groups.values()];
}

export const countDone = (items: readonly LearningAnalysisAssignment[]): number => items.filter((a) => a.status === "DONE").length;

// ---- điểm theo kỹ năng ----

/**
 * Điểm theo kỹ năng của RIÊNG buổi từ danh sách học viên của buổi (mỗi học viên kèm module đã giao, có skillType + score/maxScore nếu đã nộp):
 * học viên đang xem so với trung bình lớp cùng kỹ năng (phần trăm, làm tròn). Chỉ giữ kỹ năng học viên đã nộp ít nhất một bài (như `getSkillScores` cũ).
 */
export function skillScores(students: readonly GradingStudentResponse[], userId: string): SkillScorePoint[] {
  type Agg = { studentScore: number; studentMax: number; classScore: number; classMax: number };
  const bySkill = new Map<string, Agg>();
  for (const student of students) {
    for (const m of student.modules ?? []) {
      if (!m.submitted || !m.skillType) continue;
      const skill = String(m.skillType);
      const agg = bySkill.get(skill) ?? { studentScore: 0, studentMax: 0, classScore: 0, classMax: 0 };
      const score = Number(m.score) || 0;
      const max = Number(m.maxScore) || 0;
      agg.classScore += score;
      agg.classMax += max;
      if (student.userId === userId) {
        agg.studentScore += score;
        agg.studentMax += max;
      }
      bySkill.set(skill, agg);
    }
  }
  return [...bySkill.entries()]
    .filter(([, agg]) => agg.studentMax > 0)
    .map(([skill, agg]) => ({
      skill,
      skillLabel: SKILL_LABELS[skill] || skill,
      studentScore: Math.round((agg.studentScore / agg.studentMax) * 100),
      classAverageScore: agg.classMax > 0 ? Math.round((agg.classScore / agg.classMax) * 100) : 0,
    }));
}

// ---- chuyên cần ----

interface RawTrendPoint {
  sessionNo?: unknown;
  sessionLabel?: unknown;
  studentRate?: unknown;
  classAverageRate?: unknown;
}
interface RawLogEntry {
  sessionNo?: unknown;
  sessionLabel?: unknown;
  date?: unknown;
  status?: unknown;
  note?: unknown;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const rateOf = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

/**
 * Chuẩn hoá phản hồi attendance-analysis: `trend`/`log` thiếu => rỗng; tỷ lệ không phải số => null (điểm trống, không phải 0%); nhãn buổi thiếu
 * => "Buổi N" theo sessionNo hoặc "-"; trạng thái giữ nguyên chữ in hoa. Không phải object => null (hook coi là lỗi hợp đồng).
 */
export function normalizeAttendanceAnalysis(raw: unknown): AttendanceAnalysisResponse | null {
  if (!isRecord(raw)) return null;
  const trend: AttendanceTrendPoint[] = (Array.isArray(raw.trend) ? (raw.trend as RawTrendPoint[]) : []).filter(isRecord).map((p, i) => {
    const sessionNo = typeof p.sessionNo === "number" ? p.sessionNo : i + 1;
    return { sessionNo, sessionLabel: str(p.sessionLabel) ?? `Buổi ${sessionNo}`, studentRate: rateOf(p.studentRate), classAverageRate: rateOf(p.classAverageRate) };
  });
  const log: AttendanceLogEntry[] = (Array.isArray(raw.log) ? (raw.log as RawLogEntry[]) : []).filter(isRecord).map((e) => ({
    sessionLabel: str(e.sessionLabel) ?? (typeof e.sessionNo === "number" ? `Buổi ${e.sessionNo}` : "-"),
    date: str(e.date),
    status: (str(e.status) ?? "").toUpperCase(),
    note: str(e.note),
  }));
  return { trend, log };
}

/** Phản hồi "nhận xét gần nhất": object có `content` chuỗi => nhận xét; mọi thứ khác (null, envelope rỗng `{}`) => chưa có nhận xét. */
export function toTeacherNote(raw: unknown): TeacherNoteResponse | null {
  if (!isRecord(raw) || typeof raw.content !== "string") return null;
  return { content: raw.content, sentAt: str(raw.sentAt), author: str(raw.author) };
}

// ---- biểu đồ (ApexCharts; cấu hình lấy từ bản cũ, chỉ thêm nét đứt cho "Trung bình lớp" để hai đường phân biệt được không chỉ bằng màu) ----

export interface ChartSpec {
  options: ApexOptions;
  series: NonNullable<ApexOptions["series"]>;
}

const percent = (v: number) => `${v}%`;

export function trendChartSpec(points: readonly AttendanceTrendPoint[]): ChartSpec {
  return {
    options: {
      chart: { type: "line", height: 260, toolbar: { show: false }, zoom: { enabled: false } },
      dataLabels: { enabled: false },
      stroke: { curve: "smooth", width: 2, dashArray: [0, 5] },
      colors: [SERIES_COLOR_STUDENT, SERIES_COLOR_CLASS_AVG],
      markers: { size: 4 },
      legend: { position: "top", fontSize: "12.5px", markers: { size: 5 } },
      xaxis: { categories: points.map((p) => p.sessionLabel) },
      yaxis: { min: 0, max: 100, labels: { formatter: percent } },
      grid: { strokeDashArray: 4 },
      tooltip: { y: { formatter: percent } },
    },
    series: [
      { name: "Học viên", data: points.map((p) => p.studentRate) },
      { name: "Trung bình lớp", data: points.map((p) => p.classAverageRate) },
    ],
  };
}

/** Bản cũ tính `skillChart` (cột, 0–100%) nhưng KHÔNG render; ở đây render đúng cấu hình đó. */
export function skillChartSpec(points: readonly SkillScorePoint[]): ChartSpec {
  return {
    options: {
      chart: { type: "bar", height: 240, toolbar: { show: false } },
      plotOptions: { bar: { borderRadius: 5, columnWidth: "60%" } },
      legend: { position: "top", fontSize: "12px" },
      dataLabels: { enabled: false },
      colors: [SERIES_COLOR_STUDENT, SERIES_COLOR_CLASS_AVG],
      xaxis: { categories: points.map((s) => s.skillLabel) },
      yaxis: { min: 0, max: 100, labels: { formatter: percent } },
      grid: { strokeDashArray: 4 },
      tooltip: { y: { formatter: percent } },
    },
    series: [
      { name: "Học viên", data: points.map((s) => s.studentScore) },
      { name: "Trung bình lớp", data: points.map((s) => s.classAverageScore) },
    ],
  };
}

// ---- danh sách học viên ----

export const studentDisplayName = (s: Pick<GradingStudentResponse, "fullName" | "name" | "email">): string => s.fullName || s.name || s.email || "";

/** Tìm theo tên, email, mã học viên (không phân biệt hoa/thường) — như bản cũ. */
export function filterStudents(students: readonly GradingStudentResponse[], keyword: string): GradingStudentResponse[] {
  const k = keyword.trim().toLowerCase();
  if (!k) return [...students];
  return students.filter((s) => [s.name, s.fullName, s.email, s.studentCode].some((v) => (v || "").toLowerCase().includes(k)));
}

// ---- liên kết (hợp đồng query cũ) ----

const enc = encodeURIComponent;

export const lessonListHref = (classId: string, courseId: string) => `/instructor/list-class/list-lesson?classId=${enc(classId)}&courseId=${enc(courseId)}`;

export const learningAnalysisListHref = (p: { classId: string; courseId: string; scheduleId: string; title: string }) =>
  `/instructor/list-class/learning-analysis?classId=${enc(p.classId)}&courseId=${enc(p.courseId)}&scheduleId=${enc(p.scheduleId)}&title=${enc(p.title)}`;

/** Query sang màn chi tiết đúng thứ tự của bản cũ; `studentEmail` giữ cho tương thích liên kết, màn chi tiết KHÔNG dùng để gọi API. */
export function learningAnalysisDetailHref(p: { classId: string; courseId: string; scheduleId: string; title: string }, s: GradingStudentResponse): string {
  return (
    `/instructor/list-class/learning-analysis/detail?scheduleId=${enc(p.scheduleId)}&userId=${enc(s.userId)}&studentEmail=${enc(s.email || "")}` +
    `&classId=${enc(p.classId)}&courseId=${enc(p.courseId)}&title=${enc(p.title)}&studentName=${enc(studentDisplayName(s))}`
  );
}
