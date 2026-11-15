"use client";

// View thuần (không gọi API) của /learning-path/lesson-materials/manage, HAI CỘT: cột trái bộ tài liệu (tìm kiếm), cột phải bảng tài liệu của bộ
// đang chọn. Gắn trực tiếp vào ContentPackage/LearningResource có sẵn (xem use-lesson-materials.ts): mỗi bộ có đúng 1 loại (Slides/Tài liệu) cố định,
// trạng thái bộ = publish của package (Bản nháp/Đã xuất bản, không còn ACTIVE/ARCHIVED riêng), không còn "Chưa phân loại" hay trạng thái riêng từng
// tài liệu — mỗi tài liệu dùng nút "Xoá" (xoá thật) thay các nút vòng đời cũ.
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { MaterialSelection } from "@/components/management/lesson-materials-management/use-lesson-materials";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { PageHeader } from "@/components/shared/page-header";
import { fileUrl } from "@/lib/api/storage-client";
import { filterGroups, formatBytes, groupStatusLabel, LESSON_MATERIAL_TYPE_LABELS } from "@/lib/lesson-materials/lesson-material-model";
import type { LessonMaterial, LessonMaterialGroup } from "@/types/lesson-materials";

export const LESSON_MATERIALS_WAITING_TEXT = "Danh sách bộ tài liệu chưa được kết nối API (WAITING FOR BACKEND).";

export interface LessonMaterialsViewProps {
  state: FetchState<LessonMaterialGroup[]>;
  groups: LessonMaterialGroup[];
  refreshing: boolean;
  writeEnabled: boolean;
  busy: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  selection: MaterialSelection;
  selectedGroup: LessonMaterialGroup | null;
  detailState: FetchState<LessonMaterial[]>;
  onSelect: (selection: MaterialSelection) => void;
  onOpenCreateGroup: () => void;
  onEditGroup: (group: LessonMaterialGroup) => void;
  onTogglePublish: (group: LessonMaterialGroup) => void;
  onRemoveGroup: (group: LessonMaterialGroup) => void;
  onOpenCreate: () => void;
  onOpenBulk: () => void;
  onRemoveMaterial: (material: LessonMaterial) => void;
  onRetry: () => void;
  onRetryDetail: () => void;
}

export function LessonMaterialsView(props: LessonMaterialsViewProps) {
  const { state, groups, refreshing, writeEnabled, busy, search, selection, selectedGroup, detailState } = props;
  const loading = state.kind === "loading" && !refreshing;
  const canWrite = writeEnabled && !busy;
  const filteredGroups = filterGroups(groups, search);
  const detailMaterials = detailState.kind === "ok" ? detailState.data : [];

  return (
    <ManagementPageFrame contentClassName="lesson-material-management">
      <div className="card lesson-material-management__header">
        <PageHeader
          icon="isax-document-text"
          title="Quản lý tài liệu học tập"
          subtitle="Tổ chức tài liệu theo bộ (Bộ tài liệu); mỗi bộ chỉ chứa một loại: Slides hoặc Tài liệu."
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

      {!writeEnabled && <WriteLockedNotice what="Thao tác với tài liệu (thêm bộ, thêm tài liệu, xoá, xuất bản)" className="mb-3" />}

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
                  const selected = selection?.id === group.id;
                  return (
                    <div className={`lesson-material-management__group-card ${selected ? "is-selected" : ""}`} key={group.id} data-testid="lm-group-card">
                      <div className="lesson-material-management__group-body" role="button" tabIndex={0} aria-pressed={selected} onClick={() => props.onSelect({ id: group.id })} onKeyDown={(e) => e.key === "Enter" && props.onSelect({ id: group.id })}>
                        <div className="lesson-material-management__group-top">
                          <i className="isax isax-folder-2" />
                          <span className={`lesson-material-management__group-status ${group.status.toLowerCase()}`}>{groupStatusLabel(group.status)}</span>
                        </div>
                        <h6 className="lesson-material-management__group-name" title={group.name}>
                          {group.name}
                        </h6>
                        {group.description ? <p className="lesson-material-management__group-desc">{group.description}</p> : null}
                        <div className="lesson-material-management__group-counts">
                          <span className="badge text-bg-light border">{LESSON_MATERIAL_TYPE_LABELS[group.type]}</span>
                          {group.syllabusName && (
                            <span className="badge text-bg-light border" title="Giáo trình" data-testid="lm-group-syllabus">
                              {group.syllabusName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="lesson-material-management__group-actions">
                        <button type="button" className="btn btn-link btn-sm" onClick={() => props.onEditGroup(group)} disabled={!canWrite}>
                          <i className="isax isax-edit-2 me-1" />
                          Sửa
                        </button>
                        <button type="button" className="btn btn-link btn-sm" onClick={() => props.onTogglePublish(group)} disabled={!canWrite}>
                          {group.status === "PUBLISHED" ? (
                            <>
                              <i className="isax isax-edit-2 me-1" />
                              Về nháp
                            </>
                          ) : (
                            <>
                              <i className="isax isax-tick-circle me-1" />
                              Xuất bản
                            </>
                          )}
                        </button>
                        <button type="button" className="btn btn-link btn-sm text-danger" onClick={() => props.onRemoveGroup(group)} disabled={!canWrite}>
                          <i className="isax isax-trash me-1" />
                          Xoá
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredGroups.length === 0 && (
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
                    <h5>{selectedGroup?.name ?? ""}</h5>
                    {selectedGroup?.description ? <p>{selectedGroup.description}</p> : null}
                  </div>
                </div>

                {detailState.kind === "loading" ? (
                  <div className="lesson-material-management__loading" data-testid="lm-detail-loading">
                    <span className="spinner-border text-danger" role="status" />
                    <span>Đang tải tài liệu...</span>
                  </div>
                ) : detailState.kind !== "ok" ? (
                  <FetchStateNotice state={detailState} waitingText={LESSON_MATERIALS_WAITING_TEXT} onRetry={props.onRetryDetail} testId="lm-detail-notice" />
                ) : detailMaterials.length === 0 ? (
                  <div className="lesson-material-management__empty" data-testid="lm-detail-empty">
                    <i className="isax isax-folder-open" />
                    <h5>Chưa có tài liệu trong bộ này</h5>
                    <p>Nhấn &quot;Thêm tài liệu&quot; để thêm vào bộ.</p>
                  </div>
                ) : (
                  <div className="lesson-material-management__table-wrap">
                    <table className="table align-middle mb-0" data-testid="lm-table">
                      <thead>
                        <tr>
                          <th>Tên tài liệu</th>
                          <th>Tệp</th>
                          <th>Dung lượng</th>
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
                              <td className="text-end">
                                <div className="lesson-material-management__actions">
                                  <button type="button" className="btn btn-sm rounded-pill px-3 btn-outline-danger" disabled={!canWrite} onClick={() => props.onRemoveMaterial(material)}>
                                    <i className="isax isax-trash me-1" />
                                    Xoá
                                  </button>
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
