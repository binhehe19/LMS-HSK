import { describe, expect, it } from "vitest";
import { diffContentItems } from "@/lib/content/content-item-diff";
import { buildBreadcrumb, clampPage, countPackagesByType, DEFAULT_PACKAGE_TYPES, filterByKeyword, filterPackages, formatContentDate, isPublished, packageTypeMeta, paginate, publishStatusInfo, sortByIndex } from "@/lib/content/content-tree-model";
import { folderLocation, packageLocation, readId, readTreeLocation, ROOT_LOCATION, safeReturnUrl, studySetLocation, treeHref, treeLevel, treeQuery, withReturnUrl } from "@/lib/content/content-tree-params";
import { normalizeFolderInput, normalizePackageInput, normalizeStudySetInput, validateFolderInput, validatePackageInput, validateStudySetInput, writeErrorMessage, WRITE_NOT_INTEGRATED_MESSAGE } from "@/lib/content/content-tree-validate";
import { emptyFlashcardInput, flashcardToInput, normalizeFlashcardInput, parseBulkCards, validateFlashcardInput } from "@/lib/content/flashcard-card";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { WriteDisabledError } from "@/lib/api/write-gate";
import type { ContentLabels, ContentPackage } from "@/types/content";
import type { FlashcardCard } from "@/types/content-flashcard";

const labels: ContentLabels = { package: "Package", folder: "Thư mục", studySet: "Bộ học", item: "Thẻ" };
const params = (qs: string) => new URLSearchParams(qs);

describe("vị trí cây trong URL (content-tree-params)", () => {
  it("readId: chỉ nhận id an toàn (chữ/số/_.:-, ≤128), cắt khoảng trắng; từ chối '/', '?', '\\', rỗng", () => {
    expect(readId(" pkg-1 ")).toBe("pkg-1");
    expect(readId("a.b:c_d")).toBe("a.b:c_d");
    expect(readId("../admin")).toBeNull();
    expect(readId("a?b")).toBeNull();
    expect(readId("a\\b")).toBeNull();
    expect(readId("")).toBeNull();
    expect(readId(null)).toBeNull();
    expect(readId("x".repeat(129))).toBeNull();
  });

  it("readTreeLocation: cấp con chỉ hợp lệ khi có cấp cha; view=search chỉ ở gốc", () => {
    expect(readTreeLocation(params(""))).toEqual(ROOT_LOCATION);
    expect(readTreeLocation(params("packageId=p1&folderId=f1&studySetId=s1"))).toEqual({ packageId: "p1", folderId: "f1", studySetId: "s1", view: "tree" });
    expect(readTreeLocation(params("folderId=f1&studySetId=s1"))).toEqual(ROOT_LOCATION); // thiếu gói => bỏ cả hai cấp dưới
    expect(readTreeLocation(params("packageId=p1&studySetId=s1"))).toEqual({ ...ROOT_LOCATION, packageId: "p1" });
    expect(readTreeLocation(params("view=search"))).toEqual({ ...ROOT_LOCATION, view: "search" });
    expect(readTreeLocation(params("view=search&packageId=p1")).view).toBe("tree");
    expect(readTreeLocation(params("packageId=..%2Fx&folderId=f1"))).toEqual(ROOT_LOCATION); // id không hợp lệ
  });

  it("treeLevel theo cấp sâu nhất có id", () => {
    expect(treeLevel(ROOT_LOCATION)).toBe("packages");
    expect(treeLevel(packageLocation("p"))).toBe("folders");
    expect(treeLevel(folderLocation("p", "f"))).toBe("studySets");
    expect(treeLevel(studySetLocation("p", "f", "s"))).toBe("items");
  });

  it("treeQuery/treeHref: thứ tự cố định, mã hoá, rỗng ở gốc; vòng tròn với readTreeLocation", () => {
    expect(treeQuery(ROOT_LOCATION)).toBe("");
    expect(treeHref("/flashcard/manage", studySetLocation("p 1", "f", "s"))).toBe("/flashcard/manage?packageId=p+1&folderId=f&studySetId=s");
    expect(treeQuery({ ...ROOT_LOCATION, view: "search" })).toBe("?view=search");
    const loc = studySetLocation("p1", "f1", "s1");
    expect(readTreeLocation(params(treeQuery(loc).slice(1)))).toEqual(loc);
  });

  it("safeReturnUrl chỉ nhận đường dẫn nội bộ; withReturnUrl gắn đúng dấu ?/&", () => {
    expect(safeReturnUrl("/flashcard/manage?packageId=1", "/x")).toBe("/flashcard/manage?packageId=1");
    expect(safeReturnUrl("https://evil.test/", "/x")).toBe("/x");
    expect(safeReturnUrl("//evil.test", "/x")).toBe("/x");
    expect(safeReturnUrl("/a b", "/x")).toBe("/x");
    expect(safeReturnUrl(null, "/x")).toBe("/x");
    expect(withReturnUrl("/sets/create?folderId=f", "/back?a=1")).toBe("/sets/create?folderId=f&returnUrl=%2Fback%3Fa%3D1");
    expect(withReturnUrl("/sets/s1/edit", "/back")).toBe("/sets/s1/edit?returnUrl=%2Fback");
  });
});

describe("breadcrumb, lọc, phân trang, nhãn (content-tree-model)", () => {
  it("breadcrumb: chỉ các cấp có trong vị trí; cấp cuối active; tên chưa tải hiện '…'", () => {
    expect(buildBreadcrumb(labels, ROOT_LOCATION, {}).map((c) => [c.label, c.active])).toEqual([["Packages", true]]);
    const crumbs = buildBreadcrumb(labels, studySetLocation("p", "f", "s"), { packageName: "HSK 1", folderName: "Bài 1" });
    expect(crumbs.map((c) => [c.key, c.label, c.active])).toEqual([
      ["root", "Packages", false],
      ["package", "HSK 1", false],
      ["folder", "Bài 1", false],
      ["studySet", "…", true],
    ]);
    expect(crumbs[1].location).toEqual(packageLocation("p"));
    expect(crumbs[2].location).toEqual(folderLocation("p", "f"));
  });

  const pkgs: ContentPackage[] = [
    { id: "1", name: "Flashcard HSK 1", type: "LEARNING_PATH", publishStatus: "PUBLISHED", description: "Từ vựng cơ bản" },
    { id: "2", name: "Miễn phí", type: "FREE", publishStatus: "DRAFT" },
    { id: "3", name: "Video", type: "video_course", description: "hsk 3" },
  ];

  it("filterPackages theo loại (không phân biệt hoa/thường) + từ khoá trên tên/mô tả; countPackagesByType", () => {
    expect(filterPackages(pkgs, "ALL", "").map((p) => p.id)).toEqual(["1", "2", "3"]);
    expect(filterPackages(pkgs, "VIDEO_COURSE", "").map((p) => p.id)).toEqual(["3"]);
    expect(filterPackages(pkgs, "ALL", "  hsk ").map((p) => p.id)).toEqual(["1", "3"]);
    expect(filterPackages(pkgs, "FREE", "hsk")).toEqual([]);
    expect(countPackagesByType(pkgs, "video_course")).toBe(1);
    expect(filterByKeyword([{ a: "Xin Chào" }, { a: null }], "chào", (x) => [x.a])).toHaveLength(1);
  });

  it("publish: isPublished chỉ với PUBLISHED (mọi giá trị khác là Draft)", () => {
    expect(isPublished(pkgs[0])).toBe(true);
    expect(isPublished(pkgs[2])).toBe(false);
    expect(publishStatusInfo("PUBLISHED").label).toBe("Published");
    expect(publishStatusInfo(undefined)).toMatchObject({ label: "Draft", color: "#dc3545" });
  });

  it("packageTypeMeta: 4 loại mặc định của flashcard; loại lạ vẫn có meta hiển thị", () => {
    expect(DEFAULT_PACKAGE_TYPES.map((t) => t.value)).toEqual(["LEARNING_PATH", "LEARNING", "VIDEO_COURSE", "FREE"]);
    expect(packageTypeMeta(DEFAULT_PACKAGE_TYPES, "free").label).toBe("Học miễn phí");
    expect(packageTypeMeta(DEFAULT_PACKAGE_TYPES, "WEIRD")).toMatchObject({ value: "WEIRD", label: "WEIRD", description: "Chưa phân loại" });
    expect(packageTypeMeta(DEFAULT_PACKAGE_TYPES, undefined).label).toBe("Chưa phân loại");
  });

  it("clampPage/paginate: trang vô nghĩa về 1, vượt về trang cuối", () => {
    const list = Array.from({ length: 25 }, (_, i) => i + 1);
    expect(clampPage(0, 25, 10)).toBe(1);
    expect(clampPage(NaN, 25, 10)).toBe(1);
    expect(clampPage(99, 25, 10)).toBe(3);
    expect(clampPage(2.7, 25, 10)).toBe(2);
    expect(paginate(list, 3, 10)).toEqual([21, 22, 23, 24, 25]);
    expect(paginate(list, 9, 10)).toEqual([21, 22, 23, 24, 25]);
    expect(paginate([], 1, 10)).toEqual([]);
  });

  it("formatContentDate: ISO, epoch giây dạng chuỗi (backend gói cũ), thiếu/sai => N/A", () => {
    expect(formatContentDate("2026-03-05T08:30:00Z")).toBe("05/03/2026");
    expect(formatContentDate("1772700000")).toBe(formatContentDate(1772700000 * 1000));
    expect(formatContentDate(undefined)).toBe("N/A");
    expect(formatContentDate("không phải ngày")).toBe("N/A");
  });

  it("sortByIndex không đổi mảng gốc", () => {
    const items = [{ id: "b", studySetId: "s", index: 2 }, { id: "a", studySetId: "s", index: 0 }, { id: "c", studySetId: "s" }];
    expect(sortByIndex(items).map((i) => i.id)).toEqual(["a", "c", "b"]);
    expect(items[0].id).toBe("b");
  });
});

describe("kiểm tra form gói/thư mục/bộ (content-tree-validate)", () => {
  it("package: thiếu tên hoặc loại => thông điệp bản cũ; chuẩn hoá cắt khoảng trắng, mô tả rỗng => undefined", () => {
    expect(validatePackageInput({ name: "  ", type: "FREE" })).toBe("Vui lòng điền đầy đủ các trường bắt buộc");
    expect(validatePackageInput({ name: "A", type: "" })).not.toBeNull();
    expect(validatePackageInput({ name: "A", type: "FREE" })).toBeNull();
    expect(normalizePackageInput({ name: " A ", type: " FREE ", description: "  " })).toEqual({ name: "A", type: "FREE", description: undefined });
  });

  it("folder/studySet: thông điệp theo nhãn; studySet đòi skill khi hasSkill; isPrivate mặc định", () => {
    expect(validateFolderInput({ packageId: "p", name: "" }, labels)).toBe("Vui lòng nhập tên thư mục");
    expect(validateFolderInput({ packageId: "", name: "x" }, labels)).toBe("Vui lòng chọn package trước");
    expect(normalizeFolderInput({ packageId: "p", name: " x " })).toEqual({ packageId: "p", name: "x", description: undefined, isPrivate: false });
    expect(validateStudySetInput({ folderId: "f", title: " " }, labels, false)).toBe("Vui lòng nhập tên Bộ học");
    expect(validateStudySetInput({ folderId: "f", title: "t" }, labels, true)).toBe("Vui lòng chọn kỹ năng");
    expect(validateStudySetInput({ folderId: "f", title: "t", skill: "READING" }, labels, true)).toBeNull();
    expect(normalizeStudySetInput({ folderId: "f", title: " t ", skill: "READING" }, false)).toEqual({ folderId: "f", title: "t", description: undefined, isPrivate: true, skill: undefined });
  });

  it("writeErrorMessage: công tắc đóng/chưa cấu hình => 'chưa tích hợp'; ApiError => thông điệp của nó; khác => dự phòng", () => {
    expect(writeErrorMessage(new WriteDisabledError("content"), "x")).toBe(WRITE_NOT_INTEGRATED_MESSAGE);
    expect(writeErrorMessage(new ApiNotConfiguredError(), "x")).toBe(WRITE_NOT_INTEGRATED_MESSAGE);
    expect(writeErrorMessage(new ApiError("Bạn không có quyền thực hiện thao tác này.", 403), "x")).toBe("Bạn không có quyền thực hiện thao tác này.");
    expect(writeErrorMessage(new Error("boom"), "Xóa package thất bại")).toBe("Xóa package thất bại");
  });
});

describe("thẻ ghi nhớ (flashcard-card) và so khớp mục (content-item-diff)", () => {
  const card = (i: number, over: Partial<FlashcardCard> = {}): FlashcardCard => ({ id: `c${i}`, studySetId: "s1", index: i, term: `词${i}`, meaning: `nghĩa ${i}`, pinyin: `ci${i}`, ...over });
  const adapters = { itemToInput: flashcardToInput, normalizeItemInput: normalizeFlashcardInput };

  it("validate: chữ Hán và nghĩa bắt buộc; normalize cắt khoảng trắng, bỏ trường rỗng", () => {
    expect(validateFlashcardInput({ ...emptyFlashcardInput(), term: " ", meaning: "x" })).toBe("Vui lòng nhập chữ Hán");
    expect(validateFlashcardInput({ ...emptyFlashcardInput(), term: "你", meaning: "" })).toBe("Vui lòng nhập nghĩa tiếng Việt");
    expect(validateFlashcardInput({ ...emptyFlashcardInput(), term: "你", meaning: "bạn" })).toBeNull();
    expect(normalizeFlashcardInput({ term: " 你 ", meaning: " bạn ", pinyin: "", wordType: "  ", example: "x", imageFileId: "", audioFileId: "a1" })).toEqual({ term: "你", meaning: "bạn", pinyin: undefined, wordType: undefined, example: "x", exampleMeaning: undefined, imageFileId: undefined, audioFileId: "a1", index: undefined });
  });

  it("parseBulkCards: tab/phẩy/chấm phẩy/hai chấm/|, cột 3 là pinyin, bỏ dòng thiếu nghĩa và dòng trống", () => {
    const cards = parseBulkCards("你好\tXin chào\tnǐ hǎo\n谢谢, Cảm ơn\n再见;Tạm biệt\n\nchỉ một cột\n老师 : giáo viên\n学生|học sinh|xuésheng");
    expect(cards.map((c) => [c.term, c.meaning, c.pinyin])).toEqual([
      ["你好", "Xin chào", "nǐ hǎo"],
      ["谢谢", "Cảm ơn", ""],
      ["再见", "Tạm biệt", ""],
      ["老师", "giáo viên", ""],
      ["学生", "học sinh", "xuésheng"],
    ]);
    expect(parseBulkCards("")).toEqual([]);
  });

  it("diffContentItems: giữ id cũ, chỉ cập nhật khi đổi nội dung/thứ tự, tạo mục không id, xoá id không còn", () => {
    const existing = [card(0), card(1), card(2)];
    const diff = diffContentItems(existing, [
      { localId: "c1", id: "c1", input: flashcardToInput(card(1)) }, // lên đầu => đổi thứ tự
      { localId: "c0", id: "c0", input: { ...flashcardToInput(card(0)), meaning: "nghĩa mới" } }, // đổi nội dung + thứ tự
      { localId: "new", input: { ...emptyFlashcardInput(), term: "新", meaning: "mới" } },
    ], adapters);
    expect(diff.toUpdate.map((u) => [u.id, u.input.index, u.input.meaning])).toEqual([["c1", 0, "nghĩa 1"], ["c0", 1, "nghĩa mới"]]);
    expect(diff.toCreate).toEqual([{ term: "新", meaning: "mới", pinyin: undefined, wordType: undefined, example: undefined, exampleMeaning: undefined, imageFileId: undefined, audioFileId: undefined, index: 2 }]);
    expect(diff.toDeleteIds).toEqual(["c2"]);
  });

  it("diffContentItems: không đổi gì => không PUT/POST/DELETE (so sánh trên dạng chuẩn hoá)", () => {
    const existing = [card(0, { pinyin: undefined }), card(1)];
    const diff = diffContentItems(existing, existing.map((c) => ({ localId: c.id, id: c.id, input: { ...flashcardToInput(c), pinyin: c.pinyin ?? "  " } })), adapters);
    expect(diff).toEqual({ toCreate: [], toUpdate: [], toDeleteIds: [] });
  });
});
