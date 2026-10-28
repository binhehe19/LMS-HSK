"use client";

// Port của LMS_Frontend/src/features/learning-path/lesson-materials/manage/lesson-material-management-page.tsx (cùng class `lesson-material-management__*`,
// chữ, biểu tượng; SCSS nạp qua styles/page-styles.ts). View thuần: không gọi API; dữ liệu/thao tác qua props từ lesson-materials-management-page-content.tsx.
//
// Khác bản cũ có chủ đích: (1) bố cục HAI CỘT theo yêu cầu M5 — cột trái danh sách bộ tài liệu có tìm kiếm (+ ngăn "Chưa phân loại"), cột phải bảng tài
// liệu của bộ đang chọn với tab loại (bản cũ: lưới card rồi drill-down thay cả màn); (2) cột bảng theo thứ tự M5: Tên tài liệu, Danh mục, Loại, Tệp,
// Dung lượng, Trạng thái, Thao tác; cột Tệp có liên kết mở tệp từ repo-storage (fileUrl) khi đã cấu hình; (3) lỗi/chưa cấu hình => FetchStateNotice
// (bản cũ: toast + lưới rỗng); (4) nút ghi khoá + WriteLockedNotice khi công tắc "lesson-materials" đóng; (5) react-bootstrap Button/Form/Spinner =>
// phần tử Bootstrap thuần.
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { LessonMaterialsData, MaterialSelection } from "@/components/management/lesson-materials-management/use-lesson-materials";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { PageHeader } from "@/components/shared/page-header";
import { fileUrl } from "@/lib/api/storage-client";
import {
  countByType,
  countGrammarFamily,
  filterGroups,
  filterMaterialsByTab,
  formatBytes,
  getLifecycleActions,
  LESSON_MATERIAL_CATEGORY_LABELS,
  LESSON_MATERIAL_STATUS_LABELS,
  LESSON_MATERIAL_TYPE_LABELS,
  MATERIAL_DETAIL_TABS,
  materialDetailTabLabel,
  materialsOfGroup,
  type MaterialDetailTab,
} from "@/lib/lesson-materials/lesson-material-model";
import type { LessonMaterial, LessonMaterialGroup, LessonMaterialStatus } from "@/types/lesson-materials";

export const LESSON_MATERIALS_WAITING_TEXT = "Danh sách tài liệu học tập chưa được kết nối API (WAITING FOR BACKEND).";

export interface LessonMaterialsViewProps {
  state: FetchState<LessonMaterialsData>;
  groups: LessonMaterialGroup[];
  materials: LessonMaterial[];
  refreshing: boolean;
  writeEnabled: boolean;
  busy: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  selection: MaterialSelection;
  selectedGroup: LessonMaterialGroup | null;
  detailState: FetchState<LessonMaterial[]>;
  tab: MaterialDetailTab;
  onTabChange: (tab: MaterialDetailTab) => void;
  transitioningId: string | null;
  onSelect: (selection: MaterialSelection) => void;
  onOpenCreateGroup: () => void;
  onEditGroup: (group: LessonMaterialGroup) => void;
  onToggleArchive: (group: LessonMaterialGroup) => void;
  onOpenCreate: () => void;
  onOpenBulk: () => void;
  onChangeStatus: (material: LessonMaterial, status: LessonMaterialStatus) => void;
  onRetry: () => void;
  onRetryDetail: () => void;
}

export function LessonMaterialsView(props: LessonMaterialsViewProps) {
  const { state, groups, materials, refreshing, writeEnabled, busy, search, selection, selectedGroup, detailState, tab, transitioningId } = props;
  const loading = state.kind === "loading" && !refreshing;
  const canWrite = writeEnabled && !busy;
  const filteredGroups = filterGroups(groups, search);
  const ungrouped = materialsOfGroup(materials, null);
  const detailMaterials = detailState.kind === "ok" ? filterMaterialsByTab(detailState.data, tab) : [];
  const detailTitle = selection?.kind === "ungrouped" ? "Chưa phân loại" : (selectedGroup?.name ?? "");

  return (
    <ManagementPageFrame contentClassName="lesson-material-management">
      <div className="card lesson-material-management__header">
        <PageHeader
          icon="isax-document-text"
          title="Quản lý tài liệu học tập"
          subtitle="Tổ chức tài liệu theo bộ (Bộ tài liệu); Slide và Ngữ pháp được quản lý tách biệt trong mỗi bộ."
          actions={
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-danger rounded-pill px-3" onClick={props.onOpenCreateGroup} disabled={!canWrite}>
                <i className="isax isax-folder-add me-2" />
                Thêm bộ tài liệu
              </button>
              <button type="button" className="btn btn-danger rounded-pill px-3" onClick={props.onOpenBulk} disabled={!canWrite}>
                <i className="isax isax-document-upload me-2" />
                Thêm nhiều tài liệu
              </button>
              <button type="button" className="btn btn-danger rounded-pill px-4" onClick={props.onOpenCreate} disabled={!canWrite}>
                <i className="isax isax-add-circle me-2" />
                Thêm tài liệu
              </button>
            </div>
          }
        />
      </div>

      <div className="lesson-material-management__notice">
        <i className="isax isax-shield-search" />
        <span>Không tải lên tài liệu nhạy cảm, dữ liệu cá nhân, tài liệu mật hoặc tài liệu yêu cầu kiểm soát truy cập nghiêm ngặt. Phiên bản hiện tại sử dụng liên kết công khai theo đường dẫn.</span>
      </div>

      {!writeEnabled && <WriteLockedNotice what="Thao tác với tài liệu (thêm bộ, thêm tài liệu, đổi trạng thái)" className="mb-3" />}

      {state.kind === "waiting" || state.kind === "error" ? (
        <FetchStateNotice state={state} waitingText={LESSON_MATERIALS_WAITING_TEXT} onRetry={props.onRetry} testId="lm-notice" />
      ) : (
        <div className="row g-3">
          <div className="col-lg-4">
            <div className="lesson-material-management__toolbar" style={{ gridTemplateColumns: "1fr auto" }}>
              <div className="lesson-material-management__search">
                <i className="isax isax-search-normal-1" />
                <input className="form-control" placeholder="Tìm bộ tài liệu..." value={search} onChange={(e) => props.onSearchChange(e.target.value)} aria-label="Tìm bộ tài liệu" />
              </div>
              {search && (
                <button type="button" className="btn btn-link lesson-material-management__clear" onClick={() => props.onSearchChange("")}>
                  Xóa lọc
                </button>
              )}
            </div>

            {loading ? (
              <div className="lesson-material-management__loading" data-testid="lm-loading">
                <span className="spinner-border text-danger" role="status" />
                <span>Đang tải bộ tài liệu...</span>
              </div>
            ) : (
              <div className="lesson-material-management__group-list" data-testid="lm-group-list">
                {filteredGroups.map((group) => {
                  const own = materialsOfGroup(materials, group.id);
                  const selected = selection?.kind === "group" && selection.id === group.id;
                  return (
                    <div className={`lesson-material-management__group-card ${selected ? "is-selected" : ""}`} key={group.id} data-testid="lm-group-card">
                      <div className="lesson-material-management__group-body" role="button" tabIndex={0} aria-pressed={selected} onClick={() => props.onSelect({ kind: "group", id: group.id })} onKeyDown={(e) => e.key === "Enter" && props.onSelect({ kind: "group", id: group.id })}>
                        <div className="lesson-material-management__group-top">
                          <i className="isax isax-folder-2" />
                          <span className={`lesson-material-management__group-status ${group.status.toLowerCase()}`}>{group.status === "ARCHIVED" ? "Đã lưu trữ" : "Đang dùng"}</span>
                        </div>
                        <h6 className="lesson-material-management__group-name" title={group.name}>
                          {group.name}
                        </h6>
                        {group.description ? <p className="lesson-material-management__group-desc">{group.description}</p> : null}
                        <div className="lesson-material-management__group-counts">
                          <span>
                            <b>{countByType(own, "SLIDE")}</b> Slides
                          </span>
                          <span>
                            <b>{countGrammarFamily(own)}</b> Ngữ pháp
                          </span>
                        </div>
                      </div>
                      <div className="lesson-material-management__group-actions">
                        <button type="button" className="btn btn-link btn-sm" onClick={() => props.onEditGroup(group)} disabled={!canWrite}>
                          <i className="isax isax-edit-2 me-1" />
                          Sửa
                        </button>
                        <button type="button" className="btn btn-link btn-sm" onClick={() => props.onToggleArchive(group)} disabled={!canWrite}>
                          {group.status === "ARCHIVED" ? (
                            <>
                              <i className="isax isax-refresh me-1" />
                              Khôi phục
                            </>
                          ) : (
                            <>
                              <i className="isax isax-archive-2 me-1" />
                              Lưu trữ
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className={`lesson-material-management__group-card ${selection?.kind === "ungrouped" ? "is-selected" : ""}`} data-testid="lm-ungrouped-card">
                  <div className="lesson-material-management__group-body" role="button" tabIndex={0} aria-pressed={selection?.kind === "ungrouped"} onClick={() => props.onSelect({ kind: "ungrouped" })} onKeyDown={(e) => e.key === "Enter" && props.onSelect({ kind: "ungrouped" })}>
                    <div className="lesson-material-management__group-top">
                      <i className="isax isax-folder-open" />
                    </div>
                    <h6 className="lesson-material-management__group-name">Chưa phân loại</h6>
                    <p className="lesson-material-management__group-desc">Tài liệu chưa thuộc bộ nào.</p>
                    <div className="lesson-material-management__group-counts">
                      <span>
                        <b>{countByType(ungrouped, "SLIDE")}</b> Slides
                      </span>
                      <span>
                        <b>{countGrammarFamily(ungrouped)}</b> Ngữ pháp
                      </span>
                    </div>
                  </div>
                </div>

                {filteredGroups.length === 0 && ungrouped.length === 0 && (
                  <div className="lesson-material-management__empty" data-testid="lm-empty">
                    <i className="isax isax-folder-open" />
                    <h5>Chưa có bộ tài liệu</h5>
                    <p>Tạo bộ tài liệu đầu tiên (ví dụ &quot;HSK 3&quot;) rồi thêm tài liệu vào bộ.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="col-lg-8">
            {selection === null ? (
              <div className="lesson-material-management__pane-placeholder" data-testid="lm-placeholder">
                <i className="isax isax-document-text" />
                <p className="mb-0">Chọn một bộ tài liệu ở cột bên trái để xem và quản lý tài liệu trong bộ.</p>
              </div>
            ) : (
              <>
                <div className="lesson-material-management__detail-header">
                  <div className="lesson-material-management__detail-title">
                    <h5>{detailTitle}</h5>
                    {selectedGroup?.description ? <p>{selectedGroup.description}</p> : null}
                  </div>
                  {selectedGroup ? (
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={() => props.onEditGroup(selectedGroup)} disabled={!canWrite}>
                        <i className="isax isax-edit-2 me-1" />
                        Sửa bộ
                      </button>
                      <button type="button" className="btn btn-outline-danger btn-sm rounded-pill px-3" onClick={() => props.onToggleArchive(selectedGroup)} disabled={!canWrite}>
                        {selectedGroup.status === "ARCHIVED" ? (
                          <>
                            <i className="isax isax-refresh me-1" />
                            Khôi phục
                          </>
                        ) : (
                          <>
                            <i className="isax isax-archive-2 me-1" />
                            Lưu trữ
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="lesson-material-management__tabs" role="tablist">
                  {MATERIAL_DETAIL_TABS.map((item) => (
                    <button key={item} type="button" role="tab" aria-selected={tab === item} className={`lesson-material-management__tab ${tab === item ? "active" : ""}`} onClick={() => props.onTabChange(item)}>
                      {materialDetailTabLabel(item)}
                    </button>
                  ))}
                </div>

                {detailState.kind === "loading" ? (
                  <div className="lesson-material-management__loading" data-testid="lm-detail-loading">
                    <span className="spinner-border text-danger" role="status" />
                    <span>Đang tải tài liệu...</span>
                  </div>
                ) : detailState.kind !== "ok" ? (
                  <FetchStateNotice state={detailState} waitingText={LESSON_MATERIALS_WAITING_TEXT} onRetry={props.onRetryDetail} testId="lm-detail-notice" />
                ) : detailMaterials.length === 0 ? (
                  tab === "ALL" ? (
                    <div className="lesson-material-management__empty" data-testid="lm-detail-empty">
                      <i className="isax isax-folder-open" />
                      <h5>Chưa có tài liệu trong bộ này</h5>
                      <p>Nhấn &quot;Thêm tài liệu&quot; để thêm Slide hoặc Ngữ pháp vào bộ.</p>
                    </div>
                  ) : (
                    <div className="lesson-material-management__attachment-state" data-testid="lm-detail-empty">
                      Chưa có tài liệu {LESSON_MATERIAL_TYPE_LABELS[tab]} trong bộ này.
                    </div>
                  )
                ) : (
                  <div className="lesson-material-management__table-wrap">
                    <table className="table align-middle mb-0" data-testid="lm-table">
                      <thead>
                        <tr>
                          <th>Tên tài liệu</th>
                          <th>Danh mục</th>
                          <th>Loại</th>
                          <th>Tệp</th>
                          <th>Dung lượng</th>
                          <th>Trạng thái</th>
                          <th className="text-end">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailMaterials.map((material) => {
                          const href = fileUrl(material.fileId);
                          return (
                            <tr key={material.id} data-testid="lm-material-row">
                              <td>
                                <div className="lesson-material-management__material-title">{material.title}</div>
                                {material.description ? <div className="lesson-material-management__material-desc">{material.description}</div> : null}
                              </td>
                              <td>
                                <span className="badge text-bg-light border">{LESSON_MATERIAL_CATEGORY_LABELS[material.category ?? "LESSON"]}</span>
                              </td>
                              <td>
                                <span className="badge text-bg-light border">{LESSON_MATERIAL_TYPE_LABELS[material.type]}</span>
                              </td>
                              <td>
                                <div className="lesson-material-management__file-name">
                                  {href ? (
                                    <a href={href} target="_blank" rel="noreferrer noopener">
                                      {material.filename || "Tệp đã tải lên"}
                                    </a>
                                  ) : (
                                    material.filename || "Tệp đã tải lên"
                                  )}
                                </div>
                                <div className="lesson-material-management__file-meta">{material.mimeType || "Chờ metadata"}</div>
                              </td>
                              <td>{formatBytes(material.sizeBytes)}</td>
                              <td>
                                <span className={`lesson-material-management__status ${material.status.toLowerCase()}`}>{LESSON_MATERIAL_STATUS_LABELS[material.status]}</span>
                              </td>
                              <td className="text-end">
                                <div className="lesson-material-management__actions">
                                  {getLifecycleActions(material.status).map((action) => (
                                    <button key={`${material.id}-${action.status}`} type="button" className={`btn btn-sm rounded-pill px-3 ${action.buttonClass}`} disabled={!canWrite || transitioningId === material.id} onClick={() => props.onChangeStatus(material, action.status)}>
                                      {transitioningId === material.id ? <span className="spinner-border spinner-border-sm me-1" /> : <i className={`isax ${action.icon} me-1`} />}
                                      {action.label}
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </ManagementPageFrame>
  );
}
