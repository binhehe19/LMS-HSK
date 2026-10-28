"use client";

import { useState } from "react";
import { ManageStorageView } from "@/components/management/manage-storage/manage-storage-view";
import { StorageItemModal } from "@/components/management/manage-storage/storage-item-modal";
import { useManageStorage, type StorageItemFormValues } from "@/components/management/manage-storage/use-manage-storage";
import { VideoDetailModal } from "@/components/management/manage-storage/video-detail-modal";
import { VideoUploadModal } from "@/components/management/manage-storage/video-upload-modal";
import { confirmAction } from "@/components/shared/confirm-action";
import { isPackagePublished, STORAGE_ITEM_LABEL, studySetLabel, type StorageItemType } from "@/lib/hsk-storage/storage-model";
import type { StorageFolder, StoragePackage, StorageStudySet, StorageVideo } from "@/types/hsk-storage";

type ModalState = { kind: "item"; type: StorageItemType; editingId: string | null; values: StorageItemFormValues; key: number } | { kind: "upload"; key: number } | null;

const EMPTY_VALUES: StorageItemFormValues = { name: "", description: "", isPrivate: false };

/**
 * Container màn /instructor/manage-storage (HSK cũ: ManageStorage; ADMIN, TEACHER, MENTOR): nối hook với view thuần và các modal; xác nhận
 * xoá/publish bằng confirmAction (antd Modal.confirm) với đúng chữ của hai modal tự vẽ của bản cũ.
 */
export function ManageStoragePageContent() {
  const storage = useManageStorage();
  const [modal, setModal] = useState<ModalState>(null);
  const nextKey = (prev: ModalState) => (prev?.key ?? 0) + 1;

  const openItem = (type: StorageItemType, editingId: string | null, values: StorageItemFormValues) => setModal((prev) => ({ kind: "item", type, editingId, values, key: nextKey(prev) }));

  const submitItem = async (values: StorageItemFormValues) => {
    if (modal?.kind !== "item") return;
    if (await storage.saveItem(modal.type, values, modal.editingId)) setModal(null);
  };

  const confirmDelete = async (type: StorageItemType, id: string, name: string) => {
    const ok = await confirmAction({
      title: `Xóa ${STORAGE_ITEM_LABEL[type]}`,
      content: (
        <div className="text-center">
          <p className="text-muted mb-1">
            Bạn có chắc chắn muốn xóa <strong>&quot;{name}&quot;</strong>?
          </p>
          {type === "PACKAGE" && (
            <p className="text-danger small mb-0">
              <strong>Cảnh báo:</strong> Xóa gói sẽ xóa toàn bộ thư mục và bộ học bên trong!
            </p>
          )}
          <p className="text-muted small mb-0">Hành động này không thể hoàn tác.</p>
        </div>
      ),
      okText: "Xóa",
      cancelText: "Hủy",
      danger: true,
    });
    if (ok) await storage.deleteItem(type, id);
  };

  const togglePublish = async (pkg: StoragePackage) => {
    const publishing = !isPackagePublished(pkg);
    const ok = await confirmAction({
      title: publishing ? "Xác nhận Publish" : "Xác nhận Unpublish",
      content: publishing ? `Bạn có chắc muốn publish gói "${pkg.name}"?` : `Bạn có chắc muốn chuyển gói "${pkg.name}" về Draft?`,
      okText: publishing ? "Publish" : "Unpublish",
      cancelText: "Hủy",
      danger: !publishing,
    });
    if (ok) await storage.setPublished(pkg, publishing);
  };

  const deleteVideo = async (video: StorageVideo) => {
    const ok = await confirmAction({ title: "Xóa video", content: `Xóa video "${video.name}" khỏi kho lưu trữ? Hành động này không thể hoàn tác.`, okText: "Xóa", cancelText: "Hủy", danger: true });
    if (ok) await storage.removeVideo(video);
  };

  const submitUpload = async (file: File, title: string, description: string) => {
    if (await storage.uploadVideo(file, title, description)) setModal(null);
  };

  return (
    <>
      <ManageStorageView
        storage={storage}
        onGoTo={storage.goTo}
        onSelectPackage={(pkg) => storage.select({ pkg, folder: null, studySet: null })}
        onSelectFolder={(folder) => storage.select({ ...storage.selection, folder, studySet: null })}
        onSelectStudySet={(studySet) => storage.select({ ...storage.selection, studySet })}
        onCreatePackage={() => openItem("PACKAGE", null, EMPTY_VALUES)}
        onEditPackage={(pkg: StoragePackage) => openItem("PACKAGE", pkg.id, { name: pkg.name, description: pkg.description || "", isPrivate: false })}
        onDeletePackage={(pkg) => void confirmDelete("PACKAGE", pkg.id, pkg.name)}
        onTogglePublish={(pkg) => void togglePublish(pkg)}
        onCreateFolder={() => openItem("FOLDER", null, EMPTY_VALUES)}
        onEditFolder={(folder: StorageFolder) => openItem("FOLDER", folder.id, { name: folder.name, description: folder.description || "", isPrivate: folder.isPrivate })}
        onDeleteFolder={(folder) => void confirmDelete("FOLDER", folder.id, folder.name)}
        onCreateStudySet={() => openItem("STUDYSET", null, EMPTY_VALUES)}
        onEditStudySet={(set: StorageStudySet) => openItem("STUDYSET", set.id, { name: set.name, description: set.description || "", isPrivate: set.isPrivate })}
        onDeleteStudySet={(set) => void confirmDelete("STUDYSET", set.id, studySetLabel(set))}
        onUploadVideo={() => setModal((prev) => ({ kind: "upload", key: nextKey(prev) }))}
        onDeleteVideo={(video) => void deleteVideo(video)}
        onOpenVideo={storage.openVideo}
      />

      {modal?.kind === "item" && <StorageItemModal key={modal.key} type={modal.type} editing={modal.editingId !== null} initialValues={modal.values} submitting={storage.busy} onCancel={() => setModal(null)} onSubmit={(values) => void submitItem(values)} />}

      {modal?.kind === "upload" && <VideoUploadModal key={modal.key} submitting={storage.busy} uploadProgress={storage.uploadProgress} storageConfigured={storage.storageConfigured} onCancel={() => setModal(null)} onSubmit={(file, title, description) => void submitUpload(file, title, description)} />}

      <VideoDetailModal video={storage.detailVideo} state={storage.detailState} onClose={storage.closeVideo} onRetry={storage.retryVideoDetail} />
    </>
  );
}
