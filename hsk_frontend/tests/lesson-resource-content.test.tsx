import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import LessonResourceContent from "@/components/student/timetable/lesson-resource-content";
import type { TimetableModule } from "@/components/student/timetable/timetable-data";

it("ngữ pháp ZH: hiện câu ví dụ (sentenceZh), nghĩa (translationVi) và lưu ý cách dùng thay vì báo 'chưa có nội dung'", () => {
 // Đúng dạng nội dung ngữ pháp đã nhập (HSK3 Buổi 1 "看上去 / 看起来"); examples[] chỉ có sentenceZh + exampleIndex.
 const grammar: TimetableModule = {
  id: "g1", title: "Cụm từ cố định: 看上去 / 看起来", icon: "nguphap", kind: "practice", progress: null, description: "", resourceType: "GRAMMAR",
  content: {
   title: "Cụm từ cố định: 看上去 / 看起来",
   category: "Khác",
   hskLevel: "3",
   structure: "Chủ ngữ + 看上去 + Tính từ",
   generalDefinition: "看上去 = Trông có vẻ",
   usageNote: "Dùng khi nhận xét bề ngoài",
   examples: [
    { sentenceZh: "他们看上去有点儿像。\nPinyin: Tāmen kàn shàngqù yǒudiǎnr xiàng.", exampleIndex: 0 },
    { sentenceZh: "她看起来很累。", translationVi: "Cô ấy trông có vẻ mệt.", exampleIndex: 1 },
   ],
  },
 };
 render(<LessonResourceContent resource={grammar} isAdmin={false} />);
 expect(screen.queryByText("Học liệu đã được gắn nhưng chưa có nội dung hiển thị phù hợp.")).not.toBeInTheDocument();
 expect(screen.getAllByText("Câu ví dụ")).toHaveLength(2);
 expect(screen.getByText(/他们看上去有点儿像。 Pinyin: Tāmen/)).toBeInTheDocument();
 expect(screen.getByText("Cô ấy trông có vẻ mệt.")).toBeInTheDocument();
 expect(screen.getByText("Lưu ý cách dùng")).toBeInTheDocument();
 expect(screen.getByText("Dùng khi nhận xét bề ngoài")).toBeInTheDocument();
});
