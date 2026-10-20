import type { ImgHTMLAttributes } from "react";

/**
 * Tương đương ImageWithBasePath của LMS_Frontend: <img> thường trỏ tới tài sản tĩnh trong /public
 * (src tương đối "assets/..." được chuẩn hoá thành "/assets/..."). Cố ý KHÔNG dùng next/image để
 * giữ nguyên kích thước/hiển thị như bản cũ (không qua bộ tối ưu ảnh).
 */
export function AssetImage({ src, alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const isAbsolute = /^(https?:)?\/\//i.test(src) || src.startsWith("data:") || src.startsWith("blob:");
  const resolved = isAbsolute ? src : `/${src.replace(/^\/+/, "")}`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolved} alt={alt} {...props} />;
}
