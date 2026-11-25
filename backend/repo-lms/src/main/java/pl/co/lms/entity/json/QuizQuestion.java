package pl.co.lms.entity.json;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import pl.co.lms.entity.ExerciseQuestionType;

import java.util.List;

/**
 * Một câu hỏi bên trong QuizContent. questionId là khoá ổn định qua các version — dùng để khoá
 * AssessmentAnswer thay cho contentPackageVersionResourceId.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class QuizQuestion {

    /** ULID ổn định, được gán một lần khi câu hỏi được tạo và không thay đổi qua các version. */
    private String questionId;

    private ExerciseQuestionType questionType;
    /** Nhãn dạng câu (chỉ để hiển thị và thống kê, không đổi cách chấm). */
    private String variant;
    private String questionText;
    /** Ảnh/tệp riêng của câu: [{url, name, mimeType}] với url là đường dẫn nội bộ của storage. Backend lưu nguyên khối. */
    private JsonNode files;
    /** Audio/video riêng của câu: [{kind, url, transcript[]}]. transcript chỉ gửi học viên sau khi nộp. */
    private JsonNode media;
    /** Gợi ý hiển thị (Writing/Speaking), không tác động chấm; backend lưu nguyên khối. */
    private JsonNode hints;
    private String sentenceTemplate;
    private String explanation;
    /** ESSAY: bật chấm AI theo rubric khi có giá trị (ví dụ IELTS_WRITING); null = chấm tay. Không gửi học viên. */
    private String aiRubric;
    /** ESSAY: dữ kiện đúng để AI đối chiếu (ví dụ số liệu biểu đồ). Không gửi học viên. */
    private String referenceText;
    /** ESSAY: Task 1 hoặc 2. */
    private Integer task;
    /** ESSAY: số từ tối thiểu. */
    private Integer minimumWords;
    private String correctSentence;
    private String translationHint;
    private Integer points;
    private List<QuestionContent.QuizOptionItem> options;
    private List<QuestionContent.QuizMatchingPairItem> matchingPairs;
    private List<QuestionContent.QuizBlankItem> blanks;
    private List<QuestionContent.QuizSentenceChunkItem> sentenceChunks;
    private Integer maxFiles;
    private Long maxFileSizeBytes;
    private List<String> acceptedMimeTypes;

    /**
     * Tiêu chí chấm điểm chỉ để người chấm tham khảo (không bắt buộc áp dụng). Cố ý KHÔNG có trong QuestionContent và
     * QuestionPublicContent nên học viên không bao giờ nhận được; màn chấm nhận qua AssessmentGradingDetailResponse.Item.
     */
    private List<GradingCriterion> gradingCriteria;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class GradingCriterion {
        private String label;
        private String description;
        /** Điểm tối đa của tiêu chí (tuỳ chọn, null = không đặt); tổng các điểm đã đặt của một câu không vượt điểm của câu. */
        private Double maxPoints;
    }
}
