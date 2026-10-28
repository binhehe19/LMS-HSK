"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DictionaryManageView } from "@/components/management/dictionary/dictionary-manage-view";
import { useDictionary } from "@/components/management/dictionary/use-dictionary";
import { VocabularyFormModal } from "@/components/management/dictionary/vocabulary-form-modal";
import { confirmAction } from "@/components/shared/confirm-action";
import { emptyVocabularyForm, vocabularyToForm } from "@/lib/dictionary/vocabulary-form";
import type { Vocabulary } from "@/types/dictionary";

interface FormModalState {
  editing: Vocabulary | null;
  key: number;
}

/**
 * Container màn /vocabulary/manage (ManageVocabulary của HSK cũ): nối hook với giao diện thuần và modal form. Xác nhận xoá dùng `confirmAction`
 * (bản cũ modal tự vẽ "Xác nhận xóa"); Import Excel chưa chuyển => toast.
 */
export function DictionaryManagePageContent() {
  const dict = useDictionary();
  const [formModal, setFormModal] = useState<FormModalState | null>(null);

  const openEdit = async (vocab: Vocabulary) => {
    const detail = await dict.loadForEdit(vocab.id);
    if (detail) setFormModal((prev) => ({ editing: detail, key: (prev?.key ?? 0) + 1 }));
  };

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
        refreshing={dict.refreshing}
        access={dict.access}
        writeEnabled={dict.writeEnabled}
        canWrite={dict.canWrite}
        busy={dict.busy}
        onFiltersChange={dict.setFilters}
        onCreate={() => setFormModal((prev) => ({ editing: null, key: (prev?.key ?? 0) + 1 }))}
        onImport={() => toast.info("Import từ Excel chưa được chuyển sang bản mới (chờ hợp đồng import bất đồng bộ của backend).")}
        onEdit={(vocab) => void openEdit(vocab)}
        onDelete={(vocab) => void remove(vocab)}
        onRetry={dict.reload}
      />
      {formModal && (
        <VocabularyFormModal
          key={formModal.key}
          mode={formModal.editing ? "edit" : "create"}
          initialValues={formModal.editing ? vocabularyToForm(formModal.editing) : emptyVocabularyForm()}
          submitting={dict.busy}
          onCancel={() => setFormModal(null)}
          onSubmit={(values) => void dict.save(values, formModal.editing).then((ok) => ok && setFormModal(null))}
        />
      )}
    </>
  );
}
