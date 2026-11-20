"use client";

// Cấu hình module NGỮ PHÁP (/grammar, mục `grammar-points`) trên nền content-tree — thay cho manage-grammar.tsx của HSK cũ. Cột bảng điểm ngữ pháp
// giữ các cột của bản cũ (Điểm ngữ pháp, Định nghĩa chung, Giải thích, Ví dụ, Phân loại, Trình độ; STT và Thao tác do nền thêm).
// Khác bản cũ có chủ đích: bản cũ bỏ qua cấp Thư mục (tự tạo ngầm một thư mục trùng tên gói khi mở gói) — nền dùng chung hiện đủ 4 cấp;
// "Import Excel" của bản cũ nằm ở cấp Cấu trúc ngữ pháp (POST /grammar/grammar-points/import), nền chỉ có nút ở cấp gói và chưa chuyển.
import { FlatItemsBreadcrumbView } from "@/components/management/content-flat/flat-items-breadcrumb-view";
import { GrammarPointForm } from "@/components/management/content-grammar/grammar-point-form";
import { emptyGrammarPointInput, grammarPointSummary, grammarPointToInput, hskLevelStyle, normalizeGrammarPointInput, validateGrammarPointInput } from "@/lib/content/grammar-point";
import type { ContentItemColumn, ContentModuleConfig, ContentPackageTypeMeta } from "@/types/content";
import type { GrammarPoint } from "@/types/content-grammar";

/** ContentTypeConfig của manage-grammar.tsx cũ (mô tả riêng cho ngữ pháp), thứ tự ALL_CONTENT_TYPES. */
export const GRAMMAR_PACKAGE_TYPES: ContentPackageTypeMeta[] = [
  { value: "LEARNING_PATH", label: "Lộ trình học", description: "Ngữ pháp theo lộ trình HSK chính thức", icon: "isax isax-path-2", color: "#B00D0E", gradient: "linear-gradient(135deg, #B00D0E 0%, #7A0A0B 100%)" },
  { value: "LEARNING", label: "Khóa học", description: "Ngữ pháp trong khóa học", icon: "isax isax-video", color: "#f093fb", gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { value: "VIDEO_COURSE", label: "Khóa học video", description: "Ngữ pháp đi kèm khóa học video", icon: "isax isax-play-circle", color: "#D4AF37", gradient: "linear-gradient(135deg, #D4AF37 0%, #F0CF72 100%)" },
  { value: "FREE", label: "Học miễn phí", description: "Tài nguyên ngữ pháp miễn phí", icon: "isax isax-gift", color: "#43e97b", gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
];

const WRAP = { whiteSpace: "pre-wrap", wordBreak: "break-word" } as const;

const GRAMMAR_COLUMNS: ContentItemColumn<GrammarPoint>[] = [
  {
    key: "title",
    title: "Điểm ngữ pháp",
    width: 250,
    render: (point) => (
      <div>
        <div className="grammar-point-title fw-bold text-primary mb-1">{point.title}</div>
        {point.structure && (
          <code className="bg-light border rounded px-2 py-1 text-dark d-inline-block mt-1" style={WRAP}>
            {point.structure}
          </code>
        )}
      </div>
    ),
  },
  {
    key: "hskLevel",
    title: "Trình độ",
    width: 100,
    render: (point) => {
      if (!point.hskLevel) return <span className="text-muted small">—</span>;
      const style = hskLevelStyle(point.hskLevel);
      return (
        <span className="badge fw-700" style={{ background: style.bg, color: style.color, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
          HSK {point.hskLevel}
        </span>
      );
    },
  },
  { key: "category", title: "Phân loại", width: 120, render: (point) => <div className="text-muted small" style={WRAP}>{point.category || "—"}</div> },
  { key: "generalDefinition", title: "Định nghĩa chung", width: 150, render: (point) => <div className="text-muted small" style={WRAP}>{point.generalDefinition || "—"}</div> },
  { key: "explanation", title: "Giải thích", render: (point) => <div className="text-muted small" style={WRAP}>{point.explanation || "—"}</div> },
  {
    key: "examples",
    title: "Ví dụ",
    width: 250,
    render: (point) => (
      <div className="small" style={WRAP}>
        <div className="text-dark mb-1">{point.exampleSentenceZh || "—"}</div>
        {point.exampleSentencePinyin && <div className="text-muted">{point.exampleSentencePinyin}</div>}
        {point.exampleSentenceVi && (
          <div className="fst-italic" style={{ color: "#D4AF37" }}>
            {point.exampleSentenceVi}
          </div>
        )}
      </div>
    ),
  },
];

export const GRAMMAR_CONFIG: ContentModuleConfig<GrammarPoint> = {
  module: "GRAMMAR",
  key: "grammar",
  apiPrefix: "/grammar",
  itemsPath: "grammar-points",
  title: "Quản lý Ngữ pháp",
  icon: "isax-book-1",
  pageClassName: "manage-grammar-page",
  labels: { package: "Package", folder: "Thư mục", studySet: "Cấu trúc ngữ pháp", item: "Điểm ngữ pháp" },
  packagesHeader: { title: "Quản lý ngữ pháp theo khóa học", subtitle: "Tổ chức và quản lý các điểm ngữ pháp HSK" },
  subtitle: "Quản lý toàn bộ điểm ngữ pháp theo trình độ HSK và bài học",
  packageTypes: GRAMMAR_PACKAGE_TYPES,
  supportsImport: true,
  itemColumns: GRAMMAR_COLUMNS,
  ItemForm: GrammarPointForm,
  emptyItemInput: emptyGrammarPointInput,
  itemToInput: grammarPointToInput,
  validateItemInput: validateGrammarPointInput,
  normalizeItemInput: normalizeGrammarPointInput,
  itemSummary: grammarPointSummary,
  libraryEditHref: (point) => `/grammar/library?edit=${encodeURIComponent(point.sourceResourceId ?? "")}`,
  ItemsView: FlatItemsBreadcrumbView,
};
