"use client";

import { WRITING_CONFIG } from "@/components/management/content-hanzi/hanzi-config";
import { ContentTreeManager } from "@/components/management/content-tree/content-tree-manager";

/**
 * Màn "Quản lý Luyện viết" /hanzi/manage (HSK cũ: ManageHanzi). Khác bản cũ có chủ đích: bản cũ chỉ có 3 cấp (gói → thư mục → bộ) và bấm bộ là sang
 * trang sửa; nền content-tree thêm cấp mục (danh sách chữ) với Thêm/Sửa/Xoá từng chữ, vẫn có nút "Chỉnh sửa bộ học" sang /hanzi/edit/:id.
 * `?type=` của bản cũ (khoá tab theo loại gói) không còn: tab loại nằm trong màn.
 */
export function HanziManagePageContent() {
  return <ContentTreeManager config={WRITING_CONFIG} />;
}
