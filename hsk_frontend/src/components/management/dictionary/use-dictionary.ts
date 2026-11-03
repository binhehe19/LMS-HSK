"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { useContentAccess } from "@/hooks/use-content-access";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError } from "@/lib/api/api-client";
import { createVocabulary, deleteVocabulary, getVocabulary, searchVocabularies, updateVocabulary } from "@/lib/api/lms-dictionary-client";
import { writeErrorMessage } from "@/lib/content/content-tree-validate";
import { buildVocabularyPayload, validateVocabularyForm, type VocabularyFormValues } from "@/lib/dictionary/vocabulary-form";
import { type DictionaryFilters, dictionaryHref, dictionaryQuery, readDictionaryFilters, toSearchParams } from "@/lib/dictionary/vocabulary-model";
import type { Vocabulary, VocabularyPage } from "@/types/dictionary";

export type FilterNavigation = "push" | "replace";

/**
 * Logic màn Từ điển (manage-vocabulary.tsx cũ): bộ lọc + trang nằm trong URL, tìm kiếm phía máy chủ theo khoá bộ lọc, quyền theo ticket DICTIONARY
 * + công tắc ghi "content", và các thao tác ghi (tạo/sửa/xoá; tải chi tiết trước khi sửa như bản cũ).
 *
 * Khác bản cũ có chủ đích: (1) bộ lọc trong URL (reload/back giữ đúng kết quả; bản cũ useState); (2) lỗi tải là trạng thái của màn, không toast;
 * (3) sau khi ghi tải lại từ máy chủ (bản cũ invalidate react-query); (4) write gate: nút ẩn khi đóng, client tự chặn — không "thành công giả".
 */
export function useDictionary() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = useMemo(() => readDictionaryFilters(params), [params]);
  const access = useContentAccess("DICTIONARY");
  const { enabled: writeEnabled, demo } = useWriteGate("content");
  const canWrite = access.canManage && writeEnabled;

  const list = useKeyedFetch<VocabularyPage>(`dictionary:${dictionaryQuery(filters) || "?"}`, async () => {
    const data = await searchVocabularies(toSearchParams(filters));
    // Bản cũ coi phản hồi là mảng (sai hình) là trang rỗng; ở đây sai hợp đồng = lỗi hiển thị được.
    if (!data || typeof data !== "object" || !Array.isArray(data.items)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách từ vựng.", 200, "CONTRACT");
    return data;
  });

  const setFilters = useCallback(
    (next: DictionaryFilters, navigation: FilterNavigation = "push") => {
      const href = dictionaryHref(pathname, next);
      if (navigation === "replace") router.replace(href);
      else router.push(href);
    },
    [router, pathname],
  );

  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = async <T,>(fallback: string, work: () => Promise<T>): Promise<T | null> => {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    try {
      return await work();
    } catch (error) {
      toast.error(writeErrorMessage(error, fallback));
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  /** Bản cũ gọi getById trước khi mở form sửa (danh sách là bản rút gọn, thiếu nghĩa/ví dụ đầy đủ). */
  const loadForEdit = (id: string): Promise<Vocabulary | null> => run("Không thể tải thông tin từ vựng", () => getVocabulary(id));

  const save = async (values: VocabularyFormValues, editing: Vocabulary | null): Promise<boolean> => {
    const invalid = validateVocabularyForm(values);
    if (invalid) {
      toast.error(invalid.message);
      return false;
    }
    const payload = buildVocabularyPayload(values);
    const result = editing ? await run("Cập nhật thất bại", () => updateVocabulary(editing.id, payload, demo)) : await run("Thêm thất bại", () => createVocabulary(payload, demo));
    if (!result) return false;
    toast.success(editing ? "Cập nhật thành công!" : "Thêm mới thành công!");
    if (!editing && filters.page !== 1) setFilters({ ...filters, page: 1 }, "replace");
    else list.reload();
    return true;
  };

  const remove = async (vocab: Vocabulary): Promise<boolean> => {
    const result = await run("Đã xảy ra lỗi khi xóa", () => deleteVocabulary(vocab.id, demo));
    if (result === null) return false;
    toast.success("Xóa từ vựng thành công");
    list.reload();
    return true;
  };

  const page = list.state.kind === "ok" ? list.state.data : (list.lastData ?? null);

  return {
    filters,
    setFilters,
    state: list.state,
    /** Trang đang hiển thị: kết quả mới nhất hoặc kết quả trước đó trong lúc tải lại. */
    page,
    refreshing: list.state.kind === "loading" && list.lastData !== null,
    reload: list.reload,
    access,
    writeEnabled,
    canWrite,
    busy,
    loadForEdit,
    save,
    remove,
  };
}
