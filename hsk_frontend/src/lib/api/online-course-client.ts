// WAITING FOR BACKEND — Hàm gọi API màn Quản lý khoá học trực tuyến (/learning-path/online-course/manage) và Đăng ký khoá học (/leads) theo HỢP ĐỒNG
// ĐỀ XUẤT, kế thừa đường dẫn `/online-learning/*` của online-course.service.ts HSK cũ, qua base NEXT_PUBLIC_HSK_API_BASE_PATH (lib/api/hsk-client.ts).
// Backend chung LMS_IELTS CHƯA có endpoint tương đương nên ở production biến này trống => mọi hàm ném ApiNotConfiguredError => màn hình hiện
// WAITING FOR BACKEND. Máy chủ giả lập: scripts/mock/handlers/online-course.mjs. Hợp đồng chi tiết: docs/api-requirements/online-course.md.
//
// Khác service cũ có chủ đích: (1) `getCourses` cũ gọi thêm GET /syllabuses/{id} cho TỪNG khoá để "hydrate" syllabusInfo mà màn quản lý không dùng —
// bỏ; (2) không có hàm tạo khoá học vì nút "Tạo mới khóa học" bị ẩn ở bản cũ (`{false && …}`) — hợp đồng POST /courses vẫn ghi trong docs;
// (3) leads chỉ ADMIN (HSK cũ mở công khai — lỗ hổng U5); (4) không có export Excel (`GET /leads/export`): màn hình xuất CSV phía client.
// Thao tác GHI đi qua công tắc an toàn (lib/api/write-gate.ts, miền "online-course").
"use client";

import { hskClient } from "@/lib/api/hsk-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type {
  OnlineCourseDetail,
  OnlineCourseLeadPage,
  OnlineCourseLeadQuery,
  OnlineCourseSummary,
  OnlineCourseUpsertRequest,
  OnlineSyllabusInfo,
  OnlineSystemSyncJob,
} from "@/types/online-course";

const enc = encodeURIComponent;
const FEATURE = "online-course";
const COURSES = "/online-learning/courses";

/** Toàn bộ khoá học trực tuyến (ROLE_ADMIN). Hợp đồng là MẢNG; hook kiểm tra hình dạng. */
export function listOnlineCourses() {
  return hskClient.get<OnlineCourseSummary[]>(COURSES);
}

export function getOnlineCourse(courseId: string) {
  return hskClient.get<OnlineCourseDetail>(`${COURSES}/${enc(courseId)}`);
}

/** Chi tiết gộp (khoá + giáo trình); bản cũ chuẩn hoá nhiều hình dạng lồng nhau, ở đây hợp đồng là một đối tượng phẳng. */
export function getOnlineCourseFullDetail(courseId: string) {
  return hskClient.get<OnlineCourseDetail>(`${COURSES}/${enc(courseId)}/full-detail`);
}

/** Giáo trình theo id, dùng khi full-detail không có mô tả giáo trình (chuỗi dự phòng của bản cũ). */
export function getOnlineSyllabus(syllabusId: string) {
  return hskClient.get<OnlineSyllabusInfo>(`/online-learning/syllabuses/${enc(syllabusId)}`);
}

export function getOnlineSyncJob(jobId: string) {
  return hskClient.get<OnlineSystemSyncJob>(`/online-learning/sync/all/${enc(jobId)}`);
}

// ---- thao tác GHI (write gate "online-course") ----

export function updateOnlineCourse(courseId: string, body: OnlineCourseUpsertRequest, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.put<OnlineCourseDetail>(`${COURSES}/${enc(courseId)}`, body);
}

export function deleteOnlineCourse(courseId: string, demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.delete<void>(`${COURSES}/${enc(courseId)}`);
}

/** Bắt đầu đồng bộ toàn bộ từ CMS; theo dõi bằng getOnlineSyncJob(jobId) mỗi 3 giây như bản cũ. */
export function startOnlineSync(demoActive: boolean) {
  assertWriteEnabled(FEATURE, demoActive);
  return hskClient.post<OnlineSystemSyncJob>("/online-learning/sync/all");
}

// ---- đăng ký khoá học (lead), chỉ đọc, ROLE_ADMIN ----

/** Phân trang phía máy chủ, sắp xếp cố định `registeredAt,desc` như bản cũ; tham số rỗng không gửi. */
export function listOnlineCourseLeads(query: OnlineCourseLeadQuery) {
  const params = new URLSearchParams();
  if (query.courseCode) params.set("courseCode", query.courseCode);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  params.set("page", String(query.page));
  params.set("size", String(query.size));
  params.set("sort", "registeredAt,desc");
  return hskClient.get<OnlineCourseLeadPage>(`/online-learning/leads?${params.toString()}`);
}
