// FIXTURE TĨNH — chỉ dùng trong test. KHÔNG phải dữ liệu thật và KHÔNG được import từ mã ứng dụng.
import type { GradingClassResponse } from "@/types/grading";
import type { AuthUser } from "@/lib/api/auth-client";

const mk = (i: number, over: Partial<GradingClassResponse> = {}): GradingClassResponse => ({
  classId: `fx-${String(i).padStart(3, "0")}`,
  classCode: `HSK${(i % 6) + 1}-FX${String(i).padStart(2, "0")}`,
  courseName: `HSK ${(i % 6) + 1} cơ bản`,
  teacherName: ["Nguyễn Văn An", "Trần Thị Bình", "Lê Hoàng Cường", "Phạm Minh Đức"][i % 4],
  scheduleDays: "T2, T4, T6",
  startTime: "19:00",
  duration: 90,
  studentCount: 5 + i,
  startDate: "2026-09-01",
  endDate: "2026-12-31",
  ...over,
});

export const classesFixture: GradingClassResponse[] = [
  ...Array.from({ length: 8 }, (_, i) => mk(i + 1)),
  mk(9, { startDate: "2027-01-10", endDate: "2027-04-30" }),
  mk(10, { startDate: "2026-03-01", endDate: "2026-06-30", actualEndDate: "2026-06-30" }),
  mk(11, { startDate: "2026-03-01", endDate: "2026-06-30", actualEndDate: "2026-07-09" }),
  mk(12, { teacherName: undefined, studentCount: undefined }),
];

export const adminUser: AuthUser = {
  id: "u-admin-1",
  email: "admin@example.test",
  fullName: "Quản Trị Viên",
  avatarUrl: null,
  roles: ["ROLE_ADMIN"],
};
