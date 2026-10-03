"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError } from "@/lib/api/api-client";
import { searchItems, updateItem } from "@/lib/api/content-tree-client";
import { writeErrorMessage } from "@/lib/content/content-tree-validate";
import type { ContentItemBase, ContentItemInput, ContentItemWithContext, ContentModuleConfig, ContentPage } from "@/types/content";

const ITEM_SEARCH_PAGE_SIZE = 20; // như VocabularyManager cũ (size: 20)
const DEBOUNCE_MS = 300;

/**
 * Tab tìm mục toàn cây (VocabularyManager của HSK cũ): từ khoá chờ 300ms rồi mới tìm, phân trang phía máy chủ, sửa nhanh một mục.
 * `enabled = false` (đang ở tab cây) => không gọi API. Khác bản cũ có chủ đích: lỗi/chưa cấu hình là trạng thái hiển thị, không phải bảng rỗng.
 */
export function useContentItemSearch<TItem extends ContentItemBase>(config: ContentModuleConfig<TItem>, enabled: boolean, demo: boolean) {
  const [term, setTerm] = useState("");
  // Từ khoá đã áp dụng + trang đi cùng nhau: đổi từ khoá => về trang đầu (như bản cũ), chỉ đổi trang => giữ từ khoá.
  const [search, setSearch] = useState({ query: "", page: 0 });
  const { query, page } = search;
  const target = { apiPrefix: config.apiPrefix, itemsPath: config.itemsPath };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = term.trim();
      setSearch((prev) => (prev.query === next ? prev : { query: next, page: 0 }));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [term]);
  const setPage = (next: number) => setSearch((prev) => ({ ...prev, page: next }));

  const fetch = useKeyedFetch<ContentPage<ContentItemWithContext<TItem>>>(enabled ? `${config.key}:search:${query}:${page}` : null, async () => {
    const data = await searchItems<TItem>(target, query, page, ITEM_SEARCH_PAGE_SIZE);
    if (!data || !Array.isArray(data.items)) throw new ApiError("Dữ liệu trả về không đúng định dạng kết quả tìm kiếm.", 200, "CONTRACT");
    return data;
  });

  const [saving, setSaving] = useState(false);
  const save = async (item: TItem, input: ContentItemInput<TItem>): Promise<boolean> => {
    const invalid = config.validateItemInput(input);
    if (invalid) {
      toast.error(invalid);
      return false;
    }
    setSaving(true);
    try {
      await updateItem<TItem>(target, item.id, { ...config.normalizeItemInput(input), index: item.index }, demo);
      toast.success(`Cập nhật ${config.labels.item.toLowerCase()} thành công!`);
      fetch.reload();
      return true;
    } catch (error) {
      toast.error(writeErrorMessage(error, "Cập nhật thất bại"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const result = fetch.state.kind === "ok" ? fetch.state.data : (fetch.lastData ?? null);
  return { term, setTerm, query, page, setPage, state: fetch.state, result, reload: fetch.reload, saving, save };
}
