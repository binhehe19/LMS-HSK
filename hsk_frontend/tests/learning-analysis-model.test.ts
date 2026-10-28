import { describe, expect, it } from "vitest";
import {
  attendanceChipText,
  attendanceLabel,
  attendanceTone,
  buildAssignments,
  countDone,
  filterStudents,
  formatScore,
  groupAssignments,
  learningAnalysisDetailHref,
  learningAnalysisListHref,
  lessonListHref,
  normalizeAttendanceAnalysis,
  skillChartSpec,
  skillScores,
  toTeacherNote,
  trendChartSpec,
} from "@/lib/learning-analysis/learning-analysis-model";
import { paramNoticeText, readDetailParams, readListParams } from "@/lib/learning-analysis/learning-analysis-params";
import {
  canApproveReport,
  canGenerateHistorical,
  EMPTY_PERSONALIZATION,
  groupPersonalizationTasks,
  humanSummary,
  insufficientMessage,
  isHistoricalInsufficient,
  normalizePersonalizationView,
  scopedPersonalizationTasks,
  taskStatusClass,
  taskStatusLabel,
} from "@/lib/learning-analysis/personalization-model";
import type { PersonalizationTask } from "@/types/learning-analysis";
import { attemptsFixture, lessonFixture, personalizationApprovedFixture, personalizationDraftFixture, studentsFixture } from "./fixtures/learning-analysis";

const getter = (q: Record<string, string | undefined>) => (name: string) => q[name] ?? null;

describe("tham số URL (hợp đồng query cũ, kiểm tra an toàn trước khi gọi API)", () => {
  it("danh sách: classId + scheduleId bắt buộc; courseId/title tuỳ chọn và được cắt khoảng trắng", () => {
    expect(readListParams(getter({ classId: " 60 ", scheduleId: "sch-1", courseId: "7", title: " Buổi 1 " }))).toEqual({ kind: "ok", params: { classId: "60", scheduleId: "sch-1", courseId: "7", title: "Buổi 1" } });
    expect(readListParams(getter({ classId: "60", scheduleId: "sch-1" }))).toEqual({ kind: "ok", params: { classId: "60", scheduleId: "sch-1", courseId: "", title: "" } });
  });

  it.each([
    [{ scheduleId: "sch-1" }, { kind: "missing", param: "classId" }],
    [{ classId: "60" }, { kind: "missing", param: "scheduleId" }],
    [{ classId: "60", scheduleId: "   " }, { kind: "missing", param: "scheduleId" }],
    [{ classId: "../admin", scheduleId: "sch-1" }, { kind: "invalid", param: "classId" }],
    [{ classId: "60", scheduleId: "a?b" }, { kind: "invalid", param: "scheduleId" }],
  ])("danh sách %j => %j (không gọi API)", (q, expected) => {
    expect(readListParams(getter(q))).toEqual(expected);
  });

  it("chi tiết: thêm userId bắt buộc và studentName hiển thị; studentEmail KHÔNG được đọc", () => {
    const ok = readDetailParams(getter({ classId: "60", scheduleId: "sch-1", userId: "u-1", studentName: "An", studentEmail: "an@demo.invalid", courseId: "7", title: "B1" }));
    expect(ok).toEqual({ kind: "ok", params: { classId: "60", scheduleId: "sch-1", userId: "u-1", courseId: "7", title: "B1", studentName: "An" } });
    expect(JSON.stringify(ok)).not.toContain("studentEmail");
    expect(readDetailParams(getter({ classId: "60", scheduleId: "sch-1" }))).toEqual({ kind: "missing", param: "userId" });
    expect(readDetailParams(getter({ classId: "60", scheduleId: "sch-1", userId: "a/b" }))).toEqual({ kind: "invalid", param: "userId" });
  });

  it("câu thông báo nêu đúng tham số và màn cần quay lại", () => {
    expect(paramNoticeText({ kind: "missing", param: "userId" }, "Phân tích học tập")).toBe('Thiếu mã học viên (userId) trong đường dẫn. Hãy quay lại "Phân tích học tập" và chọn lại.');
    expect(paramNoticeText({ kind: "invalid", param: "classId" }, "Danh sách bài học")).toContain("Không hợp lệ: mã lớp (classId)");
  });
});

describe("buildAssignments — ghép quiz của buổi với bài làm đã nộp (như getAssignments cũ)", () => {
  it("quiz có bài nộp => DONE với finalScore/totalPoints/gradingStatus; chưa nộp => NOT_STARTED; bài tập không có quizId bị bỏ", () => {
    expect(buildAssignments(lessonFixture, attemptsFixture)).toEqual([
      { quizId: "quiz-l", label: "一、听力 — 判断对错", groupLabel: "#1 Quiz - Nghe", status: "DONE", score: 7, maxScore: 10, gradingStatus: "GRADED" },
      { quizId: "quiz-r", label: "二、阅读 — 阅读理解", groupLabel: "#2 Quiz - Đọc", status: "NOT_STARTED", score: undefined, maxScore: undefined, gradingStatus: undefined },
    ]);
  });

  it("chưa chốt điểm => dùng autoScore; tên bài trống => 'Bài quiz'; hai bài làm cùng quiz => lấy bài đầu; modules thiếu => rỗng", () => {
    const lesson = { modules: [{ id: "m", label: "M", exercises: [{ quizId: "q1" }] }] };
    expect(buildAssignments(lesson, [{ attemptId: "a1", quizId: "q1", autoScore: 3, totalPoints: 5 }, { attemptId: "a2", quizId: "q1", autoScore: 5, totalPoints: 5 }])).toEqual([{ quizId: "q1", label: "Bài quiz", groupLabel: "M", status: "DONE", score: 3, maxScore: 5, gradingStatus: undefined }]);
    expect(buildAssignments({ modules: [] }, [])).toEqual([]);
  });

  it("groupAssignments giữ thứ tự xuất hiện, thiếu nhãn => 'Khác'; countDone đếm DONE", () => {
    const items = buildAssignments(lessonFixture, attemptsFixture);
    const groups = groupAssignments([...items, { quizId: "x", label: "Lẻ", status: "NOT_STARTED" }]);
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([["#1 Quiz - Nghe", 1], ["#2 Quiz - Đọc", 1], ["Khác", 1]]);
    expect(countDone(items)).toBe(1);
  });
});

describe("skillScores — điểm theo kỹ năng của buổi (học viên vs trung bình lớp)", () => {
  it("phần trăm làm tròn; chỉ kỹ năng học viên đã nộp; trung bình lớp tính trên mọi bài đã nộp cùng kỹ năng", () => {
    expect(skillScores(studentsFixture, "u-1")).toEqual([{ skill: "LISTENING", skillLabel: "Nghe", studentScore: 70, classAverageScore: 80 }]);
    expect(skillScores(studentsFixture, "u-2")).toEqual([
      { skill: "LISTENING", skillLabel: "Nghe", studentScore: 90, classAverageScore: 80 },
      { skill: "READING", skillLabel: "Đọc", studentScore: 50, classAverageScore: 50 },
    ]);
    expect(skillScores(studentsFixture, "u-3")).toEqual([]); // chưa nộp gì
  });

  it("kỹ năng lạ giữ mã làm nhãn; thiếu skillType bị bỏ; điểm không phải số coi là 0", () => {
    const students = [{ userId: "u", modules: [{ moduleId: "a", label: "x", skillType: "CALLIGRAPHY", submitted: true, score: Number.NaN, maxScore: 4 }, { moduleId: "b", label: "y", submitted: true, score: 4, maxScore: 4 }] }];
    expect(skillScores(students, "u")).toEqual([{ skill: "CALLIGRAPHY", skillLabel: "CALLIGRAPHY", studentScore: 0, classAverageScore: 0 }]);
  });
});

describe("chuyên cần — chuẩn hoá phản hồi và nhãn/màu", () => {
  it("không phải object => null (lỗi hợp đồng); thiếu trend/log => rỗng", () => {
    expect(normalizeAttendanceAnalysis(null)).toBeNull();
    expect(normalizeAttendanceAnalysis([])).toBeNull();
    expect(normalizeAttendanceAnalysis({})).toEqual({ trend: [], log: [] });
  });

  it("tỷ lệ không phải số => null (điểm trống, không phải 0%); nhãn thiếu => 'Buổi N'; trạng thái in hoa; log thiếu nhãn dùng sessionNo", () => {
    expect(normalizeAttendanceAnalysis({ trend: [{ sessionNo: 2, studentRate: "80", classAverageRate: 75.5 }, { sessionLabel: "Buổi X" }], log: [{ sessionNo: 2, status: "present", date: "2026-10-01" }, { status: "ABSENT", note: "" }] })).toEqual({
      trend: [
        { sessionNo: 2, sessionLabel: "Buổi 2", studentRate: null, classAverageRate: 75.5 },
        { sessionNo: 2, sessionLabel: "Buổi X", studentRate: null, classAverageRate: null },
      ],
      log: [
        { sessionLabel: "Buổi 2", date: "2026-10-01", status: "PRESENT", note: undefined },
        { sessionLabel: "-", date: undefined, status: "ABSENT", note: undefined },
      ],
    });
  });

  it("nhãn tiếng Việt cho 4 trạng thái, giá trị lạ hiển thị nguyên văn; màu theo 3 nhánh; chữ ô vuông là số buổi", () => {
    expect(["PRESENT", "ABSENT", "LATE", "EXCUSED", "REMOTE"].map(attendanceLabel)).toEqual(["Có mặt", "Vắng", "Đi muộn", "Nghỉ có phép", "REMOTE"]);
    expect(["PRESENT", "ABSENT", "LATE", "EXCUSED", "REMOTE"].map(attendanceTone)).toEqual(["good", "bad", "warning", "warning", "warning"]);
    expect(attendanceChipText("Buổi 12")).toBe("12");
    expect(attendanceChipText("Khai giảng")).toBe("?");
  });

  it("formatScore: nguyên giữ nguyên, lẻ 2 chữ số, thiếu => '-'", () => {
    expect([formatScore(7), formatScore(7.5), formatScore(null), formatScore(undefined)]).toEqual(["7", "7.50", "-", "-"]);
  });
});

describe("toTeacherNote — nhận xét gần nhất", () => {
  it.each([[null], [undefined], [{}], [{ success: true, data: null }], ["x"], [{ content: 5 }]])("%j => null (chưa có nhận xét)", (raw) => {
    expect(toTeacherNote(raw)).toBeNull();
  });

  it("object có content => nhận xét, bỏ sentAt/author rỗng", () => {
    expect(toTeacherNote({ content: "Tốt", sentAt: "2026-10-27T08:00:00Z", author: "" })).toEqual({ content: "Tốt", sentAt: "2026-10-27T08:00:00Z", author: undefined });
  });
});

describe("cấu hình biểu đồ (ApexCharts) — màu HSK cũ, trung bình lớp nét đứt", () => {
  it("xu hướng chuyên cần: line, nhãn buổi làm trục x, dữ liệu giữ null, 2 series, nét đứt cho series thứ hai", () => {
    const spec = trendChartSpec([
      { sessionNo: 1, sessionLabel: "Buổi 1", studentRate: 100, classAverageRate: 90 },
      { sessionNo: 2, sessionLabel: "Buổi 2", studentRate: null, classAverageRate: 85 },
    ]);
    expect(spec.options.chart?.type).toBe("line");
    expect(spec.options.xaxis?.categories).toEqual(["Buổi 1", "Buổi 2"]);
    expect(spec.options.colors).toEqual(["#b10019", "#9a9690"]);
    expect(spec.options.stroke?.dashArray).toEqual([0, 5]);
    expect(spec.series).toEqual([
      { name: "Học viên", data: [100, null] },
      { name: "Trung bình lớp", data: [90, 85] },
    ]);
  });

  it("điểm kỹ năng: bar 0–100%, nhãn kỹ năng làm trục x", () => {
    const spec = skillChartSpec([{ skill: "LISTENING", skillLabel: "Nghe", studentScore: 70, classAverageScore: 80 }]);
    expect(spec.options.chart?.type).toBe("bar");
    expect(spec.options.xaxis?.categories).toEqual(["Nghe"]);
    expect(spec.series).toEqual([
      { name: "Học viên", data: [70] },
      { name: "Trung bình lớp", data: [80] },
    ]);
  });
});

describe("danh sách học viên — tìm kiếm và liên kết", () => {
  it("tìm theo tên/email/mã (không phân biệt hoa thường); rỗng => bản sao toàn bộ", () => {
    expect(filterStudents(studentsFixture, "BÌNH").map((s) => s.userId)).toEqual(["u-2"]);
    expect(filterStudents(studentsFixture, "demo.invalid").map((s) => s.userId)).toEqual(["u-1", "u-2"]);
    expect(filterStudents(studentsFixture, "hv0001").map((s) => s.userId)).toEqual(["u-1"]);
    const all = filterStudents(studentsFixture, "  ");
    expect(all).toEqual(studentsFixture);
    expect(all).not.toBe(studentsFixture);
  });

  it("liên kết giữ nguyên hợp đồng query cũ và mã hoá tham số", () => {
    const base = { classId: "60", courseId: "c 1", scheduleId: "sch-1", title: "Buổi 1 & 2" };
    expect(learningAnalysisDetailHref(base, studentsFixture[0])).toBe(
      "/instructor/list-class/learning-analysis/detail?scheduleId=sch-1&userId=u-1&studentEmail=an%40demo.invalid&classId=60&courseId=c%201&title=Bu%E1%BB%95i%201%20%26%202&studentName=Nguy%E1%BB%85n%20V%C4%83n%20An",
    );
    expect(learningAnalysisDetailHref(base, studentsFixture[2])).toContain("studentEmail=&");
    expect(learningAnalysisListHref(base)).toBe("/instructor/list-class/learning-analysis?classId=60&courseId=c%201&scheduleId=sch-1&title=Bu%E1%BB%95i%201%20%26%202");
    expect(lessonListHref("60", "")).toBe("/instructor/list-class/list-lesson?classId=60&courseId=");
  });
});

describe("cá nhân hoá — chuẩn hoá phản hồi và logic panel", () => {
  it("không phải object => không khả dụng; mảng được bảo đảm; report/snapshot thiếu id => null", () => {
    expect(normalizePersonalizationView("")).toEqual(EMPTY_PERSONALIZATION);
    expect(normalizePersonalizationView({ available: true, tasks: "x", recommendations: [{ label: "A" }, 3], report: { state: "DRAFT" }, historicalSnapshot: { id: "s", weakAreas: [{ label: "L" }, { nope: 1 }] } })).toEqual({
      available: true,
      dataSufficiency: "UNKNOWN",
      dataSufficiencyMessage: null,
      report: null,
      historicalSnapshot: { id: "s", version: 1, generatedAt: undefined, dataSufficiency: undefined, weakAreas: [{ label: "L", mastery: undefined }] },
      recommendations: [{ label: "A", reason: undefined, status: undefined }],
      tasks: [],
      currentTasks: [],
    });
    expect(normalizePersonalizationView(personalizationDraftFixture).report?.id).toBe("rep-1");
  });

  it("nhóm bài tập theo sessionCode của materialUrl (không phân biệt hoa thường); thiếu URL => mỗi bài một nhóm; URL hỏng giữ riêng", () => {
    const groups = groupPersonalizationTasks(personalizationApprovedFixture.tasks);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("session:CNH-1");
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["task-1", "task-2"]);
    const loose: PersonalizationTask[] = [
      { id: "a", title: "A", status: "ASSIGNED" },
      { id: "b", title: "B", status: "ASSIGNED", materialUrl: "http://[bad" },
      { id: "c", title: "C", status: "ASSIGNED", materialUrl: "https://x.invalid/p" },
    ];
    expect(groupPersonalizationTasks(loose).map((g) => g.key)).toEqual(["task:a", "url:http://[bad", "url:https://x.invalid/p"]);
  });

  it("scopedPersonalizationTasks: ưu tiên tasks; currentTasks lọc theo buổi/snapshot; bài không có scope chỉ giữ khi nguồn là tasks", () => {
    expect(scopedPersonalizationTasks(personalizationApprovedFixture, "sch-1").map((t) => t.id)).toEqual(["task-1", "task-2"]);
    const view = {
      ...personalizationDraftFixture,
      tasks: [],
      currentTasks: [
        { id: "k1", title: "K1", status: "ASSIGNED", sourceLmsScheduleId: "sch-1" },
        { id: "k2", title: "K2", status: "ASSIGNED", sourceLmsScheduleId: "sch-9" },
        { id: "k3", title: "K3", status: "ASSIGNED", sourceSnapshotId: "snap-1" },
        { id: "k4", title: "K4", status: "ASSIGNED" },
      ],
    };
    expect(scopedPersonalizationTasks(view, "sch-1").map((t) => t.id)).toEqual(["k1", "k3"]);
    expect(scopedPersonalizationTasks({ ...view, tasks: [{ id: "t", title: "T", status: "ASSIGNED" }] }, "sch-1").map((t) => t.id)).toEqual(["t"]);
  });

  it("tóm tắt kỹ thuật (snapshot/KC/confidence...) bị thay bằng câu đếm nội dung cần luyện", () => {
    expect(humanSummary(personalizationDraftFixture)).toBe("Học viên nên luyện thêm phần đọc hiểu đoạn văn.");
    expect(humanSummary({ ...personalizationDraftFixture, report: { id: "r", state: "DRAFT", summary: "Snapshot v2, KC mastery low, confidence 0.3" } })).toBe("Kết quả học tập đến buổi này cho thấy học viên nên luyện thêm 1 nội dung dưới đây.");
    expect(humanSummary({ ...personalizationDraftFixture, report: { id: "r", state: "DRAFT", summary: "policy applied" }, historicalSnapshot: { id: "s", version: 1, weakAreas: [] } })).toBe("Chưa có nội dung cần chú ý được ghi nhận cho buổi học này.");
  });

  it("điều kiện nút Tạo/Duyệt và thông điệp thiếu dữ liệu", () => {
    expect(canGenerateHistorical(personalizationDraftFixture)).toBe(false);
    expect(canGenerateHistorical({ ...EMPTY_PERSONALIZATION, available: true })).toBe(true);
    expect(canGenerateHistorical(EMPTY_PERSONALIZATION)).toBe(false); // không khả dụng
    expect(canApproveReport(personalizationDraftFixture)).toBe(true);
    expect(canApproveReport(personalizationApprovedFixture)).toBe(false);
    const insufficient = { ...personalizationDraftFixture, dataSufficiency: "INSUFFICIENT", dataSufficiencyMessage: "Mới có 2 câu." , historicalSnapshot: { id: "s", version: 1, dataSufficiency: { insufficient_data: true }, weakAreas: [] } };
    expect(isHistoricalInsufficient(insufficient)).toBe(true);
    expect(canApproveReport(insufficient)).toBe(false);
    expect(insufficientMessage(insufficient)).toBe("Mới có 2 câu.");
    expect(insufficientMessage({ ...insufficient, dataSufficiencyMessage: null })).toBe("Chưa đủ dữ liệu để AI đưa ra nhận xét đáng tin cậy.");
    expect(isHistoricalInsufficient({ ...personalizationDraftFixture, dataSufficiency: "INSUFFICIENT", historicalSnapshot: null })).toBe(false); // chưa có snapshot thì không nói "thiếu dữ liệu"
  });

  it("nhãn/màu trạng thái bài tập", () => {
    expect(["ASSIGNED", "in_progress", "COMPLETED", "APPROVED", "DRAFT", "", "ODD"].map((s) => taskStatusLabel(s))).toEqual(["Đã giao", "Đang học", "Đã hoàn thành", "Đã duyệt", "Bản nháp", "Đang cập nhật", "ODD"]);
    expect(taskStatusClass("COMPLETED")).toContain("text-success");
    expect(taskStatusClass("ASSIGNED")).toContain("text-primary");
    expect(taskStatusClass("IN_PROGRESS")).toContain("text-warning-emphasis");
    expect(taskStatusClass(undefined)).toBe("bg-light text-muted");
  });
});
