"use client";

import { useState } from "react";
import { BulkUploadModal } from "@/components/management/lesson-materials-management/bulk-upload-modal";
import { GroupFormModal } from "@/components/management/lesson-materials-management/group-form-modal";
import { LessonMaterialsView } from "@/components/management/lesson-materials-management/lesson-materials-view";
import { MaterialFormModal } from "@/components/management/lesson-materials-management/material-form-modal";
import { useLessonMaterials, type GroupFormValues, type MaterialFormValues, type MaterialSelection } from "@/components/management/lesson-materials-management/use-lesson-materials";
import type { LessonMaterialGroup, LessonMaterialType } from "@/types/lesson-materials";

type ModalState = { kind: "group"; values: GroupFormValues; key: number } | { kind: "material"; key: number } | { kind: "bulk"; key: number } | null;

/**
 * Container màn /learning-path/lesson-materials/manage (ROLE_ADMIN): nối hook dữ liệu với view hai cột và ba modal (bộ tài liệu, thêm tài liệu, thêm
 * hàng loạt). Tìm kiếm bộ là state cục bộ.
 */
export function LessonMaterialsManagementPageContent() {
  const lm = useLessonMaterials();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const nextKey = (prev: ModalState) => (prev?.key ?? 0) + 1;
  const defaultGroupSelection = lm.selection?.id ?? "";

  const openEditGroup = (group: LessonMaterialGroup) => setModal((prev) => ({ kind: "group", values: { id: group.id, type: group.type, name: group.name, description: group.description || "" }, key: nextKey(prev) }));

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
        refreshing={lm.refreshing}
        writeEnabled={lm.writeEnabled}
        busy={lm.busy}
        search={search}
        onSearchChange={setSearch}
        selection={lm.selection}
        selectedGroup={lm.selectedGroup}
        detailState={lm.detailState}
        topicUi={lm.topicUi}
        onSelect={(next: MaterialSelection) => lm.select(next)}
        onOpenCreateGroup={() => setModal((prev) => ({ kind: "group", values: { id: null, type: "SLIDE", name: "", description: "" }, key: nextKey(prev) }))}
        onEditGroup={openEditGroup}
        onTogglePublish={(group) => void lm.togglePublish(group)}
        onRemoveGroup={(group) => void lm.removeGroup(group)}
        onOpenCreate={() => setModal((prev) => ({ kind: "material", key: nextKey(prev) }))}
        onOpenBulk={() => {
          lm.resetBulk();
          setModal((prev) => ({ kind: "bulk", key: nextKey(prev) }));
        }}
        onRemoveMaterial={(material) => void lm.removeMaterial(material)}
        onRetry={lm.reload}
        onRetryDetail={lm.retryDetail}
      />

      {modal?.kind === "group" && <GroupFormModal key={modal.key} initialValues={modal.values} submitting={lm.busy} onCancel={() => setModal(null)} onSubmit={(values) => void submitGroup(values)} />}

      {modal?.kind === "material" && (
        <MaterialFormModal key={modal.key} groups={lm.groups} defaultGroupSelection={defaultGroupSelection} submitting={lm.busy} uploadProgress={lm.uploadProgress} storageConfigured={lm.storageConfigured} onCancel={() => setModal(null)} onSubmit={(values, file) => void submitMaterial(values, file)} />
      )}

      {modal?.kind === "bulk" && (
        <BulkUploadModal
          key={modal.key}
          groups={lm.groups}
          defaultGroupSelection={defaultGroupSelection}
          bulk={lm.bulk}
          storageConfigured={lm.storageConfigured}
          onStart={(items, groupSelection, newGroupType: LessonMaterialType, newGroupName) => void lm.startBulk(items, groupSelection, newGroupType, newGroupName)}
          onClose={closeBulk}
        />
      )}
    </>
  );
}
