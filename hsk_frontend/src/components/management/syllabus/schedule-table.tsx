"use client";

import { Alert } from "antd";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import type { ScheduleModulesMap } from "@/components/management/syllabus/use-schedule-modules";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { missingModuleTypes, moduleTypeLabel, requiredModuleTypes } from "@/lib/syllabus/schedule-modules-model";
import { cloCodes, displayText, isOpenableLink } from "@/lib/syllabus/syllabus-model";
import type { SyllabusDetailResponse, SyllabusScheduleItem } from "@/types/lms";
import type { ScheduleModule } from "@/types/syllabus-modules";

interface ScheduleTableProps {
  detail: SyllabusDetailResponse;
  modulesState: FetchState<ScheduleModulesMap>;
  busyScheduleId: string | null;
  canManage: boolean;
  writeEnabled: boolean;
  onRetryModules: () => void;
  onAddModule: (item: SyllabusScheduleItem) => void;
  onMoveModule: (scheduleId: string, moduleId: string, direction: -1 | 1) => void;
  onDeleteModule: (scheduleId: string, moduleId: string) => void;
}

type MaterialLink = { materialTitle?: string; materialLink?: string };

function MaterialList({ label, items }: { label: string; items: MaterialLink[] | undefined }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="small">
      <span className="text-muted">{label}: </span>
      {items.map((m, i) => {
        const text = m.materialTitle?.trim() || m.materialLink || "—";
        return (
          <span key={`${text}-${i}`}>
            {i > 0 && ", "}
            {isOpenableLink(m.materialLink) ? (
              <a href={m.materialLink} target="_blank" rel="noreferrer">
                {text}
              </a>
            ) : (
              text
            )}
          </span>
        );
      })}
    </div>
  );
}

function ModuleList({ scheduleId, modules, busy, canEdit, onMove, onDelete }: { scheduleId: string; modules: ScheduleModule[]; busy: boolean; canEdit: boolean; onMove: ScheduleTableProps["onMoveModule"]; onDelete: ScheduleTableProps["onDeleteModule"] }) {
  if (!modules.length) return <span className="text-muted">Chưa có module</span>;
  return (
    <div className="module-summary-list" data-testid="module-list" data-schedule-id={scheduleId}>
      {modules.map((m, i) => (
        <div key={m.id} className="module-summary-item d-flex align-items-center justify-content-between gap-2" data-testid="module-item">
          <span>
            #{m.order} {moduleTypeLabel(m.moduleType)}
            {m.title ? ` - ${m.title}` : ""}
          </span>
          {canEdit && (
            <div className="d-flex gap-1">
              <button type="button" className="btn btn-sm btn-outline-secondary" title="Đưa lên" aria-label="Đưa lên" disabled={busy || i === 0} onClick={() => onMove(scheduleId, m.id, -1)}>
                ↑
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" title="Đưa xuống" aria-label="Đưa xuống" disabled={busy || i === modules.length - 1} onClick={() => onMove(scheduleId, m.id, 1)}>
                ↓
              </button>
              <button type="button" className="btn btn-sm btn-outline-danger" title="Xóa module" aria-label="Xóa module" disabled={busy} onClick={() => onDelete(scheduleId, m.id)}>
                {busy ? <span className="spinner-border spinner-border-sm" /> : "Xóa"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Cột "Cần bổ sung": đối chiếu cột "Module ôn luyện" của giáo trình với module đã gắn (getMissingPracticeTypes của bản cũ). */
function NeedCell({ item, modules }: { item: SyllabusScheduleItem; modules: ScheduleModule[] | null }) {
  const required = requiredModuleTypes(item);
  if (!required.length) return <div className="text-muted small">Chưa thấy có thông tin module ôn luyện</div>;
  const raw = (item.moduleOnLuyen ?? []).map((m) => [m.moduleType, m.moduleContent].filter(Boolean).join(": ")).join("; ") || "—";
  if (modules === null) {
    return (
      <div className="module-summary-list">
        <div className="text-muted small">Module ôn luyện theo giáo trình:</div>
        <div className="module-summary-item">{raw}</div>
      </div>
    );
  }
  const missing = missingModuleTypes(required, modules);
  return (
    <div className="module-summary-list">
      <div className="text-muted small">{missing.length ? "Module ôn luyện cần thêm:" : "Theo cột Module ôn luyện:"}</div>
      <div className="module-summary-item">{raw}</div>
      {missing.length ? (
        <>
          <div className="text-muted small">Buổi này nên thêm (mapping):</div>
          <div className="missing-type-list">{missing.map((t) => moduleTypeLabel(t)).join(", ")}</div>
        </>
      ) : (
        <span className="text-success small">Đủ module theo cột này</span>
      )}
    </div>
  );
}

/** Tab "Lịch trình": buổi học của giáo trình (backend chung) + module ôn luyện mỗi buổi (hợp đồng đề xuất HSK). Cột đầu như bản cũ: Thao tác · Buổi · Modules hiện có · Chủ đề · Cần bổ sung. */
export function ScheduleTable(p: ScheduleTableProps) {
  const rows = p.detail.schedule ?? [];
  const canEdit = p.canManage && p.writeEnabled;
  const modulesOf = (scheduleId: string): ScheduleModule[] | null => (p.modulesState.kind === "ok" ? (p.modulesState.data[scheduleId] ?? []) : null);

  return (
    <div className="mt-3" data-testid="schedule-tab">
      <Alert
        type="info"
        showIcon
        className="mb-3"
        message="Phạm vi rút gọn (D-UI-3)"
        description="Màn này chỉ gắn bộ nội dung CÓ SẴN trong kho vào buổi học. Chưa chuyển: tạo nội dung mới ngay tại đây (gói/thư mục/bộ học), gắn học liệu (dùng màn Tài liệu học tập), đề luyện, chọn video từ kho, import module từ Excel."
      />
      {p.canManage && !p.writeEnabled && <WriteLockedNotice what="Thêm / sắp xếp / xóa module ôn luyện" className="mb-3" />}
      <FetchStateNotice state={p.modulesState} waitingText="Module ôn luyện theo buổi chưa được kết nối API (WAITING FOR BACKEND). Lịch trình bên dưới lấy từ giáo trình." onRetry={p.onRetryModules} testId="modules-notice" className="mb-3" />

      <div className="table-responsive border rounded-3">
        <table className="table table-hover mb-0 syllabus-section-table syllabus-schedule-table" data-testid="schedule-table">
          <thead>
            <tr>
              <th className="action-col">Thao tác</th>
              <th className="session-col">Buổi</th>
              <th className="module-col">Modules hiện có</th>
              <th className="topic-col">Chủ đề</th>
              <th className="need-col">Cần bổ sung</th>
              <th>Nội dung</th>
              <th>Hình thức</th>
              <th>CLO</th>
              <th>Tài liệu</th>
              <th>Nhiệm vụ</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && (
              <tr>
                <td colSpan={10} className="text-muted py-4">
                  Không có dữ liệu.
                </td>
              </tr>
            )}
            {rows.map((item, index) => {
              const modules = modulesOf(item.id);
              const busy = p.busyScheduleId === item.id;
              return (
                <tr key={item.id} data-testid="schedule-row" data-schedule-id={item.id}>
                  <td className="text-start action-col">
                    {canEdit && (
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => p.onAddModule(item)} disabled={busy || p.modulesState.kind !== "ok"}>
                        <i className="isax isax-add-circle me-1" />
                        Thêm module
                      </button>
                    )}
                  </td>
                  <td className="session-col text-center fw-bold text-muted">{index + 1}</td>
                  <td className="module-cell module-col">
                    {p.modulesState.kind === "loading" ? (
                      <span className="text-muted">Đang tải...</span>
                    ) : modules === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <ModuleList scheduleId={item.id} modules={modules} busy={busy} canEdit={canEdit} onMove={p.onMoveModule} onDelete={p.onDeleteModule} />
                    )}
                  </td>
                  <td className="topic-col fw-bold">{displayText(item.topic)}</td>
                  <td className="need-col">
                    <NeedCell item={item} modules={modules} />
                  </td>
                  <td>{displayText(item.content)}</td>
                  <td>{displayText(item.delivery)}</td>
                  <td className="text-nowrap">
                    <div>{cloCodes(p.detail, item.coreCloId)}</div>
                    {item.supportingCloId && item.supportingCloId.length > 0 && <div className="small text-muted">Hỗ trợ: {cloCodes(p.detail, item.supportingCloId)}</div>}
                  </td>
                  <td>
                    <MaterialList label="Học viên" items={item.studentMaterials} />
                    <MaterialList label="Giảng viên" items={item.teacherMaterials} />
                    {!item.studentMaterials?.length && !item.teacherMaterials?.length && <span className="text-muted">—</span>}
                  </td>
                  <td>
                    {item.studentTasks && (
                      <div className="small">
                        <span className="text-muted">Học viên: </span>
                        {item.studentTasks}
                      </div>
                    )}
                    {item.teacherTasks && (
                      <div className="small">
                        <span className="text-muted">Giảng viên: </span>
                        {item.teacherTasks}
                      </div>
                    )}
                    {!item.studentTasks && !item.teacherTasks && <span className="text-muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
