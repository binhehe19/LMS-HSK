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

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class QuestionContent {
    private ExerciseQuestionType questionType;
    private String variant;
    private String questionText;
    private JsonNode files;
    private JsonNode media;
    private JsonNode hints;
    private String sentenceTemplate;
    private String explanation;
    private String aiRubric;
    private String referenceText;
    private Integer task;
    private Integer minimumWords;
    private String correctSentence;
    private String translationHint;
    private Integer points;
    private List<QuizOptionItem> options;
    private List<QuizMatchingPairItem> matchingPairs;
    private List<QuizBlankItem> blanks;
    private List<QuizSentenceChunkItem> sentenceChunks;
    // FILE_UPLOAD: giới hạn số lượng, dung lượng và loại MIME
    private Integer maxFiles;
    private Long maxFileSizeBytes;
    private List<String> acceptedMimeTypes;

    /**
     * Bản dành cho học viên SAU khi nộp: đủ đáp án, lời giải và transcript nhưng không có dữ kiện chấm AI
     * ({@code referenceText}, {@code aiRubric}) vì chúng chỉ dùng phía server.
     */
    public static QuestionContent forResult(QuizQuestion q) {
        QuestionContent content = from(q);
        if (content != null) {
            content.setReferenceText(null);
            content.setAiRubric(null);
        }
        return content;
    }

    public static QuestionContent from(QuizQuestion q) {
        if (q == null) return null;
        return QuestionContent.builder()
                .questionType(q.getQuestionType())
                .variant(q.getVariant())
                .questionText(q.getQuestionText())
                .files(q.getFiles())
                .media(q.getMedia())
                .hints(q.getHints())
                .sentenceTemplate(q.getSentenceTemplate())
                .aiRubric(q.getAiRubric())
                .referenceText(q.getReferenceText())
                .task(q.getTask())
                .minimumWords(q.getMinimumWords())
                .explanation(q.getExplanation())
                .correctSentence(q.getCorrectSentence())
                .translationHint(q.getTranslationHint())
                .points(q.getPoints())
                .options(q.getOptions())
                .matchingPairs(q.getMatchingPairs())
                .blanks(q.getBlanks())
                .sentenceChunks(q.getSentenceChunks())
                .maxFiles(q.getMaxFiles())
                .maxFileSizeBytes(q.getMaxFileSizeBytes())
                .acceptedMimeTypes(q.getAcceptedMimeTypes())
                .build();
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class QuizOptionItem {
        private Integer optionIndex;
        private String content;
        private Boolean correct;
        /** Ảnh của lựa chọn (đường dẫn nội bộ /api/storage/file/<mã>); cũng là ảnh của lựa chọn chung ở câu nối. */
        private String mediaUrl;

        public QuizOptionItem(Integer optionIndex, String content, Boolean correct) {
            this(optionIndex, content, correct, null);
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class QuizMatchingPairItem {
        private Integer pairIndex;
        private String prompt;
        /** Bản chữ của đáp án để đọc/hiển thị; KHÔNG dùng để chấm (hai lựa chọn có thể trùng chữ). Đáp án thật là answerOptionIndex. */
        private String answer;
        /** Lời giải riêng của ý này; chỉ gửi học viên sau khi nộp. */
        private String explanation;
        /** Ảnh của vế trái (gửi học viên khi làm bài); đường dẫn nội bộ storage. Ảnh của đáp án là mediaUrl của lựa chọn đúng. */
        private String promptMediaUrl;
        /** optionIndex của lựa chọn đúng trong options (danh sách chung, nhiều dòng có thể cùng một lựa chọn); chỉ gửi học viên sau khi nộp. */
        private Integer answerOptionIndex;

        public QuizMatchingPairItem(Integer pairIndex, String prompt, String answer, String explanation) {
            this(pairIndex, prompt, answer, explanation, null, null);
        }

        public QuizMatchingPairItem(Integer pairIndex, String prompt, Integer answerOptionIndex) {
            this(pairIndex, prompt, null, null, null, answerOptionIndex);
        }
    }

    /** Khoá của từng lựa chọn như học viên gửi lên: optionIndex, thiếu thì là vị trí trong danh sách. */
    public static List<Integer> optionKeys(List<QuizOptionItem> options) {
        List<Integer> keys = new java.util.ArrayList<>();
        for (int i = 0; options != null && i < options.size(); i++) {
            QuizOptionItem option = options.get(i);
            keys.add(option != null && option.getOptionIndex() != null ? option.getOptionIndex() : i);
        }
        return keys;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class QuizBlankItem {
        private Integer blankIndex;
        private String correctAnswer;
        private List<String> acceptedAnswers;
        private String hint;
        /** Lời giải riêng của ý (chỗ trống) này; chỉ gửi học viên sau khi nộp. */
        private String explanation;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class QuizSentenceChunkItem {
        private String content;
        private Integer correctPosition;
        private Boolean distractor;
    }
}
