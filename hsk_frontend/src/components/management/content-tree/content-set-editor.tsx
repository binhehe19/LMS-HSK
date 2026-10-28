"use client";

// Trang tạo/sửa MỘT bộ kèm danh sách mục (create-set-page.tsx / update-set-page.tsx của HSK cũ, generic theo ContentModuleConfig): khối thông tin bộ,
// danh sách mục (mỗi mục một card với form của module), "Thêm mới", "Nhập nhanh" nhiều mục từ văn bản (bulk import cũ, phía client).
// Khác bản cũ có chủ đích: chọn gói → thư mục bằng hai select (bản cũ một select thư mục toàn hệ thống); ảnh qua kho lưu trữ (fileId) thay cho URL;
// lỗi tải/chưa cấu hình là khối thông báo; nút Lưu khoá khi không có quyền (ticket) hay công tắc ghi đóng.
import { Alert } from "antd";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { type ContentSetEditorMode, type ContentSetSaved, useContentSetEditor } from "@/components/management/content-tree/use-content-set-editor";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import type { ContentItemBase, ContentModuleConfig } from "@/types/content";

export interface ContentSetEditorProps<TItem extends ContentItemBase> {
  config: ContentModuleConfig<TItem>;
  mode: ContentSetEditorMode;
  /** Đích của nút quay lại (đã kiểm tra là đường dẫn nội bộ). */
  backHref: string;
  onSaved: (result: ContentSetSaved) => void;
}

const LABEL = "form-label small fw-800 text-muted text-uppercase mb-1";
const LABEL_STYLE = { letterSpacing: "0.5px" } as const;

export function ContentSetEditor<TItem extends ContentItemBase>({ config, mode, backHref, onSaved }: ContentSetEditorProps<TItem>) {
  const editor = useContentSetEditor(config, mode);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const { labels, ItemForm } = config;
  const noun = labels.item.toLowerCase();
  const isEdit = mode.kind === "edit";
  const draft = editor.draft;
  const disabled = !editor.canWrite || editor.saving;

  const save = async () => {
    const result = await editor.save();
    if (result) onSaved(result);
  };

  const importBulk = () => {
    if (!config.parseBulkText) return;
    const inputs = config.parseBulkText(bulkText);
    if (inputs.length === 0) {
      toast.error("Không có dữ liệu hợp lệ");
      return;
    }
    editor.addItems(inputs);
    toast.success(`Đã thêm ${inputs.length} ${noun}`);
    setBulkText("");
    setBulkOpen(false);
  };

  return (
    <ManagementPageFrame contentClassName={`${config.pageClassName} content-tree-page`}>
      <div className="card manage-lp-container border-0 shadow-sm" data-testid="content-set-editor" data-mode={mode.kind}>
        <div className="manage-lp-header px-4 pt-4 border-0">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
            <div className="d-flex align-items-center gap-3">
              <Link href={backHref} prefetch={false} className="btn btn-sm btn-icon btn-light rounded-circle" aria-label="Quay lại">
                <i className="isax isax-arrow-left" />
              </Link>
              <h5 className="section-title mb-0 fw-800">{isEdit ? `Chỉnh sửa ${labels.studySet}` : `Tạo ${labels.studySet} mới`}</h5>
            </div>
            {editor.canWrite && draft && (
              <div className="d-flex gap-2">
                {config.parseBulkText && (
                  <button type="button" className="btn btn-outline-primary btn-sm px-3 rounded-pill fw-semibold" onClick={() => setBulkOpen((v) => !v)} disabled={editor.saving}>
                    <i className="isax isax-document-text me-1" />
                    Nhập nhanh
                  </button>
                )}
                <button type="button" className="btn btn-primary btn-sm px-4 rounded-pill fw-bold" onClick={() => void save()} disabled={editor.saving} data-testid="set-editor-save">
                  {editor.saving ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : `Tạo ${labels.studySet}`}
                </button>
              </div>
            )}
          </div>

          {editor.access.status !== "loading" && !editor.access.canManage && (
            <div className="mb-3">
              <Alert message="Chế độ Xem duy nhất" description="Bạn hiện không có Ticket được cấp cho Module này. Bạn vẫn có thể xem các nội dung nhưng không thể Thêm, Sửa hoặc Xóa." type="warning" showIcon className="rounded-3 border-warning bg-soft-warning" data-testid="content-readonly-alert" />
            </div>
          )}
          {editor.access.canManage && !editor.writeEnabled && (
            <div className="mb-3">
              <WriteLockedNotice what={`Lưu ${labels.studySet.toLowerCase()}`} />
            </div>
          )}
        </div>

        <div className="card-body p-4">
          {isEdit && editor.loadState.kind === "loading" && (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
              <p className="text-muted mt-3 mb-0">Đang tải {labels.studySet.toLowerCase()}...</p>
            </div>
          )}
          {isEdit && <FetchStateNotice state={editor.loadState} waitingText={`Kho nội dung chưa được kết nối API (WAITING FOR BACKEND). Chưa tải được ${labels.studySet.toLowerCase()}.`} onRetry={editor.reload} testId="set-editor-notice" />}

          {draft && (
            <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
              <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: "16px" }}>
                <div className="card-body p-3 px-4">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className={LABEL} style={LABEL_STYLE} htmlFor="set-editor-title">
                        Tên {labels.studySet}
                      </label>
                      <input id="set-editor-title" type="text" className="form-control" placeholder="VD: Bài 1 - Chào hỏi cơ bản" value={draft.title} onChange={(e) => editor.update({ title: e.target.value })} disabled={disabled} />
                    </div>
                    {isEdit ? (
                      <div className="col-md-6">
                        <label className={LABEL} style={LABEL_STYLE}>{labels.folder}</label>
                        <div className="form-control bg-light" aria-readonly="true">
                          <i className="isax isax-folder-2 me-1 text-warning" />
                          {editor.loadedFolder?.name ?? draft.folderId}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="col-md-3">
                          <label className={LABEL} style={LABEL_STYLE} htmlFor="set-editor-package">
                            {labels.package}
                          </label>
                          <select id="set-editor-package" className="form-select" value={draft.packageId} onChange={(e) => editor.update({ packageId: e.target.value, folderId: "" })} disabled={disabled}>
                            <option value="">Chọn {labels.package.toLowerCase()}</option>
                            {editor.packages.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label className={LABEL} style={LABEL_STYLE} htmlFor="set-editor-folder">
                            {labels.folder}
                          </label>
                          <select id="set-editor-folder" className="form-select" value={draft.folderId} onChange={(e) => editor.update({ folderId: e.target.value })} disabled={disabled || !draft.packageId}>
                            <option value="">Chọn {labels.folder.toLowerCase()}</option>
                            {editor.folders.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    {config.hasSkill && config.skills && (
                      <div className="col-md-6">
                        <label className={LABEL} style={LABEL_STYLE} htmlFor="set-editor-skill">
                          Kỹ năng
                        </label>
                        <select id="set-editor-skill" className="form-select" value={draft.skill} onChange={(e) => editor.update({ skill: e.target.value })} disabled={disabled}>
                          <option value="">Chọn kỹ năng</option>
                          {config.skills.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="col-12">
                      <label className={LABEL} style={LABEL_STYLE} htmlFor="set-editor-description">
                        Mô tả
                      </label>
                      <textarea id="set-editor-description" className="form-control" rows={2} placeholder={`Mô tả ngắn về ${labels.studySet.toLowerCase()} này...`} value={draft.description} onChange={(e) => editor.update({ description: e.target.value })} disabled={disabled} />
                    </div>
                  </div>
                  {!isEdit && (editor.packagesState.kind === "waiting" || editor.packagesState.kind === "error" || editor.foldersState.kind === "error") && (
                    <div className="mt-3">
                      <FetchStateNotice state={editor.packagesState.kind === "ok" ? editor.foldersState : editor.packagesState} waitingText="Kho nội dung chưa được kết nối API (WAITING FOR BACKEND): chưa chọn được gói/thư mục." testId="set-editor-tree-notice" />
                    </div>
                  )}
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold mb-0">
                  {labels.item} ({draft.items.length})
                </h5>
              </div>

              {bulkOpen && config.parseBulkText && (
                <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: "12px" }} data-testid="set-editor-bulk">
                  <div className="card-body p-3 px-4">
                    <label className={LABEL} style={LABEL_STYLE} htmlFor="set-editor-bulk-text">
                      Mỗi dòng một {noun}: chữ Hán, nghĩa, pinyin (phân cách bằng tab, phẩy, chấm phẩy, hai chấm hoặc |)
                    </label>
                    <textarea id="set-editor-bulk-text" className="form-control" rows={5} placeholder={"你好\tXin chào\tnǐ hǎo\n谢谢\tCảm ơn\txièxie"} value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
                    <button type="button" className="btn btn-primary mt-3" onClick={importBulk}>
                      Thêm từ văn bản
                    </button>
                  </div>
                </div>
              )}

              {draft.items.map((item, index) => (
                <div key={item.localId} className="card border-0 shadow-sm mb-3" style={{ borderRadius: "12px" }} data-testid="set-editor-item">
                  <div className="card-body p-3 px-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-700 text-muted">
                        {labels.item} {index + 1}
                      </span>
                      {editor.canWrite && (
                        <button type="button" className="btn btn-icon btn-sm btn-light text-danger border-0" onClick={() => editor.removeItem(item.localId)} title={`Xóa ${noun}`} aria-label={`Xóa ${noun} ${index + 1}`} disabled={editor.saving}>
                          <i className="isax isax-trash" />
                        </button>
                      )}
                    </div>
                    <ItemForm value={item.input} onChange={(next) => editor.setItem(item.localId, next)} disabled={disabled} idPrefix={`set-item-${item.localId}`} />
                  </div>
                </div>
              ))}

              {editor.canWrite && (
                <button type="button" className="card border-0 shadow-sm mb-4 text-center w-100 content-add-item-card" onClick={editor.addItem} disabled={editor.saving} data-testid="set-editor-add">
                  <div className="card-body py-3">
                    <h6 className="mb-0 text-primary fw-bold text-uppercase">
                      <i className="isax isax-add me-2" />
                      Thêm {noun} mới
                    </h6>
                  </div>
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </ManagementPageFrame>
  );
}
