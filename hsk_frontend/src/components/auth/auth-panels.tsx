"use client";

import type { ReactNode } from "react";
import Image from "next/image";

/** Các trạng thái hạ tầng (đang kiểm tra phiên, lỗi, không đủ quyền). Dùng class Bootstrap sẵn có. */

export function AuthCard({
  title,
  children,
  pending = false,
  testId,
}: {
  title: string;
  children?: ReactNode;
  pending?: boolean;
  testId?: string;
}) {
  return (
    <main className="d-flex min-vh-100 align-items-center justify-content-center bg-light p-3">
      <section
        className="w-100 rounded-4 border bg-white p-4 p-sm-5 text-center shadow-sm"
        style={{ maxWidth: 420 }}
        role={pending ? "status" : undefined}
        data-testid={testId}
      >
        <Image src="/assets/hocba/tkb-mascot.png" width={144} height={108} alt="" className="mb-3" />
        <h1 className="h3 mb-2">{title}</h1>
        {pending && <span className="spinner-border spinner-border-sm text-primary mt-3" aria-hidden="true" />}
        {children}
      </section>
    </main>
  );
}

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
