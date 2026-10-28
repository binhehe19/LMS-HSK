"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ClassListState } from "@/components/management/class-management/use-admin-classes";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { listTeacherGradingClasses } from "@/lib/api/quiz-grading-client";

/**
 * Tải danh sách lớp của giảng viên. `not-integrated` = dịch vụ quiz chưa cấu hình (WAITING FOR BACKEND), khác `error` (đã gọi nhưng thất bại).
 * Không có dữ liệu mẫu thay thế khi chưa có/lỗi. Bản cũ biến mọi lỗi/phản hồi sai thành toast + danh sách rỗng ("Chưa có lớp được phân công"), che lỗi.
 * Dùng chung kiểu trạng thái với màn Admin (ClassListState).
 */
export function useTeacherClasses() {
  const [state, setState] = useState<ClassListState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listTeacherGradingClasses()
      .then((data): ClassListState => (Array.isArray(data) ? { kind: "ok", classes: data } : { kind: "error", message: "Dữ liệu trả về không đúng định dạng danh sách lớp." }))
      .catch((error: unknown): ClassListState => {
        if (error instanceof ApiNotConfiguredError) return { kind: "not-integrated", message: "Chức năng chưa được kết nối API (WAITING FOR BACKEND)." };
        const message = error instanceof ApiError ? error.message : "Không tải được danh sách lớp.";
        toast.error(message || "Không tải được danh sách lớp"); // như bản cũ (toast), nhưng KHÔNG còn hiện "chưa có lớp" sau đó
        return { kind: "error", message };
      })
      .then((next) => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
