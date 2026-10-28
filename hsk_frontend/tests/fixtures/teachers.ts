// FIXTURE TĨNH — chỉ dùng trong test. KHÔNG phải dữ liệu thật và KHÔNG được import từ mã ứng dụng.
import type { TeacherJobStatus, TeacherUser } from "@/types/teacher-management";

export const teacher = (i: number, over: Partial<TeacherUser> = {}): TeacherUser => ({
  id: `gv-${i}`,
  email: `giangvien${i}@example.test`,
  fullName: `Giảng viên ${i}`,
  avatarUrl: null,
  status: "ACTIVE",
  roles: ["ROLE_TEACHER"],
  shortDescription: null,
  fullDescription: null,
  teachingStyle: null,
  qualification: null,
  videoIntroLink: null,
  createdAt: "2026-01-10T08:00:00.000Z",
  ...over,
});

/** 12 giảng viên: 3 bị khoá (3, 6, 9), số 12 thiếu họ tên. */
export const teachersFixture: TeacherUser[] = Array.from({ length: 12 }, (_, k) => {
  const i = k + 1;
  return teacher(i, { status: i % 3 === 0 ? "BLOCKED" : "ACTIVE", fullName: i === 12 ? undefined : `Giảng viên ${i}` });
});

export const idleJob: TeacherJobStatus = { inProgress: false, status: "IDLE", jobId: null, type: null, message: null, updatedAt: null };
export const processingJob: TeacherJobStatus = { inProgress: true, status: "PROCESSING", jobId: "sync-1", type: "SYNC", message: "Đang đối soát", updatedAt: null };
export const doneJob: TeacherJobStatus = { inProgress: false, status: "DONE", jobId: "sync-1", type: "SYNC", message: "Đồng bộ CMS hoàn tất: 1 giảng viên mới", updatedAt: null };
