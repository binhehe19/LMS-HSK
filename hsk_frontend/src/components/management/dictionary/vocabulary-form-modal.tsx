"use client";

// Modal Thêm/Sửa từ vựng — port vocabulary-form-modal.tsx (+ measure-word-manager.tsx, related-words-manager.tsx) của HSK cũ lên antd Modal, giữ 5 tab:
// Thông tin | Nghĩa & Ví dụ | Từ ghép | Lượng từ & liên quan | Media & Chi tiết; mỗi pinyin có từ loại/nghĩa/lượng từ/từ ghép/đồng-trái nghĩa riêng.
// Không gọi API: `onSubmit(values)` do container xử lý; kiểm tra bằng lib/dictionary/vocabulary-form.ts và nhảy về tab có lỗi như bản cũ.
// Khác bản cũ có chủ đích: ô "thêm" của lượng từ/từ liên quan dùng state React (bản cũ document.getElementById); media chỉ nhận URL (upload qua
// MediaUploadService chưa chuyển); danh sách từ loại dùng chung 19 mục của bộ lọc màn cũ.
import { Modal } from "antd";
import { useState } from "react";
import { toast } from "sonner";
import { emptyMeaning, emptyPinyin, type MeaningFormItem, type PinyinFormItem, removePinyin, setPrimaryPinyin, validateVocabularyForm, type VocabularyFormTab, type VocabularyFormValues } from "@/lib/dictionary/vocabulary-form";
import { formatMeasureWords, HSK_LEVELS, type MeasureWord, parseMeasureWords, type RelatedWord, WORD_TYPES } from "@/lib/dictionary/vocabulary-model";

export interface VocabularyFormModalProps {
  mode: "create" | "edit";
  initialValues: VocabularyFormValues;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: VocabularyFormValues) => void;
}

const TABS: { key: VocabularyFormTab; label: string }[] = [
  { key: "info", label: "Thông tin" },
  { key: "meaning", label: "Nghĩa & Ví dụ" },
  { key: "compounds", label: "Từ ghép" },
  { key: "related", label: "Lượng từ & liên quan" },
  { key: "details", label: "Media & Chi tiết" },
];
const LABEL = "form-label fw-bold text-dark small";
const HANZI_STYLE = { fontFamily: '"Noto Sans SC", sans-serif', fontSize: 16 } as const;

function PinyinSelector({ pinyins, activeIdx, onSelect, onAdd, onRemove, disabled }: { pinyins: PinyinFormItem[]; activeIdx: number; onSelect: (i: number) => void; onAdd: () => void; onRemove: (i: number) => void; disabled?: boolean }) {
  return (
    <div className="d-flex align-items-center gap-2 flex-wrap mb-3" data-testid="pinyin-selector">
      {pinyins.map((p, idx) => (
        <div key={idx} className="position-relative">
          <button type="button" className={`btn btn-sm rounded-2 px-3 py-2 fw-bold d-flex align-items-center gap-2 ${activeIdx === idx ? "btn-primary shadow-sm" : "bg-light text-dark border-0"}`} onClick={() => onSelect(idx)} style={{ fontSize: 14, minWidth: 100 }} disabled={disabled} aria-pressed={activeIdx === idx}>
            <span style={HANZI_STYLE}>{p.pinyin || `Pinyin ${idx + 1}`}</span>
            {p.isPrimary && (
              <span style={{ fontSize: 16, color: "#fbbf24" }} title="Pinyin chính">
                ★
              </span>
            )}
          </button>
          {pinyins.length > 1 && (
            <button type="button" className="btn btn-sm p-0 text-danger border-0 position-absolute" style={{ right: -8, top: -8, fontSize: 18, lineHeight: 1, width: 24, height: 24, background: "#e5e7eb", borderRadius: "50%" }} title="Xóa pinyin này" aria-label={`Xóa pinyin ${idx + 1}`} onClick={() => onRemove(idx)} disabled={disabled}>
              ×
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-outline-primary rounded-2 px-3 py-2" style={{ fontSize: 13, fontWeight: 600 }} onClick={onAdd} disabled={disabled}>
        <i className="isax isax-add me-1" /> Thêm pinyin
      </button>
    </div>
  );
}

interface RelatedWordsEditorProps {
  idPrefix: string;
  title: string;
  icon: string;
  tone: "info" | "success" | "danger";
  hanziPlaceholder: string;
  extraPlaceholder: string;
  emptyText: string;
  words: RelatedWord[];
  onChange: (words: RelatedWord[]) => void;
  disabled?: boolean;
}

/** Khối thêm/xoá từ ghép, đồng nghĩa, trái nghĩa (hanzi + ô phụ: Hán Việt hoặc pinyin). */
function RelatedWordsEditor({ idPrefix, title, icon, tone, hanziPlaceholder, extraPlaceholder, emptyText, words, onChange, disabled }: RelatedWordsEditorProps) {
  const [hanzi, setHanzi] = useState("");
  const [extra, setExtra] = useState("");
  const add = () => {
    if (!hanzi.trim()) return;
    onChange([...words, { hanzi: hanzi.trim(), extra: extra.trim() }]);
    setHanzi("");
    setExtra("");
  };
  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: "1rem" }} data-testid={`related-${idPrefix}`}>
      <div className={`card-header bg-${tone} bg-opacity-10 border-bottom py-3 px-4`}>
        <h6 className="mb-0 fw-bold text-dark">
          <i className={`isax ${icon} me-2`} /> {title}
          <span className={`badge bg-${tone} rounded-pill ms-2`}>{words.length}</span>
        </h6>
      </div>
      <div className="card-body p-3">
        <div className="row g-2 mb-3">
          <div className="col-md-5">
            <input type="text" className="form-control form-control-sm" placeholder={hanziPlaceholder} aria-label={`${title}: Hán tự`} style={HANZI_STYLE} value={hanzi} onChange={(e) => setHanzi(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} disabled={disabled} />
          </div>
          <div className="col-md-4">
            <input type="text" className="form-control form-control-sm" placeholder={extraPlaceholder} aria-label={`${title}: ${extraPlaceholder}`} value={extra} onChange={(e) => setExtra(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} disabled={disabled} />
          </div>
          <div className="col-md-3">
            <button type="button" className={`btn btn-sm btn-${tone} w-100 rounded-pill`} onClick={add} disabled={disabled || !hanzi.trim()}>
              <i className="isax isax-add me-1" /> Thêm
            </button>
          </div>
        </div>
        {words.length === 0 ? (
          <div className="text-center py-3 text-muted">
            <small>{emptyText}</small>
          </div>
        ) : (
          <div className="d-flex flex-wrap gap-2">
            {words.map((word, i) => (
              <span key={`${word.hanzi}-${i}`} className={`badge bg-light text-dark border border-${tone} px-3 py-2 d-inline-flex align-items-center`}>
                <span style={{ ...HANZI_STYLE, fontSize: 14, fontWeight: 500 }}>{word.hanzi}</span>
                {word.extra && <span className="ms-1 text-muted">[{word.extra}]</span>}
                <button type="button" className="btn-close ms-2" style={{ width: 14, height: 14 }} aria-label={`Xóa ${word.hanzi}`} onClick={() => onChange(words.filter((_, idx) => idx !== i))} disabled={disabled} />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Lượng từ của một pinyin: chuỗi "个 [gè], 本 [běn]" như máy chủ lưu (measure-word-manager.tsx cũ). */
function MeasureWordsEditor({ value, onChange, disabled }: { value: string; onChange: (next: string) => void; disabled?: boolean }) {
  const [hanzi, setHanzi] = useState("");
  const [pinyin, setPinyin] = useState("");
  const words: MeasureWord[] = parseMeasureWords(value);
  const add = () => {
    if (!hanzi.trim()) return;
    onChange(formatMeasureWords([...words, { hanzi: hanzi.trim(), pinyin: pinyin.trim() }]));
    setHanzi("");
    setPinyin("");
  };
  return (
    <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "1rem" }} data-testid="measure-words">
      <div className="card-header bg-warning bg-opacity-10 border-bottom py-3 px-4">
        <h6 className="mb-0 fw-bold text-dark">
          <i className="isax isax-box me-2" /> Lượng từ (Measure)
          <span className="badge bg-warning rounded-pill ms-2" style={{ color: "#92400e" }}>
            {words.length}
          </span>
        </h6>
      </div>
      <div className="card-body p-3">
        <div className="row g-2 mb-3">
          <div className="col-md-3">
            <input type="text" className="form-control form-control-sm" placeholder="Hán tự (VD: 个)" aria-label="Lượng từ: Hán tự" style={HANZI_STYLE} value={hanzi} onChange={(e) => setHanzi(e.target.value)} disabled={disabled} />
          </div>
          <div className="col-md-3">
            <input type="text" className="form-control form-control-sm" placeholder="Pinyin (VD: gè)" aria-label="Lượng từ: Pinyin" value={pinyin} onChange={(e) => setPinyin(e.target.value)} disabled={disabled} />
          </div>
          <div className="col-md-6">
            <button type="button" className="btn btn-sm btn-warning w-100 rounded-pill" onClick={add} disabled={disabled || !hanzi.trim()}>
              <i className="isax isax-add me-1" /> Thêm Lượng từ
            </button>
          </div>
        </div>
        {words.length === 0 ? (
          <div className="text-center py-2 text-muted">
            <small>Chưa có lượng từ</small>
          </div>
        ) : (
          <div className="d-flex flex-wrap gap-2">
            {words.map((w, i) => (
              <span key={`${w.hanzi}-${i}`} className="badge rounded-2 px-3 py-2 d-inline-flex align-items-center" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", fontSize: 13 }}>
                <span style={{ ...HANZI_STYLE, fontSize: 14, fontWeight: 500 }}>{w.hanzi}</span>
                {w.pinyin && (
                  <span className="ms-1 text-muted" style={{ fontSize: 11 }}>
                    [{w.pinyin}]
                  </span>
                )}
                <button type="button" className="btn-close ms-2" style={{ width: 14, height: 14 }} aria-label={`Xóa lượng từ ${w.hanzi}`} onClick={() => onChange(formatMeasureWords(words.filter((_, idx) => idx !== i)))} disabled={disabled} />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const MEANING_EXAMPLE_FIELDS: { field: keyof MeaningFormItem; label: string; placeholder: string }[] = [
  { field: "exampleSentenceCn", label: "Câu ví dụ (Hán tự)", placeholder: "Hán tự..." },
  { field: "exampleSentencePinyin", label: "Phiên âm", placeholder: "Pinyin..." },
  { field: "exampleSentenceVi", label: "Dịch nghĩa (Việt)", placeholder: "Nghĩa tiếng Việt..." },
  { field: "exampleSentenceEn", label: "Dịch nghĩa (Anh)", placeholder: "Nghĩa tiếng Anh..." },
];

export function VocabularyFormModal({ mode, initialValues, submitting, onCancel, onSubmit }: VocabularyFormModalProps) {
  const [values, setValues] = useState<VocabularyFormValues>(initialValues);
  const [tab, setTab] = useState<VocabularyFormTab>("info");
  const [activeIdx, setActiveIdx] = useState(0);
  const isEdit = mode === "edit";
  const pinyins = values.pinyins;
  const curIdx = Math.min(activeIdx, pinyins.length - 1);
  const cur = pinyins[curIdx];

  const patch = (next: Partial<VocabularyFormValues>) => setValues((v) => ({ ...v, ...next }));
  const patchPinyin = (idx: number, next: Partial<PinyinFormItem>) => setValues((v) => ({ ...v, pinyins: v.pinyins.map((p, i) => (i === idx ? { ...p, ...next } : p)) }));
  const patchMeaning = (meaningIdx: number, next: Partial<MeaningFormItem>) => patchPinyin(curIdx, { meanings: cur.meanings.map((m, i) => (i === meaningIdx ? { ...m, ...next } : m)) });

  const addPinyin = () => {
    patch({ pinyins: [...pinyins, emptyPinyin()] });
    setActiveIdx(pinyins.length);
  };
  const dropPinyin = (idx: number) => {
    if (pinyins.length <= 1) {
      toast.error("Phải có ít nhất một pinyin!");
      return;
    }
    patch({ pinyins: removePinyin(pinyins, idx) });
    setActiveIdx((i) => Math.min(i, pinyins.length - 2));
  };
  const dropMeaning = (idx: number) => {
    if (cur.meanings.length <= 1) {
      toast.error("Phải có ít nhất một nghĩa!");
      return;
    }
    patchPinyin(curIdx, { meanings: cur.meanings.filter((_, i) => i !== idx) });
  };
  const toggleWordType = (type: string) => patchPinyin(curIdx, { wordTypes: cur.wordTypes.includes(type) ? cur.wordTypes.filter((t) => t !== type) : [...cur.wordTypes, type] });

  const submit = () => {
    const invalid = validateVocabularyForm(values);
    if (invalid) {
      toast.error(invalid.message);
      setTab(invalid.tab);
      return;
    }
    onSubmit(values);
  };

  const selector = <PinyinSelector pinyins={pinyins} activeIdx={curIdx} onSelect={setActiveIdx} onAdd={addPinyin} onRemove={dropPinyin} disabled={submitting} />;
  const pinyinName = cur.pinyin || `pinyin ${curIdx + 1}`;

  return (
    <Modal
      title={isEdit ? "Cập nhật từ vựng" : "Thêm từ vựng mới"}
      open
      centered
      wrapClassName="content-tree-modal vocabulary-form-modal"
      width={900}
      onCancel={onCancel}
      onOk={submit}
      okText={submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo mới"}
      cancelText="Đóng"
      okButtonProps={{ disabled: submitting }}
      confirmLoading={submitting}
    >
      <div data-testid="vocabulary-form">
        <ul className="nav nav-tabs border-0 w-100 pb-2 vocab-form-tabs mb-3" role="tablist">
          {TABS.map((t) => (
            <li key={t.key} className="nav-item" role="presentation">
              <button type="button" role="tab" aria-selected={tab === t.key} className={`nav-link ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                {t.label}
                {t.key === "compounds" && pinyins.some((p) => p.compounds.length > 0) && <span className="badge bg-primary rounded-pill ms-1" style={{ fontSize: 9 }}>{pinyins.reduce((s, p) => s + p.compounds.length, 0)}</span>}
                {t.key === "related" && pinyins.reduce((s, p) => s + p.synonyms.length + p.antonyms.length, 0) > 0 && <span className="badge bg-info rounded-pill ms-1" style={{ fontSize: 9 }}>{pinyins.reduce((s, p) => s + p.synonyms.length + p.antonyms.length, 0)}</span>}
              </button>
            </li>
          ))}
        </ul>

        <div style={{ minHeight: 400 }}>
          {tab === "info" && (
            <div className="row g-3" data-testid="vocab-tab-info">
              <div className="col-md-4">
                <label className={LABEL} htmlFor="vocab-hanzi">
                  Hán tự <span className="text-danger">*</span>
                </label>
                <input id="vocab-hanzi" type="text" className="form-control form-control-lg vocab-hanzi" value={values.hanzi} placeholder="Nhập từ vựng..." onChange={(e) => patch({ hanzi: e.target.value })} disabled={submitting} />
              </div>
              <div className="col-md-4">
                <label className={LABEL} htmlFor="vocab-radical">
                  Bộ thủ
                </label>
                <input id="vocab-radical" type="text" className="form-control form-control-lg" value={values.radical} placeholder="Nhập bộ..." onChange={(e) => patch({ radical: e.target.value })} disabled={submitting} />
              </div>
              <div className="col-md-2">
                <label className={LABEL} htmlFor="vocab-stroke-count">
                  Số nét
                </label>
                <input id="vocab-stroke-count" type="number" className="form-control form-control-lg" min={1} value={values.strokeCount} placeholder="..." onChange={(e) => patch({ strokeCount: e.target.value })} disabled={submitting} />
              </div>
              <div className="col-md-2">
                <label className={LABEL} htmlFor="vocab-hsk">
                  HSK
                </label>
                <select id="vocab-hsk" className="form-select form-select-lg" value={values.hskLevel} onChange={(e) => patch({ hskLevel: Number(e.target.value) })} disabled={submitting}>
                  {HSK_LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-8">
                <label className={LABEL} htmlFor="vocab-strokes">
                  Nét bút
                </label>
                <input id="vocab-strokes" type="text" className="form-control form-control-lg" value={values.strokes} placeholder="横、竖、横..." onChange={(e) => patch({ strokes: e.target.value })} disabled={submitting} />
              </div>
              <div className="col-md-4 d-flex flex-column justify-content-end">
                <div className="d-flex align-items-center justify-content-between p-2 border rounded-3 bg-light bg-opacity-50 h-100">
                  <span className="fw-bold text-dark small">Cấu trúc</span>
                  <div className="d-flex bg-white p-1 rounded-pill border shadow-sm" role="radiogroup" aria-label="Cấu trúc từ">
                    {[true, false].map((val) => (
                      <button key={String(val)} type="button" role="radio" aria-checked={values.isSingleVocab === val} className={`btn btn-sm px-3 py-1 rounded-pill ${values.isSingleVocab === val ? "btn-primary shadow-sm" : "text-muted border-0"}`} onClick={() => patch({ isSingleVocab: val })} style={{ fontSize: 12 }} disabled={submitting}>
                        {val ? "Từ đơn" : "Từ ghép"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <label className={LABEL} htmlFor="vocab-status">
                  Trạng thái
                </label>
                <select id="vocab-status" className="form-select form-select-lg" value={values.status} onChange={(e) => patch({ status: e.target.value === "published" ? "published" : "draft" })} disabled={submitting}>
                  <option value="draft">Draft (Nháp)</option>
                  <option value="published">Published (Đã xuất bản)</option>
                </select>
              </div>

              <div className="col-md-12 mt-2">
                <div className="border rounded-3 p-3 bg-white">
                  <div className="fw-bold text-dark mb-2" style={{ fontSize: 14 }}>
                    Pinyin ({pinyins.length})
                  </div>
                  {selector}
                  <div className="border rounded-3 p-3 bg-light bg-opacity-25">
                    <div className="row g-2 mb-3">
                      <div className="col-md-4">
                        <label className={`${LABEL} mb-1`} htmlFor="vocab-pinyin">
                          Pinyin <span className="text-danger">*</span>
                        </label>
                        <input id="vocab-pinyin" type="text" className="form-control form-control-sm" placeholder="shàng, shǎng..." value={cur.pinyin} onChange={(e) => patchPinyin(curIdx, { pinyin: e.target.value })} disabled={submitting} />
                      </div>
                      <div className="col-md-4">
                        <label className={`${LABEL} mb-1`} htmlFor="vocab-sino">
                          Hán Việt
                        </label>
                        <input id="vocab-sino" type="text" className="form-control form-control-sm" placeholder="thượng..." value={cur.sinoVietnamese} onChange={(e) => patchPinyin(curIdx, { sinoVietnamese: e.target.value })} disabled={submitting} />
                      </div>
                      <div className="col-md-4 d-flex align-items-end">
                        <button type="button" disabled={submitting || cur.isPrimary} className={`btn btn-sm w-100 rounded-pill ${cur.isPrimary ? "btn-warning text-dark" : "btn-outline-warning"}`} onClick={() => patch({ pinyins: setPrimaryPinyin(pinyins, curIdx) })} style={{ fontSize: 12 }}>
                          {cur.isPrimary ? "★ Pinyin chính" : "☆ Đặt làm chính"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className={`${LABEL} mb-2`}>
                        Loại từ của <span className="text-primary">{pinyinName}</span> <small className="text-muted fw-normal ms-1">(chọn nhiều)</small>
                      </div>
                      <div className="d-flex flex-wrap gap-2" role="group" aria-label="Loại từ">
                        {WORD_TYPES.map((type) => {
                          const selected = cur.wordTypes.includes(type);
                          return (
                            <button key={type} type="button" aria-pressed={selected} className={`btn btn-sm px-3 py-1 rounded-pill ${selected ? "btn-primary shadow-sm" : "btn-outline-secondary"}`} onClick={() => toggleWordType(type)} style={{ fontSize: 12 }} disabled={submitting}>
                              {selected && <i className="isax isax-tick-circle me-1" />}
                              {type}
                            </button>
                          );
                        })}
                      </div>
                      {cur.wordTypes.length === 0 && <small className="text-muted mt-1 d-block">Chưa chọn loại từ nào</small>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "meaning" && (
            <div data-testid="vocab-tab-meaning">
              {selector}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-dark mb-0">
                  Nghĩa của <span className="text-primary">{pinyinName}</span> <span className="text-muted ms-1">({cur.meanings.length})</span>
                </h6>
                <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={() => patchPinyin(curIdx, { meanings: [...cur.meanings, emptyMeaning()] })} disabled={submitting}>
                  <i className="isax isax-add me-1" /> Thêm nghĩa
                </button>
              </div>
              <div className="pe-2" style={{ maxHeight: 400, overflowY: "auto" }}>
                {cur.meanings.map((m, index) => (
                  <div key={index} className="card border mb-3 shadow-sm overflow-hidden" style={{ borderRadius: "1rem" }} data-testid="meaning-card">
                    <div className="card-header bg-light d-flex justify-content-between align-items-center py-2 px-3 border-bottom">
                      <span className="fw-bold text-primary small">Nghĩa #{index + 1}</span>
                      <button type="button" className="btn btn-sm text-danger p-0 border-0" onClick={() => dropMeaning(index)} title="Xóa nghĩa này" aria-label={`Xóa nghĩa ${index + 1}`} disabled={submitting}>
                        <i className="isax isax-trash small" />
                      </button>
                    </div>
                    <div className="card-body p-3">
                      <div className="mb-3">
                        <label className={LABEL} htmlFor={`vocab-meaning-${index}`}>
                          Nghĩa (Tiếng Việt) <span className="text-danger">*</span>
                        </label>
                        <input id={`vocab-meaning-${index}`} type="text" className="form-control form-control-sm" value={m.meaning} placeholder="Nhập nghĩa của từ..." onChange={(e) => patchMeaning(index, { meaning: e.target.value })} disabled={submitting} />
                      </div>
                      <div className="bg-white border rounded-3 p-3">
                        <div className={`${LABEL} mb-2`}>Ví Dụ</div>
                        <div className="row g-2">
                          {MEANING_EXAMPLE_FIELDS.map(({ field, label, placeholder }) => (
                            <div key={field} className="col-md-6">
                              <label className="form-label text-muted small mb-1" htmlFor={`vocab-meaning-${index}-${field}`}>
                                {label}
                              </label>
                              <input id={`vocab-meaning-${index}-${field}`} type="text" className="form-control form-control-sm bg-light border-0" placeholder={placeholder} value={m[field]} onChange={(e) => patchMeaning(index, { [field]: e.target.value })} disabled={submitting} />
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-top">
                          <label className={`${LABEL} mb-2`} htmlFor={`vocab-meaning-${index}-type`}>
                            Loại từ của ví dụ này
                          </label>
                          <select id={`vocab-meaning-${index}-type`} className="form-select form-select-sm bg-light border-0" value={m.exampleWordType} onChange={(e) => patchMeaning(index, { exampleWordType: e.target.value })} disabled={submitting}>
                            <option value="">-- Chọn loại từ (nếu có) --</option>
                            {(cur.wordTypes.length > 0 ? cur.wordTypes : WORD_TYPES).map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "compounds" && (
            <div data-testid="vocab-tab-compounds">
              {selector}
              <small className="text-muted d-block mb-3">
                Từ ghép riêng cho cách đọc: <span className="fw-bold text-primary">{pinyinName}</span>
              </small>
              <RelatedWordsEditor idPrefix="compounds" title="Từ Ghép" icon="isax-components" tone="info" hanziPlaceholder="VD: 上午" extraPlaceholder="Hán Việt (VD: thượng ngọ)" emptyText="Chưa có từ ghép nào. Thêm từ ghép đầu tiên!" words={cur.compounds} onChange={(compounds) => patchPinyin(curIdx, { compounds })} disabled={submitting} />
            </div>
          )}

          {tab === "related" && (
            <div data-testid="vocab-tab-related">
              {selector}
              <MeasureWordsEditor value={cur.measureWord} onChange={(measureWord) => patchPinyin(curIdx, { measureWord })} disabled={submitting} />
              <div className="row g-3 mb-4">
                <div className="col-lg-6">
                  <RelatedWordsEditor idPrefix="synonyms" title="Đồng Nghĩa" icon="isax-equals" tone="success" hanziPlaceholder="Hán tự (VD: 登)" extraPlaceholder="Pinyin (VD: dēng)" emptyText="Chưa có từ đồng nghĩa" words={cur.synonyms} onChange={(synonyms) => patchPinyin(curIdx, { synonyms })} disabled={submitting} />
                </div>
                <div className="col-lg-6">
                  <RelatedWordsEditor idPrefix="antonyms" title="Trái Nghĩa" icon="isax-close-circle" tone="danger" hanziPlaceholder="Hán tự (VD: 下)" extraPlaceholder="Pinyin (VD: xià)" emptyText="Chưa có từ trái nghĩa" words={cur.antonyms} onChange={(antonyms) => patchPinyin(curIdx, { antonyms })} disabled={submitting} />
                </div>
              </div>
              <div className="card border-0 shadow-sm" style={{ borderRadius: "1rem" }}>
                <div className="card-header bg-warning bg-opacity-10 border-bottom py-3 px-4">
                  <h6 className="mb-0 fw-bold text-dark">
                    <i className="isax isax-note me-2" />
                    Ghi chú (Pinyin: <span className="text-warning">{pinyinName}</span>)
                  </h6>
                </div>
                <div className="card-body p-3">
                  <textarea className="form-control" rows={4} aria-label="Ghi chú cho pinyin" placeholder="Ghi chú riêng cho cách đọc này (cách phân biệt, lưu ý cách dùng, v.v.)" value={cur.notes} onChange={(e) => patchPinyin(curIdx, { notes: e.target.value })} disabled={submitting} />
                </div>
              </div>
            </div>
          )}

          {tab === "details" && (
            <div data-testid="vocab-tab-details">
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className={LABEL} htmlFor="vocab-image">
                    Hình minh họa (URL)
                  </label>
                  <input id="vocab-image" type="text" className="form-control bg-light border-0" value={values.imageUrl} placeholder="Link ảnh minh họa..." onChange={(e) => patch({ imageUrl: e.target.value })} disabled={submitting} />
                </div>
                {values.isSingleVocab && (
                  <div className="col-md-6">
                    <label className={LABEL} htmlFor="vocab-stroke-url">
                      URL ảnh động nét viết
                    </label>
                    <input id="vocab-stroke-url" type="text" className="form-control bg-light border-0" value={values.strokeAnimationUrl} placeholder="Link ảnh động viết chữ..." onChange={(e) => patch({ strokeAnimationUrl: e.target.value })} disabled={submitting} />
                  </div>
                )}
              </div>
              <div className="mb-3">
                <label className={LABEL} htmlFor="vocab-etymology">
                  Chiết tự (nguồn gốc)
                </label>
                <textarea id="vocab-etymology" className="form-control bg-light border-0" rows={4} value={values.etymologyStory} placeholder="Giải thích nguồn gốc, câu chuyện ghi nhớ..." onChange={(e) => patch({ etymologyStory: e.target.value })} disabled={submitting} />
              </div>
              <div className="mb-3">
                <label className={LABEL} htmlFor="vocab-etymology-image">
                  Ảnh chiết tự (URL)
                </label>
                <input id="vocab-etymology-image" type="text" className="form-control bg-light border-0" value={values.etymologyImage} placeholder="Link ảnh chiết tự..." onChange={(e) => patch({ etymologyImage: e.target.value })} disabled={submitting} />
              </div>
              <div className="mb-2">
                <label className={LABEL} htmlFor="vocab-notes">
                  Ghi chú chung
                </label>
                <textarea id="vocab-notes" className="form-control bg-light border-0" rows={2} value={values.notes} placeholder="Ghi chú cho toàn bộ từ vựng..." onChange={(e) => patch({ notes: e.target.value })} disabled={submitting} />
              </div>
              <small className="text-muted d-block">Tải tệp ảnh lên kho lưu trữ chưa chuyển sang bản mới: nhập đường dẫn ảnh có sẵn.</small>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
