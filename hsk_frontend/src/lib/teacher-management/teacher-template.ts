// File mẫu cho "Tải file mẫu" của màn Quản lý giảng viên.
// Khác HSK cũ có chủ đích: bản cũ tạo .xlsx phía client bằng thư viện `xlsx` (không được thêm thư viện mới, xem docs/M5-AGENT-BRIEF.md mục 3);
// ở đây tạo CSV UTF-8 có BOM (Excel mở trực tiếp, giữ dấu tiếng Việt) với ĐÚNG tiêu đề cột và dòng ví dụ của template cũ.

export const TEACHER_TEMPLATE_FILENAME = "Template_Import_Giang_Vien.csv";

export const TEACHER_TEMPLATE_HEADERS: readonly string[] = ["Email (*)", "Họ và tên (*)", "Mô tả ngắn", "Mô tả chi tiết", "Phong cách giảng dạy", "Bằng cấp / Chứng chỉ", "URL Video giới thiệu", "URL Ảnh đại diện"];

export const TEACHER_TEMPLATE_SAMPLE_ROW: readonly string[] = [
  "giangvien1@example.com",
  "Nguyễn Văn A",
  "Giảng viên xuất sắc",
  "Có nhiều năm kinh nghiệm...",
  "Năng động, trực quan",
  "Thạc sĩ Khoa học máy tính",
  "https://youtube.com/watch?v=...",
  "https://example.com/avatar.jpg",
];

/** Một ô CSV: bọc dấu nháy kép khi có dấu phẩy, nháy kép hoặc xuống dòng (RFC 4180). */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function csvLine(cells: readonly string[]): string {
  return cells.map(csvCell).join(",");
}

/** Nội dung file mẫu: BOM + tiêu đề + một dòng ví dụ, ngắt dòng CRLF cho Excel trên Windows. */
export function buildTeacherTemplateCsv(): string {
  return `﻿${csvLine(TEACHER_TEMPLATE_HEADERS)}\r\n${csvLine(TEACHER_TEMPLATE_SAMPLE_ROW)}\r\n`;
}
