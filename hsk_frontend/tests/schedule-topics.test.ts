import { describe, expect, it } from "vitest";
import { groupByTopic } from "@/components/management/syllabus/schedule-topic-ui";
import { movedResourceIdsInTopic } from "@/components/management/syllabus/use-schedule-resources";
import type { ScheduleResourceLink, ScheduleTopic } from "@/lib/api/syllabus-schedule-resources-client";

const link = (id: string, displayOrder: number, topicId?: string): ScheduleResourceLink => ({
  id: `l-${id}`,
  learningResourceId: id,
  learningResourceVersionId: `v-${id}`,
  sessionNo: 1,
  displayOrder,
  resourceType: "VOCABULARY",
  topicId,
  resourceContent: null,
});
const topic = (id: string, topicOrder: number): ScheduleTopic => ({ id, contentPackageVersionId: "cpv", sessionNo: 1, title: id, topicOrder });

describe("groupByTopic", () => {
  it("returns one untopiced group when there are no topics", () => {
    const groups = groupByTopic([link("b", 1), link("a", 0)], []);
    expect(groups).toHaveLength(1);
    expect(groups[0].topic).toBeNull();
    expect(groups[0].links.map((l) => l.learningResourceId)).toEqual(["a", "b"]);
  });

  it("orders topics by topicOrder, keeps empty topics, and puts untopiced links last", () => {
    const groups = groupByTopic([link("a", 0, "t2"), link("b", 1), link("c", 2, "t2")], [topic("t2", 1), topic("t1", 0)]);
    expect(groups.map((g) => g.topic?.id ?? null)).toEqual(["t1", "t2", null]);
    expect(groups[0].links).toEqual([]);
    expect(groups[1].links.map((l) => l.learningResourceId)).toEqual(["a", "c"]);
    expect(groups[2].links.map((l) => l.learningResourceId)).toEqual(["b"]);
  });

  it("treats a link whose topic no longer exists as untopiced so it never disappears", () => {
    const groups = groupByTopic([link("a", 0, "deleted")], [topic("t1", 0)]);
    expect(groups[groups.length - 1].links.map((l) => l.learningResourceId)).toEqual(["a"]);
  });
});

describe("movedResourceIdsInTopic", () => {
  const links = [link("a", 0, "t1"), link("x", 1, "t2"), link("b", 2, "t1"), link("y", 3)];

  it("swaps with the nearest neighbour of the same topic and returns the full order", () => {
    expect(movedResourceIdsInTopic(links, "a", 1)).toEqual(["b", "x", "a", "y"]);
    expect(movedResourceIdsInTopic(links, "b", -1)).toEqual(["b", "x", "a", "y"]);
  });

  it("returns null at the edge of its topic or for unknown ids", () => {
    expect(movedResourceIdsInTopic(links, "a", -1)).toBeNull();
    expect(movedResourceIdsInTopic(links, "b", 1)).toBeNull();
    expect(movedResourceIdsInTopic(links, "x", 1)).toBeNull();
    expect(movedResourceIdsInTopic(links, "nope", 1)).toBeNull();
  });
});
