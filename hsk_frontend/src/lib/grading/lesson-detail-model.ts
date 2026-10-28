// Logic thuần của màn "Chi tiết bài học" (HSK cũ: lesson-detail-page.tsx). Bản cũ sửa trực tiếp bản sao JSON trong setState; ở đây mỗi thao tác là
// một hàm thuần trả bản ghi MỚI (không đổi đầu vào) để kiểm thử được và dùng với state bất biến.
import type { LessonDetailResponse, LessonExercise, LessonModule, LessonQuestion } from "@/types/grading";

export const TOPIC_TYPES = ["Bài học", "Slide", "Từ vựng", "Ngữ pháp"] as const;
export const MATERIAL_TYPES = ["Nghe", "Đọc hiểu", "Viết", "Nói", "Từ vựng", "Ngữ pháp", "Slide"] as const;
export const QUESTION_TYPES = ["Trắc nghiệm", "Đúng/Sai", "Tự luận", "Điền từ"] as const;

const clone = (d: LessonDetailResponse): LessonDetailResponse => JSON.parse(JSON.stringify(d)) as LessonDetailResponse;

/** Áp một thay đổi lên bản sao sâu; bản gốc không đổi. */
const mutate = (detail: LessonDetailResponse, fn: (draft: LessonDetailResponse) => void): LessonDetailResponse => {
  const next = clone(detail);
  fn(next);
  return next;
};

const exerciseAt = (d: LessonDetailResponse, mi: number, ei: number): LessonExercise | undefined => d.modules[mi]?.exercises?.[ei];
const questionAt = (d: LessonDetailResponse, mi: number, ei: number, qi: number): LessonQuestion | undefined => exerciseAt(d, mi, ei)?.questions?.[qi];

export const updateModule = <K extends keyof LessonModule>(detail: LessonDetailResponse, mi: number, field: K, value: LessonModule[K]) =>
  mutate(detail, (d) => {
    if (d.modules[mi]) d.modules[mi][field] = value;
  });

export const toggleLock = (detail: LessonDetailResponse, mi: number) =>
  mutate(detail, (d) => {
    if (d.modules[mi]) d.modules[mi].locked = !d.modules[mi].locked;
  });

export const removeModule = (detail: LessonDetailResponse, mi: number) =>
  mutate(detail, (d) => {
    d.modules.splice(mi, 1);
  });

/** `id` do nơi gọi cấp (bản cũ: `lm-${Date.now()}`) để hàm thuần không phụ thuộc thời gian. */
export const addModule = (detail: LessonDetailResponse, id: string) =>
  mutate(detail, (d) => {
    d.modules.push({ id, label: "Chủ đề mới", topicType: "Bài học", exercises: [] });
  });

export const updateExercise = <K extends keyof LessonExercise>(detail: LessonDetailResponse, mi: number, ei: number, field: K, value: LessonExercise[K]) =>
  mutate(detail, (d) => {
    const ex = exerciseAt(d, mi, ei);
    if (ex) ex[field] = value;
  });

export const addExercise = (detail: LessonDetailResponse, mi: number) =>
  mutate(detail, (d) => {
    const m = d.modules[mi];
    if (m) (m.exercises ||= []).push({ name: "", questions: [] });
  });

export const removeExercise = (detail: LessonDetailResponse, mi: number, ei: number) =>
  mutate(detail, (d) => {
    d.modules[mi]?.exercises?.splice(ei, 1);
  });

export const setExerciseAudio = (detail: LessonDetailResponse, mi: number, ei: number, audioName: string | undefined) =>
  mutate(detail, (d) => {
    const ex = exerciseAt(d, mi, ei);
    if (ex) ex.audioName = audioName;
  });

export const updateQuestion = <K extends keyof LessonQuestion>(detail: LessonDetailResponse, mi: number, ei: number, qi: number, field: K, value: LessonQuestion[K]) =>
  mutate(detail, (d) => {
    const q = questionAt(d, mi, ei, qi);
    if (q) q[field] = value;
  });

export const addQuestion = (detail: LessonDetailResponse, mi: number, ei: number) =>
  mutate(detail, (d) => {
    const ex = exerciseAt(d, mi, ei);
    if (!ex) return;
    const qs = (ex.questions ||= []);
    qs.push({ no: qs.length + 1, type: "Trắc nghiệm", text: "", options: [{ label: "" }], score: 1 });
  });

/** Xoá câu rồi đánh số lại `no` liên tục. */
export const removeQuestion = (detail: LessonDetailResponse, mi: number, ei: number, qi: number) =>
  mutate(detail, (d) => {
    const ex = exerciseAt(d, mi, ei);
    ex?.questions?.splice(qi, 1);
    ex?.questions?.forEach((q, idx) => {
      q.no = idx + 1;
    });
  });

export const updateOptionLabel = (detail: LessonDetailResponse, mi: number, ei: number, qi: number, oi: number, label: string) =>
  mutate(detail, (d) => {
    const opt = questionAt(d, mi, ei, qi)?.options?.[oi];
    if (opt) opt.label = label;
  });

/** Đáp án đúng là duy nhất trong câu. */
export const setCorrectOption = (detail: LessonDetailResponse, mi: number, ei: number, qi: number, oi: number) =>
  mutate(detail, (d) => {
    questionAt(d, mi, ei, qi)?.options?.forEach((o, idx) => {
      o.correct = idx === oi;
    });
  });

export const addOption = (detail: LessonDetailResponse, mi: number, ei: number, qi: number) =>
  mutate(detail, (d) => {
    const q = questionAt(d, mi, ei, qi);
    if (q) (q.options ||= []).push({ label: "" });
  });

export const removeOption = (detail: LessonDetailResponse, mi: number, ei: number, qi: number, oi: number) =>
  mutate(detail, (d) => {
    questionAt(d, mi, ei, qi)?.options?.splice(oi, 1);
  });

/** Điểm câu từ ô nhập số: rỗng => bỏ điểm; không phải số => giữ nguyên. */
export const parseQuestionScore = (raw: string): number | undefined | null => {
  if (raw === "") return undefined;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
};
