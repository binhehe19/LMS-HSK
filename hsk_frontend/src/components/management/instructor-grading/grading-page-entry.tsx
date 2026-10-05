"use client";

import { InstructorGradingPageContent } from "@/components/management/instructor-grading/instructor-grading-page-content";
import { LmsGradingWorkspace } from "@/components/management/instructor-grading/lms-grading-workspace";
import { isLmsApiConfigured } from "@/lib/api/lms-client";

/** Backend chung có cấu hình: chấm bài trên API của backend chung; không: màn cũ nối dịch vụ quiz (chỉ để xem trước với máy chủ giả lập). */
export function GradingPageEntry() {
  return isLmsApiConfigured() ? <LmsGradingWorkspace /> : <InstructorGradingPageContent />;
}
