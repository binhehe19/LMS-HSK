package pl.co.lms.entity.json;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Nội dung JSON của một LearningResource loại QUIZ. Chứa cả cấu hình bài (thời gian, điểm đạt)
 * lẫn danh sách câu hỏi — thay thế ContentPackageVersionConfig và list QUESTION resource riêng lẻ.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class QuizContent {

    private String title;
    private String description;

    private List<QuizQuestion> questions;

    /** Xáo thứ tự câu hỏi khi học viên làm bài (chỉ lưu; chưa áp dụng ở phía học viên). Null/false = giữ thứ tự. */
    private Boolean shuffleQuestions;

    /** Thời gian dự kiến học viên cần (phút), chỉ để hiển thị; khác timeLimits (giới hạn tối đa). */
    private Integer estimatedMinutes;

    /** Thời lượng theo ba chế độ (default/hard/easy). */
    private TimeLimits timeLimits;

    /**
     * Bố cục hiển thị do frontend định nghĩa (phần, nội dung chung, tệp, audio, thang điểm...): backend chỉ lưu và trả lại.
     * Khoá {@code grading} (dữ liệu chấm) không bao giờ gửi cho học viên; khoá {@code explanation} (giải thích, transcript)
     * chỉ gửi sau khi nộp. Xem {@link pl.co.lms.service.LayoutFilter}.
     */
    private JsonNode layout;

    /**
     * Thời lượng (giây) của một chế độ làm bài theo {@link #timeLimits}; null = không giới hạn (kể cả khi chế độ đó thiếu khoá).
     */
    public Integer limitSeconds(String mode) {
        return timeLimits == null ? null : timeLimits.forMode(mode);
    }

    /** Số ý của các câu có id trong {@code ids} (null = mọi câu): mỗi dòng nối và mỗi chỗ trống là một ý, câu khác tính một ý. */
    public int partCount(java.util.Set<String> ids) {
        if (questions == null) return 0;
        int total = 0;
        for (QuizQuestion q : questions) {
            if (ids != null && !ids.contains(q.getQuestionId())) continue;
            int lines = q.getQuestionType() == pl.co.lms.entity.ExerciseQuestionType.MATCHING && q.getMatchingPairs() != null ? q.getMatchingPairs().size()
                    : q.getQuestionType() == pl.co.lms.entity.ExerciseQuestionType.FILL_IN_BLANK && q.getBlanks() != null ? q.getBlanks().size() : 1;
            total += Math.max(1, lines);
        }
        return total;
    }
}
