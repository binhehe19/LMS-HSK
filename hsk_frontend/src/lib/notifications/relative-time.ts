import dayjs from "dayjs";
import "dayjs/locale/vi";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);
// HSK cũ đặt locale TOÀN CỤC của dayjs là "vi" (side effect khi nạp sidebar-notification-bell.tsx). antd DatePicker lấy tên thứ/tháng trong popup từ dayjs
// toàn cục nên màn thông báo cần giữ đúng điều này để lịch hiện tiếng Việt như bản cũ.
dayjs.locale("vi");

/** "3 phút trước", như bản cũ (dayjs locale vi + plugin relativeTime). */
export function formatRelativeTime(iso: string): string {
  return dayjs(iso).locale("vi").fromNow();
}
