/* eslint-disable @next/next/no-img-element */
import type { ImgHTMLAttributes } from "react";

export default function ImageWithBasePath({ src = "", alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return <img {...props} src={typeof src === "string" && src.startsWith("assets/") ? `/${src}` : src} alt={alt} />;
}

export function Spinner() {
  return <span className="spinner-border spinner-border-sm text-danger" role="status" aria-label="Đang tải" />;
}
