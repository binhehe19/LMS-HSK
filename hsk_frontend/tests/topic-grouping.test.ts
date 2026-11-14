import { describe, expect, it } from "vitest";
import { groupItemsByTopic, UNGROUPED_TOPIC_TITLE } from "@/lib/content/topic-grouping";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const topics = [
  { id: "t2", title: "Đọc", topicOrder: 2 },
  { id: "t1", title: "Nghe", topicOrder: 1 },
];

describe("groupItemsByTopic", () => {
  it("không có chủ đề (hoặc chưa tải được) => một nhóm không tiêu đề, giữ thứ tự mục", () => {
    expect(groupItemsByTopic(items, null)).toEqual([{ title: null, items }]);
    expect(groupItemsByTopic(items, { topics: [], membership: { a: "t1" } })).toEqual([{ title: null, items }]);
  });

  it("nhóm theo thứ tự chủ đề của gói, bỏ chủ đề không có mục, mục chưa phân chủ đề đứng cuối kèm tiêu đề", () => {
    // topics đã được client sắp theo topicOrder; hàm giữ nguyên thứ tự đưa vào
    const sorted = [...topics].sort((x, y) => x.topicOrder - y.topicOrder);
    const groups = groupItemsByTopic(items, { topics: sorted, membership: { a: "t2", b: "t1", c: "t2" } });
    expect(groups.map((g) => [g.title, g.items.map((i) => i.id)])).toEqual([
      ["Nghe", ["b"]],
      ["Đọc", ["a", "c"]],
      [UNGROUPED_TOPIC_TITLE, ["d"]],
    ]);
  });

  it("mục thuộc chủ đề đã bị xóa coi như chưa phân chủ đề (không biến mất); chỉ có mục chưa phân chủ đề thì nhóm không tiêu đề", () => {
    const groups = groupItemsByTopic(items, { topics: [{ id: "t1", title: "Nghe", topicOrder: 1 }], membership: { a: "t-cu", b: "t1" } });
    expect(groups.map((g) => [g.title, g.items.map((i) => i.id)])).toEqual([
      ["Nghe", ["b"]],
      [UNGROUPED_TOPIC_TITLE, ["a", "c", "d"]],
    ]);
    const none = groupItemsByTopic(items, { topics: [{ id: "t1", title: "Nghe", topicOrder: 1 }], membership: {} });
    expect(none).toEqual([{ title: null, items }]);
  });
});
