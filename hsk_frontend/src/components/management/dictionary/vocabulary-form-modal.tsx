"use client";

// Modal Thêm/Sửa từ vựng — port vocabulary-form-modal.tsx (+ measure-word-manager.tsx, related-words-manager.tsx) của HSK cũ lên antd Modal, giữ 5 tab:
// Thông tin | Nghĩa & Ví dụ | Từ ghép | Lượng từ & liên quan | Media & Chi tiết; mỗi pinyin có từ loại/nghĩa/lượng từ/từ ghép/đồng-trái nghĩa riêng.
// Lưu từ qua `onSubmit(values)` do container xử lý; tệp phát âm dùng kho lưu trữ chung.
import { Button, Modal, Segmented, Select } from "antd";
import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ContentAudioPreview, ContentFileField, ContentImagePreview } from "@/components/management/content-tree/content-file-field";
import { HanziStructureSvg } from "./hanzi-structure-svg";
import { fileUrl } from "@/lib/api/storage-client";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { confirmAction } from "@/components/shared/confirm-action";
import { emptyExample, emptyMeaning, emptyPinyin, type ExampleFormItem, type MeaningFormItem, type PinyinFormItem, removePinyin, setPrimaryPinyin, validateVocabularyForm, type VocabularyFormTab, type VocabularyFormValues } from "@/lib/dictionary/vocabulary-form";
import { formatMeasureWords, HSK_LEVELS, parseMeasureWords, type RelatedWord, WORD_TYPES } from "@/lib/dictionary/vocabulary-model";
import type { VocabularyStatus } from "@/types/dictionary";

export interface VocabularyFormModalProps {
  mode: "create" | "edit" | "view";
  initialValues: VocabularyFormValues;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit?: (values: VocabularyFormValues) => void;
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

function PinyinSelector({ pinyins, activeIdx, onSelect, onAdd, onRemove, disabled, readOnly }: { pinyins: PinyinFormItem[]; activeIdx: number; onSelect: (i: number) => void; onAdd: () => void; onRemove: (i: number) => void; disabled?: boolean; readOnly?: boolean }) {
  return (
    <div className="vocab-pinyin-selector d-flex align-items-center flex-wrap mb-3" data-testid="pinyin-selector">
      {pinyins.map((p, idx) => (
        <div key={idx} className="position-relative">
          <button type="button" className={`btn btn-sm rounded-2 px-3 fw-semibold d-flex align-items-center gap-2 vocab-compact-button ${activeIdx === idx ? "btn-primary" : "btn-light border"}`} onClick={() => onSelect(idx)} disabled={disabled} aria-pressed={activeIdx === idx}>
            <span className="vocab-pinyin-text">{p.pinyin || `Pinyin ${idx + 1}`}</span>
            {p.isPrimary && (
              <span style={{ fontSize: 16, color: "#fbbf24" }} title="Pinyin chính">
                ★
              </span>
            )}
          </button>
          {!readOnly && pinyins.length > 1 && (
            <button type="button" className="btn btn-light border rounded-circle text-danger vocab-pinyin-remove" title="Xóa pinyin này" aria-label={`Xóa pinyin ${idx + 1}`} onClick={() => onRemove(idx)} disabled={disabled}>
              ×
            </button>
          )}
        </div>
      ))}
      {!readOnly && <button type="button" className="btn btn-sm btn-outline-primary rounded-2 px-3 vocab-compact-button" onClick={onAdd} disabled={disabled}>
        <i className="isax isax-add me-1" /> Thêm pinyin
      </button>}
    </div>
  );
}

interface RelatedWordsEditorProps {
  idPrefix: string;
  title: string;
  icon: string;
  hanziPlaceholder: string;
  extraLabel: "Tiếng Việt" | "Hán Việt" | "Pinyin";
  emptyText: string;
  words: RelatedWord[];
  onChange?: (words: RelatedWord[]) => void;
  disabled?: boolean;
}

function RelatedWordsEditor({ idPrefix, title, icon, hanziPlaceholder, extraLabel, emptyText, words, onChange, disabled }: RelatedWordsEditorProps) {
  const [hanzi, setHanzi] = useState("");
  const [extra, setExtra] = useState("");
  const [draft, setDraft] = useState<(RelatedWord & { index: number }) | null>(null);

  const addWord = () => {
    if (!onChange || disabled || !hanzi.trim()) return;
    onChange([...words, { hanzi: hanzi.trim(), extra: extra.trim() }]);
    setHanzi("");
    setExtra("");
  };
  const saveWord = () => {
    if (!onChange || disabled || !draft?.hanzi.trim()) return;
    const word = { hanzi: draft.hanzi.trim(), extra: draft.extra.trim() };
    onChange(words.map((current, index) => index === draft.index ? word : current));
    setDraft(null);
  };
  const removeWord = async (index: number) => {
    if (!onChange || disabled) return;
    const confirmed = await confirmAction({
      title: `Xóa ${words[index].hanzi}?`,
      content: "Thay đổi có hiệu lực khi bạn lưu từ vựng.",
      okText: "Xóa",
      danger: true,
    });
    if (!confirmed) return;
    onChange(words.filter((_, current) => current !== index));
    if (draft?.index === index) setDraft(null);
    else if (draft && draft.index > index) setDraft({ ...draft, index: draft.index - 1 });
  };
  return (
    <section className="vocab-detail-section" data-testid={`related-${idPrefix}`}>
      <h6 className="vocab-section-title">
        <i className={`isax ${icon}`} aria-hidden="true" /> {title}
        <span className="vocab-section-count">{words.length}</span>
      </h6>
      {onChange && (
        <form className="vocab-words-add" onSubmit={event => { event.preventDefault(); addWord(); }}>
          <label className="vocab-word-field">
            <span className={LABEL}><Image src="/flags/cn.svg" alt="" width={18} height={12} /> Hán tự</span>
            <input type="text" className="form-control" placeholder={hanziPlaceholder} lang="zh" value={hanzi} onChange={event => setHanzi(event.target.value)} disabled={disabled} />
          </label>
          <label className="vocab-word-field">
            <span className={LABEL}><Image src={extraLabel === "Pinyin" ? "/flags/cn.svg" : "/flags/vn.svg"} alt="" width={18} height={12} /> {extraLabel}</span>
            <input type="text" className="form-control" value={extra} onChange={event => setExtra(event.target.value)} disabled={disabled} />
          </label>
          <Button htmlType="submit" icon={<i className="isax isax-add" aria-hidden="true" />} disabled={disabled || !hanzi.trim()}>Thêm</Button>
        </form>
      )}
      {words.length === 0 ? (
        <div className="vocab-section-empty">{emptyText}</div>
      ) : (
        <ul className="vocab-word-list">
          {words.map((word, i) => (
            <li key={`${word.hanzi}-${i}`} className={`vocab-word-row${draft?.index === i ? " is-editing" : ""}`}>
              {draft?.index === i ? (
                <form className="vocab-word-row-edit" aria-label={`Sửa ${word.hanzi}`} onSubmit={event => { event.preventDefault(); saveWord(); }}>
                  <div className="vocab-word-text">
                    <input type="text" lang="zh" className="form-control form-control-sm" aria-label="Hán tự" value={draft.hanzi}
                      autoFocus onChange={event => setDraft({ ...draft, hanzi: event.target.value })} disabled={disabled} />
                    <input type="text" className="form-control form-control-sm" aria-label={extraLabel} value={draft.extra}
                      onChange={event => setDraft({ ...draft, extra: event.target.value })} disabled={disabled} />
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <Button type="text" size="small" htmlType="submit" title="Cập nhật" aria-label="Cập nhật" disabled={disabled || !draft.hanzi.trim()}
                      icon={<i className="isax isax-tick-circle text-primary" aria-hidden="true" />} />
                    <Button type="text" size="small" title="Hủy sửa" aria-label="Hủy sửa" onClick={() => setDraft(null)}
                      icon={<i className="isax isax-close-circle" aria-hidden="true" />} />
                  </div>
                </form>
              ) : (
                <>
                  <div className="vocab-word-text">
                    <span lang="zh" style={HANZI_STYLE}>{word.hanzi}</span>
                    {word.extra && <span className="small text-muted">{word.extra}</span>}
                  </div>
                  {onChange && (
                    <div className="d-flex align-items-center gap-1">
                      <Button type="text" size="small" title="Sửa" aria-label={`Sửa ${word.hanzi}`} icon={<i className="isax isax-edit" aria-hidden="true" />} onClick={() => setDraft({ ...word, index: i })} disabled={disabled} />
                      <Button type="text" size="small" danger title="Xóa" aria-label={`Xóa ${word.hanzi}`} icon={<i className="isax isax-trash" aria-hidden="true" />} onClick={() => void removeWord(i)} disabled={disabled} />
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const EXAMPLE_FIELDS = [
  { field: "zh", label: "Tiếng Hán", placeholder: "Nhập câu ví dụ…", flag: "cn" },
  { field: "pinyin", label: "Pinyin của câu ví dụ", placeholder: "Phiên âm cả câu (không bắt buộc)" },
  { field: "vi", label: "Tiếng Việt", placeholder: "Nhập bản dịch…", flag: "vn" },
] as const;

export function VocabularyFormModal({ mode, initialValues, submitting = false, onCancel, onSubmit }: VocabularyFormModalProps) {
  const [values, setValues] = useState<VocabularyFormValues>(initialValues);
  const [tab, setTab] = useState<VocabularyFormTab>("info");
  const [activeIdx, setActiveIdx] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [saveAction, setSaveAction] = useState<VocabularyStatus>();
  const isEdit = mode === "edit";
  const isView = mode === "view";
  const locked = isView || submitting;
  const pinyins = values.pinyins;
  const totalMeanings = pinyins.reduce((total, pinyin) => total + pinyin.meanings.length, 0);
  const curIdx = Math.min(activeIdx, pinyins.length - 1);
  const cur = pinyins[curIdx];

  const patch = (next: Partial<VocabularyFormValues>) => setValues((v) => ({ ...v, ...next }));
  const patchPinyin = (idx: number, next: Partial<PinyinFormItem>) => setValues((v) => ({ ...v, pinyins: v.pinyins.map((p, i) => (i === idx ? { ...p, ...next } : p)) }));
  const patchMeaning = (meaningIdx: number, next: Partial<MeaningFormItem>) => patchPinyin(curIdx, { meanings: cur.meanings.map((m, i) => (i === meaningIdx ? { ...m, ...next } : m)) });
  const patchExample = (meaningIdx: number, exampleIdx: number, next: Partial<ExampleFormItem>) => patchMeaning(meaningIdx, { examples: cur.meanings[meaningIdx].examples.map((e, i) => (i === exampleIdx ? { ...e, ...next } : e)) });
  const addExample = (meaningIdx: number) => patchMeaning(meaningIdx, { examples: [...cur.meanings[meaningIdx].examples, emptyExample()] });
  const dropExample = async (meaningIdx: number, exampleIdx: number) => {
    const confirmed = await confirmAction({
      title: `Xóa ví dụ ${exampleIdx + 1} của nghĩa ${meaningIdx + 1}?`,
      content: "Thay đổi có hiệu lực khi bạn lưu từ vựng.",
      okText: "Xóa ví dụ",
      danger: true,
    });
    if (confirmed) patchMeaning(meaningIdx, { examples: cur.meanings[meaningIdx].examples.filter((_, i) => i !== exampleIdx) });
  };

  const addPinyin = () => {
    patch({ pinyins: [...pinyins, emptyPinyin()] });
    setActiveIdx(pinyins.length);
  };
  const dropPinyin = async (idx: number) => {
    if (pinyins.length <= 1) {
      toast.error("Phải có ít nhất một pinyin!");
      return;
    }
    const name = pinyins[idx].pinyin || `Pinyin ${idx + 1}`;
    const confirmed = await confirmAction({
      title: `Xóa ${name}?`,
      content: "Nghĩa, ví dụ và học liệu gắn với cách đọc này sẽ bị xóa khỏi form.",
      okText: "Xóa Pinyin",
      cancelText: "Hủy",
      danger: true,
    });
    if (!confirmed) return;
    patch({ pinyins: removePinyin(pinyins, idx) });
    setActiveIdx(i => Math.min(i > idx ? i - 1 : i, pinyins.length - 2));
  };
  const dropMeaning = async (idx: number) => {
    if (cur.meanings.length <= 1) {
      toast.error("Phải có ít nhất một nghĩa!");
      return;
    }
    const confirmed = await confirmAction({
      title: `Xóa nghĩa ${idx + 1}?`,
      content: "Các ví dụ thuộc nghĩa này cũng sẽ bị xóa khi bạn lưu từ vựng.",
      okText: "Xóa nghĩa",
      danger: true,
    });
    if (confirmed) patchPinyin(curIdx, { meanings: cur.meanings.filter((_, i) => i !== idx) });
  };

  const submit = (status: VocabularyStatus) => {
    if (locked || uploadingFile || !onSubmit) return;
    const invalid = validateVocabularyForm(values);
    if (invalid) {
      toast.error(invalid.message);
      setTab(invalid.tab);
      return;
    }
    setSaveAction(status);
    onSubmit({ ...values, status });
  };

  const selector = <PinyinSelector pinyins={pinyins} activeIdx={curIdx} onSelect={setActiveIdx} onAdd={addPinyin} onRemove={idx => void dropPinyin(idx)} disabled={submitting || uploadingFile} readOnly={isView} />;
  const pinyinName = cur.pinyin || `pinyin ${curIdx + 1}`;

  return (
    <Modal
      title={isView ? <>Chi tiết từ vựng <span lang="zh">{values.hanzi}</span></> : isEdit ? "Cập nhật từ vựng" : "Thêm từ vựng mới"}
      open
      centered={!isView}
      wrapClassName={`content-tree-modal vocabulary-form-modal${isView ? " vocabulary-details-modal" : ""}`}
      width={900}
      onCancel={onCancel}
      onOk={() => submit("published")}
      footer={(_, { CancelBtn, OkBtn }) => isView ? <CancelBtn /> : (
        <>
          <CancelBtn />
          <Button disabled={submitting || uploadingFile} loading={submitting && saveAction === "draft"} onClick={() => submit("draft")}>
            Lưu Nháp
          </Button>
          <OkBtn />
        </>
      )}
      okText="Lưu & Xuất bản"
      cancelText="Đóng"
      okButtonProps={{ disabled: submitting || uploadingFile }}
      confirmLoading={submitting && saveAction === "published"}
    >
      <div className="vocab-form" data-testid="vocabulary-form">
        <ul className="nav nav-tabs vocab-form-tabs mb-3" role="tablist">
          {TABS.map((t) => (
            <li key={t.key} className="nav-item" role="presentation">
              <button type="button" role="tab" aria-selected={tab === t.key} className={`nav-link ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)} disabled={uploadingFile}>
                {t.label}
                {t.key === "meaning" && totalMeanings > 0 && <span className="badge bg-primary rounded-pill ms-1" style={{ fontSize: 9 }}>{totalMeanings}</span>}
                {t.key === "compounds" && pinyins.some((p) => p.compounds.length > 0) && <span className="badge bg-primary rounded-pill ms-1" style={{ fontSize: 9 }}>{pinyins.reduce((s, p) => s + p.compounds.length, 0)}</span>}
                {t.key === "related" && pinyins.reduce((s, p) => s + p.synonyms.length + p.antonyms.length, 0) > 0 && <span className="badge bg-info rounded-pill ms-1" style={{ fontSize: 9 }}>{pinyins.reduce((s, p) => s + p.synonyms.length + p.antonyms.length, 0)}</span>}
              </button>
            </li>
          ))}
        </ul>

        <div key={tab} className="vocab-form-panel">
          {tab === "info" && (
            <div className="row g-3" data-testid="vocab-tab-info">
              <div className="col-12 col-sm-6 col-lg-3">
                <label className={LABEL} htmlFor="vocab-hanzi">
                  Hán tự <span className="text-danger">*</span>
                </label>
                <input id="vocab-hanzi" type="text" className="form-control vocab-hanzi" value={values.hanzi} placeholder="Nhập từ vựng..." onChange={(e) => patch({ hanzi: e.target.value })} readOnly={isView} disabled={submitting} />
              </div>
              <div className="col-12 col-sm-6 col-lg-3">
                <label className={LABEL} htmlFor="vocab-radical">
                  Bộ thủ
                </label>
                <input id="vocab-radical" type="text" className="form-control" value={values.radical} placeholder="Nhập bộ..." onChange={(e) => patch({ radical: e.target.value })} readOnly={isView} disabled={submitting} />
              </div>
              <div className="col-12 col-sm-6 col-lg-3">
                <label className={LABEL} htmlFor="vocab-hsk">
                  HSK
                </label>
                <select id="vocab-hsk" className="form-select" value={values.hskLevel} onChange={(e) => patch({ hskLevel: Number(e.target.value) })} disabled={locked}>
                  {isView && !HSK_LEVELS.includes(values.hskLevel) && <option value={values.hskLevel}>{values.hskLevel || "—"}</option>}
                  {HSK_LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-sm-6 col-lg-3">
                <div id="vocab-structure-label" className={LABEL}>Cấu trúc</div>
                <Segmented
                  className="vocab-structure"
                  aria-labelledby="vocab-structure-label"
                  block
                  size="large"
                  options={["Từ đơn", "Từ ghép"]}
                  value={values.isSingleVocab ? "Từ đơn" : "Từ ghép"}
                  onChange={structure => patch({ isSingleVocab: structure === "Từ đơn" })}
                  disabled={locked}
                />
              </div>

              <div className="col-12">
                <section className="border rounded-3 p-3" aria-labelledby="vocab-readings">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                    <h6 id="vocab-readings" className="fw-semibold text-dark mb-0">Pinyin ({pinyins.length})</h6>
                    {cur.isPrimary ? (
                      <span className="badge text-dark bg-light border">Pinyin chính</span>
                    ) : !isView && (
                      <button type="button" className="btn btn-sm btn-outline-secondary rounded-2 vocab-compact-button" disabled={locked || uploadingFile} onClick={() => patch({ pinyins: setPrimaryPinyin(pinyins, curIdx) })}>
                        Đặt làm Pinyin chính
                      </button>
                    )}
                  </div>
                  {selector}
                  <div className="row g-3">
                    <div className="col-12 col-sm-6 col-lg-3">
                      <label className={LABEL} htmlFor="vocab-pinyin">
                        Pinyin <span className="text-danger">*</span>
                      </label>
                      <input id="vocab-pinyin" type="text" className="form-control" placeholder="shàng, shǎng..." value={cur.pinyin} onChange={(e) => patchPinyin(curIdx, { pinyin: e.target.value })} readOnly={isView} disabled={submitting} />
                    </div>
                    <div className="col-12 col-sm-6 col-lg-3">
                      <label className={LABEL} htmlFor="vocab-sino">
                        Hán Việt
                      </label>
                      <input id="vocab-sino" type="text" className="form-control" placeholder="thượng..." value={cur.sinoVietnamese} onChange={(e) => patchPinyin(curIdx, { sinoVietnamese: e.target.value })} readOnly={isView} disabled={submitting} />
                    </div>
                    <div className="col-12 col-lg-6">
                      <label className={LABEL} htmlFor="vocab-word-types">Loại từ của {pinyinName}</label>
                      <Select
                        id="vocab-word-types"
                        mode="multiple"
                        showSearch
                        size="large"
                        className="vocab-word-types w-100"
                        placeholder="Chọn loại từ"
                        options={WORD_TYPES.map(type => ({ label: type, value: type }))}
                        value={cur.wordTypes}
                        onChange={wordTypes => patchPinyin(curIdx, { wordTypes })}
                        disabled={locked}
                      />
                    </div>
                    {isView ? cur.audioUrl && (
                      <div className="col-12">
                        <ContentAudioPreview url={cur.audioUrl} label="Nghe tệp phát âm" />
                      </div>
                    ) : (
                      <div className="col-12">
                        <ContentFileField
                          key={curIdx}
                          id="vocab-pinyin-audio"
                          label="Tệp phát âm"
                          kind="audio"
                          confirmRemove
                          previewSelectedAudio
                          previewUrl={cur.audioUrl}
                          disabled={submitting || uploadingFile}
                          onUploadingChange={setUploadingFile}
                          onChange={fileId => patchPinyin(curIdx, { audioUrl: fileUrl(fileId) ?? undefined })}
                        />
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {tab === "meaning" && (
            <div key={curIdx} data-testid="vocab-tab-meaning">
              {selector}
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                <h6 className="fw-bold text-dark mb-0">
                  Nghĩa của <span className="text-primary">{pinyinName}</span> <span className="text-muted ms-1">({cur.meanings.length})</span>
                </h6>
                {!isView && <Button type="primary" icon={<i className="isax isax-add" aria-hidden="true" />} className="vocab-add-meaning" onClick={() => patchPinyin(curIdx, { meanings: [...cur.meanings, emptyMeaning()] })} disabled={locked}>
                  Thêm nghĩa
                </Button>}
              </div>
              <div>
                {cur.meanings.map((m, index) => (
                  <div key={index} className="vocab-meaning-card card border rounded-3 mb-2 overflow-hidden" data-testid="meaning-card">
                    <div className="card-header bg-light d-flex justify-content-between align-items-center py-1 px-3 border-bottom">
                      <span className="fw-bold text-primary">Nghĩa #{index + 1}</span>
                      {!isView && <Button type="text" danger className="vocab-delete-meaning" icon={<i className="isax isax-trash" aria-hidden="true" />} onClick={() => void dropMeaning(index)} title="Xóa nghĩa này" aria-label={`Xóa nghĩa ${index + 1}`} disabled={locked} />}
                    </div>
                    <div className="card-body px-3 py-2">
                      <div className="row g-2 mb-2">
                        <div className="col-md-5">
                          <div className={`${LABEL} d-flex align-items-center gap-2`}><Image src="/flags/vn.svg" alt="" width={18} height={12} />Nghĩa (Tiếng Việt)</div>
                          <RichTextEditor label="Nghĩa (Tiếng Việt)" text={m.meaning} html={m.meaningViHtml} placeholder="Nhập nghĩa của từ…" readOnly={isView} disabled={submitting} onChange={(meaning, meaningViHtml) => patchMeaning(index, { meaning, meaningViHtml })} />
                        </div>
                        <div className="col-md-4">
                          <div className={`${LABEL} d-flex align-items-center gap-2`}><Image src="/flags/cn.svg" alt="" width={18} height={12} />Nghĩa (Tiếng Trung)</div>
                          <RichTextEditor label="Nghĩa (Tiếng Trung)" text={m.meaningZh} html={m.meaningZhHtml} placeholder="Nhập nghĩa tiếng Trung…" readOnly={isView} disabled={submitting} onChange={(meaningZh, meaningZhHtml) => patchMeaning(index, { meaningZh, meaningZhHtml })} />
                        </div>
                        <div className="col-md-3">
                          <label className={LABEL} htmlFor={`vocab-meaning-${index}-type`}>Loại từ</label>
                          <select id={`vocab-meaning-${index}-type`} className="form-select form-select-sm" value={m.exampleWordType} onChange={(e) => patchMeaning(index, { exampleWordType: e.target.value })} disabled={locked}>
                            <option value="">Chọn loại từ</option>
                            {(cur.wordTypes.length > 0 ? cur.wordTypes : WORD_TYPES).map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="border-top pt-2">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <div className="fw-semibold">
                            Ví dụ <span className="text-muted fw-normal">({m.examples.length})</span>
                          </div>
                          {!isView && (
                            <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={() => addExample(index)} disabled={locked}>
                              <i className="isax isax-add me-1" /> Thêm ví dụ
                            </button>
                          )}
                        </div>
                        {m.examples.map((example, exampleIndex) => (
                          <div key={exampleIndex} className="rounded-2 px-2 py-1 mb-1 bg-light" data-testid="example-row">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="small fw-bold text-muted">Ví dụ #{exampleIndex + 1}</span>
                              {!isView && (
                                <button type="button" className="btn btn-sm text-danger p-0 border-0" onClick={() => void dropExample(index, exampleIndex)} title="Xóa ví dụ này" aria-label={`Xóa ví dụ ${exampleIndex + 1} của nghĩa ${index + 1}`} disabled={locked}>
                                  <i className="isax isax-trash small" />
                                </button>
                              )}
                            </div>
                            <div className="row g-2">
                              {EXAMPLE_FIELDS.map(exampleField => (
                                <div key={exampleField.field} className="col-md-4">
                                  <div className="form-label text-muted d-flex align-items-center gap-2">
                                    {"flag" in exampleField && <Image src={`/flags/${exampleField.flag}.svg`} alt="" width={18} height={12} />}
                                    {exampleField.label}
                                  </div>
                                  <RichTextEditor
                                    label={exampleField.label}
                                    text={example[exampleField.field]}
                                    html={example[`${exampleField.field}Html`]}
                                    placeholder={exampleField.placeholder}
                                    readOnly={isView}
                                    disabled={submitting}
                                    onChange={(text, html) => patchExample(index, exampleIndex, { [exampleField.field]: text, [`${exampleField.field}Html`]: html })}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {m.examples.length === 0 && <small className="text-muted">Chưa có ví dụ nào</small>}
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
              <RelatedWordsEditor key={curIdx} idPrefix="compounds" title="Từ ghép" icon="isax-link-2" hanziPlaceholder="Ví dụ 上午" extraLabel="Tiếng Việt" emptyText="Chưa có từ ghép" words={cur.compounds} onChange={isView ? undefined : (compounds) => patchPinyin(curIdx, { compounds })} disabled={submitting} />
            </div>
          )}

          {tab === "related" && (
            <div data-testid="vocab-tab-related">
              {selector}
              <div key={curIdx} className="vocab-detail-grid">
                <RelatedWordsEditor idPrefix="measure-words" title="Lượng từ" icon="isax-box" hanziPlaceholder="Ví dụ 个" extraLabel="Pinyin" emptyText="Chưa có lượng từ"
                  words={parseMeasureWords(cur.measureWord).map(({ hanzi, pinyin }) => ({ hanzi, extra: pinyin }))}
                  onChange={isView ? undefined : words => patchPinyin(curIdx, { measureWord: formatMeasureWords(words.map(({ hanzi, extra }) => ({ hanzi, pinyin: extra }))) })} disabled={submitting} />
                <RelatedWordsEditor idPrefix="synonyms" title="Đồng nghĩa" icon="isax-copy" hanziPlaceholder="Ví dụ 登" extraLabel="Hán Việt" emptyText="Chưa có từ đồng nghĩa" words={cur.synonyms} onChange={isView ? undefined : synonyms => patchPinyin(curIdx, { synonyms })} disabled={submitting} />
                <RelatedWordsEditor idPrefix="antonyms" title="Trái nghĩa" icon="isax-close-circle" hanziPlaceholder="Ví dụ 下" extraLabel="Hán Việt" emptyText="Chưa có từ trái nghĩa" words={cur.antonyms} onChange={isView ? undefined : antonyms => patchPinyin(curIdx, { antonyms })} disabled={submitting} />
                <section className="vocab-detail-section">
                  <h6 className="vocab-section-title"><i className="isax isax-note" aria-hidden="true" /> Ghi chú cho {pinyinName}</h6>
                  <textarea className="form-control" rows={4} aria-label="Ghi chú cho pinyin" placeholder="Ghi chú riêng cho cách đọc này (cách phân biệt, lưu ý cách dùng, v.v.)" value={cur.notes} onChange={(e) => patchPinyin(curIdx, { notes: e.target.value })} readOnly={isView} disabled={submitting} />
                </section>
              </div>
            </div>
          )}

          {tab === "details" && (
            <div data-testid="vocab-tab-details">
              <div className="vocab-detail-grid vocab-media-grid mb-3">
                <section className="vocab-detail-section vocab-illustration">
                  {isView ? (
                    <>
                      <h6 className="vocab-section-title">Hình minh họa</h6>
                        <ContentImagePreview url={values.imageUrl} alt={`Ảnh minh họa cho ${values.hanzi}`} />
                    </>
                  ) : (
                    <ContentFileField
                      id="vocab-image"
                      label="Hình minh họa"
                      kind="image"
                      confirmRemove
                      imageOverlay
                      previewUrl={values.imageUrl}
                      disabled={submitting || uploadingFile}
                      onUploadingChange={setUploadingFile}
                      onChange={fileId => patch({ imageUrl: fileUrl(fileId) ?? "" })}
                    />
                  )}
                </section>
                <section className="vocab-detail-section" aria-labelledby="vocab-stroke-heading">
                  <h6 id="vocab-stroke-heading" className="vocab-section-title">
                    <i className="isax isax-edit-2" aria-hidden="true" /> Thứ tự nét viết
                  </h6>
                  <div className="vocab-stroke-preview">
                    <HanziStructureSvg key={values.hanzi} word={values.hanzi} showStatus />
                  </div>
                </section>
              </div>
              <div className="vocab-detail-section">
                <h6 className="vocab-section-title">Chiết tự (nguồn gốc)</h6>
                <RichTextEditor label="Chiết tự (nguồn gốc)" text={values.etymologyStory} html={values.etymologyStoryHtml} placeholder="Giải thích nguồn gốc, câu chuyện ghi nhớ…" readOnly={isView} disabled={submitting}
                  onChange={(etymologyStory, etymologyStoryHtml) => patch({ etymologyStory, etymologyStoryHtml })} />
                <h6 className="vocab-section-title mt-3">Ghi chú chung</h6>
                <RichTextEditor label="Ghi chú chung" text={values.notes} html={values.notesHtml} placeholder="Ghi chú cho toàn bộ từ vựng…" readOnly={isView} disabled={submitting}
                  onChange={(notes, notesHtml) => patch({ notes, notesHtml })} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
