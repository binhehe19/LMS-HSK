"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MembershipManagementView } from "@/components/management/membership-management/membership-management-view";
import { MembershipPlanModal } from "@/components/management/membership-management/membership-plan-modal";
import { useMembershipPlans } from "@/components/management/membership-management/use-membership-plans";
import { confirmAction } from "@/components/shared/confirm-action";
import { useWriteGate } from "@/hooks/use-write-gate";
import { apiErrorMessage } from "@/lib/api/api-error-message";
import { createMembershipPlan, deleteMembershipPlan, updateMembershipPlan } from "@/lib/api/payment-client";
import { EMPTY_MEMBERSHIP_FORM, planToForm, validateMembershipPlan, type MembershipPlanForm } from "@/lib/payment/payment-model";
import type { MembershipPlan } from "@/types/payment";

type ModalState = { mode: "create" } | { mode: "edit"; plan: MembershipPlan } | null;

/**
 * Màn "Quản lý Gói thành viên VIP" (/admin/membership-management; HSK cũ: MembershipManagement). Logic của component cũ: tải danh sách, modal tạo/sửa
 * (cùng kiểm tra tên + giá), xoá có xác nhận. Mọi thao tác ghi qua công tắc "membership"; lỗi => toast thông điệp (bản cũ: "Xóa gói thất bại" cố định).
 */
export function MembershipManagementPageContent() {
  const { enabled: writeEnabled, demo } = useWriteGate("membership");
  const { state, reload, lastData } = useMembershipPlans();
  const [modal, setModal] = useState<ModalState>(null);
  // Mỗi lần mở modal tăng một => modal được tạo lại với form ban đầu mới (form sống trong modal, xem membership-plan-modal.tsx).
  const [openSeq, setOpenSeq] = useState(0);
  const [saving, setSaving] = useState(false);

  const plans = state.kind === "ok" ? state.data : state.kind === "loading" ? (lastData ?? []) : [];

  const open = (next: Exclude<ModalState, null>) => {
    setOpenSeq((n) => n + 1);
    setModal(next);
  };

  const submit = async (form: MembershipPlanForm) => {
    if (!modal || saving) return;
    const invalid = validateMembershipPlan(form);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    const isEdit = modal.mode === "edit";
    setSaving(true);
    try {
      const body: MembershipPlanForm = { ...form, name: form.name.trim(), description: form.description.trim() };
      if (modal.mode === "edit") await updateMembershipPlan(modal.plan.id, body, demo);
      else await createMembershipPlan(body, demo);
      toast.success(`${isEdit ? "Cập nhật" : "Tạo"} gói thành công`);
      setModal(null);
      reload();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Thao tác thất bại"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (plan: MembershipPlan) => {
    const agreed = await confirmAction({ title: "Xác nhận xóa gói", content: "Bạn có chắc chắn muốn xóa gói thành viên này không?", okText: "Xóa", cancelText: "Hủy", danger: true });
    if (!agreed) return;
    try {
      await deleteMembershipPlan(plan.id, demo);
      toast.success("Xóa gói thành công");
      reload();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Xóa gói thất bại"));
    }
  };

  return (
    <>
      <MembershipManagementView state={state} plans={plans} writeEnabled={writeEnabled} onRetry={reload} onCreate={() => open({ mode: "create" })} onEdit={(plan) => open({ mode: "edit", plan })} onDelete={remove} />
      <MembershipPlanModal
        key={openSeq}
        mode={modal?.mode ?? null}
        initial={modal?.mode === "edit" ? planToForm(modal.plan) : EMPTY_MEMBERSHIP_FORM}
        saving={saving}
        writeEnabled={writeEnabled}
        onSubmit={submit}
        onCancel={() => setModal(null)}
      />
    </>
  );
}
