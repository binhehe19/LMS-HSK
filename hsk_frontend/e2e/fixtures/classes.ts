// Dữ liệu TĨNH chỉ dùng trong kiểm thử trình duyệt (chặn mạng bằng page.route). KHÔNG phải dữ liệu thật; không bao giờ được dùng làm dự phòng trong app.
export interface ClassFixture {
  classId: string;
  classCode: string;
  className: string;
  courseName: string;
  teacherName: string | null;
  teacherEmail: string;
  scheduleDays: string;
  startTime: string;
  duration: number | string;
  studentCount?: number;
  startDate: string;
  endDate: string;
  actualEndDate?: string;
}

const mk = (i: number, over: Partial<ClassFixture> = {}): ClassFixture => ({
  classId: `fx-${String(i).padStart(3, "0")}`,
  classCode: `HSK${(i % 6) + 1}-FX${String(i).padStart(2, "0")}`,
  className: `Lớp thử nghiệm ${i}`,
  courseName: i % 3 === 0 ? "HSK 3 - Giao tiếp nâng cao (tên khóa học rất dài để kiểm tra việc cắt dòng)" : `HSK ${(i % 6) + 1} cơ bản`,
  teacherName: ["Nguyễn Văn An", "Trần Thị Bình", "Lê Hoàng Cường", "Phạm Minh Đức"][i % 4],
  teacherEmail: `gv${i}@example.test`,
  scheduleDays: "T2, T4, T6",
  startTime: "19:00",
  duration: 90,
  studentCount: 5 + i,
  startDate: "2026-09-01",
  endDate: "2026-12-31",
  ...over,
});

export const classesFixture: ClassFixture[] = [
  ...Array.from({ length: 8 }, (_, i) => mk(i + 1)), // đang học
  mk(9, { startDate: "2027-01-10", endDate: "2027-04-30" }), // sắp khai giảng
  mk(10, { startDate: "2026-03-01", endDate: "2026-06-30", actualEndDate: "2026-06-30" }), // kết thúc đúng hạn
  mk(11, { startDate: "2026-03-01", endDate: "2026-06-30", actualEndDate: "2026-07-09" }), // trễ 9 ngày
  mk(12, { teacherName: null, studentCount: undefined }), // thiếu dữ liệu
  mk(13, { classCode: "", courseName: "" }),
  mk(14, { duration: "120", startTime: "08:30" }),
  mk(15),
];

export const adminUserFixture = { id: "u-admin-1", email: "admin@example.test", fullName: "Quản Trị Viên", avatarUrl: null, roles: ["ROLE_ADMIN"], emailVerified: true, status: "ACTIVE" };

/** Phong bì phản hồi API giống backend: { success, data }. */
export const envelope = (data: unknown) => JSON.stringify({ success: true, data });
