import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { upcomingSession, safeMeetingUrl, courseStats } from "@/components/student/student-model";
import { useStudentRequest } from "@/components/student/student-data";
import { studentApi } from "@/lib/api/student-client";
vi.mock("@/lib/api/lms-client", () => ({ lmsClient: { get: vi.fn() } }));
import { lmsClient } from "@/lib/api/lms-client";

afterEach(() => vi.clearAllMocks());
describe("student backend integration", () => {
 it("selects the nearest upcoming non-cancelled session with the class meeting link", () => {
  const result = upcomingSession([{ id: "class-a", code: "HSK-A", meetingLink: "https://meet.example/room", sessions: [
   { id: "past", classId: "class-a", startAt: "2026-08-01T10:00:00Z" },
   { id: "cancelled", classId: "class-a", startAt: "2026-08-02T10:00:00Z", status: "CANCELLED" },
   { id: "later", classId: "class-a", startAt: "2026-08-04T10:00:00Z" },
   { id: "next", classId: "class-a", startAt: "2026-08-03T10:00:00Z" },
  ] }], Date.parse("2026-08-02T00:00:00Z"));
  expect(result?.id).toBe("next"); expect(result?.meetingLink).toBe("https://meet.example/room");
 });
 it("does not invent future sessions or percentages with a zero denominator", () => {
  expect(upcomingSession([])).toBeNull(); expect(courseStats({ id: "empty", totalSessions: 0, completedSessions: 0 }).percent).toBe(0);
 });
 it.each(["javascript:alert(1)", "data:text/html,test", "/unknown", "file:///secret"])("rejects unsafe meeting link %s", value => expect(safeMeetingUrl(value)).toBeNull());
 it("calls personal endpoints without an arbitrary user ID", async () => {
  vi.mocked(lmsClient.get).mockResolvedValue([]);
  await studentApi.classes(); await studentApi.history("READING");
  expect(lmsClient.get).toHaveBeenNthCalledWith(1, "/me/classes");
  expect(lmsClient.get).toHaveBeenNthCalledWith(2, "/assessment-practice/history?type=PRACTICE_READING");
 });
 it("does not turn an invalid list response into an empty success", async () => {
  vi.mocked(lmsClient.get).mockResolvedValue({ items: [] });
  await expect(studentApi.classes()).rejects.toThrow("không đúng định dạng");
 });
 it("ignores stale results after a route/request changes", async () => {
  let finish!: (value: string) => void;
  const slow = () => new Promise<string>(resolve => { finish = resolve; });
  const fast = () => Promise.resolve("current");
  const { result, rerender } = renderHook(({ request }) => useStudentRequest(request), { initialProps: { request: slow } });
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  rerender({ request: fast });
  await waitFor(() => expect(result.current.data).toBe("current"));
  await act(async () => { finish("old-account-data"); });
  await waitFor(() => expect(result.current.data).toBe("current"));
 });
 it("shows request failures and can retry successfully", async () => {
  const request = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error("Backend gián đoạn")).mockResolvedValueOnce("ok");
  const { result } = renderHook(() => useStudentRequest(request));
  await waitFor(() => expect(result.current.error).toBe("Backend gián đoạn"));
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.data).toBe("ok"));
 });
});
