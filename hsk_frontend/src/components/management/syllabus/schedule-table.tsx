"use client";

import { Alert } from "antd";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { groupByTopic } from "@/components/management/syllabus/schedule-topic-ui";
import type { ScheduleResourcesMap, ScheduleTopicsMap } from "@/components/management/syllabus/use-schedule-resources";
import type { ScheduleResourceLink, ScheduleTopic } from "@/lib/api/syllabus-schedule-resources-client";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { missingRawModuleTypes, requiredRawModuleTypes, SCHEDULE_RESOURCE_TYPE_LABELS, SCHEDULE_RESOURCE_TYPES, type ScheduleResourceType } from "@/lib/syllabus/schedule-resource-types";
import { cloCodes, displayText, isOpenableLink } from "@/lib/syllabus/syllabus-model";
import type { SyllabusDetailResponse, SyllabusScheduleItem } from "@/types/lms";

interface ScheduleTableProps {
  detail: SyllabusDetailResponse;
  resourcesState: FetchState<ScheduleResourcesMap>;
  onRetryResources: () => void;
  /** Chủ đề trong buổi; vắng = không hiện chủ đề. */
  topics: ScheduleTopicsMap | null;
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

function ResourceGroupList({ byType, topicsByType }: { byType: Readonly<Record<ScheduleResourceType, ScheduleResourceLink[]>>; topicsByType: Readonly<Record<ScheduleResourceType, ScheduleTopic[]>> | null }) {
  return <div data-testid="module-list">{SCHEDULE_RESOURCE_TYPES.map(type => {
    const groups = groupByTopic(byType[type] ?? [], topicsByType?.[type] ?? []);
    if (!groups.some(g => g.topic || g.links.length)) return null;
    return <div key={type}><strong>{SCHEDULE_RESOURCE_TYPE_LABELS[type]}</strong>{groups.map(g => <div key={g.topic?.id ?? "none"} className="ms-2">{g.topic && <div>{g.topic.title}</div>}{g.links.map(link => <div key={link.id} data-testid="module-item">{resourceLabel(link)}</div>)}</div>)}</div>;
  })}</div>;
}

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
  const byTypeOf = (scheduleId: string): Readonly<Record<ScheduleResourceType, ScheduleResourceLink[]>> | null => (p.resourcesState.kind === "ok" ? p.resourcesState.data[scheduleId] ?? null : null);

  return (
    <div className="mt-3" data-testid="schedule-tab">
      <Alert
        type="info"
        showIcon
        className="mb-3"
        message="Học liệu theo học phần"
        description="Gắn học phần ở phía trên. Mở học phần để thêm, sửa, xóa hoặc sắp xếp học liệu theo buổi và chủ đề."
      />
      <FetchStateNotice state={p.resourcesState} waitingText="Module ôn luyện theo buổi chưa được kết nối API (WAITING FOR BACKEND). Lịch trình bên dưới lấy từ giáo trình." onRetry={p.onRetryResources} testId="modules-notice" className="mb-3" />

      <div className="table-responsive border rounded-3">
        <table className="table table-hover mb-0 syllabus-section-table syllabus-schedule-table" data-testid="schedule-table">
          <thead>
            <tr>
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
                <td colSpan={9} className="text-muted py-4">
                  Không có dữ liệu.
                </td>
              </tr>
            )}
            {rows.map((item, index) => {
              const sessionNo = index + 1;
              const byType = byTypeOf(item.id);
              return (
                <tr key={item.id} data-testid="schedule-row" data-schedule-id={item.id}>
                  <td className="session-col text-center fw-bold text-muted">{sessionNo}</td>
                  <td className="module-cell module-col">
                    {p.resourcesState.kind === "loading" ? (
                      <span className="text-muted">Đang tải...</span>
                    ) : byType === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <ResourceGroupList byType={byType} topicsByType={p.topics?.[item.id] ?? null} />
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
