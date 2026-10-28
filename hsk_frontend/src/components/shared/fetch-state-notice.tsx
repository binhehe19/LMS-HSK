"use client";

import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";

/**
 * Dòng thông báo thống nhất cho hai trạng thái tải không có dữ liệu: `waiting` (dịch vụ chưa cấu hình — WAITING FOR BACKEND, không có "Thử lại") và
 * `error` (đã gọi nhưng thất bại, có "Thử lại"). Trạng thái khác => null. Dùng cùng một mẫu alert như các màn M4A/M4B để các màn mới nhất quán.
 */
export function FetchStateNotice<T>({ state, waitingText, onRetry, testId = "fetch-notice", className = "" }: { state: FetchState<T>; waitingText: string; onRetry?: () => void; testId?: string; className?: string }) {
  if (state.kind !== "waiting" && state.kind !== "error") return null;
  return (
    <div className={`alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 mb-0 ${className}`} role="status" data-testid={testId} data-kind={state.kind}>
      <span>{state.kind === "error" ? state.message : waitingText}</span>
      {state.kind === "error" && onRetry && (
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

/** Khối nhỏ cho thao tác GHI bị công tắc đóng (write-gate.ts): nói rõ vì sao nút bị khoá, không bịa thành công. */
export function WriteLockedNotice({ what = "Thao tác ghi", className = "" }: { what?: string; className?: string }) {
  return (
    <div className={`alert alert-secondary py-2 small mb-0 ${className}`} role="status" data-testid="write-locked">
      {what} chưa được tích hợp với backend (WAITING FOR BACKEND): chỉ xem, chưa lưu được.
    </div>
  );
}
