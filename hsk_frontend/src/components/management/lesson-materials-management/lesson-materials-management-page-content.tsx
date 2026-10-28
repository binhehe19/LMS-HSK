"use client";

import { useState } from "react";
import { BulkUploadModal } from "@/components/management/lesson-materials-management/bulk-upload-modal";
import { GroupFormModal } from "@/components/management/lesson-materials-management/group-form-modal";
import { LessonMaterialsView } from "@/components/management/lesson-materials-management/lesson-materials-view";
import { MaterialFormModal } from "@/components/management/lesson-materials-management/material-form-modal";
import { useLessonMaterials, type GroupFormValues, type MaterialFormValues, type MaterialSelection } from "@/components/management/lesson-materials-management/use-lesson-materials";
import type { MaterialDetailTab } from "@/lib/lesson-materials/lesson-material-model";
import type { LessonMaterialGroup } from "@/types/lesson-materials";

type ModalState = { kind: "group"; values: GroupFormValues; key: number } | { kind: "material"; key: number } | { kind: "bulk"; key: number } | null;

/**
 * Container màn /learning-path/lesson-materials/manage (HSK cũ: LessonMaterialManagementPage, chỉ ADMIN ở app mới): nối hook dữ liệu với view hai cột
 * và ba modal (bộ tài liệu, thêm tài liệu, thêm hàng loạt). Tìm kiếm bộ và tab loại là state cục bộ như bản cũ.
 */
export function LessonMaterialsManagementPageContent() {
  const lm = useLessonMaterials();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<MaterialDetailTab>("ALL");
  const [modal, setModal] = useState<ModalState>(null);
  const nextKey = (prev: ModalState) => (prev?.key ?? 0) + 1;
  const defaultGroupSelection = lm.selection?.kind === "group" ? lm.selection.id : "";

  const select = (next: MaterialSelection) => {
    lm.select(next);
    setTab("ALL"); // vào bộ khác thì về tab "Tất cả" như bản cũ
  };

  const openEditGroup = (group: LessonMaterialGroup) => setModal((prev) => ({ kind: "group", values: { id: group.id, name: group.name, description: group.description || "" }, key: nextKey(prev) }));

  const submitGroup = async (values: GroupFormValues) => {
    if (await lm.saveGroup(values)) setModal(null);
  };

  const submitMaterial = async (values: MaterialFormValues, file: File | null) => {
    if (await lm.createOne(values, file)) setModal(null);
  };

  const closeBulk = () => {
    if (lm.bulk.phase === "processing") return;
    setModal(null);
    lm.resetBulk();
  };

  return (
    <>
      <LessonMaterialsView
        state={lm.state}
        groups={lm.groups}
        materials={lm.materials}
        refreshing={lm.refreshing}
        writeEnabled={lm.writeEnabled}
        busy={lm.busy}
        search={search}
        onSearchChange={setSearch}
        selection={lm.selection}
        selectedGroup={lm.selectedGroup}
        detailState={lm.detailState}
        tab={tab}
        onTabChange={setTab}
        transitioningId={lm.transitioningId}
        onSelect={select}
        onOpenCreateGroup={() => setModal((prev) => ({ kind: "group", values: { id: null, name: "", description: "" }, key: nextKey(prev) }))}
        onEditGroup={openEditGroup}
        onToggleArchive={(group) => void lm.toggleGroupArchive(group)}
        onOpenCreate={() => setModal((prev) => ({ kind: "material", key: nextKey(prev) }))}
        onOpenBulk={() => {
          lm.resetBulk();
          setModal((prev) => ({ kind: "bulk", key: nextKey(prev) }));
        }}
        onChangeStatus={(material, status) => void lm.changeStatus(material, status)}
        onRetry={lm.reload}
        onRetryDetail={lm.retryDetail}
      />

      {modal?.kind === "group" && <GroupFormModal key={modal.key} initialValues={modal.values} submitting={lm.busy} onCancel={() => setModal(null)} onSubmit={(values) => void submitGroup(values)} />}

      {modal?.kind === "material" && (
        <MaterialFormModal key={modal.key} groups={lm.groups} defaultGroupSelection={defaultGroupSelection} submitting={lm.busy} uploadProgress={lm.uploadProgress} storageConfigured={lm.storageConfigured} onCancel={() => setModal(null)} onSubmit={(values, file) => void submitMaterial(values, file)} />
      )}

      {modal?.kind === "bulk" && <BulkUploadModal key={modal.key} groups={lm.groups} defaultGroupSelection={defaultGroupSelection} bulk={lm.bulk} storageConfigured={lm.storageConfigured} onStart={(items, groupSelection, newGroupName) => void lm.startBulk(items, groupSelection, newGroupName)} onClose={closeBulk} />}
    </>
  );
}
