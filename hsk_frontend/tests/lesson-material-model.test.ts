import { describe, expect, it } from "vitest";
import { appendBulkFiles, bulkItemFromFile, filterGroups, findDuplicateGroup, formatBytes, groupStatusLabel, inferTypeFromFilename, MAX_BULK_FILES, titleFromFilename, uploadFailureErrors } from "@/lib/lesson-materials/lesson-material-model";
import type { LessonMaterialGroup } from "@/types/lesson-materials";

const group = (id: string, name: string, type: LessonMaterialGroup["type"] = "SLIDE", status: LessonMaterialGroup["status"] = "DRAFT"): LessonMaterialGroup => ({ id, name, type, status });

describe("trạng thái bộ tài liệu", () => {
  it("groupStatusLabel: DRAFT => Bản nháp; PUBLISHED => Đã xuất bản", () => {
    expect(groupStatusLabel("DRAFT")).toBe("Bản nháp");
    expect(groupStatusLabel("PUBLISHED")).toBe("Đã xuất bản");
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

  it("đuôi ảnh => MATERIAL, còn lại => SLIDE; tiêu đề bỏ đuôi tệp", () => {
    expect(inferTypeFromFilename("bai1.PNG")).toBe("MATERIAL");
    expect(inferTypeFromFilename("slide.pdf")).toBe("SLIDE");
    expect(inferTypeFromFilename("khong-duoi")).toBe("SLIDE");
    expect(titleFromFilename("Slide buổi 1.v2.pdf")).toBe("Slide buổi 1.v2");
  });

  it("bulkItemFromFile/appendBulkFiles: tự điền tên+loại, cắt ở MAX_BULK_FILES", () => {
    const png = new File(["x"], "ngu-phap.png", { type: "image/png" });
    expect(bulkItemFromFile(png)).toMatchObject({ title: "ngu-phap", type: "MATERIAL", uploadStatus: "idle", fileId: "", errorMessage: "" });
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

describe("bộ tài liệu", () => {
  const groups = [group("g1", "HSK 3", "SLIDE"), group("g2", "HSK 4", "MATERIAL"), group("g3", "HSK 3", "MATERIAL")];

  it("findDuplicateGroup: không phân biệt hoa thường/khoảng trắng, chỉ so trong cùng loại, bỏ qua chính bộ đang sửa; tên rỗng => null", () => {
    expect(findDuplicateGroup(groups, "SLIDE", " hsk 3 ")?.id).toBe("g1");
    expect(findDuplicateGroup(groups, "MATERIAL", "HSK 3")?.id).toBe("g3");
    expect(findDuplicateGroup(groups, "SLIDE", "HSK 3", "g1")).toBeNull();
    expect(findDuplicateGroup(groups, "SLIDE", "   ")).toBeNull();
    expect(findDuplicateGroup(groups, "SLIDE", "HSK 9")).toBeNull();
  });

  it("filterGroups theo tên (không phân biệt hoa thường); rỗng trả bản sao đầy đủ", () => {
    expect(filterGroups(groups, "hsk 4").map((g) => g.id)).toEqual(["g2"]);
    expect(filterGroups(groups, "")).toEqual(groups);
  });
});
