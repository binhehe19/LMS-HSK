import { describe, expect, it } from "vitest";
import {
  appendBulkFiles,
  bulkItemFromFile,
  countByType,
  countGrammarFamily,
  filterGroups,
  filterMaterialsByTab,
  findDuplicateGroup,
  flattenGroupedMaterials,
  formatBytes,
  getLifecycleActions,
  inferCategoryFromType,
  inferTypeFromFilename,
  isDuplicateGroupError,
  isInvalidTransitionError,
  materialsOfGroup,
  MAX_BULK_FILES,
  titleFromFilename,
  uploadFailureErrors,
} from "@/lib/lesson-materials/lesson-material-model";
import type { LessonMaterial, LessonMaterialGroup } from "@/types/lesson-materials";

const material = (id: string, over: Partial<LessonMaterial> = {}): LessonMaterial => ({ id, title: `Tài liệu ${id}`, type: "SLIDE", category: "LESSON", status: "DRAFT", fileId: `f-${id}`, groupId: "g1", ...over });
const group = (id: string, name: string, status: LessonMaterialGroup["status"] = "ACTIVE"): LessonMaterialGroup => ({ id, name, status });

describe("hành động vòng đời theo trạng thái (bản cũ)", () => {
  it("DRAFT: Xuất bản + Lưu trữ; PUBLISHED: Chuyển về nháp + Lưu trữ; ARCHIVED: Khôi phục nháp", () => {
    expect(getLifecycleActions("DRAFT").map((a) => [a.status, a.label])).toEqual([["PUBLISHED", "Xuất bản"], ["ARCHIVED", "Lưu trữ"]]);
    expect(getLifecycleActions("PUBLISHED").map((a) => [a.status, a.label])).toEqual([["DRAFT", "Chuyển về nháp"], ["ARCHIVED", "Lưu trữ"]]);
    expect(getLifecycleActions("ARCHIVED").map((a) => [a.status, a.label])).toEqual([["DRAFT", "Khôi phục nháp"]]);
  });

  it("mã lỗi trùng tên / chuyển trạng thái sai: 409 hoặc errorCode riêng", () => {
    expect(isDuplicateGroupError(409, undefined)).toBe(true);
    expect(isDuplicateGroupError(400, "LESSON_MATERIAL_GROUP_DUPLICATE_NAME")).toBe(true);
    expect(isDuplicateGroupError(400, "OTHER")).toBe(false);
    expect(isInvalidTransitionError(200, "LESSON_MATERIAL_INVALID_STATUS_TRANSITION")).toBe(true);
    expect(isInvalidTransitionError(500, undefined)).toBe(false);
  });
});

describe("định dạng và suy luận từ tệp", () => {
  it.each([
    [undefined, "-"],
    [0, "-"],
    [512, "512 B"],
    [1536, "1.5 KB"],
    [2 * 1024 * 1024, "2.0 MB"],
  ])("formatBytes(%s) => %s", (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });

  it("đuôi ảnh => GRAMMAR (Buổi học), còn lại => SLIDE; TEXTBOOK thuộc Khóa học; tiêu đề bỏ đuôi tệp", () => {
    expect(inferTypeFromFilename("bai1.PNG")).toBe("GRAMMAR");
    expect(inferTypeFromFilename("slide.pdf")).toBe("SLIDE");
    expect(inferTypeFromFilename("khong-duoi")).toBe("SLIDE");
    expect(inferCategoryFromType("TEXTBOOK")).toBe("COURSE");
    expect(inferCategoryFromType("GRAMMAR_3_0")).toBe("LESSON");
    expect(titleFromFilename("Slide buổi 1.v2.pdf")).toBe("Slide buổi 1.v2");
  });

  it("bulkItemFromFile/appendBulkFiles: tự điền tên+loại, cắt ở MAX_BULK_FILES", () => {
    const png = new File(["x"], "ngu-phap.png", { type: "image/png" });
    expect(bulkItemFromFile(png)).toMatchObject({ title: "ngu-phap", type: "GRAMMAR", category: "LESSON", uploadStatus: "idle", fileId: "", errorMessage: "" });
    const many = Array.from({ length: MAX_BULK_FILES + 5 }, (_, i) => new File(["x"], `f${i}.pdf`));
    const items = appendBulkFiles([], many);
    expect(items).toHaveLength(MAX_BULK_FILES);
    expect(appendBulkFiles(items, [png])).toHaveLength(MAX_BULK_FILES);
  });

  it("uploadFailureErrors chỉ lấy mục lỗi tải, errorCode UPLOAD_FAILED", () => {
    const ok = { ...bulkItemFromFile(new File(["x"], "a.pdf")), uploadStatus: "uploaded" as const, fileId: "f1" };
    const bad = { ...bulkItemFromFile(new File(["x"], "b.pdf")), uploadStatus: "error" as const, errorMessage: "Mất mạng" };
    expect(uploadFailureErrors([ok, bad])).toEqual([{ index: 0, title: "b", errorCode: "UPLOAD_FAILED", message: "Mất mạng" }]);
  });
});

describe("bộ tài liệu và đếm", () => {
  const groups = [group("g1", "HSK 3"), group("g2", "HSK 4"), group("g3", "HSK 2 (cũ)", "ARCHIVED")];

  it("findDuplicateGroup không phân biệt hoa thường/khoảng trắng, bỏ qua chính bộ đang sửa; tên rỗng => null", () => {
    expect(findDuplicateGroup(groups, " hsk 3 ")?.id).toBe("g1");
    expect(findDuplicateGroup(groups, "HSK 3", "g1")).toBeNull();
    expect(findDuplicateGroup(groups, "hsk 2 (CŨ)")?.status).toBe("ARCHIVED");
    expect(findDuplicateGroup(groups, "   ")).toBeNull();
    expect(findDuplicateGroup(groups, "HSK 9")).toBeNull();
  });

  it("filterGroups theo tên (không phân biệt hoa thường); rỗng trả bản sao đầy đủ", () => {
    expect(filterGroups(groups, "hsk 4").map((g) => g.id)).toEqual(["g2"]);
    expect(filterGroups(groups, "")).toEqual(groups);
  });

  it("materialsOfGroup(null) = chưa phân loại; countByType/countGrammarFamily (Ngữ pháp gồm 3.0)", () => {
    const all = [material("1"), material("2", { type: "GRAMMAR" }), material("3", { type: "GRAMMAR_3_0" }), material("4", { groupId: null }), material("5", { groupId: undefined, type: "TEXTBOOK", category: "COURSE" })];
    expect(materialsOfGroup(all, "g1").map((m) => m.id)).toEqual(["1", "2", "3"]);
    expect(materialsOfGroup(all, null).map((m) => m.id)).toEqual(["4", "5"]);
    expect(countByType(all, "SLIDE")).toBe(2);
    expect(countGrammarFamily(all)).toBe(2);
  });

  it("flattenGroupedMaterials theo thứ tự loại chuẩn; filterMaterialsByTab", () => {
    const flat = flattenGroupedMaterials({ group: groups[0], materialsByType: { TEXTBOOK: [material("t", { type: "TEXTBOOK" })], SLIDE: [material("s")], GRAMMAR: [material("g", { type: "GRAMMAR" })] } });
    expect(flat.map((m) => m.id)).toEqual(["s", "g", "t"]);
    expect(flattenGroupedMaterials(null)).toEqual([]);
    expect(filterMaterialsByTab(flat, "GRAMMAR").map((m) => m.id)).toEqual(["g"]);
    expect(filterMaterialsByTab(flat, "ALL")).toHaveLength(3);
  });
});
