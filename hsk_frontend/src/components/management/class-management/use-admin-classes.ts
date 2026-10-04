"use client";

import { useCallback, useEffect, useState } from "react";
import { listAdminClasses } from "@/lib/api/admin-class-source";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import type { GradingClassResponse } from "@/types/grading";

/**
 * Trạng thái màn danh sách lớp. `not-integrated` = service chưa được cấu hình (WAITING FOR BACKEND), khác với
 * `error` (đã gọi nhưng thất bại). Không có dữ liệu mẫu tự động thay thế khi lỗi.
 */
export type ClassListState =
  | { kind: "loading" }
  | { kind: "ok"; classes: GradingClassResponse[] }
  | { kind: "not-integrated"; message: string }
  | { kind: "error"; message: string };

export function useAdminClasses() {
  const [state, setState] = useState<ClassListState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Nguồn: backend chung (/api/lms, production) hoặc hợp đồng đề xuất HSK cũ (/api/quiz, chỉ xem trước/kiểm thử) — xem lib/api/admin-class-source.ts.
    listAdminClasses()
      .then((data): ClassListState => {
        // Bản cũ biến mọi phản hồi không phải mảng thành [] (che lỗi hợp đồng); ở đây coi là lỗi.
        if (!Array.isArray(data)) {
          return { kind: "error", message: "Dữ liệu trả về không đúng định dạng danh sách lớp." };
        }
        return { kind: "ok", classes: data };
      })
      .catch((error: unknown): ClassListState => {
        if (error instanceof ApiNotConfiguredError) {
          return { kind: "not-integrated", message: "Chức năng chưa được kết nối API (WAITING FOR BACKEND)." };
        }
        if (error instanceof ApiError) return { kind: "error", message: error.message };
        return { kind: "error", message: "Không tải được danh sách lớp học." };
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
