// WAITING FOR BACKEND — Hàm gọi API "module ôn luyện theo buổi" của màn Quản lý Syllabus (/learning-path/syllabus/manage) theo HỢP ĐỒNG ĐỀ XUẤT,
// kế thừa đường dẫn `/online-learning/schedule-modules` và `/online-learning/schedule-available-modules` của online-course.service.ts HSK cũ, qua base
// NEXT_PUBLIC_HSK_API_BASE_PATH (lib/api/hsk-client.ts). Backend chung LMS_IELTS chỉ có giáo trình CHỈ ĐỌC (lms-syllabus-client.ts); phần module là
// dữ liệu riêng của HSK nên ở production biến này trống => mọi hàm ném ApiNotConfiguredError => màn hình hiện WAITING FOR BACKEND.
// Máy chủ giả lập: scripts/mock/handlers/syllabus-modules.mjs. Hợp đồng chi tiết: docs/api-requirements/syllabus-modules.md.
//
// Thao tác GHI đi qua công tắc an toàn (lib/api/write-gate.ts, miền "content" — cùng miền với các màn nội dung HSK); quyền theo ticket module OTHER
// kiểm ở component (useContentAccess("OTHER")), backend phải kiểm lại. Hàm ghi khai báo `async` để lỗi công tắc cũng là promise bị reject.
"use client";

import { hskClient } from "@/lib/api/hsk-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type { CreateScheduleModuleRequest, ReorderScheduleModulesRequest, ScheduleAvailableModule, ScheduleModule } from "@/types/syllabus-modules";

const enc = encodeURIComponent;
const FEATURE = "content";
const MODULES = "/online-learning/schedule-modules";
const AVAILABLE = "/online-learning/schedule-available-modules";

/** Module ôn luyện của một buổi (đã đăng nhập: ADMIN, TEACHER, MENTOR). Hợp đồng là MẢNG; hook kiểm tra hình dạng. */
export function listScheduleModules(scheduleId: string) {
  return hskClient.get<ScheduleModule[]>(`${MODULES}/by-schedule/${enc(scheduleId)}`);
}

/** Bộ nội dung có sẵn theo LOẠI NỘI DUNG (contentTypeOf: VOCABULARY => FLASHCARD, AI_* => AI_PRACTICE); `q` rỗng thì không gửi, như bản cũ. */
export function listAvailableScheduleModules(contentType: string, q?: string) {
  const keyword = q?.trim();
  return hskClient.get<ScheduleAvailableModule[]>(`${AVAILABLE}/${enc(contentType.toUpperCase())}${keyword ? `?q=${enc(keyword)}` : ""}`);
}

// ---- thao tác GHI (write gate "content"; ADMIN hoặc TEACHER/MENTOR có ticket OTHER) ----

export async function createScheduleModule(body: CreateScheduleModuleRequest, demoActive: boolean): Promise<ScheduleModule> {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<ScheduleModule>(MODULES, body);
}

/** Gửi TOÀN BỘ id module của buổi theo thứ tự mới; phản hồi là danh sách đã đánh lại `order`. */
export async function reorderScheduleModules(scheduleId: string, ids: string[], demoActive: boolean): Promise<ScheduleModule[]> {
  assertWriteEnabled(FEATURE, demoActive);
  const body: ReorderScheduleModulesRequest = { ids };
  return hskClient.put<ScheduleModule[]>(`${MODULES}/by-schedule/${enc(scheduleId)}/reorder`, body);
}

export async function deleteScheduleModule(moduleId: string, demoActive: boolean): Promise<void> {
  assertWriteEnabled(FEATURE, demoActive);
  await hskClient.delete<unknown>(`${MODULES}/${enc(moduleId)}`);
}
