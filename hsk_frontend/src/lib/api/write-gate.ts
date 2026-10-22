// Công tắc an toàn cho các THAO TÁC GHI chưa có hợp đồng backend được xác nhận (chấm bài, nhận xét, sửa chi tiết bài học, CRUD nội dung).
// Cùng tư tưởng với campaign-send-gate.ts (M3B.4) nhưng dùng chung cho mọi miền:
//   - Mặc định ĐÓNG ("waiting"): giao diện vẫn hoàn thiện nhưng nút ghi bị khoá/ẩn và hàm client tự chặn, KHÔNG có request ghi nào được tạo.
//   - Mở khi (a) đang ở CHẾ ĐỘ DEMO (mock cách ly, lib/demo/demo-mode.ts) hoặc (b) người triển khai đặt NEXT_PUBLIC_WRITE_<MIỀN>=enabled sau khi backend
//     xác nhận hợp đồng. Mỗi biến NEXT_PUBLIC phải được tham chiếu TĨNH để Next nhúng lúc build.
//   - Ngoại lệ: miền trong DEFAULT_OPEN đã có backend thật (repo-lms) nên MẶC ĐỊNH MỞ, không cần biến môi trường; chỉ đóng khi đặt rõ
//     NEXT_PUBLIC_WRITE_<MIỀN>=disabled (vd bảo trì). Quyền ghi thật vẫn do backend kiểm tra.
// Đây không phải cờ mock: không nằm trong guard production (endpoint-safety.ts).
export type WriteFeature =
  | "quiz-grading"
  | "teacher-note"
  | "lesson-detail"
  | "content";

export type WriteAvailability = "enabled" | "waiting";

const FLAGS: Record<WriteFeature, () => string | undefined> = {
  "quiz-grading": () => process.env.NEXT_PUBLIC_WRITE_QUIZ_GRADING,
  "teacher-note": () => process.env.NEXT_PUBLIC_WRITE_TEACHER_NOTE,
  "lesson-detail": () => process.env.NEXT_PUBLIC_WRITE_LESSON_DETAIL,
  content: () => process.env.NEXT_PUBLIC_WRITE_CONTENT,
};

const DEFAULT_OPEN: ReadonlySet<WriteFeature> = new Set<WriteFeature>(["content"]);

export function getWriteAvailability(feature: WriteFeature, demoActive: boolean): WriteAvailability {
  if (demoActive) return "enabled";
  const flag = FLAGS[feature]()?.trim();
  if (DEFAULT_OPEN.has(feature)) return flag === "disabled" ? "waiting" : "enabled";
  return flag === "enabled" ? "enabled" : "waiting";
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
