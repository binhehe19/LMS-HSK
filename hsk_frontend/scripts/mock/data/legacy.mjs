// Provider dữ liệu hồ sơ `e2e`: NGUYÊN VĂN các bộ sinh dữ liệu của mock-server.mjs cũ (M1 → M4B). Bộ kiểm thử trình duyệt và ảnh chuẩn
// đã đóng băng theo dữ liệu này (tên "Lớp giả lập k", mã MOCKkk, 25 lớp, 23 buổi, buổi 4 thiếu sessionNo, i%5==0 còn bài chờ chấm...),
// nên KHÔNG đổi giá trị ở đây; muốn dữ liệu đẹp/nhất quán cho xem trước thì dùng hồ sơ `demo` (data/demo.mjs).
// Các miền mới (học viên của buổi, bài làm, chấm bài, backend chung /api/lms) được bổ sung bằng dữ liệu tổng hợp đơn giản, không đụng tới dữ liệu cũ.
import { DAY, isoDay, nowMs, state } from "../core.mjs";
import { createGradingStore, createRng } from "./grading-model.mjs";

const mkClass = (i, over = {}) => ({
  classId: `mock-${String(i).padStart(3, "0")}`,
  classCode: `HSK${(i % 6) + 1}-MOCK${String(i).padStart(2, "0")}`,
  courseName: `HSK ${(i % 6) + 1} cơ bản (DỮ LIỆU GIẢ)`,
  teacherName: ["Giáo viên A", "Giáo viên B", "Giáo viên C"][i % 3],
  scheduleDays: "T2, T4, T6",
  startTime: "19:00",
  duration: 90,
  studentCount: 8 + i,
  startDate: "2026-09-01",
  endDate: "2026-12-31",
  ...over,
});
const CLASSES = [
  ...Array.from({ length: 8 }, (_, i) => mkClass(i + 1)),
  mkClass(9, { startDate: "2027-01-10", endDate: "2027-04-30" }),
  mkClass(10, { startDate: "2026-03-01", endDate: "2026-06-30", actualEndDate: "2026-06-30" }),
  mkClass(11, { startDate: "2026-03-01", endDate: "2026-06-30", actualEndDate: "2026-07-09" }),
  mkClass(12, { teacherName: undefined, studentCount: undefined }),
];

// Lớp của GIẢNG VIÊN (DỮ LIỆU GIẢ): 25 lớp, ngày tính theo nowMs() (đóng băng được bằng /mock-control?now=). Lớp i%4==0 còn bài chờ chấm;
// i%9==0 thiếu tên giáo viên; i%11==0 thiếu số học viên.
const TEACHER_COURSES = ["HSK 1 cơ bản", "HSK 2 cơ bản", "HSK 3 trung cấp", "Giao tiếp cơ bản"];
const teacherClasses = (n) => {
  const today = Math.floor(nowMs() / DAY) * DAY;
  return Array.from({ length: n }, (_, k) => {
    const i = k + 1;
    const start = today + (i - 12) * DAY;
    return {
      classId: `mock-tc-${i}`, classCode: `MOCK${String(i).padStart(2, "0")}`, className: `Lớp giả lập ${i}`, courseId: `mock-course-${i % 4}`, courseName: TEACHER_COURSES[i % 4],
      teacherName: i % 9 === 0 ? undefined : "Giảng viên Giả Lập", teacherEmail: i % 9 === 0 ? undefined : "teacher@mock.invalid",
      startDate: isoDay(start), endDate: isoDay(start + 30 * DAY), studentCount: i % 11 === 0 ? undefined : 8 + i, hasPendingGrading: i % 4 === 0,
    };
  });
};
// Buổi học GIẢ của lớp k, trả ĐẢO NGƯỢC để frontend phải tự sắp theo sessionNo. Buổi 1: title "Buổi 1"; buổi 2: title + topic; buổi 3: không title;
// buổi 4: thiếu sessionNo (xuống cuối); i%3==0 có bài tập; i%5==0 còn bài chờ chấm.
const lessonsOf = (k, n) =>
  Array.from({ length: n }, (_, idx) => {
    const i = idx + 1;
    return {
      sessionId: `mock-ls-${k}-${i}`, syllabusScheduleId: `mock-syl-${k}-${i}`, sessionNo: i === 4 ? undefined : i,
      title: i === 1 ? "Buổi 1" : i === 3 ? undefined : `Bài ${i} của lớp ${k}`, topic: i % 2 === 0 ? `Chủ đề ${i} lớp ${k}` : undefined,
      hasAssignment: i % 3 === 0, hasPendingGrading: i % 5 === 0,
    };
  }).reverse();

// Thông báo GIẢ: mặc định 4 (1-3 chưa đọc, 4 đã đọc); notifTotal > 4: từ số 4, số chẵn đã đọc, số lẻ chưa đọc.
const mkNoti = (i, read) => ({
  id: `mock-noti-${i}`,
  topic: "GENERAL",
  title: `Thông báo giả lập ${i} (DỮ LIỆU GIẢ)`,
  message: `Nội dung thông báo giả lập số ${i}, chỉ để xem trước giao diện.`,
  resourceType: "",
  resourceId: "",
  payload: i === 1 ? { targetUrl: state.controls.notifTarget } : null,
  read,
  seen: read,
  createdAt: new Date(nowMs() - i * state.controls.notifStepMin * 60_000).toISOString(),
  readAt: null,
  seenAt: null,
});
const ROLE_CYCLE = [["ROLE_USER"], ["ROLE_TEACHER"], ["ROLE_USER"], ["ROLE_TEACHER_MANAGER"], ["ROLE_COLLABORATOR"], ["ROLE_USER", "ROLE_TEACHER"]];
const mkUser = (i) => ({ id: `mock-user-${i}`, email: `nguoidung${i}@mock.invalid`, fullName: i % 7 === 0 ? undefined : `Người dùng giả lập ${i}`, roles: ROLE_CYCLE[(i - 1) % ROLE_CYCLE.length], status: "ACTIVE" });
const STATUS_CYCLE = ["SUCCESS", "PROCESSING", "FAILED"];
const mkCampaign = (i) => ({ id: `mock-camp-${i}`, title: `Chiến dịch giả lập ${i}`, message: `Nội dung chiến dịch giả lập số ${i}.\nDòng thứ hai của nội dung.`, audienceType: i % 2 ? "SELECTED_USERS" : "ALL_USERS", status: STATUS_CYCLE[(i - 1) % 3], createdAt: new Date(nowMs() - i * 3_600_000).toISOString() });

// ---- dữ liệu tổng hợp cho các miền mới (học viên, bài làm, backend chung). 6 học viên giả cho mỗi lớp (cả lớp giảng viên mock-tc-k và lớp admin mock-00x). ----
const studentsOf = (classId) =>
  Array.from({ length: 6 }, (_, j) => ({ userId: `hv-${classId}-${j + 1}`, name: `Học viên giả lập ${j + 1} (${classId})`, email: `hocvien${j + 1}.${classId}@mock.invalid`, phone: `0900 000 ${String(j + 1).padStart(3, "0")}`, studentCode: `HV-${classId}-${j + 1}`, ability: 0.5 + j * 0.08 }));

/** Buổi học của 25 lớp giảng viên (mặc định) dùng cho kho chấm bài; buổi i%3==0 có bài tập (khớp hasAssignment của lessonsOf). Mọi buổi coi như đã diễn ra. */
const buildGradingSessions = (todayIso) => {
  const list = [];
  for (let k = 1; k <= 25; k++) {
    for (let i = 1; i <= 23; i++) {
      list.push({ sessionId: `mock-ls-${k}-${i}`, syllabusScheduleId: `mock-syl-${k}-${i}`, classId: `mock-tc-${k}`, sessionNo: i, title: i === 3 ? undefined : `Bài ${i} của lớp ${k}`, topic: i % 2 === 0 ? `Chủ đề ${i} lớp ${k}` : undefined, date: isoDay(Date.parse(todayIso) - (24 - i) * DAY), hasAssignment: i % 3 === 0 });
    }
  }
  return list;
};

// Backend chung /api/lms GIẢ (hình dạng IELTS) suy từ CLASSES: 12 lớp, 10 buổi, 6 học viên; 3 giáo trình.
const LIFECYCLE = (c) => (c.actualEndDate || Date.parse(c.endDate) < Date.now() ? "FINISHED" : Date.parse(c.startDate) > Date.now() ? "UPCOMING" : "ONGOING");
const lmsClassOf = (c, i) => ({
  id: c.classId, code: c.classCode, name: `Lớp ${c.classCode}`, courseId: `mock-course-${(i % 6) + 1}`, courseName: c.courseName, classType: "GROUP", track: "HSK", startDate: c.startDate, lifecycleStatus: LIFECYCLE(c), expectedSize: c.studentCount,
  teacherId: c.teacherName ? `gv-${(i % 3) + 1}` : undefined, teacher: c.teacherName ? { id: `gv-${(i % 3) + 1}`, fullName: c.teacherName, email: `giaovien${(i % 3) + 1}@mock.invalid`, status: "ACTIVE", roles: ["ROLE_TEACHER"] } : undefined,
  schedulePatterns: ["MONDAY", "WEDNESDAY", "FRIDAY"].map((d) => ({ dayOfWeek: d, startTime: "19:00", endTime: "20:30" })),
  educationLevelId: `lvl-${(i % 6) + 1}`, educationLevelCode: `HSK${(i % 6) + 1}`, educationLevelName: `HSK ${(i % 6) + 1}`,
});
const lmsSyllabusOf = (i) => ({
  id: `mock-syl-${i}`, name: `Giáo trình HSK ${i} (DỮ LIỆU GIẢ)`, code: `GT-HSK${i}`, educationLevelName: `HSK ${i}`, type: "STANDARD", author: "Tổ chuyên môn", latestVersionNo: 2, createdAt: "2026-01-15T08:00:00Z",
  status: "PUBLISHED", description: `Giáo trình giả lập cấp HSK ${i}.`, clo: [{ id: `clo-${i}-1`, code: "CLO1", name: "Nghe hiểu hội thoại ngắn" }, { id: `clo-${i}-2`, code: "CLO2", name: "Đọc hiểu đoạn văn" }],
  materials: [{ id: `mat-${i}-1`, title: `HSK Standard Course ${i}`, type: "Giáo trình chính", author: "Jiang Liping", publisher: "BLCUP", year: 2015 }],
  schedule: Array.from({ length: 10 }, (_, s) => ({ id: `sch-${i}-${s + 1}`, topic: `Buổi ${s + 1}: Bài ${s + 1}`, content: `Nội dung buổi ${s + 1} của giáo trình HSK ${i}`, delivery: "Trực tuyến", studentMaterials: [], teacherMaterials: [], moduleOnLuyen: [{ moduleType: "QUIZ", moduleContent: `Bài tập buổi ${s + 1}` }] })),
  gradingStructure: [{ id: `gs-${i}-1`, item: "Giữa kỳ", type: "Bài kiểm tra", weight: 40 }, { id: `gs-${i}-2`, item: "Cuối kỳ", type: "Bài kiểm tra", weight: 60 }],
  versions: [{ id: `ver-${i}-1`, versionNo: 1, status: "ARCHIVED", publishedAt: "2026-01-15T08:00:00Z", publishedBy: "admin" }, { id: `ver-${i}-2`, versionNo: 2, status: "PUBLISHED", publishedAt: "2026-06-01T08:00:00Z", publishedBy: "admin", changeNote: "Cập nhật buổi 7–10" }],
});

export function createLegacyProvider() {
  let notis = [];
  let campaigns = [];
  let grading;
  let sessions;
  const resetNotifications = () => {
    notis = Array.from({ length: state.controls.notifTotal }, (_, k) => mkNoti(k + 1, k + 1 >= 4 && (k + 1) % 2 === 0));
  };
  const resetCampaigns = () => {
    campaigns = Array.from({ length: state.controls.campaignTotal }, (_, k) => mkCampaign(k + 1));
  };
  const resetGrading = () => {
    const todayIso = isoDay(nowMs());
    sessions = buildGradingSessions(todayIso);
    grading = createGradingStore({ rng: createRng(7), sessions, studentsOf, todayIso, quizzesPerSession: 2 });
  };
  resetNotifications();
  resetCampaigns();
  resetGrading();

  return {
    profile: "e2e",
    reset() {
      resetNotifications();
      resetCampaigns();
      resetGrading();
    },
    resetNotifications,
    resetCampaigns,

    me(s) {
      return { id: `mock-${s.role}`, userCode: `M-${s.role}`, email: `${s.role}@mock.invalid`, fullName: `Người dùng giả lập (${s.role})`, avatarUrl: null, roles: s.roles, emailVerified: true };
    },

    adminClasses: () => CLASSES,
    teacherClasses: () => teacherClasses(state.controls.teacherCount),
    /** Chỉ lớp mock-tc-1..teacherCount thuộc giảng viên. */
    ownsClass(_s, classId) {
      const m = classId.match(/^mock-tc-(\d+)$/);
      const k = m ? Number(m[1]) : 0;
      return m && k >= 1 && k <= state.controls.teacherCount ? { k } : null;
    },
    classSchedules: (classId) => lessonsOf(Number(classId.match(/^mock-tc-(\d+)$/)?.[1] ?? 0), state.controls.lessonCount),
    classOf: (classId) => CLASSES.find((c) => c.classId === classId) ?? teacherClasses(state.controls.teacherCount).find((c) => c.classId === classId) ?? null,
    findSession: (scheduleId) => sessions.find((s) => s.syllabusScheduleId === scheduleId || s.sessionId === scheduleId) ?? null,
    studentsOf,
    grading: () => grading,
    adminClassStudents: (classId) => grading.classStudents(sessions.filter((s) => s.classId === classId).map((s) => s.sessionId), studentsOf(classId)),

    // ---- backend chung /api/lms (hình dạng IELTS) ----
    lmsClasses: () => CLASSES.map(lmsClassOf),
    lmsClass(classId) {
      const i = CLASSES.findIndex((c) => c.classId === classId);
      if (i < 0) return null;
      const c = CLASSES[i];
      return { ...lmsClassOf(c, i), syllabusId: `mock-syl-${(i % 3) + 1}`, syllabusVersionNo: 2, syllabusName: `Giáo trình HSK ${(i % 3) + 1} (DỮ LIỆU GIẢ)`, meetingLink: "https://meet.example.invalid/mock", note: "Dữ liệu giả lập", mentor: i % 2 ? { id: "tg-1", fullName: "Trợ giảng giả lập", email: "trogiang@mock.invalid" } : undefined };
    },
    lmsSessions: (classId) => {
      const c = CLASSES.find((x) => x.classId === classId);
      if (!c) return [];
      const start = Date.parse(c.startDate);
      return Array.from({ length: 10 }, (_, s) => ({ id: `${classId}-ss-${s + 1}`, sessionNo: s + 1, startAt: new Date(start + s * 2 * DAY + 12 * 3_600_000).toISOString(), endAt: new Date(start + s * 2 * DAY + 13.5 * 3_600_000).toISOString(), teacherId: "gv-1", teacher: { id: "gv-1", fullName: c.teacherName }, room: "Online", status: s < 5 ? "COMPLETED" : "PLANNED", percentCompleted: s < 5 ? 100 : 0 }));
    },
    lmsEnrollments: (classId) =>
      studentsOf(classId).map((st, j) => ({ id: `enr-${classId}-${j + 1}`, studentId: st.userId, studentFullName: st.name, studentEmail: st.email, studentUserCode: st.studentCode, studentPhone: st.phone, status: "ENROLLED", enrolledAt: "2026-09-01T00:00:00Z", scoreSummary: { scoreOnTen: 6 + j * 0.5, percentage: 60 + j * 5, gradedItemCount: 4 + j, totalItemCount: 10 }, attendanceSummary: { presentCount: 5 - (j % 2), totalCount: 5, percentage: j % 2 ? 80 : 100 } })),
    lmsSyllabuses: () => [1, 2, 3].map(lmsSyllabusOf).map(({ id, name, code, educationLevelName, type, author, latestVersionNo, createdAt }) => ({ id, name, code, educationLevelName, type, author, latestVersionNo, createdAt })),
    lmsSyllabus: (id) => [1, 2, 3].map(lmsSyllabusOf).find((s) => s.id === id) ?? null,

    notifications: () => notis,
    unreadCount: () => state.controls.unreadOverride ?? notis.filter((n) => !n.read).length,
    markRead(id) {
      notis = notis.map((n) => (n.id === id ? { ...n, read: true } : n));
      return notis.find((n) => n.id === id) ?? null;
    },
    markAllRead() {
      notis = notis.map((n) => ({ ...n, read: true }));
    },

    users: () => Array.from({ length: state.controls.usersTotal }, (_, k) => mkUser(k + 1)),

    campaigns: () => campaigns,
    addCampaign(body) {
      const camp = { id: `mock-camp-new-${state.campaignsSent.length}`, title: body.title, message: body.message, audienceType: "SELECTED_USERS", status: "SUCCESS", createdAt: new Date(nowMs()).toISOString() };
      campaigns = [camp, ...campaigns];
      return camp;
    },

    // module thêm cho quyền sửa nội dung theo ticket (ticket-access); toast chỉ đếm theo status/assignedId nên không đổi hành vi cũ.
    ticketsFor: (userId) => [
      { id: "t1", status: "OPEN", assignedId: userId, module: "QUIZ" },
      { id: "t2", status: "OPEN", assignedId: "someone-else", module: "WRITING" },
      { id: "t3", status: "DONE", assignedId: userId, module: "FLASHCARD" },
      { id: "t4", status: "CLOSE", assignedId: userId, module: "GRAMMAR" },
    ],
  };
}
