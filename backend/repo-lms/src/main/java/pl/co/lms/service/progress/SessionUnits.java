package pl.co.lms.service.progress;

import java.util.List;

// Các "bài" và "từ" của MỘT buổi học trong giáo trình (không phụ thuộc học sinh nên cache dùng chung được).
// Mỗi phần tử của 3 danh sách bài là learningResourceId của một resource QUIZ gắn vào buổi (1 resource = 1 bài),
// cũng chính là khoá gắn attempt (assessment_attempts.learning_resource_id).
// wordResourceIds: learningResourceId của các resource từ vựng (mỗi resource là một card từ).
public record SessionUnits(
        List<String> grammarUnits,
        List<String> vocabularyUnits,
        List<String> quickTestUnits,
        List<String> wordResourceIds
) {
    public static final SessionUnits EMPTY = new SessionUnits(List.of(), List.of(), List.of(), List.of());

    public boolean isEmpty() {
        return grammarUnits.isEmpty() && vocabularyUnits.isEmpty() && quickTestUnits.isEmpty() && wordResourceIds.isEmpty();
    }
}
