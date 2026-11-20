import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionStage } from "@/components/student/timetable/lesson-attempt-player";

describe("QuestionStage — đủ dữ liệu câu hỏi như LMS 1.0", () => {
  it("hiện hướng dẫn, độ khó, ảnh câu, gợi ý dịch; audio câu và audio đầu bài phát cả ở bài Đọc", () => {
    const content = {
      layout: {
        meta: { instruction: "Đọc kỹ đoạn văn", difficulty: "HARD" },
        sections: [{ id: "s1", questionIds: ["q1"], media: [{ kind: "audio", url: "/api/storage/file/lead" }] }],
      },
    };
    const question = {
      questionId: "q1",
      questionType: "ESSAY",
      questionText: "Dịch câu sau",
      translationHint: "Dùng 把",
      files: [{ url: "/api/storage/file/pic", name: "hinh.png", mimeType: "image/png" }],
      media: [{ kind: "audio", url: "/api/storage/file/qa" }],
    };
    const { container } = render(
      <QuestionStage title="Bài 1" content={content} questions={[question]} answers={{}} onAnswer={() => {}} skill="reading" skillName="Đọc" />,
    );
    expect(screen.getByText("Đọc kỹ đoạn văn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Câu trước|Câu sau/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Chọn câu hỏi" })).not.toBeInTheDocument();
    expect(screen.getByText("Độ khó: Khó")).toBeInTheDocument();
    expect(screen.getByAltText("hinh.png")).toHaveAttribute("src", "/api/storage/file/pic");
    expect(screen.getByText(/Dùng 把/)).toBeInTheDocument();
    const sources = [...container.querySelectorAll("audio, source")].map((el) => el.getAttribute("src"));
    expect(sources).toEqual(expect.arrayContaining(["/api/storage/file/lead", "/api/storage/file/qa"]));
  });
});
