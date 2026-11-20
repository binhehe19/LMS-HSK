"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

export interface NativeModalProps {
  show: boolean;
  onHide: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  dialogClassName?: string;
  size?: string;
  backdrop?: boolean;
}

// Native dialog provides focus trapping, Escape and focus restoration without Bootstrap JS.
export default function NativeModal({ show, onHide, title, children, className = "", dialogClassName = "" }: NativeModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (show && dialog && !dialog.open) dialog.showModal();
    if (!show && dialog?.open) dialog.close();
  }, [show]);
  if (!show) return null;
  return (
    <dialog ref={ref} className={`student-native-modal ${className}`} data-student-dialog={title ? "standard" : undefined} aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : "Chi tiết khóa học"} onCancel={onHide} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onHide();
    }}>
      <div className={`modal-dialog ${dialogClassName}`}>
        <div className="modal-content">
          {title && <div className="modal-header"><h2 id={titleId} className="h5 mb-0">{title}</h2><button type="button" className="btn-close" aria-label="Đóng" onClick={onHide} /></div>}
          <div className={title ? "modal-body" : undefined}>{children}</div>
        </div>
      </div>
    </dialog>
  );
}
