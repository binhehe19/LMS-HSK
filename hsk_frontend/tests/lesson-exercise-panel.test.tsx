import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ExercisePanel } from "@/components/student/timetable/lesson-exercise-panel";
import type { TimetableModule, TimetableSession } from "@/components/student/timetable/timetable-data";

const mocks = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("@/lib/api/student-client", () => ({ studentApi: { startAttempt: mocks.start } }));
vi.mock("@/components/student/timetable/lesson-attempt-player", () => ({
  LessonAttemptPlayer: ({ questions }: { questions: { questionText: string }[] }) => <p>{questions[0].questionText}</p>,
}));

it("shows an assigned exercise as ready and loads the question only after starting", async () => {
  const resource: TimetableModule = {
    id: "link", resourceId: "speaking", packageVersionId: "version", title: "Hỏi đúng bộ phận",
    kind: "practice", icon: "noi", description: "", progress: 0, resourceType: "ASSESSMENT",
  };
  const session = { id: "session", classId: "class", sessionNo: 1 } as TimetableSession;
  mocks.start.mockResolvedValue({
    attemptId: "attempt", learningResourceId: "speaking", status: "IN_PROGRESS",
    questions: [{ questionId: "question", content: { questionText: "Hỏi bộ phận phụ trách phòng họp." } }],
  });

  render(<ExercisePanel resources={[resource]} skill="speaking" session={session} isAdmin={false} />);
  expect(await screen.findByRole("heading", { name: "Sẵn sàng làm bài" })).toBeInTheDocument();
  expect(screen.queryByText("Chưa có dữ liệu")).not.toBeInTheDocument();
  expect(mocks.start).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu bài tập" }));
  expect(await screen.findByText("Hỏi bộ phận phụ trách phòng họp.")).toBeInTheDocument();
  expect(mocks.start).toHaveBeenCalledWith({ sessionId: "session", classId: "class", sessionNo: 1, contentPackageVersionId: "version", learningResourceId: "speaking" });
});
