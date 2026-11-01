// Logic thuần của khối "Cá nhân hoá học tập" (personalization-panel.tsx + personalization-task-groups.ts + personalization.service.ts của HSK cũ):
// chuẩn hoá phản hồi, nhóm bài tập theo liên kết, lọc bài tập theo buổi, câu tóm tắt cho người đọc, điều kiện hiện nút Tạo/Duyệt.
import type { PersonalizationHistoricalSnapshot, PersonalizationRecommendation, PersonalizationReport, PersonalizationTask, PersonalizationView, PersonalizationWeakArea } from "@/types/learning-analysis";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = <T>(v: unknown, keep: (x: unknown) => x is T): T[] => (Array.isArray(v) ? v.filter(keep) : []);
const optStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const nullableStr = (v: unknown): string | null | undefined => (v === null ? null : optStr(v));
const nullableNum = (v: unknown): number | null | undefined => (v === null ? null : typeof v === "number" ? v : undefined);

const isWeakArea = (v: unknown): v is PersonalizationWeakArea => isRecord(v) && typeof v.label === "string";
const isRecommendation = (v: unknown): v is PersonalizationRecommendation => isRecord(v);
const isTask = (v: unknown): v is PersonalizationTask => isRecord(v) && typeof v.id === "string" && typeof v.title === "string";

const toWeakAreas = (v: unknown): PersonalizationWeakArea[] => arr(v, isWeakArea).map((w) => ({ label: w.label, mastery: nullableNum(w.mastery) }));

const toReport = (v: unknown): PersonalizationReport | null =>
  isRecord(v) && typeof v.id === "string"
    ? { id: v.id, state: optStr(v.state) ?? "", generatedAt: optStr(v.generatedAt), approvedAt: optStr(v.approvedAt), summary: nullableStr(v.summary), snapshotWeakAreas: toWeakAreas(v.snapshotWeakAreas) }
    : null;

const toSnapshot = (v: unknown): PersonalizationHistoricalSnapshot | null => {
  if (!isRecord(v) || typeof v.id !== "string") return null;
  const ds = isRecord(v.dataSufficiency) ? v.dataSufficiency : undefined;
  return {
    id: v.id,
    version: typeof v.version === "number" ? v.version : 1,
    generatedAt: optStr(v.generatedAt),
    dataSufficiency: ds ? { insufficient_data: typeof ds.insufficient_data === "boolean" ? ds.insufficient_data : undefined, useful_answers: typeof ds.useful_answers === "number" ? ds.useful_answers : undefined, distinct_supported_kcs: typeof ds.distinct_supported_kcs === "number" ? ds.distinct_supported_kcs : undefined } : undefined,
    weakAreas: toWeakAreas(v.weakAreas),
  };
};

const toTask = (t: PersonalizationTask): PersonalizationTask => ({
  id: t.id,
  title: t.title,
  description: nullableStr(t.description),
  status: typeof t.status === "string" ? t.status : "",
  deadline: nullableStr(t.deadline),
  assignedAt: nullableStr(t.assignedAt),
  completedAt: nullableStr(t.completedAt),
  sourceSnapshotId: nullableStr(t.sourceSnapshotId),
  sourceLmsScheduleId: nullableStr(t.sourceLmsScheduleId),
  materialUrl: nullableStr(t.materialUrl),
  kcLabel: nullableStr(t.kcLabel),
});

export const EMPTY_PERSONALIZATION: PersonalizationView = { available: false, dataSufficiency: "UNKNOWN", dataSufficiencyMessage: null, report: null, historicalSnapshot: null, recommendations: [], tasks: [], currentTasks: [] };

/** Như `extract` của personalization.service cũ: mọi mảng được bảo đảm là mảng, thiếu/không đúng kiểu => giá trị rỗng; không phải object => không khả dụng. */
export function normalizePersonalizationView(raw: unknown): PersonalizationView {
  if (!isRecord(raw)) return EMPTY_PERSONALIZATION;
  return {
    available: raw.available === true,
    dataSufficiency: optStr(raw.dataSufficiency) ?? "UNKNOWN",
    dataSufficiencyMessage: nullableStr(raw.dataSufficiencyMessage) ?? null,
    report: toReport(raw.report),
    historicalSnapshot: toSnapshot(raw.historicalSnapshot),
    recommendations: arr(raw.recommendations, isRecommendation).map((r) => ({ label: nullableStr(r.label), reason: nullableStr(r.reason), status: nullableStr(r.status) })),
    tasks: arr(raw.tasks, isTask).map(toTask),
    currentTasks: arr(raw.currentTasks, isTask).map(toTask),
  };
}

// ---- nhãn trạng thái bài tập ----

export function taskStatusLabel(status?: string): string {
  switch (String(status || "").toUpperCase()) {
    case "ASSIGNED":
      return "Đã giao";
    case "IN_PROGRESS":
      return "Đang học";
    case "COMPLETED":
      return "Đã hoàn thành";
    case "APPROVED":
      return "Đã duyệt";
    case "DRAFT":
      return "Bản nháp";
    default:
      return status || "Đang cập nhật";
  }
}

export function taskStatusClass(status?: string): string {
  switch (String(status || "").toUpperCase()) {
    case "COMPLETED":
      return "bg-success-subtle text-success";
    case "ASSIGNED":
    case "APPROVED":
      return "bg-primary-subtle text-primary";
    case "IN_PROGRESS":
      return "bg-warning-subtle text-warning-emphasis";
    default:
      return "bg-light text-muted";
  }
}

// ---- nhóm bài tập theo liên kết (một ExamSession dùng chung cho nhiều nội dung cần củng cố => một hành động) ----

export interface PersonalizationTaskGroup {
  key: string;
  materialUrl: string | null;
  tasks: PersonalizationTask[];
}

export function getPersonalizationTaskGroupKey(task: PersonalizationTask): string {
  const materialUrl = task.materialUrl?.trim();
  if (!materialUrl) return `task:${task.id}`;
  try {
    const sessionCode = new URL(materialUrl, "http://personalization.local").searchParams.get("sessionCode")?.trim();
    if (sessionCode) return `session:${sessionCode.toUpperCase()}`;
  } catch {
    // URL hỏng/kiểu cũ: giữ riêng từng bài, không gộp nhầm.
  }
  return `url:${materialUrl}`;
}

export function groupPersonalizationTasks(tasks: readonly PersonalizationTask[]): PersonalizationTaskGroup[] {
  const groups = new Map<string, PersonalizationTaskGroup>();
  for (const task of tasks) {
    const key = getPersonalizationTaskGroupKey(task);
    const existing = groups.get(key);
    if (existing) existing.tasks.push(task);
    else groups.set(key, { key, materialUrl: task.materialUrl?.trim() || null, tasks: [task] });
  }
  return [...groups.values()];
}

export const groupHasMultipleTargets = (group: PersonalizationTaskGroup): boolean => group.tasks.length > 1 || group.tasks.some((t) => /nhiều kỹ năng|luyện tập tổng hợp/i.test(`${t.title} ${t.description || ""}`));

/** Nhãn nội dung cần củng cố (kcLabel) khác nhau trong nhóm, bỏ rỗng. */
export const groupKcLabels = (group: PersonalizationTaskGroup): string[] => [...new Set(group.tasks.map((t) => t.kcLabel?.trim()).filter((x): x is string => Boolean(x)))];

/** Trạng thái chung của nhóm: mọi bài cùng trạng thái => trạng thái đó, khác nhau => "ASSIGNED". */
export const groupStatus = (group: PersonalizationTaskGroup): string => (group.tasks.every((t) => t.status === group.tasks[0].status) ? group.tasks[0].status : "ASSIGNED");

/**
 * Bài tập thuộc buổi đang xem: ưu tiên `tasks` (đã gắn snapshot); không có thì `currentTasks`. Bài có scope (scheduleId/snapshotId) phải khớp buổi hoặc
 * snapshot hiện tại; bài không có scope chỉ được giữ khi nguồn là `tasks`.
 */
export function scopedPersonalizationTasks(view: PersonalizationView, scheduleId: string): PersonalizationTask[] {
  const snapshotScoped = view.tasks.length > 0;
  const source = snapshotScoped ? view.tasks : (view.currentTasks ?? []);
  const snapshotId = view.historicalSnapshot?.id;
  return source.filter((task) => {
    const taskSchedule = task.sourceLmsScheduleId?.trim();
    const taskSnapshot = task.sourceSnapshotId?.trim();
    if (!taskSchedule && !taskSnapshot) return snapshotScoped;
    return Boolean((scheduleId && taskSchedule === scheduleId) || (snapshotId && taskSnapshot === snapshotId));
  });
}

// ---- khối "Nhận xét của AI" ----

export const NO_HISTORICAL_MESSAGE = "Chưa có nhận xét AI cho buổi học này.";

export const isHistoricalInsufficient = (view: PersonalizationView): boolean =>
  Boolean(view.historicalSnapshot && (view.dataSufficiency === "INSUFFICIENT" || view.dataSufficiency === "INSUFFICIENT_DATA" || view.historicalSnapshot.dataSufficiency?.insufficient_data === true));

export const aiWeakAreas = (view: PersonalizationView): PersonalizationWeakArea[] => (view.report?.snapshotWeakAreas?.length ? view.report.snapshotWeakAreas : (view.historicalSnapshot?.weakAreas ?? []));

/** Tóm tắt kỹ thuật (nhắc snapshot/KC/confidence...) không đưa cho giáo viên; thay bằng câu nêu số nội dung cần luyện. */
export function humanSummary(view: PersonalizationView): string {
  const summary = view.report?.summary?.trim();
  const technical = Boolean(summary && /\b(snapshot|provenance|KC|observations?|confidence|report|policy)\b/i.test(summary));
  if (summary && !technical) return summary;
  const n = aiWeakAreas(view).length;
  return n > 0 ? `Kết quả học tập đến buổi này cho thấy học viên nên luyện thêm ${n} nội dung dưới đây.` : "Chưa có nội dung cần chú ý được ghi nhận cho buổi học này.";
}

export const canGenerateHistorical = (view: PersonalizationView): boolean => view.available && !view.historicalSnapshot;

export const canApproveReport = (view: PersonalizationView): boolean => view.available && !isHistoricalInsufficient(view) && String(view.report?.state || "").toUpperCase() === "DRAFT";

export const insufficientMessage = (view: PersonalizationView): string =>
  view.historicalSnapshot?.dataSufficiency && view.dataSufficiencyMessage ? view.dataSufficiencyMessage : "Chưa đủ dữ liệu để AI đưa ra nhận xét đáng tin cậy.";
