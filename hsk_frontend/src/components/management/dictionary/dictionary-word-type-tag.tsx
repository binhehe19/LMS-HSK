import { Tag } from "antd";
import { wordTypeBadgeStyle } from "@/lib/dictionary/vocabulary-model";

export function DictionaryWordTypeTag({ type }: { type: string }) {
  const { bg, color, border } = wordTypeBadgeStyle(type);
  return <Tag style={{ backgroundColor: bg, color, border, marginInlineEnd: 0 }}>{type}</Tag>;
}
