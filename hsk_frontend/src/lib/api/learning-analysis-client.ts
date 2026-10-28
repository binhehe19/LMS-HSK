// WAITING FOR BACKEND — hàm gọi API của màn Phân tích học tập theo HỢP ĐỒNG ĐỀ XUẤT (docs/api-requirements/learning-analysis.md), kế thừa đường dẫn
// của HSK cũ (onl-learning `/grading-classes/{classId}/schedules/{scheduleId}/students/{userId}/...` và quiz `/grading/schedules/.../personalization`)
// nhưng gom về MỘT base của quiz grading (NEXT_PUBLIC_QUIZ_API_BASE_PATH). Backend chung LMS_IELTS CHƯA có các endpoint này (B0 OPEN) nên ở
// production biến này để trống => mọi hàm ném ApiNotConfiguredError => màn hình hiện WAITING FOR BACKEND. Máy chủ giả lập: scripts/mock/handlers/learning-analysis.mjs.
//
// Khác HSK cũ có chủ đích: học viên định danh theo `userId` ở MỌI endpoint (bản cũ dùng EMAIL cho attendance-analysis — B0 M12); `studentEmail` không
// được gửi lên. Ba thao tác GHI (gửi nhận xét, tạo snapshot AI, duyệt báo cáo AI) đi qua công tắc "teacher-note" (lib/api/write-gate.ts).
"use client";

import { ApiError } from "@/lib/api/api-client";
import { quizClient } from "@/lib/api/quiz-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import { toTeacherNote } from "@/lib/learning-analysis/learning-analysis-model";
import { normalizePersonalizationView } from "@/lib/learning-analysis/personalization-model";
import type { AttendanceAnalysisResponse, PersonalizationApproveResult, PersonalizationSnapshotResult, PersonalizationView, SendTeacherNoteRequest, TeacherNoteResponse } from "@/types/learning-analysis";

const enc = encodeURIComponent;
const studentPath = (classId: string, scheduleId: string, userId: string) => `/grading/classes/${enc(classId)}/schedules/${enc(scheduleId)}/students/${enc(userId)}`;
const personalizationPath = (scheduleId: string, userId: string) => `/grading/schedules/${enc(scheduleId)}/students/${enc(userId)}/personalization`;

/** Chuyên cần luỹ kế từ đầu lớp tới buổi này + lịch sử điểm danh. Hình dạng thô — hook chuẩn hoá (normalizeAttendanceAnalysis). */
export function getAttendanceAnalysis(classId: string, scheduleId: string, userId: string) {
  return quizClient.get<AttendanceAnalysisResponse>(`${studentPath(classId, scheduleId, userId)}/attendance-analysis`);
}

/** Nhận xét gần nhất đã gửi cho học viên trong buổi; backend trả `data: null` khi chưa có (api-client trả envelope rỗng => chuẩn hoá về null). */
export async function getLatestTeacherNote(classId: string, scheduleId: string, userId: string): Promise<TeacherNoteResponse | null> {
  return toTeacherNote(await quizClient.get<unknown>(`${studentPath(classId, scheduleId, userId)}/notes/latest`));
}

/** GHI: gửi nhận xét cho học viên (backend lưu + phát thông báo). Body chỉ có `content` — không có email học viên. */
export function sendTeacherNote(classId: string, scheduleId: string, userId: string, content: string, demoActive: boolean) {
  assertWriteEnabled("teacher-note", demoActive);
  const body: SendTeacherNoteRequest = { content };
  return quizClient.post<TeacherNoteResponse>(`${studentPath(classId, scheduleId, userId)}/notes`, body);
}

/** Bản ghi gợi ý AI (snapshot + báo cáo + bài tập đề xuất) của học viên trong buổi; `classId` bắt buộc (B0 M5). */
export async function getPersonalization(scheduleId: string, userId: string, classId: string): Promise<PersonalizationView> {
  return normalizePersonalizationView(await quizClient.get<unknown>(`${personalizationPath(scheduleId, userId)}?classId=${enc(classId)}`));
}

/**
 * GHI: yêu cầu AI tạo snapshot/báo cáo cho buổi. Như bản cũ, chỉ coi là thành công khi backend XÁC NHẬN `result` CREATED|EXISTING kèm `snapshot.id`;
 * phản hồi mập mờ => lỗi UNCONFIRMED_SNAPSHOT_MUTATION (không báo "đã tạo" khi không chắc).
 */
export async function generatePersonalizationSnapshot(scheduleId: string, userId: string, classId: string, forceNewVersion: boolean, demoActive: boolean): Promise<PersonalizationSnapshotResult> {
  assertWriteEnabled("teacher-note", demoActive);
  const data = await quizClient.post<PersonalizationSnapshotResult>(`${personalizationPath(scheduleId, userId)}/snapshot?classId=${enc(classId)}&forceNewVersion=${forceNewVersion ? "true" : "false"}`);
  const result = String(data?.result || "").toUpperCase();
  const snapshotId = data?.snapshot?.id;
  if (!(result === "CREATED" || result === "EXISTING") || typeof snapshotId !== "string" || !snapshotId.trim()) {
    throw new ApiError("AI-CNH không xác nhận đã tạo hoặc tìm thấy snapshot cho buổi học này.", 200, "UNCONFIRMED_SNAPSHOT_MUTATION");
  }
  return { ...data, result };
}

/** GHI: giáo viên duyệt báo cáo AI (DRAFT → APPROVED); backend giao bài tập củng cố đi kèm. */
export function approvePersonalizationReport(scheduleId: string, userId: string, classId: string, reportId: string, demoActive: boolean) {
  assertWriteEnabled("teacher-note", demoActive);
  return quizClient.post<PersonalizationApproveResult>(`${personalizationPath(scheduleId, userId)}/reports/${enc(reportId)}/approve?classId=${enc(classId)}`);
}
