"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { HANZI_MANAGE_PATH, WRITING_CONFIG } from "@/components/management/content-hanzi/hanzi-config";
import { ContentSetEditor } from "@/components/management/content-tree/content-set-editor";
import type { ContentSetSaved } from "@/components/management/content-tree/use-content-set-editor";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { folderLocation, readId, ROOT_LOCATION, safeReturnUrl, studySetLocation, treeHref } from "@/lib/content/content-tree-params";

/**
 * /hanzi/create (tạo bộ học kèm danh sách chữ; `?packageId=&folderId=` chọn trước thư mục) và /hanzi/edit/:id (sửa bộ) — HanziCreateSetPage
 * (sets/create-set-page.tsx) của HSK cũ dùng cho cả hai route. `?returnUrl=` (đường dẫn nội bộ) là nơi quay về sau khi lưu, do màn cây truyền vào;
 * thiếu => về màn cây tại đúng thư mục/bộ vừa lưu. Khác bản cũ có chủ đích: bản cũ quay về bằng `?type=&packageId=&folderId=` và dropdown thư mục toàn
 * hệ thống; ở đây chọn gói → thư mục và dùng returnUrl như các module khác; bản cũ khởi tạo 3 dòng chữ trống, nền dùng chung khởi tạo 1.
 */
export function HanziSetEditorPageContent({ studySetId }: { studySetId?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const packageId = readId(params.get("packageId"));
  const folderId = packageId ? readId(params.get("folderId")) : null;
  const rawReturn = params.get("returnUrl");
  const fallbackBack = treeHref(HANZI_MANAGE_PATH, packageId && folderId ? folderLocation(packageId, folderId) : ROOT_LOCATION);
  const backHref = safeReturnUrl(rawReturn, fallbackBack);
  const editId = studySetId === undefined ? null : readId(studySetId);

  if (studySetId !== undefined && !editId) {
    return (
      <ManagementPageFrame contentClassName="manage-hanzi-page content-tree-page">
        <div className="alert alert-warning mb-0" role="status" data-testid="set-editor-invalid-id">
          Mã bộ học trong đường dẫn không hợp lệ. Hãy quay lại màn Quản lý Luyện viết và chọn một bộ học.
        </div>
      </ManagementPageFrame>
    );
  }

  const onSaved = (result: ContentSetSaved) => {
    if (rawReturn && backHref === rawReturn.trim()) router.push(backHref);
    else router.push(result.packageId ? treeHref(HANZI_MANAGE_PATH, studySetLocation(result.packageId, result.folderId, result.studySetId)) : fallbackBack);
  };

  return <ContentSetEditor config={WRITING_CONFIG} mode={editId ? { kind: "edit", studySetId: editId } : { kind: "create", packageId, folderId }} backHref={backHref} onSaved={onSaved} />;
}
