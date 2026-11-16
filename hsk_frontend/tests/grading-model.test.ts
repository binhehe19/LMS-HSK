import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGradingMatchText, selectedOptionIds, studentBlankAnswer, studentChunkOrder, studentPairMap, textify } from "@/lib/grading/answer-display";
import { isImageMedia, mediaUrl } from "@/lib/grading/grading-media";
import { checkGradingParams, checkRequiredId, gradingWorkspaceHref, lessonListHref, readText, submissionsHref } from "@/lib/grading/grading-params";
import {
  buildSendPlan,
  defaultDraft,
  draftDiffersFromSaved,
  draftKeyOf,
  flattenQuestions,
  formatSectionName,
  groupFlatQuestions,
  moduleAfterGrading,
  moduleAfterSending,
  modulesFromSummaries,
  parseDraftScore,
  resolveDraftScoreNumber,
  sortModules,
  totalMaxScoreOf,
} from "@/lib/grading/grading-workspace-model";
import * as lesson from "@/lib/grading/lesson-detail-model";
import { filterAndSortStudents, initials, studentBookTone, studentDisplayName, submittedMaxScore } from "@/lib/grading/submission-model";
import type { GradingAttemptDetailResponse, GradingAttemptQuestion, GradingAttemptSummaryResponse, GradingStudentModuleResponse, GradingStudentResponse, LessonDetailResponse } from "@/types/grading";

afterEach(() => vi.unstubAllEnvs());

describe("tham số URL (grading-params)", () => {
  it("checkRequiredId: cùng quy tắc với checkClassId (thiếu => missing; ký tự nguy hiểm => invalid)", () => {
    expect(checkRequiredId(" cls-01-sch1 ")).toEqual({ kind: "ok", id: "cls-01-sch1" });
    expect(checkRequiredId("")).toEqual({ kind: "missing" });
    expect(checkRequiredId("a/b")).toEqual({ kind: "invalid" });
    expect(checkRequiredId("..")).toEqual({ kind: "invalid" });
  });

  it("checkGradingParams: kiểm theo thứ tự lớp → buổi → học viên; userId chỉ bắt buộc khi được truyền", () => {
    expect(checkGradingParams({ classId: "60", scheduleId: "s1" })).toEqual({ kind: "ok", classId: "60", scheduleId: "s1", userId: "" });
    expect(checkGradingParams({ classId: "60", scheduleId: "s1", userId: "hv1" })).toEqual({ kind: "ok", classId: "60", scheduleId: "s1", userId: "hv1" });
    expect(checkGradingParams({ classId: null, scheduleId: "s1" })).toEqual({ kind: "notice", notice: "missing-class" });
    expect(checkGradingParams({ classId: "a?b", scheduleId: null })).toEqual({ kind: "notice", notice: "invalid-class" });
    expect(checkGradingParams({ classId: "60", scheduleId: "" })).toEqual({ kind: "notice", notice: "missing-schedule" });
    expect(checkGradingParams({ classId: "60", scheduleId: "a#b" })).toEqual({ kind: "notice", notice: "invalid-schedule" });
    expect(checkGradingParams({ classId: "60", scheduleId: "s1", userId: null })).toEqual({ kind: "notice", notice: "missing-user" });
    expect(checkGradingParams({ classId: "60", scheduleId: "s1", userId: "a\\b" })).toEqual({ kind: "notice", notice: "invalid-user" });
  });

  it("liên kết giữ đúng contract query cũ và mã hoá tham số", () => {
    expect(readText(null)).toBe("");
    expect(readText("  Buổi 1 ")).toBe("Buổi 1");
    expect(lessonListHref("c 1", "k&1")).toBe("/instructor/list-class/list-lesson?classId=c%201&courseId=k%261");
    expect(submissionsHref({ classId: "60", courseId: "7", scheduleId: "syl1", title: "Bài 1: A/B?" })).toBe("/instructor/list-class/submissions?classId=60&courseId=7&scheduleId=syl1&title=B%C3%A0i%201%3A%20A%2FB%3F");
    expect(gradingWorkspaceHref({ scheduleId: "syl1", userId: "hv 1", classId: "60", courseId: "", title: "Bài 1", studentName: "Nguyễn A" })).toBe(
      "/instructor/list-class/grading?scheduleId=syl1&userId=hv%201&classId=60&courseId=&title=B%C3%A0i%201&view=detail&studentName=Nguy%E1%BB%85n%20A",
    );
  });
});

describe("mediaUrl (grading-media)", () => {
  it("chưa cấu hình kho lưu trữ => null (không bịa URL); URL tuyệt đối/đường dẫn gốc giữ nguyên", () => {
    vi.stubEnv("NEXT_PUBLIC_STORAGE_API_BASE_PATH", "");
    expect(mediaUrl("01KXF9S")).toBeNull();
    expect(mediaUrl("")).toBeNull();
    expect(mediaUrl(undefined)).toBeNull();
    expect(mediaUrl("https://cdn.example.test/a.mp3")).toBe("https://cdn.example.test/a.mp3");
    expect(mediaUrl("/api/storage/file/x")).toBe("/api/storage/file/x");
  });

  it("đã cấu hình => {base}/file/{id}?disposition=inline, id được mã hoá, base bỏ '/' cuối", () => {
    vi.stubEnv("NEXT_PUBLIC_STORAGE_API_BASE_PATH", "/api/storage/");
    expect(mediaUrl("01KXF9S")).toBe("/api/storage/file/01KXF9S?disposition=inline");
    expect(mediaUrl("a b")).toBe("/api/storage/file/a%20b?disposition=inline");
  });

  it("isImageMedia theo phần mở rộng ảnh", () => {
    expect(isImageMedia("x.PNG")).toBe(true);
    expect(isImageMedia("https://h/x.webp?v=1")).toBe(true);
    expect(isImageMedia("x.mp3")).toBe(false);
    expect(isImageMedia("01KXF9S")).toBe(false);
  });
});

describe("đọc câu trả lời học viên (answer-display)", () => {
  it("textify: chuỗi/số, mảng nối bằng ', ', object lấy answer/value/text/content/id, còn lại JSON", () => {
    expect(textify(null)).toBe("");
    expect(textify(3)).toBe("3");
    expect(textify(["a", { value: "b" }, ""])).toBe("a, b");
    expect(textify({ content: "c" })).toBe("c");
    expect(textify({ foo: 1 })).toBe('{"foo":1}');
  });

  it("selectedOptionIds: chuỗi, mảng, mảng object, object selectedOptionIds/selectedOptionId", () => {
    expect(selectedOptionIds("B")).toEqual(["B"]);
    expect(selectedOptionIds(["A", { optionId: "C" }, null])).toEqual(["A", "C"]);
    expect(selectedOptionIds({ selectedOptionIds: ["A", "B"] })).toEqual(["A", "B"]);
    expect(selectedOptionIds({ selectedOptionId: 7 })).toEqual(["7"]);
    expect(selectedOptionIds(null)).toEqual([]);
  });

  it("studentPairMap: pairMatches / matchAnswers / object phẳng / mảng với các tên trường khác nhau", () => {
    expect(studentPairMap({ pairMatches: [{ promptId: "p1", answerId: "p2" }] })).toEqual({ p1: "p2" });
    expect(studentPairMap({ matchAnswers: [{ leftId: "l", rightId: "r" }] })).toEqual({ l: "r" });
    expect(studentPairMap({ p1: "p1", p2: { id: "p3" } })).toEqual({ p1: "p1", p2: "p3" });
    expect(studentPairMap([{ left: "a" }])).toEqual({ a: "" });
    expect(studentPairMap(null)).toEqual({});
  });

  it("studentBlankAnswer: mở gói { blankAnswers }, mảng {blankIndex|index}, object theo index, chuỗi đơn chỉ cho ô 0", () => {
    expect(studentBlankAnswer({ blankAnswers: [{ blankIndex: 1, answer: "公园" }] }, 1)).toBe("公园");
    expect(studentBlankAnswer([{ index: 0, value: "六点" }], 0)).toBe("六点");
    expect(studentBlankAnswer({ 0: "a", "1": "b" }, 1)).toBe("b");
    expect(studentBlankAnswer("chỉ một", 0)).toBe("chỉ một");
    expect(studentBlankAnswer("chỉ một", 1)).toBe("");
  });

  it("studentChunkOrder + parseGradingMatchText", () => {
    expect(studentChunkOrder(["c1", { chunkId: "c2" }, { id: "c3" }])).toEqual(["c1", "c2", "c3"]);
    expect(parseGradingMatchText("苹果 / píngguǒ")).toEqual({ primary: "苹果", secondary: "píngguǒ" });
    expect(parseGradingMatchText("a\n\nb\nc")).toEqual({ primary: "a", secondary: "b / c" });
    expect(parseGradingMatchText("  chỉ một  ")).toEqual({ primary: "chỉ một", secondary: "" });
    expect(parseGradingMatchText(null)).toEqual({ primary: "", secondary: "" });
  });
});

describe("màn Danh sách nộp bài (submission-model)", () => {
  const mod = (over: Partial<GradingStudentModuleResponse>): GradingStudentModuleResponse => ({ moduleId: "m", label: "Bài", submitted: true, ...over });

  it("initials: chữ đầu của từ đầu và từ cuối, viết hoa; thiếu => '?'", () => {
    expect(initials("nguyễn văn an")).toBe("NA");
    expect(initials("  Hà ")).toBe("H");
    expect(initials(undefined)).toBe("?");
  });

  it("studentBookTone: chưa nộp/toàn bộ chờ chấm => text-muted; tất cả đã trả => text-success; còn lại text-warning", () => {
    expect(studentBookTone([])).toBe("text-muted");
    expect(studentBookTone([mod({ status: "submitted" }), mod({ submitted: false, status: "returned" })])).toBe("text-muted");
    expect(studentBookTone([mod({ status: "returned" }), mod({ status: "RETURNED" })])).toBe("text-success");
    expect(studentBookTone([mod({ status: "graded" }), mod({ status: "returned" })])).toBe("text-warning");
  });

  it("submittedMaxScore chỉ cộng bài đã nộp; studentDisplayName ưu tiên name > fullName > email", () => {
    expect(submittedMaxScore([mod({ maxScore: 5 }), mod({ submitted: false, maxScore: 100 }), mod({ maxScore: undefined })])).toBe(5);
    expect(studentDisplayName({ fullName: "B", email: "e" })).toBe("B");
    expect(studentDisplayName({ email: "e" })).toBe("e");
  });

  it("filterAndSortStudents: tìm theo tên/mã/email không phân biệt hoa thường; sắp theo tên tiếng Việt; không đổi mảng gốc", () => {
    const list: GradingStudentResponse[] = [
      { userId: "1", name: "Trần Bình", studentCode: "HV0002", email: "binh@demo.invalid" },
      { userId: "2", fullName: "Nguyễn An", studentCode: "HV0001", email: "an@demo.invalid" },
      { userId: "3", name: "Đỗ Cường", studentCode: "HV0003", email: "cuong@demo.invalid" },
    ];
    const copy = [...list];
    expect(filterAndSortStudents(list, "").map((s) => s.userId)).toEqual(["3", "2", "1"]);
    expect(filterAndSortStudents(list, "hv0002").map((s) => s.userId)).toEqual(["1"]);
    expect(filterAndSortStudents(list, "AN@").map((s) => s.userId)).toEqual(["2"]);
    expect(filterAndSortStudents(list, "không có")).toEqual([]);
    expect(list).toEqual(copy);
  });
});

describe("màn chấm bài (grading-workspace-model)", () => {
  const q = (over: Partial<GradingAttemptQuestion>): GradingAttemptQuestion => ({ questionId: "q", maxScore: 5, ...over });
  const summary = (i: number, over: Partial<GradingAttemptSummaryResponse> = {}): GradingAttemptSummaryResponse => ({ attemptId: `att${i}`, quizId: `quiz${i}`, quizTitle: `Bài ${i}`, gradingStatus: "SUBMITTED", totalPoints: 10, groupId: `g${i}`, groupName: `#${i} Quiz - Kỹ năng ${i}`, groupOrder: i, quizOrder: 1, ...over });
  const detail = (i: number, questions: GradingAttemptQuestion[], over: Partial<GradingAttemptDetailResponse> = {}): GradingAttemptDetailResponse => ({ attemptId: `att${i}`, quizId: `quiz${i}`, totalPoints: 10, questions, ...over });

  it("modulesFromSummaries: điểm tính từ câu hỏi khi có chi tiết, ngược lại finalScore ?? autoScore ?? 0; trạng thái chữ thường", () => {
    const details = { att1: detail(1, [q({ answerId: "a1", teacherScore: 4 }), q({ answerId: "a2", isCorrect: true, maxScore: 1 })]) };
    const [m1, m2, m3] = modulesFromSummaries([summary(1), summary(2, { gradingStatus: "RETURNED", finalScore: 7, autoScore: 3 }), summary(3, { gradingStatus: "GRADED", quizTitle: undefined, skillType: "WRITING" })], details);
    expect(m1).toMatchObject({ attemptId: "att1", label: "Bài 1", status: "submitted", score: 5, maxScore: 10, submitted: true, groupName: "#1 Quiz - Kỹ năng 1" });
    expect(m2).toMatchObject({ status: "returned", score: 7 });
    expect(m3).toMatchObject({ status: "graded", score: 0, label: "WRITING", skillType: "WRITING" });
  });

  it("sortModules theo groupOrder rồi quizOrder, thiếu groupOrder xuống cuối; formatSectionName bỏ tiền tố '#n Quiz -'", () => {
    const mods = modulesFromSummaries([summary(2, { quizOrder: 2 }), summary(3, { groupOrder: undefined }), summary(1), summary(2, { attemptId: "att2b", quizOrder: 1 })], {});
    expect(sortModules(mods).map((m) => m.attemptId)).toEqual(["att1", "att2b", "att2", "att3"]);
    expect(formatSectionName("#1 Quiz - A. Nghe")).toBe("A. Nghe");
    expect(formatSectionName("Khác")).toBe("Khác");
    expect(formatSectionName("#2 Quiz -   ")).toBe("#2 Quiz -   ");
  });

  it("flattenQuestions đánh số liên tục, đánh dấu câu đầu mỗi bài, bỏ bài không có chi tiết; groupFlatQuestions gom theo module", () => {
    const details = { att1: detail(1, [q({ questionId: "q1", answerId: "a1" }), q({ questionId: "q2" })]), att2: detail(2, [q({ questionId: "q3", answerId: "a3" })]) };
    const mods = modulesFromSummaries([summary(2), summary(1), summary(9)], details);
    const flat = flattenQuestions(mods, details);
    expect(flat.map((f) => [f.key, f.globalIndex, f.isFirstInAttempt])).toEqual([
      ["a1", 0, true],
      ["att1-1", 1, false],
      ["a3", 2, true],
    ]);
    const groups = groupFlatQuestions(flat);
    expect(groups.map((g) => [g.key, g.name, g.items.length])).toEqual([
      ["g1", "#1 Quiz - Kỹ năng 1", 2],
      ["g2", "#2 Quiz - Kỹ năng 2", 1],
    ]);
  });

  it("bản nháp: khoá theo answerId hoặc attemptId:questionId; mặc định từ điểm/nhận xét đã lưu; so khác với đã lưu", () => {
    expect(draftKeyOf({ answerId: "a1", questionId: "q1" }, "att1")).toBe("a1");
    expect(draftKeyOf({ questionId: "q1" }, "att1")).toBe("att1:q1");
    expect(defaultDraft(q({ teacherScore: 3, teacherComment: "Tốt" }))).toEqual({ score: "3", comment: "Tốt" });
    expect(defaultDraft(q({ isCorrect: null }))).toEqual({ score: "", comment: "" });
    expect(draftDiffersFromSaved(q({ teacherScore: 3, teacherComment: "Tốt" }), { score: "3", comment: "Tốt" })).toBe(false);
    expect(draftDiffersFromSaved(q({ teacherScore: 3 }), { score: "3", comment: "x" })).toBe(true);
    expect(draftDiffersFromSaved(q({}), undefined)).toBe(false);
  });

  it("parseDraftScore: rỗng => null; ngoài [0, maxScore] hoặc không phải số => lỗi; resolveDraftScoreNumber ưu tiên bản nháp", () => {
    expect(parseDraftScore(q({ maxScore: 5 }), { score: "" })).toEqual({ ok: true, value: null });
    expect(parseDraftScore(q({ maxScore: 5 }), { score: "4.5" })).toEqual({ ok: true, value: 4.5 });
    expect(parseDraftScore(q({ maxScore: 5 }), { score: "6" })).toMatchObject({ ok: false, message: "Điểm không hợp lệ (0 đến điểm tối đa)" });
    expect(parseDraftScore(q({ maxScore: 5 }), { score: "abc" })).toMatchObject({ ok: false });
    expect(parseDraftScore(q({ maxScore: null }), { score: "1" })).toMatchObject({ ok: false });
    expect(resolveDraftScoreNumber(q({ teacherScore: 2 }), { score: "4", comment: "" })).toBe(4);
    expect(resolveDraftScoreNumber(q({ teacherScore: 2 }))).toBe(2);
    expect(resolveDraftScoreNumber(q({}), { score: "", comment: "" })).toBe(0);
  });

  it("totalMaxScoreOf: totalPoints của từng bài, thiếu thì cộng maxScore các câu", () => {
    expect(totalMaxScoreOf({ a: detail(1, [q({ maxScore: 2 }), q({ maxScore: 3 })], { totalPoints: undefined }), b: detail(2, [], { totalPoints: 7 }) })).toBe(12);
  });

  it("buildSendPlan: bài đủ điểm (GV/bản nháp/máy) => sẵn sàng; bài thiếu => cảnh báo kèm số câu; bài đã gửi hết => bỏ qua", () => {
    const details = {
      att1: detail(1, [q({ questionId: "q1", answerId: "a1", teacherScore: 4 }), q({ questionId: "q2", answerId: "a2", isCorrect: null })]),
      att2: detail(2, [q({ questionId: "q3", answerId: "a3", isCorrect: true, autoScore: 1, maxScore: 1 }), q({ questionId: "q4", answerId: "a4" })]),
      att3: detail(3, [q({ questionId: "q5", answerId: "a5", teacherScore: 5, returnedAt: "2026-10-01" })]),
    };
    const mods = modulesFromSummaries([summary(1), summary(2), summary(3, { gradingStatus: "RETURNED" })], details);
    const plan = buildSendPlan(mods, details, (question) => (question.answerId === "a4" ? { score: "3", comment: "" } : undefined));
    expect(plan.readyAttempts.map((m) => m.attemptId)).toEqual(["att2"]);
    expect(plan.incompleteAttempts).toEqual([{ attemptId: "att1", label: "Kỹ năng 1 — Bài 1", missingQuestionNumbers: [2] }]);
  });

  it("moduleAfterGrading / moduleAfterSending cập nhật điểm và trạng thái", () => {
    const [m] = modulesFromSummaries([summary(1)], {});
    const graded = moduleAfterGrading(m, detail(1, [q({ teacherScore: 4 }), q({ isCorrect: true, maxScore: 1 })], { totalPoints: 6 }));
    expect(graded).toMatchObject({ status: "graded", score: 5, maxScore: 6 });
    expect(moduleAfterSending(graded, detail(1, [q({ teacherScore: 4, returnedAt: "x" }), q({ isCorrect: true, maxScore: 1, returnedAt: "y" })]))).toMatchObject({ status: "returned", score: 5 });
    expect(moduleAfterSending(graded, detail(1, [q({ teacherScore: 4, returnedAt: "x" }), q({ isCorrect: true, maxScore: 1 })]))).toMatchObject({ status: "graded" });
  });
});

describe("màn Chi tiết bài học (lesson-detail-model): mọi thao tác trả bản mới, không đổi đầu vào", () => {
  const base: LessonDetailResponse = {
    lessonTitle: "Buổi 1",
    modules: [
      { id: "m1", label: "Nghe", topicType: "Bài học", locked: true, exercises: [{ name: "Bài 1", audioName: "a.mp3", questions: [{ no: 1, type: "Trắc nghiệm", text: "Q1", options: [{ label: "A", correct: true }, { label: "B" }], score: 1 }, { no: 2, type: "Tự luận", text: "Q2", score: 2 }] }] },
      { id: "m2", label: "Đọc", exercises: [] },
    ],
  };
  const snapshot = JSON.stringify(base);

  it("module: cập nhật trường, khoá/mở, xoá, thêm với id do nơi gọi cấp", () => {
    expect(lesson.updateModule(base, 0, "label", "Nghe hiểu").modules[0].label).toBe("Nghe hiểu");
    expect(lesson.toggleLock(base, 0).modules[0].locked).toBe(false);
    expect(lesson.removeModule(base, 0).modules.map((m) => m.id)).toEqual(["m2"]);
    const added = lesson.addModule(base, "lm-x");
    expect(added.modules[2]).toEqual({ id: "lm-x", label: "Chủ đề mới", topicType: "Bài học", exercises: [] });
    expect(lesson.updateModule(base, 9, "label", "x")).toEqual(base); // chỉ số ngoài phạm vi: không đổi
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it("bài tập: cập nhật/thêm/xoá, đổi và xoá audio", () => {
    expect(lesson.updateExercise(base, 0, 0, "name", "Mới").modules[0].exercises?.[0].name).toBe("Mới");
    expect(lesson.addExercise(base, 1).modules[1].exercises).toEqual([{ name: "", questions: [] }]);
    expect(lesson.removeExercise(base, 0, 0).modules[0].exercises).toEqual([]);
    expect(lesson.setExerciseAudio(base, 0, 0, "b.mp3").modules[0].exercises?.[0].audioName).toBe("b.mp3");
    expect(lesson.setExerciseAudio(base, 0, 0, undefined).modules[0].exercises?.[0].audioName).toBeUndefined();
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it("câu hỏi: thêm với số thứ tự kế tiếp, xoá đánh số lại, cập nhật trường", () => {
    const added = lesson.addQuestion(base, 0, 0);
    expect(added.modules[0].exercises?.[0].questions?.[2]).toEqual({ no: 3, type: "Trắc nghiệm", text: "", options: [{ label: "" }], score: 1 });
    const removed = lesson.removeQuestion(base, 0, 0, 0);
    expect(removed.modules[0].exercises?.[0].questions?.map((x) => [x.no, x.text])).toEqual([[1, "Q2"]]);
    expect(lesson.updateQuestion(base, 0, 0, 1, "score", 2.5).modules[0].exercises?.[0].questions?.[1].score).toBe(2.5);
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it("đáp án: sửa nhãn, chọn đúng duy nhất, thêm, xoá; parseQuestionScore", () => {
    expect(lesson.updateOptionLabel(base, 0, 0, 0, 1, "Bê").modules[0].exercises?.[0].questions?.[0].options?.[1].label).toBe("Bê");
    expect(lesson.setCorrectOption(base, 0, 0, 0, 1).modules[0].exercises?.[0].questions?.[0].options?.map((o) => !!o.correct)).toEqual([false, true]);
    expect(lesson.addOption(base, 0, 0, 1).modules[0].exercises?.[0].questions?.[1].options).toEqual([{ label: "" }]);
    expect(lesson.removeOption(base, 0, 0, 0, 0).modules[0].exercises?.[0].questions?.[0].options).toEqual([{ label: "B" }]);
    expect(lesson.parseQuestionScore("")).toBeUndefined();
    expect(lesson.parseQuestionScore("1.5")).toBe(1.5);
    expect(lesson.parseQuestionScore("x")).toBeNull();
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
