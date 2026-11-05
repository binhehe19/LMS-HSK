import type { Metadata } from "next";
import StudentShell from "@/components/student/dashboard/student-shell";
import { VocabularyDetailPageContent } from "@/components/student/vocabulary/vocabulary-detail-page-content";

export const metadata: Metadata = { title: "Chi tiết từ vựng | Học Bá" };

// `params` là Promise trong Next 16. key={id}: sang từ khác (chữ thành phần, "Từ đã xem") thì dựng lại trang, không giữ trạng thái của từ trước
// (đang lưu, popup đang mở, "Xem tất cả").
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StudentShell fullWidth>
      <VocabularyDetailPageContent key={id} id={id} />
    </StudentShell>
  );
}
