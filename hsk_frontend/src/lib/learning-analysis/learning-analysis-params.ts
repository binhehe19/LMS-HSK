// Tham số URL của hai màn Phân tích học tập — hợp đồng query giữ NGUYÊN như HSK cũ:
//   /instructor/list-class/learning-analysis?classId=&courseId=&scheduleId=&title=
//   /instructor/list-class/learning-analysis/detail?classId=&courseId=&scheduleId=&title=&userId=&studentEmail=&studentName=
// Khác bản cũ có chủ đích: mọi id nối vào đường dẫn API (classId, scheduleId, userId) được kiểm tra an toàn TRƯỚC khi gọi API (thiếu/không hợp lệ => không
// gọi); `studentEmail` KHÔNG được đọc để gọi API (B0 M12: định danh học viên theo userId, email không là khoá) — chỉ còn trong URL để tương thích liên kết cũ.
import { checkClassId } from "@/lib/lesson-list/lesson-list-params";

export type LearningAnalysisParamName = "classId" | "scheduleId" | "userId";

export interface LearningAnalysisListParams {
  classId: string;
  scheduleId: string;
  /** Chỉ chuyển tiếp trong liên kết (không dùng gọi API); thiếu => "". */
  courseId: string;
  /** Tiêu đề buổi (hiển thị huy hiệu + tham số `title` của lesson-detail như HSK cũ); thiếu => "". */
  title: string;
}

export interface LearningAnalysisDetailParams extends LearningAnalysisListParams {
  userId: string;
  /** Chỉ để hiển thị header/breadcrumb (bản cũ cũng lấy từ URL). */
  studentName: string;
}

export type ParamsCheck<T> = { kind: "ok"; params: T } | { kind: "missing"; param: LearningAnalysisParamName } | { kind: "invalid"; param: LearningAnalysisParamName };

type Getter = (name: string) => string | null;

const text = (get: Getter, name: string) => (get(name) ?? "").trim();

/** Cùng quy tắc an toàn với classId của màn danh sách bài học (độ dài ≤ 128, không có / \ ? # % và ký tự điều khiển). */
function checkIds<T extends LearningAnalysisParamName>(get: Getter, names: readonly T[]): { kind: "ok"; ids: Record<T, string> } | Exclude<ParamsCheck<never>, { kind: "ok" }> {
  const ids = {} as Record<T, string>;
  for (const name of names) {
    const check = checkClassId(get(name));
    if (check.kind !== "ok") return { kind: check.kind, param: name };
    ids[name] = check.classId;
  }
  return { kind: "ok", ids };
}

export function readListParams(get: Getter): ParamsCheck<LearningAnalysisListParams> {
  const ids = checkIds(get, ["classId", "scheduleId"] as const);
  if (ids.kind !== "ok") return ids;
  return { kind: "ok", params: { ...ids.ids, courseId: text(get, "courseId"), title: text(get, "title") } };
}

export function readDetailParams(get: Getter): ParamsCheck<LearningAnalysisDetailParams> {
  const ids = checkIds(get, ["classId", "scheduleId", "userId"] as const);
  if (ids.kind !== "ok") return ids;
  return { kind: "ok", params: { ...ids.ids, courseId: text(get, "courseId"), title: text(get, "title"), studentName: text(get, "studentName") } };
}

const PARAM_LABEL: Record<LearningAnalysisParamName, string> = { classId: "mã lớp (classId)", scheduleId: "mã buổi học (scheduleId)", userId: "mã học viên (userId)" };

/** Câu thông báo khi tham số thiếu/không hợp lệ, kèm gợi ý màn cần quay lại. */
export function paramNoticeText(check: Exclude<ParamsCheck<unknown>, { kind: "ok" }>, backTo: string): string {
  const problem = check.kind === "missing" ? "Thiếu" : "Không hợp lệ:";
  return `${problem} ${PARAM_LABEL[check.param]} trong đường dẫn. Hãy quay lại "${backTo}" và chọn lại.`;
}
