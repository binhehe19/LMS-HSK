"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DictionaryManageView } from "@/components/management/dictionary/dictionary-manage-view";
import { useDictionary } from "@/components/management/dictionary/use-dictionary";
import { VocabularyFormModal } from "@/components/management/dictionary/vocabulary-form-modal";
import { confirmAction } from "@/components/shared/confirm-action";
import { emptyVocabularyForm, vocabularyToForm } from "@/lib/dictionary/vocabulary-form";
import type { Vocabulary } from "@/types/dictionary";

interface FormModalState {
  mode: "create" | "edit" | "view";
  vocab: Vocabulary | null;
  key: number;
}

/**
 * Container màn /vocabulary/manage (ManageVocabulary của HSK cũ): nối hook với giao diện thuần và modal form. Xác nhận xoá dùng `confirmAction`
 * (bản cũ modal tự vẽ "Xác nhận xóa"); Import Excel chưa chuyển => toast.
 */
export function DictionaryManagePageContent() {
  const dict = useDictionary();
  const [formModal, setFormModal] = useState<FormModalState | null>(null);

  const openEdit = async (id: string) => {
    const detail = await dict.loadForEdit(id);
    if (detail) setFormModal((prev) => ({ mode: "edit", vocab: detail, key: (prev?.key ?? 0) + 1 }));
  };

  // `?edit=<id>`: link "Sửa trong Kho" từ học phần mở thẳng form sửa (một lần, khi đã có quyền ghi).
  const editId = useSearchParams().get("edit");
  const openedEditId = useRef<string | null>(null);
  const openLinkedEdit = useEffectEvent((id: string) => void openEdit(id));
  useEffect(() => {
    if (!editId || !dict.canWrite || openedEditId.current === editId) return;
    openedEditId.current = editId;
    openLinkedEdit(editId);
  }, [editId, dict.canWrite]);
  const initialValues = formModal?.vocab ? vocabularyToForm(formModal.vocab) : emptyVocabularyForm();
  if (formModal?.mode === "view") initialValues.hskLevel = formModal.vocab?.hskLevel ?? 0;

  const remove = async (vocab: Vocabulary) => {
    const ok = await confirmAction({
      title: "Xác nhận xóa",
      content: (
        <>
          Bạn có chắc muốn xóa <strong>{vocab.hanzi}</strong> không?
        </>
      ),
      okText: "Xóa ngay",
      cancelText: "Hủy bỏ",
      danger: true,
    });
    if (ok) await dict.remove(vocab);
  };

  return (
    <>
      <DictionaryManageView
        filters={dict.filters}
        state={dict.state}
        page={dict.page}
        access={dict.access}
        writeEnabled={dict.writeEnabled}
        canWrite={dict.canWrite}
        busy={dict.busy}
        onFiltersChange={dict.setFilters}
        onCreate={() => setFormModal((prev) => ({ mode: "create", vocab: null, key: (prev?.key ?? 0) + 1 }))}
        onImport={() => toast.info("Import từ Excel chưa được chuyển sang bản mới (chờ hợp đồng import bất đồng bộ của backend).")}
        onView={(vocab) => setFormModal((prev) => ({ mode: "view", vocab, key: (prev?.key ?? 0) + 1 }))}
        onEdit={(vocab) => void openEdit(vocab.id)}
        onDelete={(vocab) => void remove(vocab)}
        onRetry={dict.reload}
      />
      {formModal && (
        <VocabularyFormModal
          key={formModal.key}
          mode={formModal.mode}
          initialValues={initialValues}
          submitting={dict.busy}
          onCancel={() => setFormModal(null)}
          onSubmit={formModal.mode === "view" ? undefined : (values) => void dict.save(values, formModal.vocab).then((ok) => ok && setFormModal(null))}
        />
      )}
    </>
  );
}
