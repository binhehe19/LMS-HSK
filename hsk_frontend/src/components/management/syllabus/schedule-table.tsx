"use client";

import { Alert } from "antd";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import type { ScheduleResourcesMap } from "@/components/management/syllabus/use-schedule-resources";
import type { ScheduleResourceLink } from "@/lib/api/syllabus-schedule-resources-client";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { missingRawModuleTypes, requiredRawModuleTypes, SCHEDULE_RESOURCE_TYPE_LABELS, SCHEDULE_RESOURCE_TYPES, type ScheduleResourceType } from "@/lib/syllabus/schedule-resource-types";
import { cloCodes, displayText, isOpenableLink } from "@/lib/syllabus/syllabus-model";
import type { SyllabusDetailResponse, SyllabusScheduleItem } from "@/types/lms";

interface ScheduleTableProps {
  detail: SyllabusDetailResponse;
  resourcesState: FetchState<ScheduleResourcesMap>;
  busyScheduleId: string | null;
  canManage: boolean;
  writeEnabled: boolean;
  onRetryResources: () => void;
  onAddModule: (item: SyllabusScheduleItem, sessionNo: number) => void;
  onMoveResource: (scheduleId: string, type: ScheduleResourceType, resourceId: string, direction: -1 | 1) => void;
  onDeleteResource: (scheduleId: string, type: ScheduleResourceType, resourceId: string) => void;
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

function ResourceGroupList({
  scheduleId,
  byType,
  busy,
  canEdit,
  onMove,
  onDelete,
}: {
  scheduleId: string;
  byType: Readonly<Record<ScheduleResourceType, ScheduleResourceLink[]>>;
  busy: boolean;
  canEdit: boolean;
  onMove: ScheduleTableProps["onMoveResource"];
  onDelete: ScheduleTableProps["onDeleteResource"];
}) {
  const total = SCHEDULE_RESOURCE_TYPES.reduce((n, t) => n + (byType[t]?.length ?? 0), 0);
  if (!total) return <span className="text-muted">Chưa có module</span>;
  return (
    <div className="module-summary-list" data-testid="module-list" data-schedule-id={scheduleId}>
      {SCHEDULE_RESOURCE_TYPES.map((type) => {
        const links = byType[type] ?? [];
        if (links.length === 0) return null;
        return (
          <div key={type} className="mb-1">
            <div className="text-muted small fw-semibold">{SCHEDULE_RESOURCE_TYPE_LABELS[type]}</div>
            {links.map((link, i) => (
              <div key={link.id} className="module-summary-item d-flex align-items-center justify-content-between gap-2" data-testid="module-item">
                <span>
                  #{link.displayOrder + 1} {resourceLabel(link)}
                </span>
                {canEdit && (
                  <div className="d-flex gap-1">
                    <button type="button" className="btn btn-sm btn-outline-secondary" title="Đưa lên" aria-label="Đưa lên" disabled={busy || i === 0} onClick={() => onMove(scheduleId, type, link.learningResourceId, -1)}>
                      ↑
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-secondary" title="Đưa xuống" aria-label="Đưa xuống" disabled={busy || i === links.length - 1} onClick={() => onMove(scheduleId, type, link.learningResourceId, 1)}>
                      ↓
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-danger" title="Xóa module" aria-label="Xóa module" disabled={busy} onClick={() => onDelete(scheduleId, type, link.learningResourceId)}>
                      {busy ? <span className="spinner-border spinner-border-sm" /> : "Xóa"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Nhãn hiển thị ngắn của 1 resource đã gắn, lấy từ nội dung thật (VocabularyContent.word / QuizContent.title / GrammarContent.title). */
function resourceLabel(link: ScheduleResourceLink): string {
  const content = link.resourceContent as { word?: string; title?: string } | null;
  return content?.title || content?.word || link.learningResourceId;
}

/** Cột "Cần bổ sung": đối chiếu cột "Module ôn luyện" của giáo trình với resource đã gắn. */
function NeedCell({ item, byType }: { item: SyllabusScheduleItem; byType: Readonly<Record<ScheduleResourceType, ScheduleResourceLink[]>> | null }) {
  const required = requiredRawModuleTypes(item);
  if (!required.length) return <div className="text-muted small">Chưa thấy có thông tin module ôn luyện</div>;
  const raw = (item.moduleOnLuyen ?? []).map((m) => [m.moduleType, m.moduleContent].filter(Boolean).join(": ")).join("; ") || "—";
  if (byType === null) {
    return (
      <div className="module-summary-list">
        <div className="text-muted small">Module ôn luyện theo giáo trình:</div>
        <div className="module-summary-item">{raw}</div>
      </div>
    );
  }
  const counts = Object.fromEntries(SCHEDULE_RESOURCE_TYPES.map((t) => [t, byType[t]?.length ?? 0]));
  const missing = missingRawModuleTypes(required, counts);
  return (
    <div className="module-summary-list">
      <div className="text-muted small">{missing.length ? "Module ôn luyện cần thêm:" : "Theo cột Module ôn luyện:"}</div>
      <div className="module-summary-item">{raw}</div>
      {missing.length ? (
        <>
          <div className="text-muted small">Buổi này nên thêm:</div>
          <div className="missing-type-list">{missing.join(", ")}</div>
        </>
      ) : (
        <span className="text-success small">Đủ module theo cột này</span>
      )}
    </div>
  );
}

/** Tab "Lịch trình": buổi học của giáo trình (backend chung) + module ôn luyện mỗi buổi, gắn trực tiếp vào ContentPackage của chính giáo trình
 * (cơ chế của IELTS) — chỉ Admin thao tác (mọi endpoint /content-packages* chỉ ROLE_ADMIN ở backend). */
export function ScheduleTable(p: ScheduleTableProps) {
  const rows = p.detail.schedule ?? [];
  const canEdit = p.canManage && p.writeEnabled;
  const byTypeOf = (scheduleId: string): Readonly<Record<ScheduleResourceType, ScheduleResourceLink[]>> | null => (p.resourcesState.kind === "ok" ? p.resourcesState.data[scheduleId] ?? null : null);

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
      <FetchStateNotice state={p.resourcesState} waitingText="Module ôn luyện theo buổi chưa được kết nối API (WAITING FOR BACKEND). Lịch trình bên dưới lấy từ giáo trình." onRetry={p.onRetryResources} testId="modules-notice" className="mb-3" />

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
              const sessionNo = index + 1;
              const byType = byTypeOf(item.id);
              const busy = p.busyScheduleId === item.id;
              return (
                <tr key={item.id} data-testid="schedule-row" data-schedule-id={item.id}>
                  <td className="text-start action-col">
                    {canEdit && (
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => p.onAddModule(item, sessionNo)} disabled={busy || p.resourcesState.kind !== "ok"}>
                        <i className="isax isax-add-circle me-1" />
                        Thêm module
                      </button>
                    )}
                  </td>
                  <td className="session-col text-center fw-bold text-muted">{sessionNo}</td>
                  <td className="module-cell module-col">
                    {p.resourcesState.kind === "loading" ? (
                      <span className="text-muted">Đang tải...</span>
                    ) : byType === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <ResourceGroupList scheduleId={item.id} byType={byType} busy={busy} canEdit={canEdit} onMove={p.onMoveResource} onDelete={p.onDeleteResource} />
                    )}
                  </td>
                  <td className="topic-col fw-bold">{displayText(item.topic)}</td>
                  <td className="need-col">
                    <NeedCell item={item} byType={byType} />
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
