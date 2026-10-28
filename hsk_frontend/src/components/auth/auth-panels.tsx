"use client";

import type { ReactNode } from "react";

/** Các trạng thái hạ tầng (đang kiểm tra phiên, lỗi, không đủ quyền). Dùng class Bootstrap sẵn có. */

export function FullScreenSpinner() {
  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100" role="status" aria-live="polite">
      <div className="spinner-border text-primary" aria-hidden="true" />
      <span className="visually-hidden">Đang kiểm tra phiên đăng nhập…</span>
    </div>
  );
}

export function FullScreenMessage({
  title,
  children,
  testId,
}: {
  title: string;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="d-flex flex-column align-items-center justify-content-center min-vh-100 text-center p-4"
      data-testid={testId}
    >
      <h1 className="h3 mb-2">{title}</h1>
      {children}
    </div>
  );
}
