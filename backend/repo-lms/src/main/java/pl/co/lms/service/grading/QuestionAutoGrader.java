package pl.co.lms.service.grading;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.MissingNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.co.lms.dto.response.PartResult;
import pl.co.lms.entity.json.QuestionContent;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.regex.Pattern;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

// Chấm tự động từng câu bằng đáp án đúng trong QuestionContent (chỉ chạy phía server).
// answerJson theo chỉ số, đúng định dạng FE gửi: selectedOptionIndex, matchingAnswers{pairIndex:optionIndex} (so chỉ số, không so chữ),
// blankAnswers{blankIndex:text}, chunkOrder[chỉ số trong sentenceChunks], text.
@Component
@RequiredArgsConstructor
public class QuestionAutoGrader {

    private static final int SCORE_SCALE = 2;
    private static final Pattern WHITESPACE = Pattern.compile("[\\p{Z}\\s]+");

    private final ObjectMapper objectMapper;

    // Có ít nhất một giá trị không rỗng trong answerJson (bỏ trống thì chấm 0 điểm, không cần người/AI).
    public boolean isAnswered(String answerJson) {
        return hasContent(parse(answerJson));
    }

    // Câu có đủ dữ liệu đáp án đúng để máy chấm; thiếu thì chuyển sang chấm tay.
    public boolean canAutoGrade(QuestionContent q) {
        if (q == null || q.getQuestionType() == null) return false;
        return switch (q.getQuestionType()) {
            case MULTIPLE_CHOICE, MULTIPLE_SELECT -> !correctOptionIndexes(q).isEmpty();
            case MATCHING -> notEmpty(q.getMatchingPairs());
            case FILL_IN_BLANK -> notEmpty(q.getBlanks());
            case SENTENCE_BUILDER -> !expectedChunkOrder(q).isEmpty();
            case AUDIO_RESPONSE, ESSAY, FILE_UPLOAD -> false;
        };
    }

    // Điểm đạt được trong [0, max]. Câu sai định dạng hoặc thiếu dữ liệu tính là 0.
    public BigDecimal grade(QuestionContent q, String answerJson, BigDecimal max) {
        JsonNode answer = parse(answerJson);
        if (!hasContent(answer) || q == null || q.getQuestionType() == null) return BigDecimal.ZERO;
        return switch (q.getQuestionType()) {
            case MULTIPLE_CHOICE -> multipleChoice(q, answer, max);
            case MULTIPLE_SELECT -> multipleSelect(q, answer, max);
            case MATCHING -> byParts(matchingParts(q, answer), max);
            case FILL_IN_BLANK -> byParts(blankParts(q, answer), max);
            case SENTENCE_BUILDER -> sentenceBuilder(q, answer, max);
            case AUDIO_RESPONSE, ESSAY, FILE_UPLOAD -> BigDecimal.ZERO;
        };
    }

    private BigDecimal multipleChoice(QuestionContent q, JsonNode answer, BigDecimal max) {
        JsonNode selected = answer.path("selectedOptionIndex");
        if (!selected.isIntegralNumber()) return BigDecimal.ZERO;
        Set<Integer> correct = correctOptionIndexes(q);
        return correct.equals(Set.of(selected.asInt())) ? max : BigDecimal.ZERO;
    }

    // MULTIPLE_SELECT: điểm tỉ lệ = (đúng chọn − sai chọn) / tổng đúng, sàn 0.
    // selectedOptionIndexes là mảng số nguyên từ FE.
    private BigDecimal multipleSelect(QuestionContent q, JsonNode answer, BigDecimal max) {
        Set<Integer> correct = correctOptionIndexes(q);
        if (correct.isEmpty()) return BigDecimal.ZERO;
        JsonNode selected = answer.path("selectedOptionIndexes");
        if (!selected.isArray()) return BigDecimal.ZERO;
        Set<Integer> chosen = new HashSet<>();
        for (JsonNode n : selected) {
            if (n.isIntegralNumber()) chosen.add(n.asInt());
        }
        long truePositive = chosen.stream().filter(correct::contains).count();
        long falsePositive = chosen.stream().filter(i -> !correct.contains(i)).count();
        long net = truePositive - falsePositive;
        if (net <= 0) return BigDecimal.ZERO;
        return partial(max, (int) net, correct.size());
    }

    // Đúng/sai từng ý của câu nối hoặc câu điền chỗ trống theo thứ tự matchingPairs / blanks; câu loại khác trả danh sách rỗng.
    // Dùng chung cho chấm điểm và cho phản hồi kết quả (parts[]), để điểm và dấu đúng/sai luôn khớp nhau.
    public List<PartResult> partResults(QuestionContent q, String answerJson) {
        if (q == null || q.getQuestionType() == null) return List.of();
        JsonNode answer = parse(answerJson);
        return switch (q.getQuestionType()) {
            case MATCHING -> matchingParts(q, answer);
            case FILL_IN_BLANK -> blankParts(q, answer);
            default -> List.of();
        };
    }

    private List<PartResult> matchingParts(QuestionContent q, JsonNode answer) {
        List<QuestionContent.QuizMatchingPairItem> pairs = q.getMatchingPairs();
        if (!notEmpty(pairs)) return List.of();
        JsonNode given = answer == null ? MissingNode.getInstance() : answer.path("matchingAnswers");
        List<PartResult> parts = new ArrayList<>(pairs.size());
        for (int i = 0; i < pairs.size(); i++) {
            QuestionContent.QuizMatchingPairItem pair = pairs.get(i);
            int key = pair.getPairIndex() != null ? pair.getPairIndex() : i;
            JsonNode chosen = given.path(String.valueOf(key));
            parts.add(new PartResult(key, pair.getAnswerOptionIndex() != null && chosen.isIntegralNumber()
                    && chosen.asInt() == pair.getAnswerOptionIndex()));
        }
        return parts;
    }

    private List<PartResult> blankParts(QuestionContent q, JsonNode answer) {
        List<QuestionContent.QuizBlankItem> blanks = q.getBlanks();
        if (!notEmpty(blanks)) return List.of();
        JsonNode given = answer == null ? MissingNode.getInstance() : answer.path("blankAnswers");
        List<PartResult> parts = new ArrayList<>(blanks.size());
        for (int i = 0; i < blanks.size(); i++) {
            QuestionContent.QuizBlankItem blank = blanks.get(i);
            int key = blank.getBlankIndex() != null ? blank.getBlankIndex() : i;
            String value = given.path(String.valueOf(key)).asText("");
            parts.add(new PartResult(key, sameText(value, blank.getCorrectAnswer()) || acceptedContains(blank, value)));
        }
        return parts;
    }

    // Điểm câu = max × số ý đúng ÷ tổng số ý (chia đều cho các ý).
    private BigDecimal byParts(List<PartResult> parts, BigDecimal max) {
        return partial(max, (int) parts.stream().filter(PartResult::correct).count(), parts.size());
    }
    private BigDecimal sentenceBuilder(QuestionContent q, JsonNode answer, BigDecimal max) {
        List<Integer> expected = expectedChunkOrder(q);
        JsonNode order = answer.path("chunkOrder");
        if (expected.isEmpty() || !order.isArray() || order.size() != expected.size()) return BigDecimal.ZERO;
        for (int i = 0; i < expected.size(); i++) {
            if (!order.get(i).isIntegralNumber() || order.get(i).asInt() != expected.get(i)) return BigDecimal.ZERO;
        }
        return max;
    }

    // Chỉ số các chunk không phải distractor, sắp theo correctPosition (thiếu vị trí xếp cuối).
    private List<Integer> expectedChunkOrder(QuestionContent q) {
        List<QuestionContent.QuizSentenceChunkItem> chunks = q.getSentenceChunks();
        if (!notEmpty(chunks)) return List.of();
        List<Integer> indexes = new ArrayList<>();
        for (int i = 0; i < chunks.size(); i++) {
            if (!Boolean.TRUE.equals(chunks.get(i).getDistractor())) indexes.add(i);
        }
        indexes.sort(Comparator.comparing(
                (Integer i) -> chunks.get(i).getCorrectPosition(), Comparator.nullsLast(Comparator.<Integer>naturalOrder())));
        return indexes;
    }

    private Set<Integer> correctOptionIndexes(QuestionContent q) {
        Set<Integer> correct = new HashSet<>();
        if (q.getOptions() == null) return correct;
        for (int i = 0; i < q.getOptions().size(); i++) {
            QuestionContent.QuizOptionItem option = q.getOptions().get(i);
            if (Boolean.TRUE.equals(option.getCorrect())) {
                correct.add(option.getOptionIndex() != null ? option.getOptionIndex() : i);
            }
        }
        return correct;
    }

    private boolean acceptedContains(QuestionContent.QuizBlankItem blank, String value) {
        if (blank.getAcceptedAnswers() == null) return false;
        return blank.getAcceptedAnswers().stream().anyMatch(accepted -> sameText(value, accepted));
    }

    private BigDecimal partial(BigDecimal max, int correct, int total) {
        if (total <= 0 || correct <= 0) return BigDecimal.ZERO;
        return max.multiply(BigDecimal.valueOf(correct))
                .divide(BigDecimal.valueOf(total), SCORE_SCALE, RoundingMode.HALF_UP);
    }

    public static boolean sameText(String a, String b) {
        String left = normalize(a);
        return !left.isEmpty() && left.equals(normalize(b));
    }

    static String normalize(String value) {
        if (value == null) return "";
        // NFC + mọi khoảng trắng Unicode (kể cả khoảng trắng không ngắt) gộp thành một dấu cách, không phân biệt hoa thường.
        return WHITESPACE.matcher(Normalizer.normalize(value, Normalizer.Form.NFC)).replaceAll(" ").strip().toLowerCase(Locale.ROOT);
    }

    private static boolean notEmpty(List<?> list) {
        return list != null && !list.isEmpty();
    }

    private JsonNode parse(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean hasContent(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) return false;
        if (node.isTextual()) return !node.asText().isBlank();
        if (node.isValueNode()) return true;
        for (JsonNode child : node) {
            if (hasContent(child)) return true;
        }
        return false;
    }
}
