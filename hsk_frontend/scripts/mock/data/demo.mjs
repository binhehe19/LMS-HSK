// Provider dữ liệu hồ sơ `demo` (MOCK / NOT INTEGRATED): một bộ dữ liệu GIẢ nhưng NHẤT QUÁN cho chế độ demo —
// giảng viên ↔ lớp được phân công ↔ buổi học ↔ học viên ↔ bài nộp/chấm bài, thông báo, chiến dịch, ticket, người dùng.
// Mọi con số hiển thị ở các màn (bài chờ chấm, điểm, số liệu tổng quan) được suy ra từ cùng tập dữ liệu này (grading-model.mjs).
// Không có dữ liệu cá nhân thật: tên/email/số điện thoại đều sinh từ danh sách giả, miền email `demo.invalid`.
import { DAY, isoDay, nowMs, state } from "../core.mjs";
import { createGradingStore, createRng } from "./grading-model.mjs";

const FIRST = ["An", "Bảo", "Châu", "Dũng", "Giang", "Hà", "Hùng", "Huyền", "Khánh", "Lan", "Linh", "Long", "Mai", "Minh", "My", "Nam", "Ngọc", "Nhung", "Phong", "Phúc", "Phương", "Quân", "Quỳnh", "Sơn", "Thảo", "Thành", "Thu", "Trang", "Trung", "Tú", "Tuấn", "Uyên", "Vy", "Yến"];
const MIDDLE = ["Văn", "Thị", "Minh", "Ngọc", "Hoàng", "Thu", "Quốc", "Gia", "Thanh", "Đức"];
const LAST = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
const LESSONS = ["第一课: 爱的细节", "第二课: 留串钥匙给父母", "第三课: 人生有选择，一切可改变", "第四课: 子路背米", "第五课: 济南的泉水", "第六课: 除夕的由来", "第七课: 成语故事", "第八课: 中国的节日", "第九课: 网上购物", "复习与测试"];
const TOPICS = ["Ngữ pháp: 把字句", "Từ vựng chủ đề gia đình", "Nghe hiểu hội thoại", "Đọc hiểu đoạn văn ngắn", "Viết đoạn 80 chữ", "Thành ngữ thường dùng", "Luyện phát âm thanh điệu", "Ôn tập giữa kỳ", "Dịch Hán–Việt", "Kiểm tra cuối khoá"];

const slug = (name) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, "");

export function createDemoProvider() {
  let d = build();
  const rebuild = () => {
    d = build();
  };

  function build() {
    const rng = createRng(20261027);
    const today = Math.floor(nowMs() / DAY) * DAY;
    const todayIso = isoDay(today);
    const name = () => `${rng.pick(LAST)} ${rng.pick(MIDDLE)} ${rng.pick(FIRST)}`;

    // ----- tài khoản demo đăng nhập được (khớp ROLE_PRESETS của core.mjs) -----
    const accounts = {
      admin: { id: "demo-admin", userCode: "AD001", email: "admin.demo@demo.invalid", fullName: "Trần Quốc Bảo", roles: ["ROLE_ADMIN"] },
      teacher: { id: "demo-teacher", userCode: "GV001", email: "giangvien.demo@demo.invalid", fullName: "Nguyễn Minh Anh", roles: ["ROLE_TEACHER"] },
      mentor: { id: "demo-mentor", userCode: "TG001", email: "trogiang.demo@demo.invalid", fullName: "Lê Thu Hà", roles: ["ROLE_MENTOR"] },
      "teacher-manager": { id: "demo-tm", userCode: "QL001", email: "quanly.demo@demo.invalid", fullName: "Phạm Gia Hưng", roles: ["ROLE_TEACHER_MANAGER"] },
      manager: { id: "demo-manager", userCode: "QL002", email: "manager.demo@demo.invalid", fullName: "Vũ Đức Long", roles: ["ROLE_MANAGER"] },
      collaborator: { id: "demo-collab", userCode: "CTV001", email: "ctv.demo@demo.invalid", fullName: "Đỗ Ngọc Yến", roles: ["ROLE_COLLABORATOR"] },
      user: { id: "demo-student", userCode: "HV0000", email: "hocvien.demo@demo.invalid", fullName: "Hoàng Thanh Tú", roles: ["ROLE_USER"] },
      none: { id: "demo-none", userCode: "X000", email: "none.demo@demo.invalid", fullName: "Tài khoản không có vai trò", roles: [] },
    };

    // ----- giảng viên (T1 = tài khoản teacher demo), khoá học -----
    const teachers = [
      { id: "demo-teacher", name: accounts.teacher.fullName, email: accounts.teacher.email, phone: "0901 234 001", status: "ACTIVE", specialty: "HSK 4–5", joinedAt: "2024-03-01" },
      { id: "t-02", name: "Chu Nguyễn Huyền My", email: "huyenmy.demo@demo.invalid", phone: "0901 234 002", status: "ACTIVE", specialty: "HSK 5–6", joinedAt: "2023-09-15" },
      { id: "t-03", name: "Lâm Thùy Dung", email: "thuydung.demo@demo.invalid", phone: "0901 234 003", status: "ACTIVE", specialty: "Giao tiếp", joinedAt: "2024-06-10" },
      { id: "t-04", name: "Nguyễn Hoàng Bảo Phụng", email: "baophung.demo@demo.invalid", phone: "0901 234 004", status: "INACTIVE", specialty: "HSK 3", joinedAt: "2022-11-20" },
    ];
    const mentor = { id: "demo-mentor", name: accounts.mentor.fullName, email: accounts.mentor.email };
    const courses = [
      { id: "c-h30", code: "H30", name: "HSK 3 — H30", level: "HSK 3", sessions: 10 },
      { id: "c-h40", code: "H40", name: "HSK 4 — H40", level: "HSK 4", sessions: 10 },
      { id: "c-h50", code: "H50", name: "HSK 5 — H50", level: "HSK 5", sessions: 10 },
      { id: "c-gt1", code: "GT1", name: "Giao tiếp 1 — GT1", level: "Sơ cấp", sessions: 10 },
      { id: "c-gt2", code: "GT2", name: "Giao tiếp 2 — GT2", level: "Trung cấp", sessions: 10 },
      { id: "c-lt4", code: "LT4", name: "Luyện thi HSK 4", level: "HSK 4", sessions: 10 },
    ];
    const courseOf = (id) => courses.find((c) => c.id === id);
    const teacherOf = (id) => teachers.find((t) => t.id === id);

    // ----- lớp: ngày tính theo hôm nay để luôn có lớp đang diễn ra / sắp mở / đã kết thúc -----
    const mkClass = (i, code, courseId, teacherId, startOffsetDays, lengthDays, over = {}) => {
      const start = today + startOffsetDays * DAY;
      const end = start + lengthDays * DAY;
      return { classId: `cls-${String(i).padStart(2, "0")}`, classCode: code, className: `Lớp ${code}`, courseId, teacherId, mentorId: null, scheduleDays: rng.pick(["2, 4, 6", "3, 5, 7", "2, 5", "4, 7"]), startTime: rng.pick(["18:00", "18:30", "19:00", "20:15", "08:30"]), duration: rng.pick([90, 90, 120, 60]), startMs: start, endMs: end, startDate: isoDay(start), endDate: isoDay(end), actualEndDate: undefined, ...over };
    };
    const classes = [
      mkClass(1, "H4006", "c-h40", "demo-teacher", -40, 90, { mentorId: "demo-mentor" }),
      mkClass(2, "GT2-003", "c-gt2", "demo-teacher", -20, 90, { mentorId: "demo-mentor" }),
      mkClass(3, "H5004", "c-h50", "demo-teacher", -120, 110, { actualEndDate: isoDay(today - 8 * DAY) }),
      mkClass(4, "H3002", "c-h30", "demo-teacher", 10, 90),
      mkClass(5, "H5005", "c-h50", "t-02", -60, 100),
      mkClass(6, "H5006", "c-h50", "t-02", -15, 100),
      mkClass(7, "GT1-015", "c-gt1", "t-03", -30, 60),
      mkClass(8, "GT1-016", "c-gt1", "t-03", 5, 60),
      mkClass(9, "LT4-001", "c-lt4", "t-02", -90, 80, { actualEndDate: isoDay(today - 12 * DAY) }),
      mkClass(10, "H3001", "c-h30", "t-04", -150, 90, { actualEndDate: isoDay(today - 55 * DAY) }),
      mkClass(11, "GT2-004", "c-gt2", "t-03", -5, 90),
      mkClass(12, "H4007", "c-h40", "t-02", 20, 90),
    ];
    const classById = (id) => classes.find((c) => c.classId === id);

    // ----- học viên và ghi danh -----
    const students = Array.from({ length: 40 }, (_, i) => {
      const n = name();
      return { userId: `hv-${String(i + 1).padStart(3, "0")}`, name: n, email: `${slug(n)}${i + 1}@demo.invalid`, phone: `09${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`, studentCode: `HV${String(i + 1).padStart(4, "0")}`, ability: 0.45 + rng.next() * 0.5, joinedAt: isoDay(today - rng.int(30, 400) * DAY) };
    });
    students[0].userId = "demo-student"; // tài khoản "Học viên" demo trùng với một học viên trong lớp của giảng viên demo
    students[0].name = accounts.user.fullName;
    students[0].email = accounts.user.email;
    const enrollments = new Map(); // classId -> student[]
    for (const c of classes) {
      const n = rng.int(6, 12);
      const picked = [...students].sort(() => rng.next() - 0.5).slice(0, n);
      if (c.classId === "cls-01" && !picked.includes(students[0])) picked[0] = students[0];
      enrollments.set(c.classId, picked);
    }
    const studentsOf = (classId) => enrollments.get(classId) ?? [];

    // ----- buổi học: 10 buổi, cách 3 ngày; buổi lẻ và buổi 10 có bài tập -----
    const sessions = [];
    for (const c of classes) {
      for (let i = 1; i <= 10; i++) {
        const dateMs = c.startMs + (i - 1) * 3 * DAY;
        sessions.push({ sessionId: `${c.classId}-s${i}`, syllabusScheduleId: `${c.classId}-sch${i}`, classId: c.classId, sessionNo: i, title: LESSONS[i - 1], topic: TOPICS[i - 1], date: isoDay(dateMs), dateMs, startTime: c.startTime, hasAssignment: i % 2 === 1 || i === 10 });
      }
    }
    const grading = createGradingStore({ rng, sessions, studentsOf, todayIso });

    // ----- thông báo theo tài khoản, chiến dịch, ticket -----
    const notifications = new Map(); // accountKey -> noti[]
    let notiSeq = 0;
    const mkNoti = (minutesAgo, title, message, targetUrl, read = false) => ({ id: `noti-${++notiSeq}`, topic: "GENERAL", title, message, resourceType: "", resourceId: "", payload: targetUrl ? { targetUrl } : null, read, seen: read, createdAt: new Date(nowMs() - minutesAgo * 60_000).toISOString(), readAt: null, seenAt: null });
    const teacherNotis = (ownerId) => {
      const own = classes.filter((c) => c.teacherId === ownerId || c.mentorId === ownerId).map((c) => c.classId);
      const recent = sessions.filter((s) => own.includes(s.classId)).flatMap((s) => grading.sessionAttempts(s.sessionId).filter((a) => a.gradingStatus === "SUBMITTED").map((a) => ({ a, s }))).slice(0, 5);
      const list = recent.map(({ a, s }, i) => {
        const st = students.find((x) => x.userId === a.userId);
        const c = classById(s.classId);
        return mkNoti(35 * (i + 1), `${st?.name ?? "Học viên"} đã nộp bài`, `Bài "${grading.quizzes.get(a.quizId).title}" — Buổi ${s.sessionNo}, lớp ${c.classCode}. Bài đang chờ chấm.`, `/instructor/list-class/submissions?classId=${c.classId}&courseId=${c.courseId}&scheduleId=${s.syllabusScheduleId}&title=${encodeURIComponent(`Buổi ${s.sessionNo}: ${s.title}`)}`, i >= 3);
      });
      const next = sessions.filter((s) => own.includes(s.classId) && s.dateMs >= today).sort((a, b) => a.dateMs - b.dateMs)[0];
      if (next) list.push(mkNoti(60 * 9, `Buổi ${next.sessionNo} lớp ${classById(next.classId).classCode} sắp diễn ra`, `${next.title} — ${next.date} ${next.startTime}. Nhớ kiểm tra tài liệu buổi học.`, "/instructor/list-class", true));
      list.push(mkNoti(60 * 30, "Chào mừng đến hệ thống LMS Học Bá", "Đây là dữ liệu demo. Mọi thao tác chỉ ảnh hưởng bộ dữ liệu giả lập trên máy này.", null, true));
      return list;
    };
    const adminNotis = () => [
      mkNoti(12, "Yêu cầu hỗ trợ mới", "Giảng viên Lâm Thùy Dung gửi yêu cầu hỗ trợ về tài liệu lớp GT1-015.", "/admin/tickets"),
      mkNoti(95, "Chiến dịch 'Lịch nghỉ lễ' đã gửi xong", "Đã gửi tới 612 người dùng, 0 lỗi.", "/admin/settings/notifications"),
      mkNoti(60 * 5, "Đồng bộ lớp học từ CMS hoàn tất", `${classes.length} lớp, ${students.length} học viên được cập nhật.`, "/admin/class-management", true),
      mkNoti(60 * 26, "3 giảng viên chưa cập nhật hồ sơ", "Vào Quản lý giảng viên để nhắc nhở.", "/admin/teacher-management", true),
    ];
    const resetNotifications = () => {
      notifications.clear();
      notifications.set("admin", adminNotis());
      notifications.set("teacher", teacherNotis("demo-teacher"));
      notifications.set("mentor", teacherNotis("demo-mentor"));
    };
    const notisOf = (s) => {
      if (!notifications.has(s.role)) notifications.set(s.role, [mkNoti(60 * 30, "Chào mừng đến hệ thống LMS Học Bá", "Đây là dữ liệu demo.", null, true)]);
      return notifications.get(s.role);
    };

    let campaigns = [];
    const resetCampaigns = () => {
      campaigns = [
        { id: "camp-5", title: "Lịch nghỉ lễ 30/4 – 1/5", message: "Trung tâm nghỉ từ 30/4 đến hết 1/5. Các lớp học bù theo thông báo của giảng viên.", audienceType: "ALL_USERS", status: "SUCCESS", createdAt: new Date(nowMs() - 95 * 60_000).toISOString() },
        { id: "camp-4", title: "Khai giảng lớp H3002", message: "Lớp H3002 khai giảng tuần tới, học viên vui lòng kiểm tra lịch.", audienceType: "SELECTED_USERS", status: "SUCCESS", createdAt: new Date(nowMs() - 2 * DAY).toISOString() },
        { id: "camp-3", title: "Bảo trì hệ thống", message: "Hệ thống bảo trì 23:00–01:00 ngày mai.", audienceType: "ALL_USERS", status: "PROCESSING", createdAt: new Date(nowMs() - 3 * DAY).toISOString() },
        { id: "camp-2", title: "Nhắc nộp bài tập tuần 3", message: "Các em còn thiếu bài tập tuần 3, hạn nộp Chủ nhật.", audienceType: "SELECTED_USERS", status: "SUCCESS", createdAt: new Date(nowMs() - 9 * DAY).toISOString() },
        { id: "camp-1", title: "Thử nghiệm gửi thông báo", message: "Chiến dịch thử, đã huỷ.", audienceType: "SELECTED_USERS", status: "FAILED", createdAt: new Date(nowMs() - 20 * DAY).toISOString() },
      ];
    };
    resetNotifications();
    resetCampaigns();

    const users = [
      ...Object.values(accounts).filter((a) => a.roles.length).map((a) => ({ id: a.id, email: a.email, fullName: a.fullName, roles: a.roles, status: "ACTIVE" })),
      ...teachers.filter((t) => t.id !== "demo-teacher").map((t) => ({ id: t.id, email: t.email, fullName: t.name, roles: ["ROLE_TEACHER"], status: t.status })),
      ...students.filter((s) => s.userId !== "demo-student").map((s) => ({ id: s.userId, email: s.email, fullName: s.name, roles: ["ROLE_USER"], status: "ACTIVE" })),
    ];

    return { rng, today, todayIso, accounts, teachers, mentor, courses, courseOf, teacherOf, classes, classById, students, studentsOf, sessions, grading, notisOf, resetNotifications, campaigns: () => campaigns, prependCampaign: (c) => (campaigns = [c, ...campaigns]), resetCampaigns, users };
  }

  // ----- hình dạng phản hồi -----
  const toGradingClass = (c) => {
    const t = d.teacherOf(c.teacherId);
    const course = d.courseOf(c.courseId);
    const pending = d.grading.classPendingCount(c.classId);
    return { classId: c.classId, classCode: c.classCode, className: c.className, courseId: c.courseId, courseName: course.name, teacherName: t?.name, teacherEmail: t?.email, assistantName: c.mentorId ? d.mentor.name : undefined, scheduleDays: c.scheduleDays, startTime: c.startTime, duration: c.duration, startDate: c.startDate, endDate: c.endDate, actualEndDate: c.actualEndDate, studentCount: d.studentsOf(c.classId).length, totalSessions: 10, ungradedCount: pending, hasPendingGrading: pending > 0, classStatus: c.actualEndDate || c.endMs < d.today ? "FINISHED" : c.startMs > d.today ? "UPCOMING" : "ONGOING" };
  };
  const toSchedule = (s) => ({ sessionId: s.sessionId, sessionNo: s.sessionNo, title: s.title, topic: s.topic, date: s.date, sessionDate: s.date, startTime: s.startTime, syllabusScheduleId: s.syllabusScheduleId, hasAssignment: s.hasAssignment, hasPendingGrading: d.grading.hasPendingGrading(s.sessionId), ungradedCount: d.grading.pendingCount(s.sessionId) });
  const DAYS = { "2": "MONDAY", "3": "TUESDAY", "4": "WEDNESDAY", "5": "THURSDAY", "6": "FRIDAY", "7": "SATURDAY", CN: "SUNDAY" };
  const endTimeOf = (start, minutes) => {
    const [h, m] = start.split(":").map(Number);
    const total = h * 60 + m + minutes;
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  /** ClassSummaryResponse của repo-lms (proxy ERP) suy từ lớp demo. */
  const toLmsClass = (c) => {
    const t = d.teacherOf(c.teacherId);
    const course = d.courseOf(c.courseId);
    return {
      id: c.classId, code: c.classCode, name: c.className, courseId: c.courseId, courseName: course.name, classType: "GROUP", track: "HSK", startDate: c.startDate,
      lifecycleStatus: c.actualEndDate || c.endMs < d.today ? "FINISHED" : c.startMs > d.today ? "UPCOMING" : "ONGOING", expectedSize: d.studentsOf(c.classId).length + 2,
      teacherId: c.teacherId, teacher: t ? { id: t.id, fullName: t.name, email: t.email, status: t.status, roles: ["ROLE_TEACHER"] } : undefined,
      schedulePatterns: c.scheduleDays.split(",").map((x) => x.trim()).map((day) => ({ dayOfWeek: DAYS[day] ?? day, startTime: c.startTime, endTime: endTimeOf(c.startTime, c.duration) })),
      educationLevelId: `lvl-${course.code}`, educationLevelCode: course.code, educationLevelName: course.level,
    };
  };

  const ownedClasses = (s) => {
    const me = d.accounts[s.role];
    return d.classes.filter((c) => c.teacherId === me.id || c.mentorId === me.id);
  };

  return {
    profile: "demo",
    reset: rebuild,
    resetNotifications: () => d.resetNotifications(),
    resetCampaigns: () => d.resetCampaigns(),
    /** Toàn bộ dữ liệu gốc cho các handler miền mới (teacher-management, dashboard...). */
    get raw() {
      return d;
    },

    me(s) {
      const a = d.accounts[s.role] ?? d.accounts.none;
      return { id: a.id, userCode: a.userCode, email: a.email, fullName: a.fullName, avatarUrl: null, roles: s.roles, emailVerified: true };
    },

    adminClasses: () => d.classes.map(toGradingClass),
    teacherClasses: (s) => ownedClasses(s).map(toGradingClass),
    ownsClass: (s, classId) => (ownedClasses(s).some((c) => c.classId === classId) ? { classId } : null),
    classSchedules: (classId) => d.sessions.filter((s) => s.classId === classId).map(toSchedule),
    /** Buổi học theo khoá `syllabusScheduleId` (query `scheduleId` của các màn kế tiếp) hoặc `sessionId`. */
    findSession: (scheduleId) => d.sessions.find((s) => s.syllabusScheduleId === scheduleId || s.sessionId === scheduleId) ?? null,
    classOf: (classId) => d.classById(classId) ?? null,
    studentsOf: (classId) => d.studentsOf(classId),
    grading: () => d.grading,

    notifications: (s) => d.notisOf(s),
    unreadCount: (s) => state.controls.unreadOverride ?? d.notisOf(s).filter((n) => !n.read).length,
    markRead(id, s) {
      const list = d.notisOf(s);
      const n = list.find((x) => x.id === id);
      if (n) {
        n.read = true;
        n.seen = true;
        n.readAt = new Date(nowMs()).toISOString();
      }
      return n ?? null;
    },
    markAllRead(s) {
      for (const n of d.notisOf(s)) {
        n.read = true;
        n.seen = true;
      }
    },

    users: () => d.users,

    campaigns: () => d.campaigns(),
    addCampaign(body) {
      const camp = { id: `camp-new-${state.campaignsSent.length}`, title: body.title, message: body.message, audienceType: "SELECTED_USERS", status: "SUCCESS", createdAt: new Date(nowMs()).toISOString() };
      d.prependCampaign(camp);
      // người nhận là tài khoản demo đăng nhập được => thấy ngay ở chuông thông báo của tài khoản đó
      for (const [role, a] of Object.entries(d.accounts)) {
        if (body.userIds.includes(a.id)) d.notisOf({ role }).unshift({ id: `noti-camp-${camp.id}-${role}`, topic: "CAMPAIGN", title: body.title, message: body.message, resourceType: "", resourceId: "", payload: null, read: false, seen: false, createdAt: camp.createdAt, readAt: null, seenAt: null });
      }
      return camp;
    },

    /** Học viên của lớp cho Admin theo hợp đồng HSK cũ (gộp bài làm mọi buổi). */
    adminClassStudents: (classId) => d.grading.classStudents(d.sessions.filter((s) => s.classId === classId).map((s) => s.sessionId), d.studentsOf(classId)),

    // ---- backend chung /api/lms (hình dạng DTO của repo-lms, suy từ cùng bộ dữ liệu) ----
    lmsClasses: () => d.classes.map(toLmsClass),
    lmsClass(classId) {
      const c = d.classById(classId);
      if (!c) return null;
      return { ...toLmsClass(c), syllabusId: `syl-${c.courseId}`, syllabusVersionNo: 2, syllabusName: `Giáo trình ${d.courseOf(c.courseId).name}`, meetingLink: `https://meet.example.invalid/${c.classCode.toLowerCase()}`, note: undefined, mentorId: c.mentorId ?? undefined, mentor: c.mentorId ? { id: d.mentor.id, fullName: d.mentor.name, email: d.mentor.email, status: "ACTIVE", roles: ["ROLE_MENTOR"] } : undefined, studentManager: { id: "qlhv-1", fullName: "Phạm Thu Trang", email: "qlhv.demo@demo.invalid", status: "ACTIVE" }, createdAt: new Date(c.startMs - 20 * DAY).toISOString() };
    },
    lmsSessions: (classId) => {
      const c = d.classById(classId);
      if (!c) return [];
      const t = d.teacherOf(c.teacherId);
      return d.sessions.filter((s) => s.classId === classId).map((s) => ({ id: s.sessionId, sessionNo: s.sessionNo, startAt: new Date(s.dateMs + 12 * 3_600_000).toISOString(), endAt: new Date(s.dateMs + 12 * 3_600_000 + c.duration * 60_000).toISOString(), teacherId: c.teacherId, teacher: t ? { id: t.id, fullName: t.name, email: t.email } : undefined, room: "Online", meetingLink: `https://meet.example.invalid/${c.classCode.toLowerCase()}`, status: s.dateMs < d.today ? "COMPLETED" : "PLANNED", percentCompleted: s.dateMs < d.today ? 100 : 0, note: s.topic }));
    },
    lmsEnrollments(classId) {
      const sessionIds = d.sessions.filter((s) => s.classId === classId).map((s) => s.sessionId);
      const summary = d.grading.classStudents(sessionIds, d.studentsOf(classId));
      const c = d.classById(classId);
      const pastSessions = d.sessions.filter((s) => s.classId === classId && s.dateMs < d.today).length;
      return summary.map((st, j) => {
        const graded = st.modules.filter((m) => m.submitted);
        const max = graded.reduce((sum, m) => sum + (m.maxScore || 0), 0);
        const score = graded.reduce((sum, m) => sum + (m.score || 0), 0);
        const pct = max ? Math.round((score / max) * 100) : undefined;
        const present = pastSessions ? Math.max(0, pastSessions - (j % 3)) : 0;
        return { id: `enr-${classId}-${j + 1}`, studentId: st.userId, studentFullName: st.name, studentEmail: st.email, studentUserCode: st.studentCode, studentPhone: st.phone, status: "ENROLLED", enrolledAt: new Date(c.startMs - 7 * DAY).toISOString(), scoreSummary: { scoreOnTen: pct === undefined ? undefined : Math.round(pct) / 10, percentage: pct, gradedItemCount: graded.length, totalItemCount: st.modules.length }, attendanceSummary: pastSessions ? { presentCount: present, totalCount: pastSessions, percentage: Math.round((present / pastSessions) * 100) } : undefined };
      });
    },
    lmsSyllabuses: () => d.courses.map((c) => ({ id: `syl-${c.id}`, name: `Giáo trình ${c.name}`, code: `GT-${c.code}`, educationLevelName: c.level, type: "STANDARD", author: "Tổ chuyên môn Học Bá", latestVersionNo: 2, createdAt: "2026-01-15T08:00:00Z" })),
    lmsSyllabus(id) {
      const c = d.courses.find((x) => `syl-${x.id}` === id);
      if (!c) return null;
      return {
        id, name: `Giáo trình ${c.name}`, code: `GT-${c.code}`, educationLevelName: c.level, type: "STANDARD", author: "Tổ chuyên môn Học Bá", latestVersionNo: 2, createdAt: "2026-01-15T08:00:00Z", status: "PUBLISHED", updatedAt: "2026-06-01T08:00:00Z",
        description: `Giáo trình ${c.name}: 10 buổi, mỗi buổi 90–120 phút, kết hợp nghe – đọc – viết – nói.`, trainingProgram: "Tiếng Trung tổng quát", prerequisite: c.level === "HSK 3" ? "Hoàn thành HSK 2" : "Theo xếp lớp", distributionHours: "20 giờ lý thuyết · 10 giờ thực hành", teachingMethods: "Giao tiếp, nhiệm vụ, lớp học đảo ngược", minimumPassingScore: 60, scoreRange: "0–100",
        clo: [{ id: `${id}-clo1`, code: "CLO1", name: "Nghe hiểu hội thoại", description: "Nghe hiểu hội thoại thường ngày theo cấp độ" }, { id: `${id}-clo2`, code: "CLO2", name: "Đọc hiểu đoạn văn", description: "Đọc hiểu đoạn văn 150–300 chữ" }, { id: `${id}-clo3`, code: "CLO3", name: "Viết đoạn ngắn", description: "Viết đoạn 80–120 chữ đúng ngữ pháp" }],
        materials: [{ id: `${id}-m1`, title: `HSK Standard Course — ${c.level}`, type: "Giáo trình chính", author: "Jiang Liping", publisher: "BLCUP", year: 2015 }, { id: `${id}-m2`, title: "Sổ tay ngữ pháp Học Bá", type: "Tài liệu bổ trợ", author: "Tổ chuyên môn", publisher: "Nội bộ", year: 2026 }],
        schedule: Array.from({ length: 10 }, (_, i) => ({ id: `${id}-sch-${i + 1}`, topic: `Buổi ${i + 1}: ${LESSONS[i]}`, content: TOPICS[i], delivery: "Trực tuyến", sessionLo: `Hoàn thành mục tiêu buổi ${i + 1}`, coreCloId: [`${id}-clo${(i % 3) + 1}`], studentMaterials: [{ materialTitle: `Slide buổi ${i + 1}`, materialLink: "#" }], teacherMaterials: [{ materialTitle: `Giáo án buổi ${i + 1}`, materialLink: "#" }], moduleOnLuyen: i % 2 === 0 || i === 9 ? [{ moduleType: "QUIZ", moduleContent: `Bài tập buổi ${i + 1}` }] : [], studentTasks: "Làm bài tập về nhà trước buổi kế tiếp", teacherTasks: "Chấm và trả bài trong 3 ngày" })),
        gradingStructure: [{ id: `${id}-gs1`, item: "Chuyên cần", type: "Điểm danh", weight: 10 }, { id: `${id}-gs2`, item: "Bài tập", type: "Bài tập về nhà", weight: 30 }, { id: `${id}-gs3`, item: "Cuối khoá", type: "Bài kiểm tra", weight: 60 }],
        testTemplate: { midtermFormat: "Trắc nghiệm 40 câu", finalFormat: "Nghe – Đọc – Viết theo cấu trúc HSK" },
        versions: [{ id: `${id}-v1`, versionNo: 1, status: "ARCHIVED", publishedAt: "2026-01-15T08:00:00Z", publishedBy: "admin.demo" }, { id: `${id}-v2`, versionNo: 2, status: "PUBLISHED", publishedAt: "2026-06-01T08:00:00Z", publishedBy: "admin.demo", changeNote: "Cập nhật buổi 7–10, thêm đề luyện" }],
      };
    },

    /**
     * Ticket phân công (danh sách cho toast + quyền sửa nội dung theo module). Giảng viên demo: WRITING, QUIZ đang mở và FLASHCARD đã báo cáo
     * => được sửa Hán tự / Bài tập / Thẻ ghi nhớ, các module khác chỉ xem; Mentor demo: GRAMMAR. Admin thấy toàn bộ.
     */
    ticketsFor() {
      return [
        { id: "tk-101", status: "OPEN", assignedId: "demo-teacher", module: "WRITING", description: "Bổ sung bộ luyện viết HSK 4 bài 7–10", createdAt: new Date(nowMs() - 2 * DAY).toISOString() },
        { id: "tk-102", status: "OPEN", assignedId: "demo-teacher", module: "QUIZ", description: "Soạn bài tập nghe cho lớp H4006", createdAt: new Date(nowMs() - 5 * DAY).toISOString() },
        { id: "tk-103", status: "DONE", assignedId: "demo-teacher", module: "FLASHCARD", description: "Thẻ ghi nhớ từ vựng bài 1–6", createdAt: new Date(nowMs() - 12 * DAY).toISOString() },
        { id: "tk-104", status: "OPEN", assignedId: "demo-mentor", module: "GRAMMAR", description: "Rà soát điểm ngữ pháp HSK 3", createdAt: new Date(nowMs() - 3 * DAY).toISOString() },
        { id: "tk-105", status: "OPEN", assignedId: "t-02", module: "PRONUNCIATION", description: "Thu âm mẫu phát âm bài 5", createdAt: new Date(nowMs() - 1 * DAY).toISOString() },
        { id: "tk-106", status: "CLOSE", assignedId: "demo-teacher", module: "DICTIONARY", description: "Bổ sung từ điển HSK 5 (đã đóng)", createdAt: new Date(nowMs() - 30 * DAY).toISOString() },
        { id: "tk-107", status: "OPEN", assignedId: "demo-teacher", module: "OTHER", description: "Bổ sung module ôn luyện cho giáo trình HSK 4 (buổi 7–10)", createdAt: new Date(nowMs() - 4 * DAY).toISOString() },
      ];
    },
  };
}
