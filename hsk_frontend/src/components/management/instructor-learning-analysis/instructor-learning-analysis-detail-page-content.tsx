"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { InstructorLearningAnalysisDetailView } from "@/components/management/instructor-learning-analysis/instructor-learning-analysis-detail-view";
import { useLearningAnalysisDetail } from "@/components/management/instructor-learning-analysis/use-learning-analysis-detail";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError } from "@/lib/api/api-client";
import { approvePersonalizationReport, generatePersonalizationSnapshot, sendTeacherNote } from "@/lib/api/learning-analysis-client";
import { WriteDisabledError } from "@/lib/api/write-gate";
import { learningAnalysisListHref } from "@/lib/learning-analysis/learning-analysis-model";
import { paramNoticeText, readDetailParams } from "@/lib/learning-analysis/learning-analysis-params";

const errorMessage = (error: unknown, fallback: string) => (error instanceof ApiError || error instanceof WriteDisabledError ? error.message : fallback);

// Màn "Chi tiết phân tích học tập" của một học viên trong buổi (HSK cũ: LearningAnalysisDetailPage). Tham số từ URL (hợp đồng giữ nguyên; `studentEmail`
// không được dùng để gọi API). Ba thao tác GHI (gửi nhận xét, tạo/duyệt nhận xét AI) đi qua công tắc "teacher-note"; sau khi ghi thành công thì TẢI LẠI
// nguồn tương ứng (bản cũ gán thẳng phản hồi POST vào state) để màn luôn hiển thị đúng dữ liệu backend đang giữ.
export function InstructorLearningAnalysisDetailPageContent() {
  const sp = useSearchParams();
  const check = readDetailParams((name) => sp.get(name));
  const params = check.kind === "ok" ? check.params : null;
  const paramNotice = check.kind === "ok" ? null : paramNoticeText(check, "Phân tích học tập");

  const data = useLearningAnalysisDetail(params); // tham số lỗi => không gọi API
  const { enabled: writeEnabled, demo } = useWriteGate("teacher-note");

  // Bản nháp gắn với (lớp, buổi, học viên): đổi học viên qua URL => ô nhập về rỗng (bản cũ dùng effect reset).
  const scope = params ? `${params.classId}|${params.scheduleId}|${params.userId}` : "";
  const [draft, setDraft] = useState({ scope: "", text: "" });
  const noteDraft = draft.scope === scope ? draft.text : "";
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);

  const sendNote = async () => {
    if (!params || sending) return;
    const content = noteDraft.trim();
    if (!content) {
      toast.error("Nhập nội dung nhận xét trước khi gửi");
      return;
    }
    setSending(true);
    try {
      await sendTeacherNote(params.classId, params.scheduleId, params.userId, content, demo);
      setDraft({ scope, text: "" });
      data.reload.note();
      toast.success("Đã gửi nhận xét cho học viên");
    } catch (error) {
      toast.error(errorMessage(error, "Gửi nhận xét thất bại"));
    } finally {
      setSending(false);
    }
  };

  const generate = async () => {
    if (!params || generating) return;
    setGenerating(true);
    try {
      const result = await generatePersonalizationSnapshot(params.scheduleId, params.userId, params.classId, false, demo);
      data.reload.personalization();
      toast.success(result.result === "EXISTING" ? "Đã dùng nhận xét AI hiện có của buổi học này" : "Đã tạo nhận xét AI cho buổi học này");
    } catch (error) {
      toast.error(errorMessage(error, "Không thể tạo nhận xét AI"));
    } finally {
      setGenerating(false);
    }
  };

  const approve = async () => {
    const reportId = data.personalization.kind === "ok" ? data.personalization.data.report?.id : undefined;
    if (!params || approving || !reportId) return;
    setApproving(true);
    try {
      await approvePersonalizationReport(params.scheduleId, params.userId, params.classId, reportId, demo);
      data.reload.personalization();
      toast.success("Đã duyệt nhận xét AI cho buổi học này");
    } catch (error) {
      toast.error(errorMessage(error, "Không thể duyệt nhận xét AI"));
    } finally {
      setApproving(false);
    }
  };

  return (
    <InstructorLearningAnalysisDetailView
      params={params}
      paramNotice={paramNotice}
      backHref={params ? learningAnalysisListHref(params) : "/instructor/list-class"}
      data={data}
      writeEnabled={writeEnabled}
      noteDraft={noteDraft}
      onNoteDraftChange={(text) => setDraft({ scope, text })}
      onSendNote={sendNote}
      sendingNote={sending}
      generating={generating}
      onGenerate={generate}
      approving={approving}
      onApprove={approve}
    />
  );
}
