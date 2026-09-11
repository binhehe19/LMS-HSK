"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FLASHCARD_CONFIG, FLASHCARD_MANAGE_PATH } from "@/components/management/content-flashcard/flashcard-config";
import { ContentSetEditor } from "@/components/management/content-tree/content-set-editor";
import type { ContentSetSaved } from "@/components/management/content-tree/use-content-set-editor";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { folderLocation, readId, ROOT_LOCATION, safeReturnUrl, studySetLocation, treeHref } from "@/lib/content/content-tree-params";

/**
 * /sets/create (tạo bộ thẻ kèm thẻ; `?packageId=&folderId=` chọn trước thư mục) và /sets/:id/edit (sửa bộ thẻ) — CreateSetPage/UpdateSetPage của HSK cũ.
 * `?returnUrl=` (đường dẫn nội bộ) là nơi quay về/sau khi lưu, do màn cây truyền vào; thiếu => về màn cây tại đúng thư mục/bộ vừa lưu.
 */
export function FlashcardSetEditorPageContent({ studySetId }: { studySetId?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const packageId = readId(params.get("packageId"));
  const folderId = packageId ? readId(params.get("folderId")) : null;
  const rawReturn = params.get("returnUrl");
  const fallbackBack = treeHref(FLASHCARD_MANAGE_PATH, packageId && folderId ? folderLocation(packageId, folderId) : ROOT_LOCATION);
  const backHref = safeReturnUrl(rawReturn, fallbackBack);
  const editId = studySetId === undefined ? null : readId(studySetId);

  if (studySetId !== undefined && !editId) {
    return (
      <ManagementPageFrame contentClassName="manage-flashcard-page content-tree-page">
        <div className="alert alert-warning mb-0" role="status" data-testid="set-editor-invalid-id">
          Mã bộ thẻ trong đường dẫn không hợp lệ. Hãy quay lại màn Quản lý Flashcards và chọn một bộ.
        </div>
      </ManagementPageFrame>
    );
  }

  const onSaved = (result: ContentSetSaved) => {
    // Có returnUrl hợp lệ => về đúng chỗ người dùng đến; không có => mở bộ vừa lưu trong cây (khi biết đủ gói/thư mục).
    if (rawReturn && backHref === rawReturn.trim()) router.push(backHref);
    else router.push(result.packageId ? treeHref(FLASHCARD_MANAGE_PATH, studySetLocation(result.packageId, result.folderId, result.studySetId)) : fallbackBack);
  };

  return <ContentSetEditor config={FLASHCARD_CONFIG} mode={editId ? { kind: "edit", studySetId: editId } : { kind: "create", packageId, folderId }} backHref={backHref} onSaved={onSaved} />;
}
