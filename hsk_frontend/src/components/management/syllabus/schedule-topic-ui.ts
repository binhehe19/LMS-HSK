import type { ScheduleTopicsMap } from "@/components/management/syllabus/use-schedule-resources";
import type { ScheduleResourceLink, ScheduleTopic } from "@/lib/api/syllabus-schedule-resources-client";
import type { ScheduleResourceType } from "@/lib/syllabus/schedule-resource-types";

/** Chủ đề trong buổi (theo từng loại học liệu): dữ liệu và thao tác truyền từ trang quản lý xuống bảng lịch trình. */
export interface ScheduleTopicUi {
  /** null = chưa tải xong hoặc tải lỗi: bảng vẫn hiện module, chỉ không hiện chủ đề. */
  topics: ScheduleTopicsMap | null;
  onCreate: (scheduleId: string, type: ScheduleResourceType, sessionNo: number, title: string) => Promise<boolean>;
  onRename: (scheduleId: string, type: ScheduleResourceType, topicId: string, title: string) => Promise<boolean>;
  onDelete: (scheduleId: string, type: ScheduleResourceType, topicId: string) => void;
  onMove: (scheduleId: string, type: ScheduleResourceType, sessionNo: number, topicId: string, direction: -1 | 1) => void;
  onAssign: (scheduleId: string, type: ScheduleResourceType, resourceId: string, topicId: string | null) => void;
}

export interface TopicGroup {
  /** null = nhóm "Chưa phân chủ đề". */
  topic: ScheduleTopic | null;
  links: ScheduleResourceLink[];
}

/**
 * Nhóm module của một loại theo chủ đề: chủ đề theo topicOrder (kể cả chủ đề rỗng), module trong nhóm theo displayOrder, nhóm không chủ đề đứng cuối.
 * Không có chủ đề nào thì trả một nhóm duy nhất không chủ đề (giữ hiển thị phẳng như trước).
 */
export function groupByTopic(links: readonly ScheduleResourceLink[], topics: readonly ScheduleTopic[]): TopicGroup[] {
  const byOrder = (a: ScheduleResourceLink, b: ScheduleResourceLink) => a.displayOrder - b.displayOrder;
  const known = new Set(topics.map((t) => t.id));
  const groups: TopicGroup[] = [...topics].sort((a, b) => a.topicOrder - b.topicOrder).map((topic) => ({ topic, links: links.filter((l) => l.topicId === topic.id).sort(byOrder) }));
  // Chủ đề không còn trong danh sách (đã xóa, hoặc thuộc học phần khác) coi như không chủ đề để module không biến mất khỏi màn hình.
  const rest = links.filter((l) => !l.topicId || !known.has(l.topicId)).sort(byOrder);
  if (rest.length > 0 || groups.length === 0) groups.push({ topic: null, links: rest });
  return groups;
}
