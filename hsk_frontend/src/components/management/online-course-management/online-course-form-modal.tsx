"use client";

// Modal "Cập Nhật Khóa Học" (modal upsert react-bootstrap cũ => antd Modal; cùng trường, nhãn, placeholder). Chỉ có chế độ SỬA: nút "Tạo mới khóa học"
// của bản cũ bị ẩn (`{false && …}`) nên không có đường vào chế độ tạo. Không gọi API: `onSubmit(values)` do container xử lý; giá trị khởi tạo lấy
// một lần lúc mount (container remount bằng `key` mỗi lần mở).
import { Modal } from "antd";
import { useState } from "react";
import { validateCourseForm, type CourseFormValues } from "@/lib/online-course/online-course-model";

export interface OnlineCourseFormModalProps {
  initialValues: CourseFormValues;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: CourseFormValues) => void;
}

export function OnlineCourseFormModal({ initialValues, submitting, onCancel, onSubmit }: OnlineCourseFormModalProps) {
  const [values, setValues] = useState<CourseFormValues>(initialValues);
  const set = (field: keyof CourseFormValues) => (event: { target: { value: string } }) => setValues((prev) => ({ ...prev, [field]: event.target.value }));
  const invalid = validateCourseForm(values);

  return (
    <Modal
      title="Cập Nhật Khóa Học"
      open
      centered
      width={800}
      wrapClassName="onl-modal-custom"
      onCancel={onCancel}
      onOk={() => onSubmit(values)}
      okText={submitting ? "Đang lưu..." : "Lưu thay đổi"}
      cancelText="Hủy bỏ"
      okButtonProps={{ disabled: submitting || invalid !== null }}
      confirmLoading={submitting}
    >
      <div className="row g-4" data-testid="onl-course-form">
        <div className="col-md-12">
          <label className="form-label" htmlFor="onl-form-name">
            Tên khóa học
          </label>
          <input id="onl-form-name" className="form-control" placeholder="Ví dụ: Chinese HSK3 Online Intensive" value={values.name} onChange={set("name")} />
        </div>
        <div className="col-md-8">
          <label className="form-label" htmlFor="onl-form-thumbnail">
            Thumbnail URL
          </label>
          <input id="onl-form-thumbnail" className="form-control" placeholder="https://..." value={values.thumbnail} onChange={set("thumbnail")} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="onl-form-price">
            Học phí (VND)
          </label>
          <input id="onl-form-price" type="number" className="form-control" placeholder="2500000" value={values.price} onChange={set("price")} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="onl-form-syllabus">
            Syllabus ID
          </label>
          <input id="onl-form-syllabus" className="form-control" placeholder="Nhập ID từ CMS" value={values.syllabusId} onChange={set("syllabusId")} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="onl-form-type">
            Loại hình
          </label>
          <select id="onl-form-type" className="form-select" value={values.courseType} onChange={set("courseType")}>
            <option value="">Chọn loại</option>
            <option value="Group">Lớp nhóm (Group)</option>
            <option value="1-1">Học 1 kèm 1 (1-1)</option>
          </select>
        </div>
        <div className="col-md-2">
          <label className="form-label" htmlFor="onl-form-level">
            Trình độ
          </label>
          <input id="onl-form-level" className="form-control" placeholder="HSK3" value={values.level} onChange={set("level")} />
        </div>
        <div className="col-md-2">
          <label className="form-label" htmlFor="onl-form-lessons">
            Số bài
          </label>
          <input id="onl-form-lessons" type="number" className="form-control" value={values.totalLessons} onChange={set("totalLessons")} />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="onl-form-description">
            Mô tả ngắn gọn
          </label>
          <textarea id="onl-form-description" className="form-control" rows={3} placeholder="Nhập mô tả về khóa học..." value={values.description} onChange={set("description")} />
        </div>
        {invalid && values.name !== initialValues.name && <div className="col-12 text-danger small">{invalid}</div>}
      </div>
    </Modal>
  );
}
