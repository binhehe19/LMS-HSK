"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { minHeight?: number };

const fit = (el: HTMLTextAreaElement | null, minHeight: number) => {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
};

/**
 * Port của LMS_Frontend/src/core/common/auto-grow-textarea.tsx: textarea tự cao theo nội dung và vẫn cho kéo chỉnh chiều cao (resize: vertical).
 * Chỉ màn chấm bài dùng (ô "Nhận xét của giáo viên") nên đặt cạnh component thay vì shared/.
 */
export function AutoGrowTextarea({ minHeight = 80, style, value, onChange, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    fit(ref.current, minHeight);
  }, [value, minHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        fit(e.currentTarget, minHeight);
      }}
      style={{ resize: "vertical", overflow: "auto", minHeight, ...style }}
      {...rest}
    />
  );
}
