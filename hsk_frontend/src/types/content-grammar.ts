// Mục nội dung của module NGỮ PHÁP (`/grammar/grammar-points`). Tên trường giữ NGUYÊN DTO của backend ngữ pháp HSK cũ
// (com.lms.grammar.dto GrammarPointResponse — features/learning-path/grammar/types/grammar-point.types.ts) vì dịch vụ này đã có thật ở LMS_Backend;
// khác bản cũ có chủ đích: `grammarIndex` → `index` (dùng chung nền content-tree), `exampleCount` bỏ (không hiển thị). Xem docs/api-requirements/content-tree.md.
import type { ContentItemBase, ContentItemInput } from "@/types/content";

export interface GrammarPoint extends ContentItemBase {
  /** Tên điểm ngữ pháp, vd "Câu với 是". */
  title: string;
  /** Định nghĩa chung (một dòng). */
  generalDefinition?: string;
  /** Phân loại (vd "Câu trần thuật", "Trợ từ động thái"). */
  category?: string;
  /** Trình độ HSK dưới dạng chuỗi "1".."9" như backend cũ. */
  hskLevel?: string;
  /** Cấu trúc, vd "A + 是 + B". */
  structure?: string;
  explanation?: string;
  note?: string;
  exampleSentenceZh?: string;
  exampleSentencePinyin?: string;
  exampleSentenceVi?: string;
}

export type GrammarPointInput = ContentItemInput<GrammarPoint>;
