package pl.co.lms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import pl.co.lms.dto.request.HeartbeatAssessmentAttemptRequest.AnswerItem;
import pl.co.lms.entity.ExerciseQuestionType;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class QuizAnswerSanitizerTest {

    private final QuizAnswerSanitizer sanitizer = new QuizAnswerSanitizer(new ObjectMapper());

    private static QuizContent quiz(QuizQuestion... questions) {
        QuizContent quiz = new QuizContent();
        quiz.setQuestions(List.of(questions));
        return quiz;
    }

    private static QuizQuestion question(String id, ExerciseQuestionType type, Integer maxFiles) {
        return QuizQuestion.builder().questionId(id).questionType(type).maxFiles(maxFiles).build();
    }

    private String clean(QuizContent quiz, String questionId, String answerJson) {
        return sanitizer.sanitize(quiz, List.of(new AnswerItem(questionId, answerJson))).get(0).answerJson();
    }

    @Test
    void fileUpload_KeepsOnlyMaxFilesAndKnownFields() {
        QuizContent quiz = quiz(question("q", ExerciseQuestionType.FILE_UPLOAD, 2));
        String json = "{\"files\":[{\"fileId\":\"a\",\"fileName\":\"a.pdf\",\"mimeType\":\"application/pdf\",\"sizeBytes\":10,\"evil\":\"x\"},"
                + "{\"fileId\":\"b\"},{\"fileId\":\"c\"}]}";

        assertThat(clean(quiz, "q", json))
                .isEqualTo("{\"files\":[{\"fileId\":\"a\",\"fileName\":\"a.pdf\",\"mimeType\":\"application/pdf\",\"sizeBytes\":10},{\"fileId\":\"b\"}]}");
    }

    @Test
    void fileUpload_DefaultLimitIsThreeWhenQuestionHasNone() {
        QuizContent quiz = quiz(question("q", ExerciseQuestionType.FILE_UPLOAD, null));
        String json = "{\"files\":[{\"fileId\":\"1\"},{\"fileId\":\"2\"},{\"fileId\":\"3\"},{\"fileId\":\"4\"}]}";

        assertThat(clean(quiz, "q", json)).doesNotContain("\"4\"").contains("\"3\"");
    }

    @Test
    void fileUpload_InvalidShapeBecomesEmptyAnswer() {
        QuizContent quiz = quiz(question("q", ExerciseQuestionType.FILE_UPLOAD, 3));

        assertThat(clean(quiz, "q", "not json")).isEmpty();
        assertThat(clean(quiz, "q", "{\"files\":\"x\"}")).isEmpty();
        assertThat(clean(quiz, "q", "{\"files\":[{\"fileName\":\"no-id\"},{\"fileId\":\"\"}]}")).isEmpty();
        assertThat(clean(quiz, "q", null)).isEmpty();
    }

    @Test
    void audio_KeepsFileRefAndDuration() {
        QuizContent quiz = quiz(question("q", ExerciseQuestionType.AUDIO_RESPONSE, null));
        String json = "{\"audio\":{\"fileId\":\"f1\",\"mimeType\":\"audio/webm\",\"sizeBytes\":2048,\"durationSeconds\":12.5,\"x\":1}}";

        assertThat(clean(quiz, "q", json))
                .isEqualTo("{\"audio\":{\"fileId\":\"f1\",\"mimeType\":\"audio/webm\",\"sizeBytes\":2048,\"durationSeconds\":12.5}}");
    }

    @Test
    void audio_WithoutFileIdBecomesEmptyAnswer() {
        QuizContent quiz = quiz(question("q", ExerciseQuestionType.AUDIO_RESPONSE, null));

        assertThat(clean(quiz, "q", "{\"audio\":{\"mimeType\":\"audio/webm\"}}")).isEmpty();
    }

    @Test
    void otherQuestionTypesAndUnknownQuestionsAreUntouched() {
        QuizContent quiz = quiz(question("mc", ExerciseQuestionType.MULTIPLE_CHOICE, null));

        assertThat(clean(quiz, "mc", "{\"selectedOptionIndex\":1}")).isEqualTo("{\"selectedOptionIndex\":1}");
        assertThat(clean(quiz, "unknown", "anything")).isEqualTo("anything");
    }

    @Test
    void nullQuizReturnsItemsUnchanged() {
        List<AnswerItem> items = List.of(new AnswerItem("q", "x"));

        assertThat(sanitizer.sanitize(null, items)).isEqualTo(items);
    }
}
