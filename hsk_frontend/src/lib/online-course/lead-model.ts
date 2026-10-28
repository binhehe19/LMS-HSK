// Hàm thuần của màn Quản lý đăng ký khoá học online (online-course-lead-management-page.tsx cũ): nhãn/màu trạng thái, từ điển loại khoá theo mã,
// lọc trạng thái phía client, định dạng ngày, xuất CSV phía trình duyệt (thay cho GET /leads/export .xlsx của bản cũ).
import type { OnlineCourseLead, OnlineCourseLeadStatus, OnlineCourseSummary } from "@/types/online-course";

export type LeadStatusFilter = "ALL" | OnlineCourseLeadStatus;

export const LEAD_STATUS_OPTIONS: { value: LeadStatusFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "PENDING", label: "Chờ tư vấn" },
  { value: "IN_PROGRESS", label: "Đang học" },
  { value: "COMPLETED", label: "Hoàn thành" },
  { value: "CANCELED", label: "Đã hủy" },
];

/** Trạng thái lạ/thiếu => "Chờ tư vấn" (nhánh default của bản cũ). */
export function leadStatusLabel(status: string | undefined | null): string {
  switch (String(status || "").toUpperCase()) {
    case "IN_PROGRESS":
      return "Đang học";
    case "COMPLETED":
      return "Hoàn thành";
    case "CANCELED":
      return "Đã hủy";
    default:
      return "Chờ tư vấn";
  }
}

/** Class huy hiệu Bootstrap tương ứng Badge bg của bản cũ (info/warning/success/secondary). */
export function leadStatusBadgeClass(status: string | undefined | null): string {
  switch (String(status || "").toUpperCase()) {
    case "IN_PROGRESS":
      return "bg-warning";
    case "COMPLETED":
      return "bg-success";
    case "CANCELED":
      return "bg-secondary";
    default:
      return "bg-info";
  }
}

export function formatLeadDate(iso: string | undefined | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("vi-VN");
}

export function normalizeLookupKey(value: string | undefined | null): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Mã/id/tên khoá (đã chuẩn hoá) → courseType, để điền "Loại khóa học" khi bản ghi đăng ký thiếu trường này (như bản cũ). */
export function buildCourseTypeDictionary(courses: readonly OnlineCourseSummary[]): Record<string, string> {
  const dictionary: Record<string, string> = {};
  for (const course of courses) {
    const type = String(course.courseType || "").trim();
    if (!type) continue;
    for (const key of [course.code, course.slug, course.id, course.name, course.title].map(normalizeLookupKey).filter(Boolean)) dictionary[key] = type;
  }
  return dictionary;
}

export function resolveLeadCourseType(lead: OnlineCourseLead, dictionary: Record<string, string>): string {
  const matched = [lead.courseCode, lead.courseId, lead.courseName].map(normalizeLookupKey).filter(Boolean).map((key) => dictionary[key]).find(Boolean);
  return matched || String(lead.courseType || "").trim() || "-";
}

export function filterLeadsByStatus(leads: readonly OnlineCourseLead[], status: LeadStatusFilter): OnlineCourseLead[] {
  if (status === "ALL") return [...leads];
  return leads.filter((lead) => String(lead.status || "").toUpperCase() === status);
}

const CSV_HEADER = ["Học viên", "Email", "Liên hệ", "Nội dung đăng ký", "Mã khóa học", "Loại khóa học", "Ngày đăng ký", "Trạng thái", "Ghi chú"];

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV UTF-8 có BOM (Excel tiếng Việt mở đúng dấu) cho các dòng đang hiển thị — khác bản cũ (tải .xlsx do máy chủ tạo). */
export function buildLeadsCsv(leads: readonly OnlineCourseLead[], dictionary: Record<string, string>): string {
  const rows = leads.map((lead) =>
    [lead.fullName, lead.email, lead.phone || "", lead.courseName || "", lead.courseCode, resolveLeadCourseType(lead, dictionary), formatLeadDate(lead.registeredAt), leadStatusLabel(lead.status), lead.note || ""].map((v) => csvCell(String(v ?? ""))).join(","),
  );
  return `﻿${[CSV_HEADER.join(","), ...rows].join("\r\n")}`;
}

export function leadsCsvFilename(now: Date): string {
  return `online-course-leads-${now.toISOString().slice(0, 10)}.csv`;
}
