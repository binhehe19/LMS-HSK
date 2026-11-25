package pl.co.lms.service.grading.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import pl.co.lms.entity.ExerciseQuestionType;
import pl.co.lms.entity.json.QuestionContent;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Chấm bài luận bằng AI theo 4 tiêu chí IELTS Writing: nối pipeline chấm chung với nhà cung cấp {@link WritingAiGradingClient}
 * (có khi đã cấu hình ai.api-key và model). Chỉ nhận câu ESSAY mang {@code aiRubric = "IELTS_WRITING"};
 * đề bài là {@code questionText} của chính câu, kèm {@code task}, {@code minimumWords} và dữ kiện chấm
 * {@code referenceText} nằm trên câu. Không có nhà cung cấp hoặc không có dấu hiệu thì bài đi chấm tay; điểm không bao giờ được bịa.
 * Hợp đồng đầu ra 4 tiêu chí do client này sở hữu; backend chỉ lưu {@code rubric} dưới dạng JSON mờ.
 */
@Component
@RequiredArgsConstructor
public class WritingEssayAiGradingClient implements AiGradingClient {

    public static final String RUBRIC_MARKER = "IELTS_WRITING";
    private static final BigDecimal MAX_BAND = BigDecimal.valueOf(9);
    private static final List<String> CRITERIA = List.of("task", "coherence", "lexical", "grammar");
    private static final Map<String, String> LABELS = Map.of(
            "task", "Task Achievement / Task Response", "coherence", "Coherence & Cohesion",
            "lexical", "Lexical Resource", "grammar", "Grammatical Range & Accuracy");

    private final ObjectProvider<WritingAiGradingClient> provider;
    private final ObjectMapper mapper;

    @Override
    public boolean supports(QuestionContent question) {
        return question != null && question.getQuestionType() == ExerciseQuestionType.ESSAY
                && RUBRIC_MARKER.equals(question.getAiRubric()) && provider.getIfAvailable() != null;
    }

    @Override
    public Result grade(Request request) {
        WritingAiGradingClient chat = provider.getIfAvailable();
        if (chat == null) throw new IllegalStateException("Chưa cấu hình dịch vụ chấm AI Writing");
        QuestionContent question = request.question();
        if (question == null || !RUBRIC_MARKER.equals(question.getAiRubric())) throw new IllegalStateException("Câu hỏi chưa bật chấm AI Writing");
        try {
            JsonNode validated = normalize(chat.grade(testOf(question), essayText(request.answerJson())));
            BigDecimal band = validated.path("bandScore").decimalValue();
            // Điểm của câu theo thang maxPoints của câu (band 0..9).
            BigDecimal max = request.maxPoints() == null ? MAX_BAND : request.maxPoints();
            BigDecimal score = band.multiply(max).divide(MAX_BAND, 2, RoundingMode.HALF_UP);
            return new Result(score, validated.path("feedback").asText(), validated);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Dịch vụ chấm AI Writing lỗi: " + e.getMessage(), e);
        }
    }

    private ObjectNode testOf(QuestionContent question) {
        ObjectNode test = mapper.createObjectNode();
        test.put("task", question.getTask() == null ? 2 : question.getTask());
        test.put("minimumWords", question.getMinimumWords() == null ? 0 : question.getMinimumWords());
        String html = question.getQuestionText() == null ? "" : question.getQuestionText();
        test.put("prompt", html.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").strip());
        test.put("referenceText", question.getReferenceText() == null ? "" : question.getReferenceText());
        return test;
    }
    /** Chuẩn hoá và kiểm tra kết quả từ nhà cung cấp: đủ 4 tiêu chí, band 0..9 bước 0.5, có nhận xét; band tổng do ta tính. */
    private ObjectNode normalize(JsonNode raw) {
        if (raw == null || !raw.isObject() || !raw.path("criteria").isArray() || raw.path("criteria").size() != CRITERIA.size()) {
            throw new IllegalStateException("Kết quả chấm AI thiếu tiêu chí");
        }
        Map<String, JsonNode> byId = new HashMap<>();
        BigDecimal sum = BigDecimal.ZERO;
        for (JsonNode c : raw.path("criteria")) {
            if (!CRITERIA.contains(c.path("id").asText()) || byId.put(c.path("id").asText(), c) != null || !c.path("bandScore").isNumber()) {
                throw new IllegalStateException("Tiêu chí chấm AI không hợp lệ");
            }
            BigDecimal band = c.path("bandScore").decimalValue();
            if (band.compareTo(BigDecimal.ZERO) < 0 || band.compareTo(MAX_BAND) > 0
                    || band.multiply(BigDecimal.valueOf(2)).stripTrailingZeros().scale() > 0
                    || !c.path("feedback").isTextual() || c.path("feedback").asText().isBlank()) {
                throw new IllegalStateException("Điểm hoặc nhận xét tiêu chí AI không hợp lệ");
            }
            sum = sum.add(band);
        }
        if (!raw.path("feedback").isTextual() || raw.path("feedback").asText().isBlank()) {
            throw new IllegalStateException("Thiếu nhận xét tổng thể từ AI");
        }
        ObjectNode result = mapper.createObjectNode();
        result.put("policy", "IELTS_WRITING_PRACTICE_V1").put("estimated", true)
                .put("bandScore", sum.divide(BigDecimal.valueOf(2), 0, RoundingMode.HALF_UP).divide(BigDecimal.valueOf(2)))
                .put("feedback", raw.path("feedback").asText());
        var criteria = result.putArray("criteria");
        for (String id : CRITERIA) {
            JsonNode c = byId.get(id);
            criteria.addObject().put("id", id).put("label", LABELS.get(id))
                    .put("bandScore", c.path("bandScore").decimalValue()).put("feedback", c.path("feedback").asText());
        }
        return result;
    }

    // Đáp án câu ESSAY có dạng {"text": "..."}; chấp nhận cả chuỗi JSON thuần.
    private String essayText(String answerJson) throws Exception {
        if (answerJson == null) return "";
        JsonNode node = mapper.readTree(answerJson);
        if (node.isTextual()) return node.asText();
        return node.has("text") ? node.path("text").asText() : node.toString();
    }
}