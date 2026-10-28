import { describe, expect, it } from "vitest";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { WriteDisabledError } from "@/lib/api/write-gate";
import { ADDABLE_MODULE_TYPES, contentTypeOf, missingModuleTypes, moduleActionErrorMessage, moduleTypeLabel, movedIds, requiredModuleTypes, sortModules } from "@/lib/syllabus/schedule-modules-model";
import { buildSyllabusInfoFields, cloCodes, displayText, filterSyllabuses, formatSyllabusDate, isOpenableLink, syllabusTitle } from "@/lib/syllabus/syllabus-model";
import { SYLLABUS_TABS, checkSyllabusId, parseSyllabusTab } from "@/lib/syllabus/syllabus-params";
import type { SyllabusDetailResponse, SyllabusSummaryResponse } from "@/types/lms";
import type { ScheduleModule } from "@/types/syllabus-modules";

const mod = (id: string, order: number, moduleType = "QUIZ"): ScheduleModule => ({ id, scheduleId: "s1", order, moduleType });
const syl = (i: number, over: Partial<SyllabusSummaryResponse> = {}): SyllabusSummaryResponse => ({ id: `syl-${i}`, name: `Giáo trình HSK ${i}`, code: `GT-${i}`, educationLevelName: `HSK ${i}`, type: "STANDARD", author: "Tổ chuyên môn", ...over });

describe("syllabus-params: ?view= và ?tab=", () => {
  it.each([
    [null, "none"],
    [undefined, "none"],
    ["", "invalid"],
    ["   ", "invalid"],
    [".", "invalid"],
    ["..", "invalid"],
    ["a/b", "invalid"],
    ["a?b", "invalid"],
    ["a%20b", "invalid"],
    ["a\\b", "invalid"],
    ["x".repeat(129), "invalid"],
  ])("checkSyllabusId(%j) => %s", (raw, kind) => {
    expect(checkSyllabusId(raw).kind).toBe(kind);
  });

  it("id hợp lệ được cắt khoảng trắng hai đầu; UUID và id dạng syl-14 đều hợp lệ", () => {
    expect(checkSyllabusId(" syl-14 ")).toEqual({ kind: "ok", id: "syl-14" });
    expect(checkSyllabusId("4f1c2b7e-9a3d-4e2f-8b1a-0c9d8e7f6a5b").kind).toBe("ok");
  });

  it("parseSyllabusTab: khoá hợp lệ giữ nguyên, lạ/thiếu => 'info'; đủ 7 tab theo thứ tự brief", () => {
    expect(parseSyllabusTab("schedule")).toBe("schedule");
    expect(parseSyllabusTab("versions")).toBe("versions");
    expect(parseSyllabusTab("Schedule")).toBe("info");
    expect(parseSyllabusTab(null)).toBe("info");
    expect(SYLLABUS_TABS.map((t) => t.label)).toEqual(["Thông tin chung", "CLO", "Tài liệu", "Lịch trình", "Cấu trúc đánh giá", "Mẫu bài kiểm tra", "Phiên bản"]);
  });
});

describe("syllabus-model: hiển thị", () => {
  it("displayText: rỗng/null/undefined/object => —; boolean => Có/Không; mảng nối ', '; số giữ nguyên", () => {
    expect(displayText(undefined)).toBe("—");
    expect(displayText(null)).toBe("—");
    expect(displayText("   ")).toBe("—");
    expect(displayText({ a: 1 })).toBe("—");
    expect(displayText(true)).toBe("Có");
    expect(displayText(false)).toBe("Không");
    expect(displayText(["a", "", "b"])).toBe("a, b");
    expect(displayText([])).toBe("—");
    expect(displayText(60)).toBe("60");
  });

  it("formatSyllabusDate: ISO => dd/MM/yyyy; thiếu/không hợp lệ => — (không 'Invalid Date')", () => {
    expect(formatSyllabusDate("2026-01-15T08:00:00Z")).toBe("15/01/2026");
    expect(formatSyllabusDate(undefined)).toBe("—");
    expect(formatSyllabusDate("không phải ngày")).toBe("—");
  });

  it("syllabusTitle: tên > mã > id", () => {
    expect(syllabusTitle({ id: "x", name: "Tên", code: "GT" })).toBe("Tên");
    expect(syllabusTitle({ id: "x", name: "  ", code: "GT" })).toBe("GT");
    expect(syllabusTitle({ id: "x" })).toBe("x");
  });

  it("filterSyllabuses: tìm trên tên/mã/cấp độ/loại/tác giả, không phân biệt hoa thường; rỗng => giữ nguyên thứ tự", () => {
    const list = [syl(1), syl(2, { author: "Nguyễn Văn An" }), syl(3, { type: "INTENSIVE" })];
    expect(filterSyllabuses(list, "").map((s) => s.id)).toEqual(["syl-1", "syl-2", "syl-3"]);
    expect(filterSyllabuses(list, "hsk 2").map((s) => s.id)).toEqual(["syl-2"]);
    expect(filterSyllabuses(list, "gt-3").map((s) => s.id)).toEqual(["syl-3"]);
    expect(filterSyllabuses(list, "intensive").map((s) => s.id)).toEqual(["syl-3"]);
    expect(filterSyllabuses(list, "văn an").map((s) => s.id)).toEqual(["syl-2"]);
    expect(filterSyllabuses(list, "không có")).toEqual([]);
  });

  it("buildSyllabusInfoFields: 20 trường cố định đúng thứ tự, trường thiếu hiện —, ngày được định dạng", () => {
    const fields = buildSyllabusInfoFields({ id: "s", name: "GT", trainingProgram: "Tổng quát", minimumPassingScore: 60, createdAt: "2026-01-15T08:00:00Z" });
    expect(fields).toHaveLength(20);
    expect(fields.slice(0, 3).map((f) => f.label)).toEqual(["Tên khóa học", "Mã khóa học", "Cấp độ HSK"]);
    const byLabel = Object.fromEntries(fields.map((f) => [f.label, f.value]));
    expect(byLabel["Chương trình đào tạo"]).toBe("Tổng quát");
    expect(byLabel["Điểm đạt tối thiểu"]).toBe("60");
    expect(byLabel["Ngày tạo"]).toBe("15/01/2026");
    expect(byLabel["Mã khóa học"]).toBe("—");
    expect(byLabel["Ghi chú"]).toBe("—");
  });

  it("cloCodes: id => mã CLO; id lạ giữ nguyên; thiếu => —", () => {
    const detail: Pick<SyllabusDetailResponse, "clo"> = { clo: [{ id: "c1", code: "CLO1", name: "Nghe" }, { id: "c2", name: "Đọc hiểu" }] };
    expect(cloCodes(detail, ["c1", "c2", "c9"])).toBe("CLO1, Đọc hiểu, c9");
    expect(cloCodes(detail, [])).toBe("—");
    expect(cloCodes(detail, undefined)).toBe("—");
  });

  it("isOpenableLink: chỉ URL http(s) tuyệt đối; '#' hay đường dẫn tương đối của ERP không mở", () => {
    expect(isOpenableLink("https://x.test/a")).toBe(true);
    expect(isOpenableLink("HTTP://x.test")).toBe(true);
    expect(isOpenableLink("#")).toBe(false);
    expect(isOpenableLink("/files/a.pdf")).toBe(false);
    expect(isOpenableLink(undefined)).toBe(false);
  });
});

describe("schedule-modules-model: module ôn luyện theo buổi", () => {
  it("moduleTypeLabel: nhãn tiếng Việt của HSK cũ, không phân biệt hoa thường; loại lạ giữ nguyên; rỗng => —", () => {
    expect(moduleTypeLabel("VOCABULARY")).toBe("Từ vựng");
    expect(moduleTypeLabel("quiz")).toBe("Quiz");
    expect(moduleTypeLabel("AI_WRITING")).toBe("Luyện tập với AI");
    expect(moduleTypeLabel("NEW_TYPE")).toBe("NEW_TYPE");
    expect(moduleTypeLabel(undefined)).toBe("—");
  });

  it("contentTypeOf: Từ vựng tải kho Flashcard, AI_* dùng kho AI_PRACTICE, loại khác giữ nguyên (viết hoa)", () => {
    expect(contentTypeOf("VOCABULARY")).toBe("FLASHCARD");
    expect(contentTypeOf("AI_SPEAKING")).toBe("AI_PRACTICE");
    expect(contentTypeOf("quiz")).toBe("QUIZ");
  });

  it("ADDABLE_MODULE_TYPES: không có LESSON_MATERIAL (màn Tài liệu học tập riêng), LISTENING (chọn video từ kho) và AI_* (bản cũ đã tắt)", () => {
    expect(ADDABLE_MODULE_TYPES).not.toContain("LESSON_MATERIAL");
    expect(ADDABLE_MODULE_TYPES).not.toContain("LISTENING");
    expect(ADDABLE_MODULE_TYPES.some((t) => t.startsWith("AI_"))).toBe(false);
    expect(ADDABLE_MODULE_TYPES).toEqual(expect.arrayContaining(["QUIZ", "FLASHCARD", "WRITING", "GRAMMAR", "PRONUNCIATION"]));
  });

  it("sortModules: theo order tăng dần, ổn định với order trùng/không phải số; không đổi mảng gốc", () => {
    const list = [mod("c", 3), mod("a", 1), mod("x", Number.NaN), mod("b", 2), mod("y", 0)];
    expect(sortModules(list).map((m) => m.id)).toEqual(["x", "y", "a", "b", "c"]);
    expect(list[0].id).toBe("c");
  });

  it("movedIds: đổi chỗ với hàng xóm; đầu không lên, cuối không xuống, id lạ => null", () => {
    const list = [mod("a", 1), mod("b", 2), mod("c", 3)];
    expect(movedIds(list, "b", -1)).toEqual(["b", "a", "c"]);
    expect(movedIds(list, "b", 1)).toEqual(["a", "c", "b"]);
    expect(movedIds(list, "a", -1)).toBeNull();
    expect(movedIds(list, "c", 1)).toBeNull();
    expect(movedIds(list, "zzz", 1)).toBeNull();
  });

  it("requiredModuleTypes + missingModuleTypes: cột Module ôn luyện của giáo trình đối chiếu với module đã gắn (AI_* gộp AI_PRACTICE)", () => {
    const item = { moduleOnLuyen: [{ moduleType: "quiz", moduleContent: "Bài tập" }, { moduleType: "AI_WRITING" }, { moduleType: "QUIZ" }, { moduleType: "" }] };
    expect(requiredModuleTypes(item)).toEqual(["QUIZ", "AI_PRACTICE"]);
    expect(missingModuleTypes(["QUIZ", "AI_PRACTICE"], [mod("m", 1, "QUIZ")])).toEqual(["AI_PRACTICE"]);
    expect(missingModuleTypes(["QUIZ", "AI_PRACTICE"], [mod("m", 1, "QUIZ"), mod("n", 2, "AI_READING")])).toEqual([]);
    expect(requiredModuleTypes({ moduleOnLuyen: undefined })).toEqual([]);
  });

  it("moduleActionErrorMessage: công tắc đóng / chưa cấu hình => 'chưa được tích hợp'; ApiError => thông điệp; lỗi lạ => câu dự phòng", () => {
    expect(moduleActionErrorMessage(new WriteDisabledError("content"), "x")).toContain("WAITING FOR BACKEND");
    expect(moduleActionErrorMessage(new ApiNotConfiguredError(), "x")).toContain("WAITING FOR BACKEND");
    expect(moduleActionErrorMessage(new ApiError("Bạn không có quyền thực hiện thao tác này.", 403), "x")).toBe("Bạn không có quyền thực hiện thao tác này.");
    expect(moduleActionErrorMessage(new Error("boom"), "Không thể xóa module")).toBe("Không thể xóa module");
  });
});
