"use client";

// Modal "Tạo gói VIP mới" / "Chỉnh sửa gói VIP" của membership-management.tsx (HSK cũ) — cùng antd Modal/Input/InputNumber/Switch và chữ.
// Khác bản cũ có chủ đích: form sống TRONG modal (container đổi `key` mỗi lần mở) để mỗi phím gõ không vẽ lại bảng phía sau; `confirmLoading`
// khi đang lưu (bản cũ dùng `loading` => thay cả form bằng skeleton); nút OK khoá khi công tắc ghi đóng; label gắn htmlFor để đọc được bằng trợ năng.
import { Input, InputNumber, Modal, Switch } from "antd";
import { useState } from "react";
import type { MembershipPlanForm } from "@/lib/payment/payment-model";

export type MembershipPlanModalMode = "create" | "edit";

interface MembershipPlanModalProps {
  /** null = đóng. */
  mode: MembershipPlanModalMode | null;
  /** Giá trị ban đầu của lần mở này (gói đang sửa, hoặc mặc định khi tạo). */
  initial: MembershipPlanForm;
  saving: boolean;
  writeEnabled: boolean;
  onSubmit: (form: MembershipPlanForm) => void;
  onCancel: () => void;
}

const thousands = (value: string | number | undefined) => `${value ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const parseThousands = (value: string | undefined) => Number(String(value ?? "").replace(/\$\s?|(,*)/g, "")) || 0;

export function MembershipPlanModal({ mode, initial, saving, writeEnabled, onSubmit, onCancel }: MembershipPlanModalProps) {
  const [form, setForm] = useState<MembershipPlanForm>(initial);
  const isEdit = mode === "edit";
  return (
    <Modal
      title={isEdit ? "Chỉnh sửa gói VIP" : "Tạo gói VIP mới"}
      open={mode !== null}
      confirmLoading={saving}
      onOk={() => onSubmit(form)}
      onCancel={onCancel}
      okText={isEdit ? "Cập nhật" : "Tạo ngay"}
      cancelText="Hủy"
      okButtonProps={{ disabled: !writeEnabled }}
      cancelButtonProps={{ disabled: saving }}
      width={600}
      className="membership-modal"
      destroyOnClose
    >
      <div className="row g-3 mt-1" data-testid="membership-plan-form">
        <div className="col-12">
          <label className="form-label fs-14 fw-bold" htmlFor="plan-name">
            Tên gói <span className="text-danger">*</span>
          </label>
          <Input id="plan-name" placeholder="Ví dụ: VIP Premium Monthly" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="col-12">
          <label className="form-label fs-14 fw-bold" htmlFor="plan-description">
            Mô tả gói
          </label>
          <Input.TextArea id="plan-description" rows={3} placeholder="Mô tả các đặc quyền của gói này..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="col-md-6">
          <label className="form-label fs-14 fw-bold" htmlFor="plan-price">
            Giá tiền (VNĐ) <span className="text-danger">*</span>
          </label>
          <InputNumber<number> id="plan-price" className="w-100" min={0} formatter={thousands} parser={parseThousands} value={form.price} onChange={(val) => setForm({ ...form, price: val ?? 0 })} />
        </div>
        <div className="col-md-6">
          <label className="form-label fs-14 fw-bold" htmlFor="plan-duration">
            Thời hạn (Ngày) <span className="text-danger">*</span>
          </label>
          <InputNumber<number> id="plan-duration" className="w-100" min={1} value={form.durationInDays} onChange={(val) => setForm({ ...form, durationInDays: val || 30 })} />
        </div>
        <div className="col-12">
          <div className="d-flex align-items-center gap-2">
            <Switch id="plan-active" checked={form.active} onChange={(val) => setForm({ ...form, active: val })} />
            <label className="fs-14 fw-bold mb-0" htmlFor="plan-active">
              Kích hoạt bán gói
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
