"use client";

import type { ReactNode } from "react";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { ScheduleTable } from "@/components/management/syllabus/schedule-table";
import type { ScheduleModulesMap } from "@/components/management/syllabus/use-schedule-modules";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { buildSyllabusInfoFields, cloCodes, displayText, formatSyllabusDate, syllabusTitle, type InfoField } from "@/lib/syllabus/syllabus-model";
import { SYLLABUS_TABS, type SyllabusTabKey } from "@/lib/syllabus/syllabus-params";
import type { SyllabusDetailResponse, SyllabusScheduleItem, SyllabusVersionResponse } from "@/types/lms";

interface SyllabusDetailPanelProps {
  detailState: FetchState<SyllabusDetailResponse>;
  versionsState: FetchState<SyllabusVersionResponse[]>;
  tab: SyllabusTabKey;
  onTabChange: (tab: SyllabusTabKey) => void;
  onBack: () => void;
  onReload: () => void;
  canManage: boolean;
  writeEnabled: boolean;
  modulesState: FetchState<ScheduleModulesMap>;
  busyScheduleId: string | null;
  onRetryModules: () => void;
  onAddModule: (item: SyllabusScheduleItem) => void;
  onMoveModule: (scheduleId: string, moduleId: string, direction: -1 | 1) => void;
  onDeleteModule: (scheduleId: string, moduleId: string) => void;
}

interface SectionColumn<T> {
  title: string;
  render: (row: T) => ReactNode;
  className?: string;
}

/** Bảng của một mục (CLO / Tài liệu / Cấu trúc đánh giá / Phiên bản) — thay renderDataTable (cột theo khoá JSON) của bản cũ bằng cột cố định theo DTO. */
function SectionTable<T>({ rows, columns, rowKey, testId }: { rows: readonly T[]; columns: SectionColumn<T>[]; rowKey: (row: T, index: number) => string; testId: string }) {
  if (!rows.length) return <div className="text-muted py-4">Không có dữ liệu.</div>;
  return (
    <div className="table-responsive border rounded-3 mt-3">
      <table className="table table-hover mb-0 syllabus-section-table" data-testid={testId}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.title} className={c.className}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)}>
              {columns.map((c) => (
                <td key={c.title} className={c.className}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoGrid({ fields, testId }: { fields: InfoField[]; testId: string }) {
  return (
    <div className="info-grid mt-3" data-testid={testId}>
      {fields.map((field) => (
        <div className="info-item" key={field.label}>
          <label>{field.label}</label>
          <div className="value-box">{field.value}</div>
        </div>
      ))}
    </div>
  );
}

function VersionsTab({ state, onRetry }: { state: FetchState<SyllabusVersionResponse[]>; onRetry: () => void }) {
  if (state.kind === "loading") {
    return (
      <div className="text-center py-4">
        <span className="spinner-border spinner-border-sm text-primary" /> <span className="text-muted ms-2">Đang tải phiên bản...</span>
      </div>
    );
  }
  if (state.kind !== "ok") return <FetchStateNotice state={state} waitingText="Phiên bản giáo trình chưa được kết nối API (WAITING FOR BACKEND)." onRetry={onRetry} testId="versions-notice" className="mt-3" />;
  return (
    <SectionTable
      rows={state.data}
      rowKey={(v, i) => v.id ?? String(i)}
      testId="versions-table"
      columns={[
        { title: "Phiên bản", render: (v) => displayText(v.versionNo) },
        { title: "Trạng thái", render: (v) => displayText(v.status) },
        { title: "Ngày phát hành", render: (v) => formatSyllabusDate(v.publishedAt) },
        { title: "Người phát hành", render: (v) => displayText(v.publishedBy) },
        { title: "Ghi chú thay đổi", render: (v) => displayText(v.changeNote) },
      ]}
    />
  );
}

export function SyllabusDetailPanel(p: SyllabusDetailPanelProps) {
  const detail = p.detailState;
  return (
    <>
      <div className="toolbar px-4 py-3 border-bottom bg-light">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={p.onBack}>
            <i className="isax isax-arrow-left-2 me-1" />
            Danh sách giáo trình
          </button>
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={p.onReload} disabled={detail.kind === "loading"}>
            <i className="isax isax-arrow-2 me-1" />
            Tải lại
          </button>
        </div>
      </div>

      <div className="content-wrapper">
        {detail.kind === "loading" && (
          <div className="text-center py-5 mt-5">
            <span className="spinner-border text-primary" />
            <p className="mt-3 text-muted">Đang tải dữ liệu syllabus...</p>
          </div>
        )}

        {(detail.kind === "waiting" || detail.kind === "error") && (
          <div className="p-3">
            <FetchStateNotice state={detail} waitingText="Chi tiết giáo trình chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={p.onReload} testId="syllabus-notice" />
          </div>
        )}

        {detail.kind === "ok" && (
          <div className="syllabus-detail-panel p-3 p-lg-4">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <h5 className="mb-0 fw-700" data-testid="syllabus-title">
                {syllabusTitle(detail.data)}
              </h5>
              <span className="text-muted small">{[detail.data.code, detail.data.educationLevelName, detail.data.status].filter(Boolean).join(" · ")}</span>
            </div>

            <ul className="nav nav-tabs syllabus-tabs" role="tablist">
              {SYLLABUS_TABS.map((t) => (
                <li className="nav-item" key={t.key} role="presentation">
                  <button type="button" role="tab" aria-selected={p.tab === t.key} className={`nav-link${p.tab === t.key ? " active" : ""}`} onClick={() => p.onTabChange(t.key)}>
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>

            {p.tab === "info" && <InfoGrid fields={buildSyllabusInfoFields(detail.data)} testId="info-grid" />}

            {p.tab === "clo" && (
              <SectionTable
                rows={detail.data.clo ?? []}
                rowKey={(c) => c.id}
                testId="clo-table"
                columns={[
                  { title: "Mã", render: (c) => displayText(c.code), className: "text-nowrap" },
                  { title: "Tên", render: (c) => displayText(c.name) },
                  { title: "Mô tả", render: (c) => displayText(c.description) },
                ]}
              />
            )}

            {p.tab === "materials" && (
              <SectionTable
                rows={detail.data.materials ?? []}
                rowKey={(m) => m.id}
                testId="materials-table"
                columns={[
                  { title: "Tiêu đề", render: (m) => displayText(m.title) },
                  { title: "Loại", render: (m) => displayText(m.type) },
                  { title: "Tác giả", render: (m) => displayText(m.author) },
                  { title: "Nhà xuất bản", render: (m) => displayText(m.publisher) },
                  { title: "Năm", render: (m) => displayText(m.year) },
                  { title: "Lần xuất bản", render: (m) => displayText(m.edition) },
                  { title: "ISBN", render: (m) => displayText(m.isbn) },
                ]}
              />
            )}

            {p.tab === "schedule" && (
              <ScheduleTable
                detail={detail.data}
                modulesState={p.modulesState}
                busyScheduleId={p.busyScheduleId}
                canManage={p.canManage}
                writeEnabled={p.writeEnabled}
                onRetryModules={p.onRetryModules}
                onAddModule={p.onAddModule}
                onMoveModule={p.onMoveModule}
                onDeleteModule={p.onDeleteModule}
              />
            )}

            {p.tab === "grading" && (
              <SectionTable
                rows={detail.data.gradingStructure ?? []}
                rowKey={(g) => g.id}
                testId="grading-table"
                columns={[
                  { title: "Hạng mục", render: (g) => displayText(g.item) },
                  { title: "Loại", render: (g) => displayText(g.type) },
                  { title: "Trọng số", render: (g) => displayText(g.weight), className: "text-nowrap" },
                  { title: "Thời điểm", render: (g) => displayText(g.timing) },
                  { title: "Thời lượng", render: (g) => displayText(g.duration) },
                  { title: "CLO", render: (g) => cloCodes(detail.data, g.cloIds) },
                  { title: "Hình thức tổ chức", render: (g) => displayText(g.organizationalForm) },
                  { title: "Tiêu chí", render: (g) => displayText(g.criteria) },
                  { title: "Phạm vi nội dung", render: (g) => displayText(g.contentScope) },
                ]}
              />
            )}

            {p.tab === "test-template" &&
              (detail.data.testTemplate ? (
                <InfoGrid
                  testId="test-template-grid"
                  fields={[
                    { label: "Hình thức kiểm tra giữa kỳ", value: displayText(detail.data.testTemplate.midtermFormat) },
                    { label: "Hình thức kiểm tra cuối kỳ", value: displayText(detail.data.testTemplate.finalFormat) },
                    { label: "Ghi chú", value: displayText(detail.data.testTemplate.notes) },
                  ]}
                />
              ) : (
                <div className="text-muted py-4">Không có dữ liệu.</div>
              ))}

            {p.tab === "versions" && <VersionsTab state={p.versionsState} onRetry={p.onReload} />}
          </div>
        )}
      </div>
    </>
  );
}
