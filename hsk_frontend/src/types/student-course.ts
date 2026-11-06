// Hợp đồng API màn "Khoá học" học viên (/student/student-courses) với repo-lms (/hsk-courses, HskCourseController).

/** LIVE = sở hữu lấy từ ERP HSK lúc gọi; CACHED = ERP lỗi, dùng bản lưu gần nhất; UNAVAILABLE = ERP lỗi, chưa có bản lưu. */
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
  progress: number;
  doneSessions: number;
  progressStatus?: string | null;
}

export interface StudentCourseCatalog {
  items: StudentCourseApi[];
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

/** OK; NONE = khoá chưa gắn giáo trình; UNAVAILABLE = ERP HSK lỗi. */
export type SyllabusStatus = "OK" | "NONE" | "UNAVAILABLE";

export interface StudentCourseDetailApi {
  course: StudentCourseApi;
  syllabusStatus: SyllabusStatus;
  sessions: StudentCourseSession[];
  materials: StudentCourseMaterial[];
  previewTopics: string[];
  enrollmentSource: EnrollmentSource;
}
