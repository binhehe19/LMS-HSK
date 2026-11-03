// Công tắc an toàn cho các THAO TÁC GHI chưa có hợp đồng backend được xác nhận (chấm bài, nhận xét, CRUD giảng viên/nội dung/khoá học/tài liệu/ticket...).
// Cùng tư tưởng với campaign-send-gate.ts (M3B.4) nhưng dùng chung cho mọi miền:
//   - Mặc định ĐÓNG ("waiting"): giao diện vẫn hoàn thiện nhưng nút ghi bị khoá/ẩn và hàm client tự chặn, KHÔNG có request ghi nào được tạo.
//   - Mở khi (a) đang ở CHẾ ĐỘ DEMO (mock cách ly, lib/demo/demo-mode.ts) hoặc (b) người triển khai đặt NEXT_PUBLIC_WRITE_<MIỀN>=enabled sau khi backend
//     xác nhận hợp đồng. Mỗi biến NEXT_PUBLIC phải được tham chiếu TĨNH để Next nhúng lúc build.
// Đây không phải cờ mock: không nằm trong guard production (endpoint-safety.ts).
export type WriteFeature =
  | "quiz-grading"
  | "teacher-note"
  | "lesson-detail"
  | "teacher-management"
  | "content"
  | "online-course"
  | "storage"
  | "work-tickets"
  | "membership";

export type WriteAvailability = "enabled" | "waiting";

const FLAGS: Record<WriteFeature, () => string | undefined> = {
  "quiz-grading": () => process.env.NEXT_PUBLIC_WRITE_QUIZ_GRADING,
  "teacher-note": () => process.env.NEXT_PUBLIC_WRITE_TEACHER_NOTE,
  "lesson-detail": () => process.env.NEXT_PUBLIC_WRITE_LESSON_DETAIL,
  "teacher-management": () => process.env.NEXT_PUBLIC_WRITE_TEACHER_MANAGEMENT,
  content: () => process.env.NEXT_PUBLIC_WRITE_CONTENT,
  "online-course": () => process.env.NEXT_PUBLIC_WRITE_ONLINE_COURSE,
  storage: () => process.env.NEXT_PUBLIC_WRITE_STORAGE,
  "work-tickets": () => process.env.NEXT_PUBLIC_WRITE_WORK_TICKETS,
  membership: () => process.env.NEXT_PUBLIC_WRITE_MEMBERSHIP,
};

export function getWriteAvailability(feature: WriteFeature, demoActive: boolean): WriteAvailability {
  if (demoActive) return "enabled";
  return FLAGS[feature]()?.trim() === "enabled" ? "enabled" : "waiting";
}

/** Ném khi một hàm client ghi được gọi lúc công tắc đóng: KHÔNG có request nào được tạo. */
export class WriteDisabledError extends Error {
  feature: WriteFeature;
  constructor(feature: WriteFeature) {
    super("Thao tác ghi chưa được tích hợp (WAITING FOR BACKEND).");
    this.name = "WriteDisabledError";
    this.feature = feature;
  }
}

/** Lớp chặn cuối cùng cho hàm client ghi: `assertWriteEnabled("quiz-grading", demoActive)` trước khi gọi API. */
export function assertWriteEnabled(feature: WriteFeature, demoActive: boolean): void {
  if (getWriteAvailability(feature, demoActive) !== "enabled") throw new WriteDisabledError(feature);
}
