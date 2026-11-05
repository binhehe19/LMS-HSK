"use client";

// Khung popup dùng chung cho các màn luyện tập từ vựng (practice-modal.tsx của HSK cũ): header gradient theo theme, nút Đóng,
// Esc / bấm nền để đóng (chạy animation trượt ra rồi mới unmount), khoá cuộn trang. Render qua portal vào body, bọc trong
// .hsk-vocab-modal để SCSS của popup không rò sang khu khác.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AssetImage } from "@/components/shared/asset-image";
import "./practice-modal.scss";

/** Thời lượng animation đóng — phải khớp @keyframes pm-slide-out trong SCSS. */
const CLOSE_ANIMATION_MS = 160;

export type PracticeModalTheme = "red" | "blue" | "green" | "coral";

interface PracticeModalProps {
  /** class icon isax hiển thị bên trái tiêu đề */
  icon: string;
  /** ảnh icon (asset Figma) dùng thay cho icon isax ở tiêu đề */
  iconSrc?: string;
  title: string;
  /** chữ Hán hiển thị cạnh tiêu đề (vd "Luyện phát âm: 山") */
  hanzi?: string;
  onClose: () => void;
  children: ReactNode;
  /** thay nút "Đóng" mặc định ở chân popup */
  footer?: ReactNode;
  /** rộng hơn mặc định 650px */
  wide?: boolean;
  theme?: PracticeModalTheme;
  /** ẩn chân popup (khi popup tự dựng phần dưới) */
  noFooter?: boolean;
}

export function PracticeModal({ icon, iconSrc, title, hanzi, onClose, children, footer, wide, theme = "red", noFooter }: PracticeModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    if (closeTimerRef.current !== null) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(onClose, CLOSE_ANIMATION_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [requestClose]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  return createPortal(
    <div className="hsk-vocab-modal">
      <div className={`pm-overlay ${isClosing ? "is-closing" : ""}`} onClick={requestClose} role="presentation">
        <div
          className={`pm-modal pm-modal--${theme} ${wide ? "pm-modal--wide" : ""} ${isClosing ? "is-closing" : ""}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={hanzi ? `${title} ${hanzi}` : title}
        >
          <header className="pm-head">
            <div className="pm-head__title">
              {iconSrc ? <AssetImage className="pm-head__icon" src={iconSrc} alt="" /> : <i className={`isax ${icon}`} />}
              <span>{title}</span>
              {hanzi && <span className="pm-head__hanzi">{hanzi}</span>}
            </div>
            <button type="button" className="pm-head__close" onClick={requestClose} aria-label="Đóng">
              <i className="isax isax-close-square" />
            </button>
          </header>

          <div className="pm-body">{children}</div>

          {!noFooter && (
            <footer className="pm-foot">
              {footer ?? (
                <button type="button" className="pm-btn-close" onClick={requestClose}>
                  Đóng
                </button>
              )}
            </footer>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
