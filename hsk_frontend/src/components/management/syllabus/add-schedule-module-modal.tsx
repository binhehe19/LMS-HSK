"use client";

// Hộp "Thêm module" cho một buổi — thích nghi theo cơ chế IELTS (frontend/.../package-editor/library-picker-modal.tsx): chọn 1 "bộ nội dung" có sẵn
// trong Kho HSK (Flashcard/Quiz/Ngữ pháp, đã AVAILABLE qua lms-content-client.ts/lms-quiz-client.ts/lms-grammar-client.ts), rồi tick NHIỀU mục lẻ
// trong bộ đó để copy vào buổi (mỗi mục = 1 bản sao riêng, copy-on-attach) — không còn khái niệm "1 module = 1 bộ".
import { Modal } from "antd";
import { useState } from "react";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { listFlashcardPackages, listPackageItems } from "@/lib/api/lms-content-client";
import { listGrammarPackages, listPackageGrammarPoints } from "@/lib/api/lms-grammar-client";
import { listPackageQuizItems, listQuizPackages } from "@/lib/api/lms-quiz-client";
import { QUIZ_SKILLS, quizSkillLabel } from "@/lib/content/quiz-item";
import { SCHEDULE_RESOURCE_TYPE_LABELS, SCHEDULE_RESOURCE_TYPES, type ScheduleResourceType } from "@/lib/syllabus/schedule-resource-types";
import { displayText } from "@/lib/syllabus/syllabus-model";
import type { ContentPackage } from "@/types/content";
import type { SyllabusScheduleItem } from "@/types/lms";

interface PickItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Kỹ năng của bài tập (chỉ loại ASSESSMENT), dùng để lọc trước khi chọn. */
  skill?: string;
}

async function listPackagesOf(type: ScheduleResourceType): Promise<ContentPackage[]> {
  if (type === "VOCABULARY") return listFlashcardPackages();
  if (type === "ASSESSMENT") return listQuizPackages();
  return listGrammarPackages();
}

async function listItemsOf(type: ScheduleResourceType, packageId: string): Promise<PickItem[]> {
  if (type === "VOCABULARY") {
    const items = await listPackageItems(packageId);
    return items.map((c) => ({ id: c.id, title: c.term, subtitle: c.meaning || undefined }));
  }
  if (type === "ASSESSMENT") {
    const items = await listPackageQuizItems(packageId);
    return items.map((q) => ({ id: q.id, title: q.title, subtitle: q.description || (q.questionCount ? `${q.questionCount} câu` : undefined), skill: q.skill }));
  }
  const items = await listPackageGrammarPoints(packageId);
  return items.map((g) => ({ id: g.id, title: g.title, subtitle: g.generalDefinition || undefined }));
}

interface AddScheduleModuleModalProps {
  /** Buổi đang thêm; null = đóng. Cha đặt `key` theo buổi nên mỗi lần mở là form mới. */
  schedule: SyllabusScheduleItem | null;
  /** Vị trí buổi trong lịch trình + 1 — cũng là `sessionNo` khi gắn resource. */
  sessionNo: number;
  busy: boolean;
  onCancel: () => void;
  /** true = đã thêm xong hết (cha đóng hộp); false = còn mục lỗi, hộp giữ nguyên để người dùng thấy toast lỗi. */
  onSubmit: (type: ScheduleResourceType, sources: { id: string; label: string }[], topicId: string | null) => Promise<boolean>;
  /** Chủ đề đã có của buổi này theo loại, để chọn nơi gắn module (rỗng = không hiện ô chọn). */
  topicsOf: (type: ScheduleResourceType) => readonly { id: string; title: string }[];
}

export function AddScheduleModuleModal({ schedule, sessionNo, busy, onCancel, onSubmit, topicsOf }: AddScheduleModuleModalProps) {
  const [type, setType] = useState<ScheduleResourceType>("VOCABULARY");
  const [topicId, setTopicId] = useState("");
  const topics = topicsOf(type);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, string>>(new Map()); // id => title (label cho toast lỗi)
  const [skill, setSkill] = useState("");

  const open = schedule !== null;
  const packages = useKeyedFetch<ContentPackage[]>(open ? `schedule-add-packages:${type}` : null, () => listPackagesOf(type));
  const items = useKeyedFetch<PickItem[]>(open && packageId ? `schedule-add-items:${type}:${packageId}` : null, () => listItemsOf(type, packageId as string));

  const changeType = (next: string) => {
    const t = SCHEDULE_RESOURCE_TYPES.find((v) => v === next) ?? "VOCABULARY";
    setType(t);
    setTopicId("");
    setPackageId(null);
    setSelected(new Map());
    setSkill("");
  };
  // Đổi bộ lọc thì bỏ lựa chọn cũ: mục đã tick mà bị ẩn sẽ không lặng lẽ được thêm vào buổi.
  const changeSkill = (next: string) => {
    setSkill(next);
    setSelected(new Map());
  };
  const pickPackage = (id: string) => {
    setPackageId(id);
    setSelected(new Map());
  };
  const toggle = (item: PickItem) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item.title);
      return next;
    });
  const visible = items.state.kind === "ok" ? items.state.data.filter((i) => !skill || i.skill === skill) : [];
  const selectAll = () => setSelected(new Map(visible.map((i) => [i.id, i.title])));

  const canSubmit = schedule !== null && selected.size > 0 && !busy;
  const submit = async () => {
    const sources = Array.from(selected, ([id, title]) => ({ id, label: title }));
    const done = await onSubmit(type, sources, topicId || null);
    if (done) setSelected(new Map());
  };

  return (
    <Modal
      open={open}
      centered
      width={760}
      title={`Thêm module ôn luyện — ${schedule ? displayText(schedule.topic) : ""}`}
      onCancel={onCancel}
      onOk={() => void submit()}
      okText={`Thêm${selected.size > 0 ? ` ${selected.size} mục` : ""} vào buổi`}
      cancelText="Đóng"
      okButtonProps={{ disabled: !canSubmit, loading: busy }}
      cancelButtonProps={{ disabled: busy }}
      className="schedule-module-add-modal"
    >
      <div className="row g-3">
        <div className="col-md-5">
          <label className="form-label fw-semibold" htmlFor="module-type">
            Loại nội dung
          </label>
          <select id="module-type" className="form-select" value={type} onChange={(e) => changeType(e.target.value)} disabled={busy}>
            {SCHEDULE_RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {SCHEDULE_RESOURCE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-7">
          <label className="form-label fw-semibold" htmlFor="module-package">
            Bộ nội dung trong Kho
          </label>
          <FetchStateNotice state={packages.state} waitingText="Kho nội dung chưa được kết nối API (WAITING FOR BACKEND)." onRetry={packages.reload} testId="packages-notice" />
          {packages.state.kind === "ok" &&
            (packages.state.data.length === 0 ? (
              <div className="text-muted small py-2">Kho chưa có bộ nội dung nào cho loại này.</div>
            ) : (
              <select id="module-package" className="form-select" value={packageId ?? ""} onChange={(e) => pickPackage(e.target.value)} disabled={busy}>
                <option value="" disabled>
                  — Chọn bộ nội dung —
                </option>
                {packages.state.data.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.syllabusName ? ` — ${p.syllabusName}` : ""}
                  </option>
                ))}
              </select>
            ))}
        </div>

        {topics.length > 0 && (
          <div className="col-12">
            <label className="form-label fw-semibold" htmlFor="module-topic">
              Thêm vào chủ đề
            </label>
            <select id="module-topic" className="form-select" value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={busy}>
              <option value="">Không chủ đề</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="col-12">
          {packageId && items.state.kind === "loading" && (
            <div className="text-muted small py-2">
              <span className="spinner-border spinner-border-sm me-2" />
              Đang tải...
            </div>
          )}
          {packageId && <FetchStateNotice state={items.state} waitingText="Kho nội dung chưa được kết nối API (WAITING FOR BACKEND): chưa chọn được mục." onRetry={items.reload} testId="available-notice" />}
          {packageId && items.state.kind === "ok" && (
            <>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small">Đã chọn {selected.size} / {visible.length} mục</span>
                <div className="d-flex align-items-center gap-2">
                  {type === "ASSESSMENT" && (
                    <select className="form-select form-select-sm" style={{ width: "auto" }} aria-label="Lọc theo kỹ năng" value={skill} onChange={(e) => changeSkill(e.target.value)} disabled={busy}>
                      <option value="">Tất cả kỹ năng</option>
                      {QUIZ_SKILLS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={selectAll} disabled={busy || visible.length === 0}>
                    Chọn tất cả
                  </button>
                </div>
              </div>
              {items.state.data.length === 0 ? (
                <div className="text-muted small py-2">Bộ này chưa có mục nào.</div>
              ) : visible.length === 0 ? (
                <div className="text-muted small py-2">Bộ này không có bài tập nào thuộc kỹ năng đã chọn.</div>
              ) : (
                <div className="list-group syllabus-available-list" data-testid="available-list" style={{ maxHeight: 320, overflowY: "auto" }}>
                  {visible.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-2${selected.has(item.id) ? " active" : ""}`}
                      aria-pressed={selected.has(item.id)}
                      onClick={() => toggle(item)}
                      disabled={busy}
                    >
                      <span>
                        <span className="fw-semibold">{item.title || item.id}</span>
                        {item.subtitle && <span className={`d-block small${selected.has(item.id) ? "" : " text-muted"}`}>{item.subtitle}</span>}
                      </span>
                      {type === "ASSESSMENT" && <span className="badge bg-info-subtle text-info border flex-shrink-0">{item.skill ? quizSkillLabel(item.skill) : "Chưa chọn kỹ năng"}</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
