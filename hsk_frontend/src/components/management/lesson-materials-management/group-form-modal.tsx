"use client";

// Modal "Thêm bộ tài liệu" / "Sửa bộ tài liệu". Không gọi API. Loại (Slides/Tài liệu) chỉ chọn được khi TẠO bộ mới — cố định theo ContentPackageType
// ở backend, không đổi được sau khi bộ đã có tài liệu.
import { Alert, Select, Modal } from "antd";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { listSyllabuses } from "@/lib/api/lms-syllabus-client";
import { useState } from "react";
import type { GroupFormValues } from "@/components/management/lesson-materials-management/use-lesson-materials";
import { LESSON_MATERIAL_TYPE_LABELS, LESSON_MATERIAL_TYPE_ORDER } from "@/lib/lesson-materials/lesson-material-model";
import type { LessonMaterialType } from "@/types/lesson-materials";

export interface GroupFormModalProps {
  initialValues: GroupFormValues;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: GroupFormValues) => void;
}

export function GroupFormModal({ initialValues, submitting, onCancel, onSubmit }: GroupFormModalProps) {
  const [values, setValues] = useState(initialValues);
  const editing = initialValues.id !== null;
  const syllabuses = useKeyedFetch(editing ? null : "material-syllabuses", listSyllabuses);
  return (
    <Modal title={editing ? "Sửa bộ tài liệu" : "Thêm bộ tài liệu"} open centered onCancel={onCancel} onOk={() => onSubmit(values)} okText={submitting ? "Đang lưu..." : editing ? "Lưu" : "Thêm bộ"} cancelText="Hủy" okButtonProps={{ disabled: submitting || !values.name.trim(), danger: true }} confirmLoading={submitting}>
      {!editing && <div className="mb-3"><label>Giáo trình (tùy chọn)</label><Select aria-label="Giáo trình của học phần" allowClear showSearch optionFilterProp="label" style={{ width: "100%" }} disabled={submitting} value={values.syllabusId} onChange={syllabusId => setValues(v => ({ ...v, syllabusId }))} options={syllabuses.state.kind === "ok" ? syllabuses.state.data.map(s => ({ value: s.id, label: s.name || s.code || s.id })) : []} />{syllabuses.state.kind === "error" && <Alert type="error" message="Không tải được giáo trình" action={<button onClick={syllabuses.reload}>Thử lại</button>} />}</div>}
      <div className="row g-3" data-testid="lm-group-form">
        <div className="col-12">
          <label className="form-label" htmlFor="lm-group-name">
            Tên bộ tài liệu
          </label>
          <input id="lm-group-name" className="form-control" value={values.name} onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ví dụ: HSK 3" />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="lm-group-type">
            Loại
          </label>
          <select id="lm-group-type" className="form-select" value={values.type} disabled={editing} onChange={(e) => setValues((prev) => ({ ...prev, type: e.target.value as LessonMaterialType }))}>
            {LESSON_MATERIAL_TYPE_ORDER.map((type) => (
              <option value={type} key={type}>
                {LESSON_MATERIAL_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          {editing && <div className="form-text">Không đổi được loại của bộ đã tạo.</div>}
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="lm-group-description">
            Mô tả
          </label>
          <textarea id="lm-group-description" className="form-control" rows={3} value={values.description} onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))} placeholder="Mô tả ngắn (tùy chọn)" />
        </div>
      </div>
    </Modal>
  );
}
