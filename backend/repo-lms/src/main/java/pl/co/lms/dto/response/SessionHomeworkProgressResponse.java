package pl.co.lms.dto.response;

// Tiến độ bài tập của MỘT buổi học cho học sinh đang đăng nhập. Mọi phần trăm nằm trong [0, 100]; null = chưa có
// dữ liệu (buổi/cụm không có bài, từ), FE hiển thị "Chưa có dữ liệu" chứ không phải 0%. Công thức: docs/homework-progress-metrics.md.
//   homeworkProgress: "Tiến độ bài tập" của buổi (chỉ bài tập, không tính từ đã thuộc).
//   personalProgress: "Tiến độ cá nhân" của buổi (gồm cả từ đã thuộc), nguyên liệu để tính "Tiến độ cá nhân" của lớp.
public record SessionHomeworkProgressResponse(
        String sessionId,
        Integer sessionNo,
        Double homeworkProgress,
        Double personalProgress,
        Cluster grammar,
        Cluster vocabulary,
        Cluster quickTest
) {
    // percent: số hiển thị ở card/badge của cụm. knownWords/totalWords chỉ có ở cụm Từ vựng.
    public record Cluster(Double percent, int doneUnits, int totalUnits, Integer knownWords, Integer totalWords) {}
}
