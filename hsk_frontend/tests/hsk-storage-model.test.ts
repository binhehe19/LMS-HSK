import { describe, expect, it } from "vitest";
import { breadcrumbItems, defaultVideoTitle, EMPTY_SELECTION, episodeTag, formatMegabytes, hasProcessingVideo, isPackagePublished, MAX_VIDEO_BYTES, selectionAtLevel, storageLevel, studySetLabel, validateVideoFile, videoStatusColor, videoStatusLabel, type StorageSelection } from "@/lib/hsk-storage/storage-model";
import type { StorageFolder, StoragePackage, StorageStudySet, StorageVideo } from "@/types/hsk-storage";

const pkg: StoragePackage = { id: "p1", name: "Gói A", type: "VIDEO_COURSE", publishStatus: "PUBLISHED", createdAt: "2026-01-01", updatedAt: "2026-01-02" };
const folder: StorageFolder = { id: "f1", name: "Thư mục B", packageId: "p1", isPrivate: false, createdAt: "2026-01-01", updatedAt: "2026-01-02" };
const set: StorageStudySet = { id: "s1", name: "  ", folderId: "f1", isPrivate: true, createdAt: "2026-01-01", updatedAt: "2026-01-02" };
const full: StorageSelection = { pkg, folder, studySet: set };

describe("đường dẫn drill-down", () => {
  it("storageLevel theo mức sâu nhất đang chọn", () => {
    expect(storageLevel(EMPTY_SELECTION)).toBe("packages");
    expect(storageLevel({ pkg, folder: null, studySet: null })).toBe("folders");
    expect(storageLevel({ pkg, folder, studySet: null })).toBe("study-sets");
    expect(storageLevel(full)).toBe("videos");
  });

  it("breadcrumbItems: mục cuối active (target null), các mục trước bấm về đúng mức; bộ học không tên => 'Nhóm học'", () => {
    expect(breadcrumbItems(EMPTY_SELECTION)).toEqual([{ key: "root", label: "Thư viện Media", target: null }]);
    expect(breadcrumbItems(full).map((i) => [i.label, i.target])).toEqual([
      ["Thư viện Media", "packages"],
      ["Gói A", "folders"],
      ["Thư mục B", "study-sets"],
      ["Nhóm học", null],
    ]);
  });

  it("selectionAtLevel bỏ chọn các mức sâu hơn", () => {
    expect(selectionAtLevel(full, "packages")).toEqual(EMPTY_SELECTION);
    expect(selectionAtLevel(full, "folders")).toEqual({ pkg, folder: null, studySet: null });
    expect(selectionAtLevel(full, "study-sets")).toEqual({ pkg, folder, studySet: null });
    expect(selectionAtLevel(full, "videos")).toBe(full);
  });
});

describe("nhãn và kiểm tra tệp video", () => {
  it("studySetLabel/isPackagePublished/episodeTag/videoStatusLabel", () => {
    expect(studySetLabel(set)).toBe("Nhóm học");
    expect(studySetLabel({ ...set, name: "Bài 1" })).toBe("Bài 1");
    expect(isPackagePublished(pkg)).toBe(true);
    expect(isPackagePublished({ ...pkg, publishStatus: "DRAFT" })).toBe(false);
    expect(episodeTag(0)).toBe("Bài 01");
    expect(episodeTag(11)).toBe("Bài 12");
    expect(videoStatusLabel("COMPLETED")).toBe("Sẵn sàng");
    expect(videoStatusLabel("PROCESSING")).toBe("PROCESSING");
    expect(videoStatusColor("COMPLETED")).not.toBe(videoStatusColor("FAILED"));
  });

  it("validateVideoFile: phải là video/*, tối đa 1GB; defaultVideoTitle bỏ đuôi; formatMegabytes 2 chữ số", () => {
    expect(validateVideoFile({ type: "image/png", size: 10 })).toBe("Vui lòng chọn tệp video hợp lệ");
    expect(validateVideoFile({ type: "video/mp4", size: MAX_VIDEO_BYTES + 1 })).toBe("Kích thước tệp phải nhỏ hơn 1GB");
    expect(validateVideoFile({ type: "video/mp4", size: MAX_VIDEO_BYTES })).toBeNull();
    expect(defaultVideoTitle("bai-1.intro.MP4")).toBe("bai-1.intro");
    expect(formatMegabytes(1.5 * 1024 * 1024)).toBe("1.50 MB");
  });

  it("hasProcessingVideo: còn PENDING/PROCESSING thì tiếp tục hỏi lại", () => {
    const video = (status: string): StorageVideo => ({ id: status, code: "c", name: "v", status, studySetId: "s1", createdAt: "2026-01-01", updatedAt: "2026-01-01" });
    expect(hasProcessingVideo([video("COMPLETED"), video("FAILED")])).toBe(false);
    expect(hasProcessingVideo([video("COMPLETED"), video("PROCESSING")])).toBe(true);
    expect(hasProcessingVideo([video("PENDING")])).toBe(true);
    expect(hasProcessingVideo([])).toBe(false);
  });
});
