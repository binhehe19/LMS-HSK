"use client";

// Container màn quản lý nội dung PHẲNG (Package → mục) — mirror content-tree-manager.tsx nhưng bớt 2 cấp Folder/StudySet (nối lms-content-client.ts/
// lms-grammar-client.ts, backend thật thay vì content-tree-client.ts/mock). Generic theo TItem, nhận `client` (bộ hàm CRUD của module đó) làm prop —
// mỗi module mới chỉ cần khai báo config + client riêng theo FlatContentClient<TItem>, không cần sửa manager này.
import { PackageImportModal } from "./package-import-modal";
import { Alert } from "antd";
import { useState } from "react";
import { ContentItemModal } from "@/components/management/content-tree/content-item-modal";
import { PackageFormModal } from "@/components/management/content-tree/content-entity-modals";
import { useFlatContent, type FlatContentClient } from "@/components/management/content-flat/use-flat-content";
import { FlatItemsBreadcrumbView } from "./flat-items-breadcrumb-view";
import { PackageWorkspace } from "./package-workspace";
import { PackageCatalog } from "./package-catalog";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { confirmAction } from "@/components/shared/confirm-action";
import { WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { isPublished } from "@/lib/content/content-tree-model";
import { FLAT_ROOT_LOCATION, flatPackageLocation } from "@/lib/content/flat-content-params";
import type { ContentItemBase, ContentModuleConfig, ContentPackage } from "@/types/content";

type Mode = "create" | "edit";
interface PackageModalState { type: string | null; key: number }
interface ItemModalState<TItem> { mode: Mode; editing: TItem | null; key: number }

const bump = <T extends { key: number }>(prev: T | null) => (prev?.key ?? 0) + 1;

export function FlatContentManager<TItem extends ContentItemBase>({ config, client }: {
  config: ContentModuleConfig<TItem>; client: FlatContentClient<TItem>;
}) {
  const tree = useFlatContent(config, client);
  const { labels } = config;
  const { location, level } = tree;
  const ItemsViewComp = FlatItemsBreadcrumbView;
  const packageType = config.packageTypes[0];
  const editing = tree.edit.status === "ready";

  const [packageModal, setPackageModal] = useState<PackageModalState | null>(null);
  const [itemModal, setItemModal] = useState<ItemModalState<TItem> | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const ItemPicker = config.ItemPicker;

  const deletePackage = async (pkg: ContentPackage) => {
    const ok = await confirmAction({
      title: `Xóa ${labels.package}`,
      content: (
        <>
          Bạn có chắc chắn muốn xóa {labels.package.toLowerCase()} <strong>&quot;{pkg.name}&quot;</strong>? Tất cả {labels.item.toLowerCase()} bên trong sẽ bị xóa.
        </>
      ),
      okText: "Xóa",
      danger: true,
    });
    if (ok) await tree.removePackage(pkg);
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

  const submitPackage = async (input: Parameters<typeof tree.savePackage>[0]) => {
    if (await tree.savePackage(input)) setPackageModal(null);
  };
  const submitItem = async (input: Parameters<typeof tree.saveItem>[0]) => {
    if (!itemModal) return;
    const ok = await tree.saveItem(input, itemModal.editing);
    if (ok) setItemModal(null);
  };

  const body =
    tree.missing === "package" ? (
      <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 mb-0" role="status" data-testid="flat-content-missing">
        <span>Không tìm thấy {labels.package.toLowerCase()} trong danh sách (có thể đã bị xóa hoặc đường dẫn không đúng).</span>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => tree.go(FLAT_ROOT_LOCATION)}>
          Quay lại
        </button>
      </div>
    ) : level === "packages" ? (
      <div className="flashcard-package-type-manager">
        <PackageCatalog
          heading={packageType?.label ?? config.title}
          icon={config.icon}
          state={tree.packages.state}
          packages={tree.packages.list}
          busy={tree.busy}
          onCreate={tree.canWrite ? () => setPackageModal(prev => ({ type: packageType?.value ?? null, key: bump(prev) })) : undefined}
          onOpenReadOnly={tree.canWrite ? undefined : pkg => tree.go(flatPackageLocation(pkg.id))}
          onEdit={tree.canWrite ? pkg => tree.go(flatPackageLocation(pkg.id)) : undefined}
          onDelete={tree.canWrite ? pkg => void deletePackage(pkg) : undefined}
          onTogglePublish={tree.canPublish ? pkg => void togglePublish(pkg) : undefined}
          onRetry={tree.packages.reload}
        />
      </div>
    ) : (
      <ItemsViewComp
        embedded
        key={`items:${location.packageId}`}
        config={config}
        pkg={tree.selectedPackage}
        state={tree.items.state}
        items={tree.items.list}
        canWrite={editing}
        busy={tree.busy}
        onCreate={() => (ItemPicker ? setPickerOpen(true) : setItemModal((prev) => ({ mode: "create", editing: null, key: bump(prev) })))}
        onEdit={(item) => setItemModal((prev) => ({ mode: "edit", editing: item, key: bump(prev) }))}
        onDelete={(item) => void deleteItem(item)}
        onBack={() => tree.go(FLAT_ROOT_LOCATION)}
        onRetry={tree.items.reload}
        topicUi={tree.topicUi}
      />
    );

  const showHeaderTitle = level !== "packages" && !tree.selectedPackage;
  const showReadonlyAlert = tree.access.status !== "loading" && !tree.access.canManage;
  const showWriteLockedNotice = tree.access.canManage && !tree.writeEnabled;
  const hasHeader = showHeaderTitle || showReadonlyAlert || showWriteLockedNotice;

  return (
    <ManagementPageFrame contentClassName={`${config.pageClassName} content-tree-page${tree.selectedPackage ? " package-editor-page" : ""}`}>
      <div className="card manage-lp-container border-0 shadow-sm" data-testid="flat-content" data-module={config.key} data-level={level}>
        {hasHeader && (
          <div className="manage-lp-header px-4 pt-4 border-0">
            {showHeaderTitle && (
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="section-title mb-0 fw-800">
                  <i className={`isax ${config.icon.replace(/^isax\s+/, "")} me-2 text-primary`} />
                  {config.title}
                </h5>
              </div>
            )}
            {showReadonlyAlert && (
              <div className="mb-3">
                <Alert message="Chế độ Xem duy nhất" description="Bạn hiện không có Ticket được cấp cho Module này. Bạn vẫn có thể xem các nội dung nhưng không thể Thêm, Sửa hoặc Xóa." type="warning" showIcon className="rounded-3 border-warning bg-soft-warning" data-testid="flat-content-readonly-alert" />
              </div>
            )}
            {showWriteLockedNotice && (
              <div className="mb-3">
                <WriteLockedNotice what="Thêm/Sửa/Xóa nội dung" />
              </div>
            )}
          </div>
        )}

        <div className={tree.selectedPackage ? "card-body p-0" : "card-body p-3"}>
          {level === "items" && tree.selectedPackage ? (
            <PackageWorkspace
              key={tree.edit.draft?.id ?? tree.selectedPackage.id}
              pkg={tree.edit.draft ? {
                ...tree.selectedPackage,
                name: tree.edit.draft.title ?? "",
                description: tree.edit.draft.description ?? "",
                sessionCount: tree.edit.draft.sessionCount ?? tree.selectedPackage.sessionCount,
              } : tree.selectedPackage}
              sessionNo={tree.sessionNo}
              onSession={tree.setSessionNo}
              busy={tree.busy || (editing && (importOpen || pickerOpen || !!itemModal))}
              canWrite={editing}
              canPublish={tree.canPublish}
              demo={tree.demo}
              itemCount={tree.items.list.length}
              topicUi={tree.topicUi}
              status={tree.edit.status}
              statusMessage={tree.edit.message}
              onRetryEdit={tree.edit.retry}
              hasLock={tree.edit.hasLock}
              onHeartbeat={tree.heartbeat}
              onSave={tree.saveWorkspace}
              onDiscard={tree.discardWorkspace}
              onCopy={syllabusId => tree.selectedPackage ? tree.copyPackage(tree.selectedPackage, syllabusId) : Promise.resolve(false)}
              onBack={() => { tree.packages.reload(); tree.go(FLAT_ROOT_LOCATION); }}
              onImport={() => setImportOpen(true)}
              onCreate={() => ItemPicker ? setPickerOpen(true) : setItemModal(prev => ({ mode: "create", editing: null, key: bump(prev) }))}
            >
              {body}
            </PackageWorkspace>
          ) : body}
        </div>
      </div>

      {packageModal && (
        <PackageFormModal
          key={packageModal.key}
          allowSyllabus
          labels={labels}
          mode="create"
          initialValues={{ name: "", type: packageModal.type ?? config.packageTypes[0]?.value ?? "", description: "" }}
          submitting={tree.busy}
          onCancel={() => setPackageModal(null)}
          onSubmit={(values) => void submitPackage(values)}
        />
      )}
      {editing && importOpen && tree.selectedPackage && <PackageImportModal packageId={tree.selectedPackage.id} type={tree.selectedPackage.type} sessionNo={tree.sessionNo} demo={tree.demo} hasLock={tree.edit.hasLock} onClose={() => setImportOpen(false)} onAdded={tree.items.reload} />}
      {editing && ItemPicker && <ItemPicker sessionNo={tree.sessionNo} open={pickerOpen} pkg={tree.selectedPackage} items={tree.items.list} demo={tree.demo} hasLock={tree.edit.hasLock} onClose={() => setPickerOpen(false)} onAdded={() => tree.items.reload()} />}
      {editing && itemModal && (
        <ContentItemModal
          config={config}
          mode={itemModal.mode}
          initialValue={itemModal.editing ? config.itemToInput(itemModal.editing) : config.emptyItemInput()}
          submitting={tree.busy}
          onCancel={() => setItemModal(null)}
          onSubmit={(input) => void submitItem(input)}
        />
      )}
    </ManagementPageFrame>
  );
}
