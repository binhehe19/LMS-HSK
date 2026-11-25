package pl.co.lms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;

import static org.assertj.core.api.Assertions.assertThat;

class QuizLayoutIntegrityTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private static QuizQuestion q(String id) {
        QuizQuestion question = new QuizQuestion();
        question.setQuestionId(id);
        return question;
    }

    private QuizContent quiz(String layoutJson, String... questionIds) throws Exception {
        return QuizContent.builder().title("t")
                .questions(java.util.Arrays.stream(questionIds).map(QuizLayoutIntegrityTest::q).toList())
                .layout(layoutJson == null ? null : mapper.readTree(layoutJson)).build();
    }

    @Test
    void consistentLayout_hasNoViolations() throws Exception {
        var content = quiz("""
                {"version":2,"sections":[{"id":"s1","questionIds":["a","b"]}]}""", "a", "b");
        assertThat(QuizLayoutIntegrity.violations(content)).isEmpty();
    }

    @Test
    void layoutPointingToMissingQuestion_isReportedWithTheId() throws Exception {
        var content = quiz("""
                {"version":2,"sections":[{"id":"s1","questionIds":["a","ghost"]}]}""", "a");
        assertThat(QuizLayoutIntegrity.violations(content)).anyMatch(v -> v.contains("ghost"));
    }

    @Test
    void questionNotShownInLayout_isReportedWithTheId() throws Exception {
        var content = quiz("""
                {"version":2,"sections":[{"id":"s1","questionIds":["a"]}]}""", "a", "orphan");
        assertThat(QuizLayoutIntegrity.violations(content)).anyMatch(v -> v.contains("orphan"));
    }

    @Test
    void questionReferencedTwice_isReported() throws Exception {
        var content = quiz("""
                {"version":2,"sections":[{"id":"s1","questionIds":["a"]},{"id":"s2","questionIds":["a"]}]}""", "a");
        assertThat(QuizLayoutIntegrity.violations(content)).anyMatch(v -> v.contains("a") && v.contains("nhiều lần"));
    }

    @Test
    void duplicateSectionIds_areReported() throws Exception {
        var content = quiz("""
                {"version":2,"sections":[{"id":"s1","questionIds":["a"]},{"id":"s1","questionIds":["b"]}]}""", "a", "b");
        assertThat(QuizLayoutIntegrity.violations(content)).anyMatch(v -> v.contains("s1"));
    }

    @Test
    void v2SectionWithoutQuestionIds_isReported_evenWhenNothingElseIsReferenced() throws Exception {
        var content = quiz("""
                {"version":2,"sections":[{"id":"s1"}]}""", "a");
        assertThat(QuizLayoutIntegrity.violations(content)).anyMatch(v -> v.contains("questionIds") && v.contains("s1"));
    }

    @Test
    void v2SectionMayHaveAnEmptyQuestionList() throws Exception {
        var content = quiz("""
                {"version":2,"sections":[{"id":"intro","questionIds":[]},{"id":"s1","questionIds":["a"]}]}""", "a");
        assertThat(QuizLayoutIntegrity.violations(content)).isEmpty();
    }

    @Test
    void oldGroupShapedLayout_isNoLongerReadAsReferences() throws Exception {
        // Layout cũ (không version 2) chỉ có groups: backend không còn hiểu nhóm nên coi như không tham chiếu câu nào.
        var content = quiz("""
                {"sections":[{"id":"s1","groups":[{"id":"g1","questions":[{"questionId":"ghost"}]}]}]}""", "a");
        assertThat(QuizLayoutIntegrity.violations(content)).isEmpty();
    }

    @Test
    void placementShapedLayout_usingQuestionIds_isChecked() throws Exception {
        var ok = quiz("""
                {"sections":[{"id":"x","questionIds":["a"]},{"id":"y","questionIds":["b"]}]}""", "a", "b");
        assertThat(QuizLayoutIntegrity.violations(ok)).isEmpty();
        var bad = quiz("""
                {"sections":[{"id":"x","questionIds":["a"]}]}""", "a", "b");
        assertThat(QuizLayoutIntegrity.violations(bad)).anyMatch(v -> v.contains("b"));
    }

    @Test
    void flatQuizWithoutLayoutSections_isSkipped() throws Exception {
        assertThat(QuizLayoutIntegrity.violations(quiz(null, "a", "b"))).isEmpty();
        assertThat(QuizLayoutIntegrity.violations(quiz("{\"meta\":{}}", "a"))).isEmpty();
        assertThat(QuizLayoutIntegrity.violations(quiz("{\"sections\":[{\"id\":\"s\"}]}", "a"))).isEmpty();
    }

    @Test
    void message_listsAllViolationsAndCapsLongLists() throws Exception {
        var content = quiz("""
                {"version":2,"sections":[{"id":"s1","questionIds":["a"]}]}""", "a", "o1", "o2");
        var message = QuizLayoutIntegrity.message(QuizLayoutIntegrity.violations(content));
        assertThat(message).contains("o1", "o2");
        var many = java.util.stream.IntStream.range(0, 50).mapToObj(i -> "lỗi " + i).toList();
        assertThat(QuizLayoutIntegrity.message(many)).contains("lỗi 0").doesNotContain("lỗi 49").contains("50");
    }
}
