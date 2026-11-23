import { describe, expect, it } from "vitest";
import { movedResourceIds } from "@/components/management/syllabus/use-schedule-resources";
import type { ScheduleResourceLink } from "@/lib/api/syllabus-schedule-resources-client";
import { missingRawModuleTypes, normalizeScheduleResourceType, rawModuleTypeLabel, requiredRawModuleTypes } from "@/lib/syllabus/schedule-resource-types";
import { buildSyllabusInfoFields, cloCodes, displayText, filterSyllabuses, formatSyllabusDate, isOpenableLink, syllabusTitle } from "@/lib/syllabus/syllabus-model";
import { SYLLABUS_TABS, checkSyllabusId, parseSyllabusTab } from "@/lib/syllabus/syllabus-params";
import type { SyllabusDetailResponse, SyllabusSummaryResponse } from "@/types/lms";

const link = (id: string, displayOrder: number): ScheduleResourceLink => ({ id: `link-${id}`, learningResourceId: id, learningResourceVersionId: `v-${id}`, sessionNo: 1, displayOrder, resourceType: "VOCABULARY", resourceContent: null });
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

describe("schedule-resource-types: module ôn luyện theo buổi (gắn trực tiếp vào ContentPackage của giáo trình, cơ chế IELTS)", () => {
  it("normalizeScheduleResourceType: FLASHCARD/VOCABULARY => VOCABULARY, QUIZ => ASSESSMENT, GRAMMAR giữ nguyên; loại chưa hỗ trợ => null", () => {
    expect(normalizeScheduleResourceType("FLASHCARD")).toBe("VOCABULARY");
    expect(normalizeScheduleResourceType("vocabulary")).toBe("VOCABULARY");
    expect(normalizeScheduleResourceType("quiz")).toBe("ASSESSMENT");
    expect(normalizeScheduleResourceType("GRAMMAR")).toBe("GRAMMAR");
    expect(normalizeScheduleResourceType("WRITING")).toBeNull();
    expect(normalizeScheduleResourceType(undefined)).toBeNull();
  });

  it("rawModuleTypeLabel: nhãn tiếng Việt cho 3 loại có nội dung thật; loại lạ giữ nguyên; rỗng => —", () => {
    expect(rawModuleTypeLabel("VOCABULARY")).toBe("Từ vựng");
    expect(rawModuleTypeLabel("quiz")).toBe("Bài tập (Quiz)");
    expect(rawModuleTypeLabel("WRITING")).toBe("WRITING");
    expect(rawModuleTypeLabel(undefined)).toBe("—");
  });

  it("requiredRawModuleTypes + missingRawModuleTypes: cột Module ôn luyện của giáo trình đối chiếu với resource đã gắn", () => {
    const item = { moduleOnLuyen: [{ moduleType: "quiz", moduleContent: "Bài tập" }, { moduleType: "WRITING" }, { moduleType: "QUIZ" }, { moduleType: "" }] };
    expect(requiredRawModuleTypes(item)).toEqual(["QUIZ", "WRITING"]);
    expect(missingRawModuleTypes(["QUIZ", "WRITING"], { ASSESSMENT: 1 })).toEqual(["WRITING"]);
    expect(missingRawModuleTypes(["QUIZ", "WRITING"], {})).toEqual(["QUIZ", "WRITING"]);
    expect(requiredRawModuleTypes({ moduleOnLuyen: undefined })).toEqual([]);
  });

  it("movedResourceIds: đổi chỗ với hàng xóm theo displayOrder; đầu không lên, cuối không xuống, id lạ => null", () => {
    const list = [link("a", 1), link("b", 2), link("c", 3)];
    expect(movedResourceIds(list, "b", -1)).toEqual(["b", "a", "c"]);
    expect(movedResourceIds(list, "b", 1)).toEqual(["a", "c", "b"]);
    expect(movedResourceIds(list, "a", -1)).toBeNull();
    expect(movedResourceIds(list, "c", 1)).toBeNull();
    expect(movedResourceIds(list, "zzz", 1)).toBeNull();
  });
});
