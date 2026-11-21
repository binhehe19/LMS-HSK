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

describe("QuestionStage — ảnh đề chuyển từ LMS 1.0 (không có mimeType, đường dẫn không đuôi)", () => {
  it("hiện ảnh chung của phần ('passage-image') và ảnh của câu ('question-image'); tệp khác không rõ loại thì không coi là ảnh", () => {
    const content = {
      layout: {
        sections: [{
          id: "section-1",
          questionIds: ["q28"],
          files: [
            { url: "/api/storage/file/01M4AQWMKX37F5GVGMEA12ZN47", name: "passage-image" },
            { url: "/api/storage/file/doc", name: "de-bai" },
            { url: "/api/storage/file/pdf", name: "passage-image", mimeType: "application/pdf" },
          ],
        }],
      },
    };
    const question = {
      questionId: "q28",
      questionType: "ESSAY",
      questionText: "28. Nhìn tranh và dùng từ “以为” để đặt một câu phù hợp.",
      files: [{ url: "/api/storage/file/q-pic", name: "question-image" }],
    };
    const { container } = render(
      <QuestionStage title="书写 第二部分" content={content} questions={[question]} answers={{}} onAnswer={() => {}} skill="writing" skillName="Viết" />,
    );
    const sources = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(sources).toEqual(["/api/storage/file/01M4AQWMKX37F5GVGMEA12ZN47", "/api/storage/file/q-pic"]);
    expect(screen.getAllByAltText("Hình minh hoạ")).toHaveLength(2);
  });
});
