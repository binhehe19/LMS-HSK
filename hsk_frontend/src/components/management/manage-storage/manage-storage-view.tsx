"use client";

// Port của LMS_Frontend/src/features/learning-path/storage/manage/manage-storage.tsx (cùng DOM `.manage-storage-container > .storage-workspace >
// .storage-breadcrumb + .view-content-area`, chữ, biểu tượng; SCSS manage-storage.scss nạp qua styles/page-styles.ts). View thuần: không gọi API.
//
// Khác bản cũ có chủ đích: (1) Alert "Chế độ Xem duy nhất" hiện cho MỌI tài khoản không có quyền theo ticket (useContentAccess("STORAGE"): giảng viên
// không có ticket STORAGE OPEN/DONE, hoặc dịch vụ ticket chưa cấu hình/lỗi => fail-closed) — bản cũ chỉ kiểm isTeacher/isCollaborator; (2) công tắc
// ghi "storage" đóng => nút ghi khoá + WriteLockedNotice; (3) lỗi/chưa cấu hình => FetchStateNotice thay vì console.error + danh sách rỗng;
// (4) modal xác nhận xoá/publish tự vẽ bằng div fixed => confirmAction (antd Modal.confirm) ở container.
import { Alert } from "antd";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { ManageStorage } from "@/components/management/manage-storage/use-manage-storage";
import { StorageExplorerList } from "@/components/management/manage-storage/storage-explorer-list";
import { StorageVideoList } from "@/components/management/manage-storage/storage-video-list";
import { WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { breadcrumbItems, isPackagePublished, storageLevel, studySetLabel, type StorageLevel } from "@/lib/hsk-storage/storage-model";
import type { StorageFolder, StoragePackage, StorageStudySet, StorageVideo } from "@/types/hsk-storage";

export const STORAGE_WAITING_TEXT = "Kho lưu trữ đa phương tiện chưa được kết nối API (WAITING FOR BACKEND).";

export interface ManageStorageViewProps {
  storage: ManageStorage;
  onGoTo: (level: StorageLevel) => void;
  onSelectPackage: (pkg: StoragePackage) => void;
  onSelectFolder: (folder: StorageFolder) => void;
  onSelectStudySet: (studySet: StorageStudySet) => void;
  onCreatePackage: () => void;
  onEditPackage: (pkg: StoragePackage) => void;
  onDeletePackage: (pkg: StoragePackage) => void;
  onTogglePublish: (pkg: StoragePackage) => void;
  onCreateFolder: () => void;
  onEditFolder: (folder: StorageFolder) => void;
  onDeleteFolder: (folder: StorageFolder) => void;
  onCreateStudySet: () => void;
  onEditStudySet: (studySet: StorageStudySet) => void;
  onDeleteStudySet: (studySet: StorageStudySet) => void;
  onUploadVideo: () => void;
  onDeleteVideo: (video: StorageVideo) => void;
  onOpenVideo: (video: StorageVideo) => void;
}

export function ManageStorageView(props: ManageStorageViewProps) {
  const { storage } = props;
  const { selection, access, writeEnabled, busy } = storage;
  const level = storageLevel(selection);
  const viewOnly = access.status !== "loading" && !access.canManage;
  const canManage = access.canManage;
  const writeOpen = writeEnabled && !busy;

  return (
    <ManagementPageFrame>
      {viewOnly && (
        <div className="mb-4" data-testid="storage-view-only">
          <Alert message="Chế độ Xem duy nhất" description="Bạn hiện không có Ticket được cấp cho Module này. Bạn vẫn có thể xem các nội dung nhưng không thể Thêm, Sửa hoặc Xóa." type="warning" showIcon className="rounded-3 border-warning bg-soft-warning shadow-sm" />
        </div>
      )}
      {canManage && !writeEnabled && <WriteLockedNotice what="Thao tác với kho lưu trữ (tạo/sửa/xóa gói, thư mục, bộ học; tải và xóa video; publish)" className="mb-3" />}

      <div className="manage-storage-container">
        <div className="storage-workspace">
          <div className="storage-breadcrumb" data-testid="storage-breadcrumb">
            {breadcrumbItems(selection).map((item, index, all) => (
              <div
                key={item.key}
                className={`breadcrumb-item ${item.target === null ? "active" : ""}`}
                role={item.target === null ? undefined : "button"}
                tabIndex={item.target === null ? undefined : 0}
                onClick={() => item.target && props.onGoTo(item.target)}
                onKeyDown={(e) => e.key === "Enter" && item.target && props.onGoTo(item.target)}
              >
                {index === 0 && <i className="isax isax-folder-2" />}
                {item.label}
                {index < all.length - 1 && <span className="separator">/</span>}
              </div>
            ))}
          </div>

          <div className="view-content-area">
            {level === "packages" && (
              <StorageExplorerList<StoragePackage>
                state={storage.packages.state}
                items={storage.packages.items}
                header={{ icon: "isax-folder-2", title: "Kho lưu trữ Media", count: `${storage.packages.items.length} bộ sưu tập` }}
                createLabel="Tạo kho mới"
                empty={{ icon: "isax-data-2", title: "Chưa có kho lưu trữ nào", text: "Hãy khởi tạo kho lưu trữ đầu tiên để bắt đầu quản lý tài nguyên media của bạn.", cta: "Khởi tạo ngay" }}
                canManage={canManage}
                writeEnabled={writeOpen}
                waitingText={STORAGE_WAITING_TEXT}
                itemName={(pkg) => pkg.name}
                itemDescription={(pkg) => pkg.description || "Không có mô tả cho gói này."}
                cardIcon="isax-folder-2"
                renderBadge={(pkg) => {
                  const published = isPackagePublished(pkg);
                  return (
                    <div className="mb-2">
                      <span className="badge rounded-pill" style={{ background: published ? "rgba(25, 135, 84, 0.15)" : "rgba(220, 53, 69, 0.15)", color: published ? "#198754" : "#dc3545" }}>
                        {published ? "Published" : "Draft"}
                      </span>
                    </div>
                  );
                }}
                renderFooter={() => (
                  <>
                    <div className="stat-badge">
                      <i className="isax isax-folder" />
                      Thư mục
                    </div>
                    <div className="stat-badge">
                      <i className="isax isax-video-play" />
                      Video
                    </div>
                  </>
                )}
                extraMenu={(pkg) =>
                  access.canPublish
                    ? [
                        {
                          key: "publish",
                          label: (
                            <span>
                              <i className={`isax ${isPackagePublished(pkg) ? "isax-close-circle text-danger" : "isax-tick-circle text-success"} me-2`} />
                              {isPackagePublished(pkg) ? "Unpublish (về Draft)" : "Publish"}
                            </span>
                          ),
                          onClick: () => props.onTogglePublish(pkg),
                        },
                      ]
                    : []
                }
                onSelect={props.onSelectPackage}
                onCreate={props.onCreatePackage}
                onEdit={props.onEditPackage}
                onDelete={props.onDeletePackage}
                onRetry={storage.packages.reload}
                testId="storage-packages"
              />
            )}

            {level === "folders" && (
              <StorageExplorerList<StorageFolder>
                state={storage.folders.state}
                items={storage.folders.items}
                header={{ icon: "isax-folder-open", title: "Thư mục", count: `${storage.folders.items.length} thư mục` }}
                createLabel="Tạo thư mục mới"
                empty={{ icon: "isax-folder-2", title: "Chưa có thư mục nào", text: "Hãy tạo thư mục để bắt đầu phân loại tài nguyên tập của bạn.", cta: "Tạo ngay" }}
                canManage={canManage}
                writeEnabled={writeOpen}
                waitingText={STORAGE_WAITING_TEXT}
                itemName={(folder) => folder.name}
                itemDescription={(folder) => folder.description || "Không có mô tả cho thư mục này."}
                cardIcon="isax-folder-cloud"
                renderFooter={(folder) => (
                  <>
                    <div className="stat-badge">
                      <i className="isax isax-book-1" />
                      Bộ học
                    </div>
                    {folder.isPrivate && (
                      <div className="stat-badge text-warning">
                        <i className="isax isax-lock" />
                        Riêng tư
                      </div>
                    )}
                  </>
                )}
                onSelect={props.onSelectFolder}
                onCreate={props.onCreateFolder}
                onEdit={props.onEditFolder}
                onDelete={props.onDeleteFolder}
                onRetry={storage.folders.reload}
                testId="storage-folders"
              />
            )}

            {level === "study-sets" && (
              <StorageExplorerList<StorageStudySet>
                state={storage.studySets.state}
                items={storage.studySets.items}
                header={{ icon: "isax-layer", title: "Nhóm tài nguyên", count: `${storage.studySets.items.length} nhóm` }}
                createLabel="Thêm nhóm mới"
                empty={{ icon: "isax-element-plus", title: "Chưa có nhóm nào", text: "Hãy tạo nhóm tài nguyên đầu tiên để bắt đầu quản lý các tệp media.", cta: "Thêm ngay" }}
                canManage={canManage}
                writeEnabled={writeOpen}
                waitingText={STORAGE_WAITING_TEXT}
                itemName={studySetLabel}
                itemDescription={(set) => set.description || "Không có mô tả cho bộ học này."}
                cardIcon="isax-play-circle"
                renderFooter={(set) => (
                  <>
                    <div className="stat-badge">
                      <i className="isax isax-video" />
                      Video của bạn
                    </div>
                    {set.isPrivate && (
                      <div className="stat-badge text-warning">
                        <i className="isax isax-lock" />
                        Khóa
                      </div>
                    )}
                  </>
                )}
                onSelect={props.onSelectStudySet}
                onCreate={props.onCreateStudySet}
                onEdit={props.onEditStudySet}
                onDelete={props.onDeleteStudySet}
                onRetry={storage.studySets.reload}
                testId="storage-study-sets"
              />
            )}

            {level === "videos" && <StorageVideoList state={storage.videos.state} videos={storage.videos.items} canManage={canManage} writeEnabled={writeOpen} onUpload={props.onUploadVideo} onDelete={props.onDeleteVideo} onOpen={props.onOpenVideo} onReload={storage.videos.reload} />}
          </div>
        </div>
      </div>
    </ManagementPageFrame>
  );
}
