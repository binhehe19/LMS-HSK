"use client";

// Container màn quản lý nội dung dạng cây — thay cho manage-flashcard.tsx / manage-vocabulary-set.tsx (và cùng mẫu cho manage-quiz/hanzi/grammar/
// pronunciation) của HSK cũ, cấu hình theo ContentModuleConfig. Giữ DOM khung cũ: `.card.manage-lp-container > .manage-lp-header (tiêu đề, Alert, nav tab,
// breadcrumb) + .card-body.p-4 (một cấp của cây)`.
//
// Khác bản cũ có chủ đích (quy ước M5): modal/hộp xác nhận tự vẽ → antd Modal + confirmAction; vị trí cây nằm trong URL; lỗi API là trạng thái hiển thị;
// nút ghi ẩn khi không có quyền (ticket) hoặc công tắc ghi đóng (WriteLockedNotice), không có "thành công giả"; "Nhập Excel" chưa chuyển (toast thông báo).
import { Alert } from "antd";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ContentFoldersView } from "@/components/management/content-tree/content-folders-view";
import { ContentItemModal } from "@/components/management/content-tree/content-item-modal";
import { ContentItemSearchView } from "@/components/management/content-tree/content-item-search-view";
import { ContentItemsView } from "@/components/management/content-tree/content-items-view";
import { ContentPackagesView } from "@/components/management/content-tree/content-packages-view";
import { ContentStudySetsView } from "@/components/management/content-tree/content-study-sets-view";
import { ContentTreeBreadcrumb } from "@/components/management/content-tree/content-tree-breadcrumb";
import { FolderFormModal, PackageFormModal, StudySetFormModal } from "@/components/management/content-tree/content-entity-modals";
import { useContentItemSearch } from "@/components/management/content-tree/use-content-item-search";
import { useContentTree } from "@/components/management/content-tree/use-content-tree";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { confirmAction } from "@/components/shared/confirm-action";
import { WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { buildBreadcrumb, isPublished } from "@/lib/content/content-tree-model";
import { folderLocation, packageLocation, ROOT_LOCATION, studySetLocation, treeHref, withReturnUrl } from "@/lib/content/content-tree-params";
import type { ContentFolder, ContentItemBase, ContentItemWithContext, ContentModuleConfig, ContentPackage, ContentStudySet } from "@/types/content";

type Mode = "create" | "edit";
interface PackageModalState { mode: Mode; editing: ContentPackage | null; type: string | null; key: number }
interface FolderModalState { mode: Mode; editing: ContentFolder | null; key: number }
interface StudySetModalState { mode: Mode; editing: ContentStudySet | null; key: number }
interface ItemModalState<TItem> { mode: Mode; editing: TItem | null; source: "tree" | "search"; key: number }

const bump = <T extends { key: number }>(prev: T | null) => (prev?.key ?? 0) + 1;

export function ContentTreeManager<TItem extends ContentItemBase>({ config }: { config: ContentModuleConfig<TItem> }) {
  const tree = useContentTree(config);
  const pathname = usePathname();
  const { labels } = config;
  const { location, level } = tree;
  const searchView = location.view === "search";
  const search = useContentItemSearch(config, searchView, tree.demo);

  const [packageModal, setPackageModal] = useState<PackageModalState | null>(null);
  const [folderModal, setFolderModal] = useState<FolderModalState | null>(null);
  const [setModal, setSetModal] = useState<StudySetModalState | null>(null);
  const [itemModal, setItemModal] = useState<ItemModalState<ContentItemWithContext<TItem>> | null>(null);

  const crumbs = buildBreadcrumb(labels, location, { packageName: tree.selectedPackage?.name, folderName: tree.selectedFolder?.name, studySetTitle: tree.selectedStudySet?.title });
  const currentHref = treeHref(pathname, location);

  // ---- xác nhận xoá / publish (chữ của các hộp thoại cũ) ----
  const deletePackage = async (pkg: ContentPackage) => {
    const ok = await confirmAction({
      title: `Xóa ${labels.package}`,
      content: (
        <>
          Bạn có chắc chắn muốn xóa {labels.package.toLowerCase()} <strong>&quot;{pkg.name}&quot;</strong>? Tất cả {labels.folder.toLowerCase()} và {labels.studySet.toLowerCase()} bên trong sẽ bị xóa.
        </>
      ),
      okText: "Xóa",
      danger: true,
    });
    if (ok) await tree.removePackage(pkg);
  };
  const deleteFolder = async (folder: ContentFolder) => {
    const ok = await confirmAction({
      title: `Xóa ${labels.folder}`,
      content: (
        <>
          Bạn có chắc chắn muốn xóa {labels.folder.toLowerCase()} <strong>&quot;{folder.name}&quot;</strong>? Tất cả {labels.studySet.toLowerCase()} bên trong sẽ bị xóa.
        </>
      ),
      okText: "Xóa",
      danger: true,
    });
    if (ok) await tree.removeFolder(folder);
  };
  const deleteStudySet = async (set: ContentStudySet) => {
    const ok = await confirmAction({
      title: `Xóa ${labels.studySet.toLowerCase()}`,
      content: (
        <>
          Bạn có chắc chắn muốn xóa {labels.studySet.toLowerCase()} <strong>&quot;{set.title}&quot;</strong>? Hành động này không thể hoàn tác.
        </>
      ),
      okText: "Xóa",
      danger: true,
    });
    if (ok) await tree.removeStudySet(set);
  };
  const deleteItem = async (item: TItem) => {
    const ok = await confirmAction({ title: `Xóa ${labels.item.toLowerCase()}`, content: `Bạn có chắc chắn muốn xóa ${labels.item.toLowerCase()} "${config.itemSummary(item)}"?`, okText: "Xóa", danger: true });
    if (ok) await tree.removeItem(item);
  };
  const togglePublish = async (pkg: ContentPackage) => {
    const publishing = !isPublished(pkg);
    const ok = await confirmAction({
      title: publishing ? "Xác nhận Publish" : "Xác nhận Unpublish",
      content: publishing ? `Bạn có chắc muốn publish ${labels.package.toLowerCase()} "${pkg.name}"?` : `Bạn có chắc muốn chuyển ${labels.package.toLowerCase()} "${pkg.name}" về Draft?`,
      okText: publishing ? "Publish" : "Unpublish",
      danger: !publishing,
    });
    if (ok) await tree.togglePublish(pkg);
  };

  // ---- modal ----
  const submitPackage = async (values: ContentPackage | null, input: Parameters<typeof tree.savePackage>[0]) => {
    if (await tree.savePackage(input, values)) setPackageModal(null);
  };
  const submitItem = async (input: Parameters<typeof tree.saveItem>[0]) => {
    if (!itemModal) return;
    const ok = itemModal.source === "search" && itemModal.editing ? await search.save(itemModal.editing, input) : await tree.saveItem(input, itemModal.editing);
    if (ok) setItemModal(null);
  };

  const missingLabel = tree.missing === "package" ? labels.package : tree.missing === "folder" ? labels.folder : labels.studySet;
  const missingBack = tree.missing === "package" || !location.packageId ? ROOT_LOCATION : tree.missing === "folder" || !location.folderId ? packageLocation(location.packageId) : folderLocation(location.packageId, location.folderId);

  const body = searchView ? (
    <ContentItemSearchView config={config} term={search.term} state={search.state} result={search.result} canWrite={tree.canWrite} busy={search.saving} onTermChange={search.setTerm} onPageChange={search.setPage} onEdit={(item) => setItemModal((prev) => ({ mode: "edit", editing: item, source: "search", key: bump(prev) }))} onRetry={search.reload} />
  ) : tree.missing ? (
    <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 mb-0" role="status" data-testid="content-missing" data-kind={tree.missing}>
      <span>Không tìm thấy {missingLabel.toLowerCase()} trong danh sách (có thể đã bị xóa hoặc đường dẫn không đúng).</span>
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => tree.go(missingBack)}>
        Quay lại
      </button>
    </div>
  ) : level === "packages" ? (
    <div className="flashcard-package-type-manager">
      <ContentPackagesView
        key="packages"
        config={config}
        state={tree.packages.state}
        packages={tree.packages.list}
        canWrite={tree.canWrite}
        canPublish={tree.canPublish}
        busy={tree.busy}
        onOpen={(pkg) => tree.go(packageLocation(pkg.id))}
        onCreate={(type) => setPackageModal((prev) => ({ mode: "create", editing: null, type: type ?? null, key: bump(prev) }))}
        onEdit={(pkg) => setPackageModal((prev) => ({ mode: "edit", editing: pkg, type: null, key: bump(prev) }))}
        onDelete={(pkg) => void deletePackage(pkg)}
        onTogglePublish={(pkg) => void togglePublish(pkg)}
        onImport={() => toast.info("Nhập Excel chưa được chuyển sang bản mới (chờ hợp đồng import của backend).")}
        onRetry={tree.packages.reload}
      />
    </div>
  ) : level === "folders" ? (
    <ContentFoldersView
      key={`folders:${location.packageId}`}
      config={config}
      pkg={tree.selectedPackage}
      state={tree.folders.state}
      folders={tree.folders.list}
      canWrite={tree.canWrite}
      busy={tree.busy}
      onOpen={(folder) => tree.go(folderLocation(folder.packageId || location.packageId || "", folder.id))}
      onCreate={() => setFolderModal((prev) => ({ mode: "create", editing: null, key: bump(prev) }))}
      onEdit={(folder) => setFolderModal((prev) => ({ mode: "edit", editing: folder, key: bump(prev) }))}
      onDelete={(folder) => void deleteFolder(folder)}
      onRetry={tree.folders.reload}
    />
  ) : level === "studySets" ? (
    <ContentStudySetsView
      key={`sets:${location.folderId}`}
      config={config}
      folder={tree.selectedFolder}
      state={tree.studySets.state}
      studySets={tree.studySets.list}
      canWrite={tree.canWrite}
      busy={tree.busy}
      createWithItemsHref={config.setEditorRoutes && location.packageId && location.folderId ? withReturnUrl(config.setEditorRoutes.create(location.packageId, location.folderId), currentHref) : null}
      onOpen={(set) => tree.go(studySetLocation(location.packageId ?? "", location.folderId ?? "", set.id))}
      onCreate={() => setSetModal((prev) => ({ mode: "create", editing: null, key: bump(prev) }))}
      onEdit={(set) => setSetModal((prev) => ({ mode: "edit", editing: set, key: bump(prev) }))}
      onDelete={(set) => void deleteStudySet(set)}
      onRetry={tree.studySets.reload}
    />
  ) : (
    <ContentItemsView
      key={`items:${location.studySetId}`}
      config={config}
      studySet={tree.selectedStudySet}
      state={tree.items.state}
      items={tree.items.list}
      canWrite={tree.canWrite}
      busy={tree.busy}
      editWithItemsHref={config.setEditorRoutes && location.studySetId ? withReturnUrl(config.setEditorRoutes.edit(location.studySetId), currentHref) : null}
      onCreate={() => setItemModal((prev) => ({ mode: "create", editing: null, source: "tree", key: bump(prev) }))}
      onEdit={(item) => setItemModal((prev) => ({ mode: "edit", editing: item, source: "tree", key: bump(prev) }))}
      onDelete={(item) => void deleteItem(item)}
      onEditStudySet={() => tree.selectedStudySet && setSetModal((prev) => ({ mode: "edit", editing: tree.selectedStudySet, key: bump(prev) }))}
      onBack={() => tree.go(folderLocation(location.packageId ?? "", location.folderId ?? ""))}
      onRetry={tree.items.reload}
    />
  );

  return (
    <ManagementPageFrame contentClassName={`${config.pageClassName} content-tree-page`}>
      <div className="card manage-lp-container border-0 shadow-sm" data-testid="content-tree" data-module={config.key} data-level={searchView ? "search" : level}>
        <div className="manage-lp-header px-4 pt-4 border-0">
          {(searchView || level !== "packages") && (
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="section-title mb-0 fw-800">
                <i className={`isax ${config.icon.replace(/^isax\s+/, "")} me-2 text-primary`} />
                {config.title}
              </h5>
            </div>
          )}
          {tree.access.status !== "loading" && !tree.access.canManage && (
            <div className="mb-3">
              <Alert message="Chế độ Xem duy nhất" description="Bạn hiện không có Ticket được cấp cho Module này. Bạn vẫn có thể xem các nội dung nhưng không thể Thêm, Sửa hoặc Xóa." type="warning" showIcon className="rounded-3 border-warning bg-soft-warning" data-testid="content-readonly-alert" />
            </div>
          )}
          {tree.access.canManage && !tree.writeEnabled && (
            <div className="mb-3">
              <WriteLockedNotice what="Thêm/Sửa/Xóa nội dung" />
            </div>
          )}

          {config.itemSearchTab && (
            <div className="flashcard-manage-nav mb-3" role="tablist">
              <button type="button" role="tab" aria-selected={!searchView} className={`flashcard-manage-nav-item ${!searchView ? "active" : ""}`} onClick={() => tree.go(ROOT_LOCATION)}>
                <i className="isax isax-box-1 me-2" />
                {labels.package}s
              </button>
              <button type="button" role="tab" aria-selected={searchView} className={`flashcard-manage-nav-item ${searchView ? "active" : ""}`} onClick={() => tree.go({ ...ROOT_LOCATION, view: "search" })}>
                <i className={`isax ${config.itemSearchTab.icon} me-2`} />
                {config.itemSearchTab.label}
              </button>
            </div>
          )}

          {!searchView && <ContentTreeBreadcrumb crumbs={crumbs} onNavigate={tree.go} />}
        </div>

        <div className="card-body p-4">{body}</div>
      </div>

      {packageModal && (
        <PackageFormModal
          key={packageModal.key}
          labels={labels}
          mode={packageModal.mode}
          initialValues={packageModal.editing ? { name: packageModal.editing.name, type: packageModal.editing.type, description: packageModal.editing.description ?? "" } : { name: "", type: packageModal.type ?? config.packageTypes[0]?.value ?? "", description: "" }}
          submitting={tree.busy}
          onCancel={() => setPackageModal(null)}
          onSubmit={(values) => void submitPackage(packageModal.editing, values)}
        />
      )}
      {folderModal && location.packageId && (
        <FolderFormModal
          key={folderModal.key}
          labels={labels}
          mode={folderModal.mode}
          initialValues={folderModal.editing ? { packageId: folderModal.editing.packageId || location.packageId, name: folderModal.editing.name, description: folderModal.editing.description ?? "", isPrivate: folderModal.editing.isPrivate ?? false } : { packageId: location.packageId, name: "", description: "", isPrivate: false }}
          submitting={tree.busy}
          onCancel={() => setFolderModal(null)}
          onSubmit={(values) => void tree.saveFolder(values, folderModal.editing).then((ok) => ok && setFolderModal(null))}
        />
      )}
      {setModal && location.folderId && (
        <StudySetFormModal
          key={setModal.key}
          labels={labels}
          mode={setModal.mode}
          skills={config.hasSkill ? config.skills : undefined}
          initialValues={setModal.editing ? { folderId: setModal.editing.folderId || location.folderId, title: setModal.editing.title, description: setModal.editing.description ?? "", isPrivate: setModal.editing.isPrivate ?? true, skill: setModal.editing.skill ?? "" } : { folderId: location.folderId, title: "", description: "", isPrivate: true, skill: "" }}
          submitting={tree.busy}
          onCancel={() => setSetModal(null)}
          onSubmit={(values) => void tree.saveStudySet(values, setModal.editing).then((ok) => ok && setSetModal(null))}
        />
      )}
      {itemModal && (
        <ContentItemModal
          key={itemModal.key}
          config={config}
          mode={itemModal.mode}
          initialValue={itemModal.editing ? config.itemToInput(itemModal.editing) : config.emptyItemInput()}
          submitting={itemModal.source === "search" ? search.saving : tree.busy}
          onCancel={() => setItemModal(null)}
          onSubmit={(input) => void submitItem(input)}
        />
      )}
    </ManagementPageFrame>
  );
}
