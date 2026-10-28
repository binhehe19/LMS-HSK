"use client";

// Hộp "Thêm module" cho một buổi — port RÚT GỌN chế độ `existing` (chọn bộ nội dung có sẵn) của modal thêm module trong syllabus-management-modal.tsx
// HSK cũ. Không chuyển (D-UI-3): chế độ `manual` (tạo gói/thư mục/bộ học + nhập nội dung tay), `excel` (import), hàng đợi bản nháp nhiều module,
// module con của "Từ vựng" (externalRefJson), chọn video cho Luyện nghe, gắn học liệu. react-bootstrap Modal => antd Modal.
import { Modal } from "antd";
import { useState } from "react";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { ApiError } from "@/lib/api/api-client";
import { listAvailableScheduleModules } from "@/lib/api/syllabus-modules-client";
import { ADDABLE_MODULE_TYPES, QUIZ_SKILL_OPTIONS, contentTypeOf, moduleTypeLabel } from "@/lib/syllabus/schedule-modules-model";
import { displayText } from "@/lib/syllabus/syllabus-model";
import type { SyllabusScheduleItem } from "@/types/lms";
import type { CreateScheduleModuleRequest, ScheduleAvailableModule, ScheduleModuleType } from "@/types/syllabus-modules";

interface AddScheduleModuleModalProps {
  /** Buổi đang thêm; null = đóng. Cha đặt `key` theo buổi nên mỗi lần mở là form mới. */
  schedule: SyllabusScheduleItem | null;
  busy: boolean;
  onCancel: () => void;
  /** true = đã thêm xong (cha đóng hộp). */
  onSubmit: (body: CreateScheduleModuleRequest) => Promise<boolean>;
}

export function AddScheduleModuleModal({ schedule, busy, onCancel, onSubmit }: AddScheduleModuleModalProps) {
  const [moduleType, setModuleType] = useState<ScheduleModuleType>("VOCABULARY");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ScheduleAvailableModule | null>(null);
  const [title, setTitle] = useState("");
  const [skillType, setSkillType] = useState("PRACTICE");

  const open = schedule !== null;
  const contentType = contentTypeOf(moduleType);
  // Tìm theo từ khoá ĐÃ GỬI (nút Tìm / Enter), không tìm theo từng phím để không dồn request.
  const available = useKeyedFetch<ScheduleAvailableModule[]>(open ? `available:${contentType}:${query}` : null, async () => {
    const data = await listAvailableScheduleModules(contentType, query);
    if (!Array.isArray(data)) throw new ApiError("Dữ liệu kho nội dung trả về không đúng định dạng.", 200);
    return data;
  });

  const changeType = (next: string) => {
    const type = ADDABLE_MODULE_TYPES.find((t) => t === next) ?? "VOCABULARY";
    setModuleType(type);
    setSelected(null);
    setTitle("");
  };
  const pick = (m: ScheduleAvailableModule) => {
    setSelected(m);
    setTitle(m.title ?? "");
  };
  const search = () => setQuery(draft.trim());

  const canSubmit = schedule !== null && selected !== null && title.trim().length > 0 && !busy;
  const submit = () => {
    if (!schedule || !selected) return;
    void onSubmit({ scheduleId: schedule.id, moduleType, contentSetId: selected.id, title: title.trim(), ...(moduleType === "QUIZ" ? { skillType } : {}) });
  };

  return (
    <Modal
      open={open}
      centered
      width={760}
      title={`Thêm module ôn luyện — ${schedule ? displayText(schedule.topic) : ""}`}
      onCancel={onCancel}
      onOk={submit}
      okText="Thêm vào buổi"
      cancelText="Hủy"
      okButtonProps={{ disabled: !canSubmit, loading: busy }}
      cancelButtonProps={{ disabled: busy }}
      className="schedule-module-add-modal"
    >
      <div className="row g-3">
        <div className="col-md-4">
          <label className="form-label fw-semibold" htmlFor="module-type">
            Loại module
          </label>
          <select id="module-type" className="form-select" value={moduleType} onChange={(e) => changeType(e.target.value)} disabled={busy}>
            {ADDABLE_MODULE_TYPES.map((t) => (
              <option key={t} value={t}>
                {moduleTypeLabel(t)}
              </option>
            ))}
          </select>
          {moduleType === "VOCABULARY" && <div className="form-text">Từ vựng dùng bộ thẻ (study set) của Flashcard.</div>}
        </div>
        <div className="col-md-8">
          <label className="form-label fw-semibold" htmlFor="available-search">
            Tìm bộ nội dung có sẵn
          </label>
          <div className="input-group">
            <input
              id="available-search"
              className="form-control"
              placeholder="Tên bộ nội dung"
              value={draft}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  search();
                }
              }}
            />
            <button type="button" className="btn btn-outline-primary" onClick={search} disabled={busy}>
              <i className="isax isax-search-normal-14 me-1" />
              Tìm
            </button>
          </div>
        </div>

        <div className="col-12">
          {available.state.kind === "loading" && (
            <div className="text-muted small py-2">
              <span className="spinner-border spinner-border-sm me-2" />
              Đang tải kho nội dung...
            </div>
          )}
          <FetchStateNotice state={available.state} waitingText="Kho nội dung HSK chưa được kết nối API (WAITING FOR BACKEND): chưa chọn được bộ nội dung." onRetry={available.reload} testId="available-notice" />
          {available.state.kind === "ok" &&
            (available.state.data.length === 0 ? (
              <div className="text-muted small py-2">Không có bộ nội dung phù hợp.</div>
            ) : (
              <div className="list-group syllabus-available-list" data-testid="available-list">
                {available.state.data.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-2${selected?.id === m.id ? " active" : ""}`}
                    aria-pressed={selected?.id === m.id}
                    onClick={() => pick(m)}
                    disabled={busy}
                  >
                    <span>
                      <span className="fw-semibold">{m.title?.trim() || m.id}</span>
                      {m.repoName && <span className={`d-block small${selected?.id === m.id ? "" : " text-muted"}`}>{m.repoName}</span>}
                    </span>
                    {typeof m.itemCount === "number" && <span className="badge bg-light text-dark border">{m.itemCount} mục</span>}
                  </button>
                ))}
              </div>
            ))}
        </div>

        <div className={moduleType === "QUIZ" ? "col-md-8" : "col-12"}>
          <label className="form-label fw-semibold" htmlFor="module-title">
            Tiêu đề module
          </label>
          <input id="module-title" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mặc định lấy tên bộ nội dung đã chọn" disabled={busy} />
        </div>
        {moduleType === "QUIZ" && (
          <div className="col-md-4">
            <label className="form-label fw-semibold" htmlFor="module-skill">
              Kỹ năng
            </label>
            <select id="module-skill" className="form-select" value={skillType} onChange={(e) => setSkillType(e.target.value)} disabled={busy}>
              {QUIZ_SKILL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}
