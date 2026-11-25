package pl.co.lms.entity.json;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.co.lms.entity.ExerciseQuestionType;
import pl.co.lms.service.LayoutFilter;

import java.util.List;

// Nội dung câu hỏi an toàn để trả về client khi học viên ĐANG làm bài: danh sách cho phép (từng trường được liệt kê rõ).
// Dùng trong response của POST /assessment-attempts; KHÔNG dùng trong admin API.
// Trường mới của câu hỏi phải được thêm vào đây thì học viên mới nhận được; mặc định là bị giấu.
// Không có: correct, answer, correctAnswer, acceptedAnswers, correctPosition, correctSentence, explanation (từng ý và cả câu),
// aiRubric, referenceText, media[].transcript (chỉ có sau khi nộp, xem QuestionContent.forResult).
@Getter
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class QuestionPublicContent {
    private ExerciseQuestionType questionType;
    private String variant;
    private String questionText;
    private JsonNode files;
    private JsonNode media;
    private JsonNode hints;
    private String sentenceTemplate;
    private String translationHint;
    private Integer points;
    private Integer task;
    private Integer minimumWords;
    private List<OptionItem> options;
    private List<MatchingPromptItem> matchingPairs;
    private List<BlankItem> blanks;
    private List<SentenceChunkItem> sentenceChunks;
    // FILE_UPLOAD: thông tin hiển thị cho học viên
    private Integer maxFiles;
    private Long maxFileSizeBytes;
    private List<String> acceptedMimeTypes;

    @Getter
    @NoArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class OptionItem {
        private Integer optionIndex;
        private String content;
        private String mediaUrl;
        // correct bị bỏ
    }

    @Getter
    @NoArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MatchingPromptItem {
        private Integer pairIndex;
        private String prompt;
        private String promptMediaUrl;
        // answer, answerOptionIndex, explanation bị bỏ
    }

    @Getter
    @NoArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class BlankItem {
        private Integer blankIndex;
        private String hint;
        // correctAnswer, acceptedAnswers, explanation bị bỏ
    }

    @Getter
    @NoArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SentenceChunkItem {
        private String content;
        private Boolean distractor;
        // correctPosition bị bỏ
    }

    // Tạo từ QuizQuestion (nội dung câu trong QUIZ resource), chỉ giữ lại các trường công khai.
    public static QuestionPublicContent from(QuizQuestion q) {
        return from(QuestionContent.from(q));
    }

    // Tạo từ QuestionContent đầy đủ, chỉ giữ lại các trường công khai.
    public static QuestionPublicContent from(QuestionContent full) {
        if (full == null) return null;
        QuestionPublicContent pub = new QuestionPublicContent();
        pub.questionType = full.getQuestionType();
        pub.variant = full.getVariant();
        pub.questionText = full.getQuestionText();
        // files/media/hints là JSON mờ: lọc như layout (bỏ grading/explanation/transcript ở mọi độ sâu) để tác giả không lỡ để lộ lời giải.
        pub.files = LayoutFilter.forStudent(full.getFiles(), false);
        pub.media = LayoutFilter.forStudent(full.getMedia(), false);
        pub.hints = LayoutFilter.forStudent(full.getHints(), false);
        pub.sentenceTemplate = full.getSentenceTemplate();
        pub.translationHint = full.getTranslationHint();
        pub.points = full.getPoints();
        pub.task = full.getTask();
        pub.minimumWords = full.getMinimumWords();

        if (full.getOptions() != null) {
            pub.options = full.getOptions().stream().map(o -> {
                OptionItem item = new OptionItem();
                item.optionIndex = o.getOptionIndex();
                item.content = o.getContent();
                item.mediaUrl = o.getMediaUrl();
                return item;
            }).toList();
        }
        if (full.getMatchingPairs() != null) {
            pub.matchingPairs = full.getMatchingPairs().stream().map(p -> {
                MatchingPromptItem item = new MatchingPromptItem();
                item.pairIndex = p.getPairIndex();
                item.prompt = p.getPrompt();
                item.promptMediaUrl = p.getPromptMediaUrl();
                return item;
            }).toList();
        }
        if (full.getBlanks() != null) {
            pub.blanks = full.getBlanks().stream().map(b -> {
                BlankItem item = new BlankItem();
                item.blankIndex = b.getBlankIndex();
                item.hint = b.getHint();
                return item;
            }).toList();
        }
        if (full.getSentenceChunks() != null) {
            pub.sentenceChunks = full.getSentenceChunks().stream().map(c -> {
                SentenceChunkItem item = new SentenceChunkItem();
                item.content = c.getContent();
                item.distractor = c.getDistractor();
                return item;
            }).toList();
        }
        pub.maxFiles = full.getMaxFiles();
        pub.maxFileSizeBytes = full.getMaxFileSizeBytes();
        pub.acceptedMimeTypes = full.getAcceptedMimeTypes();
        return pub;
    }
}
