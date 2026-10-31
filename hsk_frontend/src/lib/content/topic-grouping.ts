// Nhóm mục của một gói theo chủ đề để hiển thị: chủ đề theo thứ tự (chỉ chủ đề có mục), mục chưa phân chủ đề đứng cuối. Không có chủ đề nào
// thì trả một nhóm duy nhất không tiêu đề để giữ hiển thị phẳng như trước.
import type { PackageTopicState } from "@/lib/api/package-topics-client";

export interface TopicItemGroup<T> {
  /** null = nhóm không tiêu đề (không có chủ đề, hoặc mục chưa phân chủ đề khi gói không có chủ đề). */
  title: string | null;
  items: T[];
}

export const UNGROUPED_TOPIC_TITLE = "Chưa phân chủ đề";

/** Mục theo thứ tự chủ đề rồi theo thứ tự đã có trong nhóm; mục chưa phân chủ đề đứng cuối. */
export function sortByTopic<T extends { id: string }>(items: readonly T[], state: PackageTopicState | null): T[] {
  return groupItemsByTopic(items, state).flatMap((g) => g.items);
}

export function groupItemsByTopic<T extends { id: string }>(items: readonly T[], state: PackageTopicState | null): TopicItemGroup<T>[] {
  if (!state || state.topics.length === 0) return [{ title: null, items: [...items] }];
  const known = new Set(state.topics.map((t) => t.id));
  const groups: TopicItemGroup<T>[] = state.topics.map((topic) => ({ title: topic.title, items: items.filter((i) => state.membership[i.id] === topic.id) })).filter((g) => g.items.length > 0);
  // Mục thuộc chủ đề không còn trong danh sách coi như chưa phân chủ đề để không biến mất khỏi màn hình.
  const rest = items.filter((i) => !known.has(state.membership[i.id] ?? ""));
  if (rest.length > 0) groups.push({ title: groups.length > 0 ? UNGROUPED_TOPIC_TITLE : null, items: rest });
  return groups;
}
