package pl.co.lms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import pl.co.lms.dto.response.PartResult;
import pl.co.lms.entity.ExerciseQuestionType;
import pl.co.lms.entity.json.QuestionContent;
import pl.co.lms.service.grading.QuestionAutoGrader;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class QuestionAutoGraderTest {

    private QuestionAutoGrader grader;

    @BeforeEach
    void setUp() {
        grader = new QuestionAutoGrader(new ObjectMapper());
    }

    // ── MULTIPLE_CHOICE ──────────────────────────────────────────────────────

    @Test
    void multipleChoice_correctAnswer_fullMark() throws Exception {
        QuestionContent q = multipleChoiceQ();
        String answer = """
                {"selectedOptionIndex": 1}
                """;
        assertThat(grader.grade(q, answer, BigDecimal.TEN)).isEqualByComparingTo("10");
    }

    @Test
    void multipleChoice_wrongAnswer_zero() throws Exception {
        QuestionContent q = multipleChoiceQ();
        String answer = """
                {"selectedOptionIndex": 0}
                """;
        assertThat(grader.grade(q, answer, BigDecimal.TEN)).isEqualByComparingTo("0");
    }

    // ── MATCHING: mỗi dòng là một ý, chia đều điểm ───────────────────────────

    @Test
    void matching_scoresEachRowAndReportsParts() {
        QuestionContent q = matchingQ(); // 3 dòng, đáp án theo optionIndex: 1 (B), 0 (A), 1 (B)
        String answer = "{\"matchingAnswers\":{\"0\":1,\"1\":2,\"2\":1}}";
        assertThat(grader.canAutoGrade(q)).isTrue();
        // 2/3 ý đúng → 5 × 2 ÷ 3 = 3.33
        assertThat(grader.grade(q, answer, BigDecimal.valueOf(5))).isEqualByComparingTo("3.33");
        assertThat(grader.partResults(q, answer)).containsExactly(
                new PartResult(0, true), new PartResult(1, false), new PartResult(2, true));
    }

    @Test
    void matching_unansweredRowsCountAsWrong() {
        QuestionContent q = matchingQ();
        assertThat(grader.grade(q, "{\"matchingAnswers\":{\"1\":0}}", BigDecimal.valueOf(3))).isEqualByComparingTo("1");
        assertThat(grader.partResults(q, null)).extracting(PartResult::correct).containsExactly(false, false, false);
    }

    @Test
    void matching_gradesByOptionIndexSoSameTextChoicesStayDistinct() {
        // Hai tranh cùng nhãn "A" (khác ảnh): chọn đúng tranh mới được điểm; gửi chữ thay vì chỉ số thì không tính.
        QuestionContent q = new QuestionContent();
        q.setQuestionType(ExerciseQuestionType.MATCHING);
        q.setOptions(List.of(
                new QuestionContent.QuizOptionItem(0, "A", null, "/api/storage/file/cat"),
                new QuestionContent.QuizOptionItem(1, "A", null, "/api/storage/file/dog")));
        q.setMatchingPairs(List.of(new QuestionContent.QuizMatchingPairItem(0, "狗", 1)));
        assertThat(grader.grade(q, "{\"matchingAnswers\":{\"0\":1}}", BigDecimal.ONE)).isEqualByComparingTo("1");
        assertThat(grader.grade(q, "{\"matchingAnswers\":{\"0\":0}}", BigDecimal.ONE)).isEqualByComparingTo("0");
        assertThat(grader.grade(q, "{\"matchingAnswers\":{\"0\":\"A\"}}", BigDecimal.ONE)).isEqualByComparingTo("0");
    }

    @Test
    void matching_trueFalseNotGivenIsOneRowMatching() {
        QuestionContent q = new QuestionContent();
        q.setQuestionType(ExerciseQuestionType.MATCHING);
        q.setVariant("TRUE_FALSE_NOT_GIVEN");
        q.setOptions(List.of(
                new QuestionContent.QuizOptionItem(0, "TRUE", null),
                new QuestionContent.QuizOptionItem(1, "FALSE", null),
                new QuestionContent.QuizOptionItem(2, "NOT GIVEN", null)));
        q.setMatchingPairs(List.of(new QuestionContent.QuizMatchingPairItem(0, "The statement.", 2)));
        assertThat(grader.grade(q, "{\"matchingAnswers\":{\"0\":2}}", BigDecimal.ONE)).isEqualByComparingTo("1");
        assertThat(grader.grade(q, "{\"matchingAnswers\":{\"0\":0}}", BigDecimal.ONE)).isEqualByComparingTo("0");
    }

    @Test
    void fillInBlank_scoresEachBlankAndReportsParts() {
        QuestionContent q = new QuestionContent();
        q.setQuestionType(ExerciseQuestionType.FILL_IN_BLANK);
        q.setQuestionText("It opened in {{1}} and closed in {{2}}, then {{3}} {{4}}.");
        q.setBlanks(List.of(blank(0, "1998", List.of("nineteen ninety-eight")), blank(1, "2004", null),
                blank(2, "re", null), blank(3, "opened", null)));
        String answer = "{\"blankAnswers\":{\"0\":\"Nineteen Ninety-Eight\",\"1\":\"2005\",\"2\":\"re\"}}";
        // 2/4 ý đúng → 8 × 2 ÷ 4 = 4
        assertThat(grader.grade(q, answer, BigDecimal.valueOf(8))).isEqualByComparingTo("4");
        assertThat(grader.partResults(q, answer)).extracting(PartResult::correct).containsExactly(true, false, true, false);
    }

    @Test
    void partResults_isEmptyForOtherTypes() {
        assertThat(grader.partResults(multipleChoiceQ(), "{\"selectedOptionIndex\":1}")).isEmpty();
    }
    // ── Chuẩn so khớp văn bản (dùng chung cho Reading/Listening) ─────────────

    @Test
    void fillInBlank_ignoresCaseUnicodeWhitespaceAndNormalizationForm() {
        QuestionContent q = new QuestionContent();
        q.setQuestionType(ExerciseQuestionType.FILL_IN_BLANK);
        q.setQuestionText("{{blank}}");
        QuestionContent.QuizBlankItem blank = new QuestionContent.QuizBlankItem();
        blank.setBlankIndex(0);
        blank.setCorrectAnswer("café");
        blank.setAcceptedAnswers(List.of("silver membership"));
        q.setBlanks(List.of(blank));
        assertThat(grader.grade(q, "{\"blankAnswers\":{\"0\":\"  CAFE\\u0301 \"}}", BigDecimal.ONE)).isEqualByComparingTo("1");
        assertThat(grader.grade(q, "{\"blankAnswers\":{\"0\":\" SILVER\\u00a0 MEMBERSHIP \"}}", BigDecimal.ONE)).isEqualByComparingTo("1");
        assertThat(grader.grade(q, "{\"blankAnswers\":{\"0\":\"cafe\"}}", BigDecimal.ONE)).isEqualByComparingTo("0");
    }

    // ── MULTIPLE_SELECT ──────────────────────────────────────────────────────

    @Test
    void multipleSelect_allCorrect_fullMark() throws Exception {
        QuestionContent q = multipleSelectQ(); // correct: 0, 2
        String answer = """
                {"selectedOptionIndexes": [0, 2]}
                """;
        assertThat(grader.grade(q, answer, BigDecimal.TEN)).isEqualByComparingTo("10");
    }

    @Test
    void multipleSelect_oneCorrectOneFalse_halfMark() throws Exception {
        QuestionContent q = multipleSelectQ(); // correct: 0, 2
        // chọn đúng 1 (index 0), sai 1 (index 1) → net = 1 - 1 = 0
        String answer = """
                {"selectedOptionIndexes": [0, 1]}
                """;
        assertThat(grader.grade(q, answer, BigDecimal.TEN)).isEqualByComparingTo("0");
    }

    @Test
    void multipleSelect_oneCorrectNoFalse_halfMark() throws Exception {
        QuestionContent q = multipleSelectQ(); // correct: 0, 2 (total 2 correct)
        String answer = """
                {"selectedOptionIndexes": [0]}
                """;
        // net = 1 correct - 0 false = 1; partial(10, 1, 2) = 5
        assertThat(grader.grade(q, answer, BigDecimal.TEN)).isEqualByComparingTo("5.00");
    }

    @Test
    void multipleSelect_noAnswer_zero() {
        QuestionContent q = multipleSelectQ();
        assertThat(grader.grade(q, "{}", BigDecimal.TEN)).isEqualByComparingTo("0");
    }

    // ── ESSAY / FILE_UPLOAD: canAutoGrade = false ────────────────────────────

    @Test
    void essay_canAutoGrade_false() {
        QuestionContent q = new QuestionContent();
        q.setQuestionType(ExerciseQuestionType.ESSAY);
        assertThat(grader.canAutoGrade(q)).isFalse();
    }

    @Test
    void fileUpload_canAutoGrade_false() {
        QuestionContent q = new QuestionContent();
        q.setQuestionType(ExerciseQuestionType.FILE_UPLOAD);
        assertThat(grader.canAutoGrade(q)).isFalse();
    }

    @Test
    void essay_grade_zero_regardless() {
        QuestionContent q = new QuestionContent();
        q.setQuestionType(ExerciseQuestionType.ESSAY);
        assertThat(grader.grade(q, "{\"text\":\"any answer\"}", BigDecimal.TEN)).isEqualByComparingTo("0");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private QuestionContent matchingQ() {
        QuestionContent q = new QuestionContent();
        q.setQuestionType(ExerciseQuestionType.MATCHING);
        q.setQuestionText("Choose the correct heading.");
        q.setOptions(List.of(
                new QuestionContent.QuizOptionItem(0, "Heading A", null),
                new QuestionContent.QuizOptionItem(1, "Heading B", null),
                new QuestionContent.QuizOptionItem(2, "Heading C", null)));
        q.setMatchingPairs(List.of(
                new QuestionContent.QuizMatchingPairItem(0, "Paragraph 1", 1),
                new QuestionContent.QuizMatchingPairItem(1, "Paragraph 2", 0),
                new QuestionContent.QuizMatchingPairItem(2, "Paragraph 3", 1)));
        return q;
    }

    private QuestionContent.QuizBlankItem blank(int index, String answer, List<String> accepted) {
        QuestionContent.QuizBlankItem blank = new QuestionContent.QuizBlankItem();
        blank.setBlankIndex(index);
        blank.setCorrectAnswer(answer);
        blank.setAcceptedAnswers(accepted);
        return blank;
    }

    private QuestionContent multipleChoiceQ() {
        QuestionContent q = new QuestionContent();
        q.setQuestionType(ExerciseQuestionType.MULTIPLE_CHOICE);
        q.setQuestionText("What is 2+2?");
        q.setOptions(List.of(
                new QuestionContent.QuizOptionItem(0, "3", false),
                new QuestionContent.QuizOptionItem(1, "4", true),
                new QuestionContent.QuizOptionItem(2, "5", false)
        ));
        return q;
    }

    private QuestionContent multipleSelectQ() {
        QuestionContent q = new QuestionContent();
        q.setQuestionType(ExerciseQuestionType.MULTIPLE_SELECT);
        q.setQuestionText("Which are fruits?");
        q.setOptions(List.of(
                new QuestionContent.QuizOptionItem(0, "Apple", true),
                new QuestionContent.QuizOptionItem(1, "Carrot", false),
                new QuestionContent.QuizOptionItem(2, "Banana", true)
        ));
        return q;
    }
}
