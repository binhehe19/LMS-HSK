"use client";

import { useState } from "react";
import { NewAccountsModal } from "@/components/management/teacher-management/new-accounts-modal";
import { TeacherFormModal } from "@/components/management/teacher-management/teacher-form-modal";
import { TeacherManagementView } from "@/components/management/teacher-management/teacher-management-view";
import { TeacherSyncModal } from "@/components/management/teacher-management/teacher-sync-modal";
import { useCmsSync } from "@/components/management/teacher-management/use-cms-sync";
import { useTeacherManagement } from "@/components/management/teacher-management/use-teacher-management";
import { confirmAction } from "@/components/shared/confirm-action";
import { EMPTY_TEACHER_FORM, formFromTeacher, type TeacherFormMode, type TeacherFormValues } from "@/lib/teacher-management/teacher-form";
import { TEACHER_TEMPLATE_FILENAME, buildTeacherTemplateCsv } from "@/lib/teacher-management/teacher-template";
import type { TeacherUser } from "@/types/teacher-management";

type FormModalState = { mode: TeacherFormMode; teacher: TeacherUser | null; key: number };

/** Tải một file văn bản phía trình duyệt (file mẫu CSV); không có upload hay gọi mạng. */
function downloadTextFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Container màn /admin/teacher-management (chế độ Admin của TeacherManagementPage cũ): nối hook dữ liệu với giao diện thuần và các modal.
 * Xác nhận khoá/mở khoá dùng `confirmAction` (antd Modal.confirm) thay cho hai antd Modal riêng của bản cũ — khác có chủ đích theo quy ước M5.
 */
export function TeacherManagementPageContent() {
  const tm = useTeacherManagement();
  const sync = useCmsSync(tm.demo, tm.reload);
  const [formModal, setFormModal] = useState<FormModalState | null>(null);
  const [newAccounts, setNewAccounts] = useState({ open: false, version: 0 });

  const openNewAccounts = () => setNewAccounts((prev) => ({ open: true, version: prev.version + 1 }));
  /** Danh sách "Tài khoản mới" tải lại nếu đang mở (sau gửi lại / đổi email). */
  const refreshNewAccounts = () => setNewAccounts((prev) => (prev.open ? { ...prev, version: prev.version + 1 } : prev));

  const submitForm = async (values: TeacherFormValues) => {
    if (!formModal) return;
    if (formModal.mode === "create") {
      const created = await tm.create(values);
      if (created) {
        setFormModal(null);
        openNewAccounts(); // như bản cũ: tạo xong mở danh sách tài khoản mới để thấy kết quả gửi email
      }
    } else if (formModal.teacher && (await tm.update(formModal.teacher, values))) {
      setFormModal(null);
    }
  };

  const block = async (teacher: TeacherUser) => {
    const ok = await confirmAction({
      title: "Xác nhận khóa giảng viên",
      content: "Bạn có chắc chắn muốn khóa quyền truy cập của tài khoản Giảng viên này không?",
      okText: "Xác nhận khóa",
      danger: true,
    });
    if (ok) await tm.block(teacher);
  };

  const unblock = async (teacher: TeacherUser) => {
    const ok = await confirmAction({
      title: "Xác nhận mở khóa giảng viên",
      content: "Bạn có chắc chắn muốn mở lại quyền truy cập cho tài khoản Giảng viên này không?",
      okText: "Xác nhận mở khóa",
    });
    if (ok) await tm.unblock(teacher);
  };

  const importFile = async (file: File) => {
    const result = await tm.importFile(file);
    if (result && result.items.length > 0) openNewAccounts();
  };

  const resend = async (teacher: TeacherUser) => {
    await tm.resendEmail(teacher.id);
    refreshNewAccounts();
  };

  const changeEmailAndResend = async (teacher: TeacherUser, email: string) => {
    const result = await tm.changeEmailAndResend(teacher.id, email);
    refreshNewAccounts();
    return result !== null;
  };

  return (
    <>
      <TeacherManagementView
        state={tm.state}
        teachers={tm.teachers}
        refreshing={tm.refreshing}
        writeEnabled={tm.writeEnabled}
        busy={tm.busy}
        importing={tm.importing}
        importInProgress={tm.importInProgress}
        syncing={sync.syncing}
        onRetry={tm.reload}
        onOpenSync={sync.openModal}
        onDownloadTemplate={() => downloadTextFile(TEACHER_TEMPLATE_FILENAME, buildTeacherTemplateCsv(), "text/csv;charset=utf-8")}
        onImportFile={(file) => void importFile(file)}
        onOpenCreate={() => setFormModal((prev) => ({ mode: "create", teacher: null, key: (prev?.key ?? 0) + 1 }))}
        onOpenNewAccounts={openNewAccounts}
        onResendEmail={(teacher) => void resend(teacher)}
        onEdit={(teacher) => setFormModal((prev) => ({ mode: "edit", teacher, key: (prev?.key ?? 0) + 1 }))}
        onBlock={(teacher) => void block(teacher)}
        onUnblock={(teacher) => void unblock(teacher)}
      />

      {formModal && (
        <TeacherFormModal
          key={formModal.key}
          mode={formModal.mode}
          initialValues={formModal.teacher ? formFromTeacher(formModal.teacher) : EMPTY_TEACHER_FORM}
          submitting={tm.busy}
          onCancel={() => setFormModal(null)}
          onSubmit={(values) => void submitForm(values)}
        />
      )}

      <TeacherSyncModal open={sync.open} state={sync.state} onStart={() => void sync.start()} onClose={sync.close} />

      <NewAccountsModal
        open={newAccounts.open}
        version={newAccounts.version}
        writeEnabled={tm.writeEnabled}
        busy={tm.busy}
        onClose={() => setNewAccounts((prev) => ({ ...prev, open: false }))}
        onResend={(teacher) => void resend(teacher)}
        onChangeEmailAndResend={changeEmailAndResend}
      />
    </>
  );
}
