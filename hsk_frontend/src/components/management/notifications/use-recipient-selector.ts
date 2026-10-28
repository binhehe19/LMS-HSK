"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import { fetchAdminUsers } from "@/lib/api/admin-user-client";
import { clampedPageOrNull } from "@/lib/notifications/pagination";
import type { AdminUser, AdminUserListResponse } from "@/types/admin-user";

const USER_PAGE_SIZE = 10; // như RecipientSelectorModal cũ (size: 10)

/**
 * Logic của modal "Chọn người dùng nhận thông báo": tìm kiếm + lọc vai trò + phân trang (chỉ đọc), "chọn tất cả" theo bộ lọc.
 * `onAddMany` đưa người đã lấy vào danh sách đã chọn (do form quản lý).
 */
export function useRecipientSelector(show: boolean, onAddMany: (users: AdminUser[]) => void) {
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(0);
  const [isSelectingAll, setIsSelectingAll] = useState(false);

  const { state, reload, lastData } = useKeyedFetch<AdminUserListResponse>(show ? JSON.stringify(["users", page, appliedSearch, roleFilter]) : null, async () => {
    try {
      const result = await fetchAdminUsers({ page, size: USER_PAGE_SIZE, search: appliedSearch, role: roleFilter === "" ? undefined : roleFilter });
      // Trang hiện tại không còn hợp lệ => về trang cuối còn dữ liệu (đổi khoá nên kết quả của trang cũ bị bỏ).
      const lastValid = clampedPageOrNull(page, result?.totalElements ?? 0, USER_PAGE_SIZE);
      if (lastValid !== null) setPage(lastValid);
      return result;
    } catch (error) {
      if (!(error instanceof ApiNotConfiguredError)) toast.error("Không tải được danh sách người dùng"); // như bản cũ
      throw error;
    }
  });

  const data = state.kind === "ok" ? state.data : null;

  /** Tìm kiếm chỉ áp dụng khi bấm "Tìm kiếm" (như bản cũ); luôn về trang đầu. */
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setAppliedSearch(searchInput);
    setPage(0);
  };

  const changeRole = (role: string) => {
    setRoleFilter(role);
    setPage(0);
  };

  /** "Chọn tất cả …": hỏi tổng số rồi lấy hết người phù hợp bộ lọc (đúng 2 bước như bản cũ). */
  const selectAllMatching = async () => {
    setIsSelectingAll(true);
    try {
      const filter = { search: searchInput, role: roleFilter === "" ? undefined : roleFilter };
      const first = await fetchAdminUsers({ page: 0, size: 1, ...filter });
      const total = first.totalElements;
      if (total > 0) {
        const all = await fetchAdminUsers({ page: 0, size: total, ...filter });
        if (all.items.length < total) {
          // Khác bản cũ có chủ đích: bản cũ báo "Đã chọn tất cả N" kể cả khi máy chủ giới hạn kích thước trang và chỉ trả một phần.
          onAddMany(all.items);
          toast.error(`Chỉ lấy được ${all.items.length}/${total} người dùng (máy chủ giới hạn kích thước trang). Hãy thu hẹp bộ lọc hoặc chọn thêm.`);
        } else {
          onAddMany(all.items);
          toast.success(`Đã chọn tất cả ${total} người dùng phù hợp`);
        }
      } else {
        toast.info("Không có người dùng nào phù hợp để chọn");
      }
    } catch {
      toast.error("Không thể chọn tất cả người dùng");
    } finally {
      setIsSelectingAll(false);
    }
  };

  return {
    state,
    users: data && Array.isArray(data.items) ? data.items : [],
    totalPages: lastData?.totalPages ?? 1, // giữ khi đang tải trang khác (bản cũ giữ totalPages trong state)
    page,
    searchInput,
    roleFilter,
    isSelectingAll,
    setSearchInput,
    changeRole,
    submitSearch,
    goToPage: setPage,
    selectAllMatching,
    reload,
  };
}
