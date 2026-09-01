# Yêu cầu API — Màn "Tổng quan" giảng viên (`/instructor/welcome`)

Trạng thái tích hợp: **WAITING FOR BACKEND**. UI hoàn chỉnh và đã kiểm thử trên mock; chưa có dịch vụ nào được cấu hình trong frontend, nên các ô số liệu hiện "—" kèm thông báo chờ
(không có số 0 giả). Màn này **không gọi API riêng**: dùng lại hai client đã có.

| Dữ liệu | Client | Endpoint (hợp đồng GIẢ ĐỊNH rút từ HSK cũ, chưa xác nhận) | Biến cấu hình | Ghi chú |
|---|---|---|---|---|
| Công việc: tổng/đang mở/đã hoàn tất/tỷ lệ | `lib/api/ticket-client.ts` `getTickets(0, 50)` | `GET <TICKET base>?page=0&size=50` → mảng `TicketResponse` (chấp nhận mảng trần, `content`, `items`, `data`) | `NEXT_PUBLIC_TICKET_API_BASE_PATH` | tính ở frontend: lọc `assignedId` = id người dùng, `status` OPEN/DONE |
| Thông báo chưa đọc | `lib/api/notification-client.ts` `getUnreadCount()` | `GET <NOTIFICATION base>/unread-count` → số nguyên | `NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH` | cùng nguồn với chuông ở sidebar; hỏi lại mỗi 30 giây + khi có sự kiện `notifications-updated` |

Chi tiết hợp đồng, câu hỏi cần xác nhận và hành vi lỗi: `docs/api-requirements/notifications.md`. Điểm bổ sung cho màn này:

1. **Phạm vi dữ liệu ticket** (đã đọc source `LMS_Backend/repo-lms-identity`, chỉ đọc): `GET /tickets` trả **toàn bộ** ticket cho principal "privileged" (Admin/Teacher-manager) và **chỉ ticket có `assignedId` = chính người dùng** cho role còn lại.
   Với Teacher/Mentor frontend lọc `assignedId` lần nữa (như HSK cũ) nên kết quả trùng khớp; backend owner xác nhận Teacher/Mentor **không** thuộc nhóm privileged.
2. **Giới hạn 50 ticket đầu** (hành vi cũ): nếu một giảng viên có > 50 ticket đang hiệu lực, số đếm thấp hơn thực tế. Đề nghị backend cung cấp endpoint đếm theo trạng thái cho người dùng hiện tại (`OPEN`, `DONE`) để bỏ giới hạn này.
3. **Không có dữ liệu giảng viên khác** trong màn này (không số liệu lớp, học viên). Nếu bản cũ sau này bổ sung, cần endpoint riêng.
4. `GET /users/me` (Auth chung) không trả `username` và `isPremium`; màn dùng `fullName` rồi `email` thay cho `name || username` của bản cũ (xem `docs/M3B2-WELCOME.md`).
