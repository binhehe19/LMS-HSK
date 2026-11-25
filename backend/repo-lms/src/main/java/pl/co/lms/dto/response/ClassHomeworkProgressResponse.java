package pl.co.lms.dto.response;

import java.util.List;

// Tiến độ bài tập của cả lớp cho học sinh đang đăng nhập (GET /me/classes/{classId}/homework-progress). Công thức:
// docs/homework-progress-metrics.md. null = chưa có dữ liệu.
//   personalProgress:  "Tiến độ cá nhân" = trung bình tiến độ cá nhân của MỌI buổi (buổi có nội dung mà chưa làm là 0%).
//   homeworkDiligence: "Chuyên cần bài tập" = trung bình "Tiến độ bài tập" của các buổi ĐÃ CÓ làm bài.
//   averageScore:      "Điểm trung bình bài tập" (thang %) = trung bình điểm của các bài đã chấm xong.
//   sessions:          tiến độ từng buổi (modal buổi học dùng lại, không cần gọi thêm).
public record ClassHomeworkProgressResponse(
        Double personalProgress,
        Double homeworkDiligence,
        Double averageScore,
        List<SessionHomeworkProgressResponse> sessions
) {}
