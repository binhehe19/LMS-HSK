import type { ReactNode } from "react";
import { Button } from "antd";
import { FetchErrorNotice } from "@/components/shared/fetch-state-notice";
import { useStudentDesktop } from "./use-student-desktop";

export function StudentContentState({ kind, className = "", children }: {
  kind: "loading" | "empty";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`student-content-state ${className}`} role="status" data-state={kind}>
      {children}
    </div>
  );
}

export function StudentFetchError({ title, description, className, onRetry, mobileContent, mobileRetryClassName, onBack }: {
  title: string;
  description: string;
  className?: string;
  onRetry?: () => void;
  mobileContent?: ReactNode;
  mobileRetryClassName?: string;
  onBack?: () => void;
}) {
  const desktop = useStudentDesktop();
  if (desktop) {
    return (
      <FetchErrorNotice title={title} description={description} onRetry={onRetry} className="student-fetch-error">
        {onBack && <Button className="ms-2" onClick={onBack}>Quay lại</Button>}
      </FetchErrorNotice>
    );
  }
  return (
    <div className={className} role="alert">
      {mobileContent ?? description}
      {onRetry && <button type="button" className={mobileRetryClassName} onClick={onRetry}>Thử lại</button>}
      {onBack && <button type="button" onClick={onBack}>Quay lại</button>}
    </div>
  );
}
