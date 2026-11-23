import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScheduleTable } from "@/components/management/syllabus/schedule-table";
import type { SyllabusDetailResponse } from "@/types/lms";
import type { ScheduleResourcesMap } from "@/components/management/syllabus/use-schedule-resources";
vi.mock("antd", () => ({ Alert: ({ description }: { description: string }) => <p>{description}</p> }));
it("shows resources from multiple packages without legacy write controls", () => {
  const link = (id: string, version: string, title: string) => ({ id, learningResourceId: id, learningResourceVersionId: id, sessionNo: 1, displayOrder: 0, resourceType: "GRAMMAR", contentPackageVersionId: version, resourceContent: { title } });
  const html = renderToStaticMarkup(<ScheduleTable detail={{ id: "s", schedule: [{ id: "lesson" }] } as SyllabusDetailResponse} resourcesState={{ kind: "ok", data: { lesson: { VOCABULARY: [], ASSESSMENT: [], GRAMMAR: [link("a", "p1", "Grammar A"), link("b", "p2", "Grammar B")] } } as ScheduleResourcesMap }} topics={null} onRetryResources={() => {}} />);
  expect(html).toContain("Grammar A");
  expect(html).toContain("Grammar B");
  expect(html).toContain("Mở học phần");
  expect(html).not.toContain("Thêm module");
  expect(html).not.toContain("Đưa chủ đề lên");
});
