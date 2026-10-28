"use client";

// Modal Thêm/Sửa câu hỏi (CreateQuestionModal của HSK cũ) trên antd Modal rộng (bản cũ modal-xl tự vẽ). Không gọi API: container xử lý `onSubmit`;
// giá trị khởi tạo lấy một lần lúc mount (container remount bằng `key`).
import { Modal } from "antd";
import { useState } from "react";
import { toast } from "sonner";
import { QuizQuestionForm } from "@/components/management/content-quiz/quiz-question-form";
import { type QuizQuestionInput, validateQuestionInput } from "@/lib/content/quiz-question";

export interface QuizQuestionModalProps {
  mode: "create" | "edit";
  initialValue: QuizQuestionInput;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (value: QuizQuestionInput) => void;
}

export function QuizQuestionModal({ mode, initialValue, submitting, onCancel, onSubmit }: QuizQuestionModalProps) {
  const [value, setValue] = useState<QuizQuestionInput>(initialValue);
  const isEdit = mode === "edit";

  const submit = () => {
    const invalid = validateQuestionInput(value);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    onSubmit(value);
  };

  return (
    <Modal
      title={
        <div>
          <div className="fw-800">
            <i className="isax isax-message-question me-2 text-primary" />
            {isEdit ? "Chỉnh sửa câu hỏi" : "Thêm câu hỏi mới"}
          </div>
          <p className="text-muted small mb-0 fw-normal">Thiết kế câu hỏi dễ nhập liệu và rõ ràng cho người học.</p>
        </div>
      }
      open
      centered
      wrapClassName="content-tree-modal quiz-question-modal"
      width={960}
      onCancel={onCancel}
      onOk={submit}
      okText={submitting ? "Đang lưu..." : isEdit ? "Cập nhật" : "Thêm câu hỏi"}
      cancelText="Hủy"
      okButtonProps={{ disabled: submitting }}
      confirmLoading={submitting}
    >
      <QuizQuestionForm value={value} onChange={setValue} disabled={submitting} idPrefix={`quiz-question-${mode}`} />
    </Modal>
  );
}
