"use client";

// Màn "Khoá học" học viên nối repo-lms thật (/hsk-courses, HskCourseController) qua NEXT_PUBLIC_LMS_API_BASE_PATH (lib/api/lms-client.ts).
// Thay chuỗi gọi của HSK cũ (/online-learning/courses + /students/me/online-courses + /students/me/timetable + /syllabuses/{id}):
// backend ghép sẵn danh mục + trạng thái sở hữu/tiến độ (ERP HSK) nên trang chỉ gọi 1 request, mở chi tiết thêm 1 request.
import { lmsClient } from "@/lib/api/lms-client";
import type { StudentCourseCatalog, StudentCourseDetailApi } from "@/types/student-course";

export async function listStudentCourses(): Promise<StudentCourseCatalog> {
  const res = await lmsClient.get<StudentCourseCatalog>("/hsk-courses");
  if (!res || !Array.isArray(res.items)) throw new Error("Dữ liệu khoá học trả về không đúng định dạng.");
  return res;
}

export async function getStudentCourse(id: string): Promise<StudentCourseDetailApi> {
  const res = await lmsClient.get<StudentCourseDetailApi>(`/hsk-courses/${encodeURIComponent(id)}`);
  if (!res || !res.course) throw new Error("Dữ liệu khoá học trả về không đúng định dạng.");
  return res;
}
