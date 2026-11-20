"use client";

import { Button, Empty } from "antd";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";

export function FetchErrorNotice({ title = "Không thể tải dữ liệu", description, onRetry, testId = "fetch-notice", className = "" }: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  testId?: string;
  className?: string;
}) {
  const detail = description?.trim();
  return (
    <div className={`py-2 ${className}`} role="alert" data-testid={testId} data-kind="error">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={(
        <>
          <div className="fw-semibold text-dark">{title}</div>
          <div className="small text-muted mt-1">{detail && !/^internal server error$/i.test(detail) ? detail : "Hãy thử tải lại dữ liệu."}</div>
        </>
      )}>
        {onRetry && <Button onClick={onRetry} icon={<i className="isax isax-refresh" aria-hidden="true" />}>Thử lại</Button>}
      </Empty>
    </div>
  );
}

/**
 * `waiting` báo dịch vụ chưa cấu hình, `error` hiện khung lỗi tải cùng thao tác thử lại.
 */
export function FetchStateNotice<T>({ state, waitingText, onRetry, testId = "fetch-notice", className = "" }: { state: FetchState<T>; waitingText: string; onRetry?: () => void; testId?: string; className?: string }) {
  if (state.kind === "error") {
    return <FetchErrorNotice description={state.message} onRetry={onRetry} testId={testId} className={`border rounded-3 ${className}`} />;
  }
  if (state.kind !== "waiting") return null;
  return (
    <div className={`alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 mb-0 ${className}`} role="status" data-testid={testId} data-kind={state.kind}>
      <span>{waitingText}</span>
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
