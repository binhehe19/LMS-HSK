// Phân trang phía client cho các danh sách của màn thông báo (trang bắt đầu từ 0).

/** Số trang theo tổng bản ghi; 0 bản ghi => 0 trang. */
export function pageCount(totalElements: number, size: number): number {
  return size > 0 && totalElements > 0 ? Math.ceil(totalElements / size) : 0;
}

/**
 * Trang hợp lệ gần nhất khi dữ liệu thay đổi (vd. bản ghi bị xoá/đọc khiến trang hiện tại không còn): trả về trang cuối nếu `page` vượt quá,
 * hoặc null nếu `page` vẫn hợp lệ / không có bản ghi nào (khi đó hiện trạng thái rỗng, không nhảy trang).
 */
export function clampedPageOrNull(page: number, totalElements: number, size: number): number | null {
  const pages = pageCount(totalElements, size);
  return pages > 0 && page > pages - 1 ? pages - 1 : null;
}
