// CSS riêng của từng màn hình (HSK cũ import trong file trang). Trong LMS_Frontend cũ mọi CSS này được
// nạp TRƯỚC bootstrap.min.css và index.scss (vì src/index.tsx import ALLRoutes trước các file đó), nên khi
// cùng độ đặc hiệu thì Bootstrap/index.scss THẮNG. Ví dụ ".acm-class-link" (đỏ) bị ".btn-link" của Bootstrap
// ghi đè => người dùng cũ thấy liên kết mã lớp màu xanh, nút "Xuất Excel" không viền.
// Để giao diện mới giống hệt, file này được import ở root layout TRƯỚC bootstrap. Khi chuyển thêm màn hình,
// thêm import vào đây theo thứ tự import trong LMS_Frontend/src/routes/router.link.tsx
// (class-management.css của Giảng viên: dòng 84, trước admin-class-management.css: dòng 158).
import "@/components/management/instructor-class-list/class-management.css";
// M5 — W1-A: màn chấm bài bỏ padding cột nội dung (ManagementPageFrame không nhận class cho .col-lg-9 như bản cũ).
import "@/components/management/instructor-grading/instructor-grading.css";
import "@/components/management/class-management/class-management.css";
// M5 — W1-E: dashboard Admin (.premium-card/.dash-widget-card lấy từ CSS học viên của HSK cũ, chỉ phần cần).
import "@/components/management/admin-dashboard/admin-dashboard.css";
// M5 — W2-D: giáo trình (gồm khối .manage-lp-container nguyên văn manage-learning-path.scss).
import "@/components/management/syllabus/syllabus-management.scss";
// M5 — W2-C: tài liệu học tập.
import "@/components/management/lesson-materials-management/lesson-material-management-page.scss";
// Dùng chung cho các màn chuyển ở M5 (page-header của HSK cũ là CSS toàn cục, import ở core/common/page-header).
import "@/components/shared/page-header.scss";
// M5 — W2-T: nền quản lý nội dung dạng cây (đã gộp .manage-lp-container/.package-type-manager/.manage-flashcard-page/.manage-vocabulary-page của HSK cũ).
import "@/components/management/content-tree/content-tree.scss";
// M5 — W2-E: luyện viết (Hán tự) rồi luyện phát âm, theo thứ tự route trong router.link.tsx cũ (~1730 → ~1922); mọi rule dưới .manage-hanzi-page / .manage-pronunciation-page.
import "@/components/management/content-hanzi/manage-hanzi.scss";
import "@/components/management/content-pronunciation/manage-pronunciation.scss";
// M5 — W2-B: bài tập → ngữ pháp → từ điển (SCSS cũ của từ điển có selector gốc .manage-vocabulary-page trùng màn Bộ từ vựng nên được gắn thêm .dictionary-manage-page).
import "@/components/management/content-quiz/manage-quiz.scss";
import "@/components/management/content-grammar/manage-grammar.scss";
import "@/components/management/dictionary/dictionary-manage.scss";
// Băng-rôn/trang chọn tài khoản của chế độ demo (không có ở HSK cũ; chỉ hiện ở bản build demo).
import "@/components/demo/demo.css";
