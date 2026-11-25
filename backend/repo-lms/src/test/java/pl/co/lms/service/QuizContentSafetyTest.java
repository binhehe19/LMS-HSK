package pl.co.lms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import pl.co.lms.dto.request.HeartbeatAssessmentAttemptRequest;
import pl.co.lms.entity.ExerciseQuestionType;
import pl.co.lms.entity.json.QuestionContent;
import pl.co.lms.entity.json.QuestionPublicContent;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Những gì học viên được và không được nhận, và những gì backend kiểm tra khi lưu / nhận bài làm của câu nhiều ý. */
class QuizContentSafetyTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private QuizQuestion fullQuestion() throws Exception {
        QuizQuestion q = new QuizQuestion();
        q.setQuestionId("q1");
        q.setQuestionType(ExerciseQuestionType.MATCHING);
        q.setVariant("MATCHING_HEADING");
        q.setQuestionText("<p>Choose</p>");
        q.setPoints(2);
        q.setExplanation("whole-question explanation");
        q.setFiles(mapper.readTree("[{\"url\":\"/api/storage/file/f1\",\"name\":\"a.png\",\"mimeType\":\"image/png\"}]"));
        q.setMedia(mapper.readTree("[{\"kind\":\"audio\",\"url\":\"/api/storage/file/m1\",\"transcript\":[{\"speaker\":\"A\",\"start\":0,\"text\":\"secret\"}]}]"));
        q.setHints(mapper.readTree("{\"ideas\":[\"i1\"]}"));
        q.setAiRubric("IELTS_WRITING");
        q.setReferenceText("server-only reference");
        q.setTask(1);
        q.setMinimumWords(150);
        q.setOptions(List.of(new QuestionContent.QuizOptionItem(0, "Heading A", true), new QuestionContent.QuizOptionItem(1, "Heading B", false)));
        q.setMatchingPairs(List.of(new QuestionContent.QuizMatchingPairItem(0, "Paragraph 1", "Heading A", "row explanation", null, 0)));
        QuestionContent.QuizBlankItem blank = new QuestionContent.QuizBlankItem();
        blank.setBlankIndex(0);
        blank.setCorrectAnswer("secret answer");
        blank.setAcceptedAnswers(List.of("alt answer"));
        blank.setExplanation("blank explanation");
        q.setBlanks(List.of(blank));
        return q;
    }

    @Test
    void studentDuringTheAttempt_receivesDisplayFieldsButNoAnswersExplanationsTranscriptOrGradingData() throws Exception {
        String json = mapper.writeValueAsString(QuestionPublicContent.from(fullQuestion()));
        JsonNode node = mapper.readTree(json);
        assertThat(node.path("variant").asText()).isEqualTo("MATCHING_HEADING");
        assertThat(node.path("files").get(0).path("url").asText()).isEqualTo("/api/storage/file/f1");
        assertThat(node.path("media").get(0).path("url").asText()).isEqualTo("/api/storage/file/m1");
        assertThat(node.path("hints").path("ideas").get(0).asText()).isEqualTo("i1");
        assertThat(node.path("task").asInt()).isEqualTo(1);
        assertThat(node.path("minimumWords").asInt()).isEqualTo(150);
        assertThat(json).doesNotContain("transcript", "secret", "referenceText", "server-only", "aiRubric", "IELTS_WRITING",
                "explanation", "correct", "\"answer\"", "correctAnswer", "acceptedAnswers", "alt answer");
        // dữ liệu nguồn không bị đổi khi lọc
        assertThat(fullQuestion().getMedia().get(0).has("transcript")).isTrue();
    }

    @Test
    void studentAfterSubmit_receivesAnswersExplanationsAndTranscriptButNeverTheAiGradingData() throws Exception {
        String json = mapper.writeValueAsString(QuestionContent.forResult(fullQuestion()));
        assertThat(json).contains("transcript", "whole-question explanation", "row explanation", "blank explanation", "secret answer", "\"correct\":true");
        assertThat(json).doesNotContain("referenceText", "server-only", "aiRubric", "IELTS_WRITING");
    }

    @Test
    void layoutTranscriptIsHiddenUntilSubmitted() throws Exception {
        JsonNode layout = mapper.readTree("{\"version\":2,\"sections\":[{\"id\":\"s\",\"media\":[{\"kind\":\"audio\",\"url\":\"/api/storage/file/m\","
                + "\"transcript\":[{\"text\":\"secret\"}]}],\"explanation\":\"e\",\"questionIds\":[]}]}");
        assertThat(LayoutFilter.forStudent(layout, false).toString()).doesNotContain("transcript", "secret", "explanation").contains("/api/storage/file/m");
        assertThat(LayoutFilter.forStudent(layout, true).toString()).contains("transcript", "secret", "explanation");
    }

    private QuizContent quiz(QuizQuestion... questions) {
        return QuizContent.builder().title("t").questions(List.of(questions)).build();
    }

    @Test
    void validContentHasNoProblems() throws Exception {
        QuizQuestion fill = new QuizQuestion();
        fill.setQuestionId("q2");
        fill.setQuestionType(ExerciseQuestionType.FILL_IN_BLANK);
        fill.setQuestionText("a {{1}} b {{2}}");
        fill.setBlanks(List.of(blank(0), blank(1)));
        assertThat(QuizContentChecks.problems(quiz(fullQuestion(), fill))).isEmpty();
    }

    private QuestionContent.QuizBlankItem blank(int index) {
        QuestionContent.QuizBlankItem blank = new QuestionContent.QuizBlankItem();
        blank.setBlankIndex(index);
        blank.setCorrectAnswer("x");
        return blank;
    }

    @Test
    void matchingAnswerOutsideTheOptionsIsReported() throws Exception {
        QuizQuestion q = fullQuestion();
        q.setMatchingPairs(List.of(new QuestionContent.QuizMatchingPairItem(0, "P", 9)));
        assertThat(QuizContentChecks.problems(quiz(q))).anyMatch(p -> p.contains("q1") && p.contains("dòng 1"));
    }

    @Test
    void blankMarkersMustMatchTheBlanks() {
        QuizQuestion q = new QuizQuestion();
        q.setQuestionId("q3");
        q.setQuestionType(ExerciseQuestionType.FILL_IN_BLANK);
        q.setBlanks(List.of(blank(0), blank(1)));
        q.setQuestionText("only {{1}}");
        assertThat(QuizContentChecks.problems(quiz(q))).isNotEmpty();
        q.setQuestionText("{{1}} {{1}} {{2}}");
        assertThat(QuizContentChecks.problems(quiz(q))).isNotEmpty();
        q.setQuestionText("{{1}} {{2}} {{3}}");
        assertThat(QuizContentChecks.problems(quiz(q))).isNotEmpty();
    }

    @Test
    void onlyInternalStoragePathsAreAcceptedForFilesAndMedia() throws Exception {
        for (String bad : List.of("https://evil.test/x.mp3", "javascript:alert(1)", "data:text/html;base64,AAA", "//evil.test/x", "/api/storage/file/../x")) {
            QuizQuestion q = fullQuestion();
            q.setFiles(mapper.readTree("[{\"url\":\"" + bad + "\",\"name\":\"n\",\"mimeType\":\"image/png\"}]"));
            assertThat(QuizContentChecks.problems(quiz(q))).as(bad).isNotEmpty();
            q = fullQuestion();
            q.setMedia(mapper.readTree("[{\"kind\":\"audio\",\"url\":\"" + bad + "\"}]"));
            assertThat(QuizContentChecks.problems(quiz(q))).as(bad).isNotEmpty();
        }
        QuizQuestion unknownKind = fullQuestion();
        unknownKind.setMedia(mapper.readTree("[{\"kind\":\"script\",\"url\":\"/api/storage/file/m1\"}]"));
        assertThat(QuizContentChecks.problems(quiz(unknownKind))).isNotEmpty();
    }

    @Test
    void optionAndMatchingImagesReachTheStudentButNotWhichChoiceIsRight() throws Exception {
        QuizQuestion q = fullQuestion();
        q.setOptions(List.of(new QuestionContent.QuizOptionItem(0, "A", null, "/api/storage/file/cat"),
                new QuestionContent.QuizOptionItem(1, "A", null, "/api/storage/file/dog")));
        q.setMatchingPairs(List.of(new QuestionContent.QuizMatchingPairItem(0, "Paragraph 1", null, null, "/api/storage/file/left1", 1)));
        String json = mapper.writeValueAsString(QuestionPublicContent.from(q));
        assertThat(json).contains("/api/storage/file/cat", "/api/storage/file/dog", "/api/storage/file/left1").doesNotContain("answerOptionIndex");
        assertThat(mapper.writeValueAsString(QuestionContent.forResult(q))).contains("\"answerOptionIndex\":1");
        // Hai lựa chọn trùng chữ "A" vẫn hợp lệ vì đáp án là chỉ số.
        assertThat(QuizContentChecks.problems(quiz(q))).isEmpty();
    }

    @Test
    void optionAndMatchingImagesMustBeInternalStoragePaths() throws Exception {
        QuizQuestion q = fullQuestion();
        q.setOptions(List.of(new QuestionContent.QuizOptionItem(0, "Heading A", true, "https://cdn.test/a.png")));
        assertThat(QuizContentChecks.problems(quiz(q))).anyMatch(p -> p.contains("ảnh của lựa chọn"));
        q = fullQuestion();
        q.setMatchingPairs(List.of(new QuestionContent.QuizMatchingPairItem(0, "P", null, null, "javascript:alert(1)", 0)));
        assertThat(QuizContentChecks.problems(quiz(q))).anyMatch(p -> p.contains("ảnh của lựa chọn"));
    }

    @Test
    void sectionFilesAndMediaInTheLayoutAreCheckedToo() throws Exception {
        QuizContent content = QuizContent.builder().title("t").questions(List.of())
                .layout(mapper.readTree("{\"version\":2,\"sections\":[{\"id\":\"s\",\"files\":[{\"url\":\"https://x.test/a.png\"}],\"questionIds\":[]}]}")).build();
        assertThat(QuizContentChecks.problems(content)).anyMatch(p -> p.contains("Phần s"));
    }

    @Test
    void sanitizerKeepsOnlyRealPartsOfMultiPartAnswers() throws Exception {
        QuizAnswerSanitizer sanitizer = new QuizAnswerSanitizer(mapper);
        QuizQuestion fill = new QuizQuestion();
        fill.setQuestionId("q2");
        fill.setQuestionType(ExerciseQuestionType.FILL_IN_BLANK);
        fill.setBlanks(List.of(blank(0), blank(1)));
        QuizContent content = quiz(fullQuestion(), fill);
        String longText = "x".repeat(5000);
        var items = List.of(
                new HeartbeatAssessmentAttemptRequest.AnswerItem("q1", "{\"matchingAnswers\":{\"0\":0,\"7\":1,\"junk\":0}}"),
                new HeartbeatAssessmentAttemptRequest.AnswerItem("q2", "{\"blankAnswers\":{\"0\":\"" + longText + "\",\"1\":5}}"),
                new HeartbeatAssessmentAttemptRequest.AnswerItem("q2", "{\"blankAnswers\":{\"9\":\"nope\"}}"));
        var out = sanitizer.sanitize(content, items);
        assertThat(mapper.readTree(out.get(0).answerJson()).path("matchingAnswers").fieldNames()).toIterable().containsExactly("0");
        JsonNode blanks = mapper.readTree(out.get(1).answerJson()).path("blankAnswers");
        assertThat(blanks.path("0").asText()).hasSize(1000);
        assertThat(blanks.has("1")).isFalse();
        assertThat(out.get(2).answerJson()).isEmpty();
    }

    @Test
    void reservedKeysAreStrippedAtAnyDepthOfFilesMediaAndHints() throws Exception {
        QuizQuestion q = fullQuestion();
        q.setHints(mapper.readTree("{\"ideas\":[\"i\"],\"nested\":{\"transcript\":\"leak\",\"explanation\":\"leak2\"}}"));
        q.setMedia(mapper.readTree("[{\"kind\":\"audio\",\"url\":\"/api/storage/file/m1\",\"tracks\":[{\"transcript\":\"leak3\"}]}]"));
        String json = mapper.writeValueAsString(QuestionPublicContent.from(q));
        assertThat(json).doesNotContain("leak", "transcript", "explanation").contains("\"ideas\"");
    }

    @Test
    void duplicateOrNegativeIndexesAreReported() {
        QuizQuestion fill = new QuizQuestion();
        fill.setQuestionId("q4");
        fill.setQuestionType(ExerciseQuestionType.FILL_IN_BLANK);
        fill.setQuestionText("{{1}}");
        fill.setBlanks(List.of(blank(0), blank(0)));
        assertThat(QuizContentChecks.problems(quiz(fill))).isNotEmpty();
        fill.setBlanks(List.of(blank(-1)));
        fill.setQuestionText("{{0}}");
        assertThat(QuizContentChecks.problems(quiz(fill))).isNotEmpty();
        fill.setQuestionText("{{99999999999}}");
        fill.setBlanks(List.of(blank(0)));
        assertThat(QuizContentChecks.problems(quiz(fill))).isNotEmpty();

        QuizQuestion match = new QuizQuestion();
        match.setQuestionId("q5");
        match.setQuestionType(ExerciseQuestionType.MATCHING);
        match.setOptions(List.of(new QuestionContent.QuizOptionItem(0, "A", null)));
        match.setMatchingPairs(List.of(new QuestionContent.QuizMatchingPairItem(1, "p", 0), new QuestionContent.QuizMatchingPairItem(1, "q", 0)));
        assertThat(QuizContentChecks.problems(quiz(match))).anyMatch(p -> p.contains("trùng"));
    }
}