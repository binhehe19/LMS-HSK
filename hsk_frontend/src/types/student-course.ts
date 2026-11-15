// Dữ liệu màn "Khoá học" học viên (/student/student-courses), ghép ở frontend từ API có sẵn của repo-lms (lib/api/lms-course-client.ts).

/** LIVE = đọc được lớp của học viên (/me/classes); UNAVAILABLE = không đọc được nên mọi khoá hiện "chưa sở hữu". CACHED giữ cho tương thích. */
export type EnrollmentSource = "LIVE" | "CACHED" | "UNAVAILABLE";

export interface StudentCourseApi {
  id: string;
  code: string;
  name: string;
  courseType?: string | null;
  levelIn?: string | null;
  levelOut?: string | null;
  totalSessions?: number | null;
  price?: number | null;
  thumbnail?: string | null;
  description?: string | null;
  category?: string | null;
  audiences?: string[] | null;
  studyForm?: string | null;
  months?: number | null;
  hoursPerSession?: number | null;
  displayOrder?: number | null;
  releasedAt?: string | null;
  owned: boolean;
  registered?: boolean | null;
  progress: number;
  doneSessions: number;
  progressStatus?: string | null;
}

export interface StudentCourseCatalog {
  items: StudentCourseApi[];
  totalPages?: number;
  enrollmentSource: EnrollmentSource;
}

export interface StudentCourseSession {
  id?: string | null;
  sessionNo?: number | null;
  topic?: string | null;
  content?: string | null;
}

export interface StudentCourseMaterial {
  id?: string | null;
  title: string;
  type?: string | null;
  url?: string | null;
}

/** OK; NONE = khoá chưa gắn giáo trình; UNAVAILABLE = không tải được giáo trình. */
export type SyllabusStatus = "OK" | "NONE" | "UNAVAILABLE";

export interface StudentCourseDetailApi {
  course: StudentCourseApi;
  syllabusStatus: SyllabusStatus;
  sessions: StudentCourseSession[];
  materials: StudentCourseMaterial[];
  previewTopics: string[];
  enrollmentSource: EnrollmentSource;
}
