"use client";

import { PRONUNCIATION_CONFIG } from "@/components/management/content-pronunciation/pronunciation-config";
import { ContentTreeManager } from "@/components/management/content-tree/content-tree-manager";

/**
 * Màn "Quản lý Phát âm" /pronunciation/manage (HSK cũ: ManagePronunciation). Khác bản cũ có chủ đích: bảng mục có dòng mở rộng (hướng dẫn/media) =>
 * nút "Xem" hiện khối xem nhanh phía trên bảng; `?type=` (tab loại trên URL) không còn, tab loại nằm trong màn; ô tìm theo cấp giữ ở từng view.
 */
export function PronunciationManagePageContent() {
  return <ContentTreeManager config={PRONUNCIATION_CONFIG} />;
}
