package pl.co.lms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.co.lms.dto.request.HeartbeatAssessmentAttemptRequest;
import pl.co.lms.entity.ExerciseQuestionType;
import pl.co.lms.entity.json.QuestionContent;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

// Làm sạch đáp án dạng tệp trước khi lưu lúc nộp bài: câu nộp file chỉ giữ tối đa maxFiles tệp đúng cấu trúc, câu ghi âm
// chỉ giữ một bản ghi đúng cấu trúc; câu nối và câu điền chỗ trống chỉ giữ các ý có thật (khoá theo pairIndex/blankIndex) với giá trị
// hợp lệ (câu nối: optionIndex có thật; câu điền: chữ giới hạn độ dài); đáp án sai cấu trúc bị xoá (lưu rỗng, coi như bỏ trống).
// Các loại câu khác giữ nguyên.
// Đáp án mẫu: {"files":[{"fileId","fileName","mimeType","sizeBytes"}]} và {"audio":{"fileId","mimeType","sizeBytes","durationSeconds"}}.
@Component
@RequiredArgsConstructor
public class QuizAnswerSanitizer {

    private static final int DEFAULT_MAX_FILES = 3;
    private static final int MAX_ANSWER_TEXT = 1000;

    private final ObjectMapper objectMapper;

    public List<HeartbeatAssessmentAttemptRequest.AnswerItem> sanitize(
            QuizContent quiz, List<HeartbeatAssessmentAttemptRequest.AnswerItem> items) {
        if (quiz == null || quiz.getQuestions() == null || items == null) return items;
        Map<String, QuizQuestion> byId = new HashMap<>();
        for (QuizQuestion q : quiz.getQuestions()) byId.put(q.getQuestionId(), q);

        List<HeartbeatAssessmentAttemptRequest.AnswerItem> result = new ArrayList<>(items.size());
        for (HeartbeatAssessmentAttemptRequest.AnswerItem item : items) {
            QuizQuestion question = byId.get(item.questionId());
            String cleaned = item.answerJson();
            if (question != null && question.getQuestionType() == ExerciseQuestionType.FILE_UPLOAD) {
                cleaned = cleanFiles(item.answerJson(), maxFilesOf(question));
            } else if (question != null && question.getQuestionType() == ExerciseQuestionType.AUDIO_RESPONSE) {
                cleaned = cleanAudio(item.answerJson());
            } else if (question != null && question.getQuestionType() == ExerciseQuestionType.MATCHING) {
                Set<Integer> choices = new HashSet<>(QuestionContent.optionKeys(question.getOptions()));
                cleaned = cleanParts(item.answerJson(), "matchingAnswers", matchingKeys(question),
                        value -> value.isIntegralNumber() && choices.contains(value.asInt()) ? value : null);
            } else if (question != null && question.getQuestionType() == ExerciseQuestionType.FILL_IN_BLANK) {
                cleaned = cleanParts(item.answerJson(), "blankAnswers", blankKeys(question), value -> value.isTextual()
                        ? com.fasterxml.jackson.databind.node.TextNode.valueOf(value.asText().length() > MAX_ANSWER_TEXT
                                ? value.asText().substring(0, MAX_ANSWER_TEXT) : value.asText())
                        : null);
            }
            result.add(new HeartbeatAssessmentAttemptRequest.AnswerItem(item.questionId(), cleaned));
        }
        return result;
    }

    private static Set<String> matchingKeys(QuizQuestion question) {
        Set<String> keys = new HashSet<>();
        List<QuestionContent.QuizMatchingPairItem> pairs = question.getMatchingPairs();
        for (int i = 0; pairs != null && i < pairs.size(); i++) keys.add(String.valueOf(pairs.get(i).getPairIndex() != null ? pairs.get(i).getPairIndex() : i));
        return keys;
    }

    private static Set<String> blankKeys(QuizQuestion question) {
        Set<String> keys = new HashSet<>();
        List<QuestionContent.QuizBlankItem> blanks = question.getBlanks();
        for (int i = 0; blanks != null && i < blanks.size(); i++) keys.add(String.valueOf(blanks.get(i).getBlankIndex() != null ? blanks.get(i).getBlankIndex() : i));
        return keys;
    }

    // Câu nhiều ý: chỉ giữ khoá của các ý có thật và giá trị hợp lệ theo loại câu (`clean` trả null = bỏ ý đó); không còn ý nào thì coi như bỏ trống.
    // Câu nối: giá trị là optionIndex của một lựa chọn có thật. Câu điền: chữ, cắt ở MAX_ANSWER_TEXT.
    private String cleanParts(String answerJson, String field, Set<String> validKeys, java.util.function.UnaryOperator<JsonNode> clean) {
        JsonNode given = parse(answerJson).path(field);
        if (!given.isObject()) return "";
        ObjectNode kept = objectMapper.createObjectNode();
        given.fields().forEachRemaining(entry -> {
            JsonNode value = validKeys.contains(entry.getKey()) ? clean.apply(entry.getValue()) : null;
            if (value != null) kept.set(entry.getKey(), value);
        });
        if (kept.isEmpty()) return "";
        ObjectNode root = objectMapper.createObjectNode();
        root.set(field, kept);
        return root.toString();
    }

    private int maxFilesOf(QuizQuestion question) {
        return question.getMaxFiles() != null && question.getMaxFiles() > 0 ? question.getMaxFiles() : DEFAULT_MAX_FILES;
    }

    private String cleanFiles(String answerJson, int maxFiles) {
        JsonNode files = parse(answerJson).path("files");
        if (!files.isArray()) return "";
        ArrayNode kept = objectMapper.createArrayNode();
        for (JsonNode file : files) {
            if (kept.size() >= maxFiles) break;
            ObjectNode clean = cleanFileRef(file);
            if (clean != null) kept.add(clean);
        }
        if (kept.isEmpty()) return "";
        ObjectNode root = objectMapper.createObjectNode();
        root.set("files", kept);
        return root.toString();
    }

    private String cleanAudio(String answerJson) {
        ObjectNode clean = cleanFileRef(parse(answerJson).path("audio"));
        if (clean == null) return "";
        JsonNode duration = parse(answerJson).path("audio").path("durationSeconds");
        if (duration.isNumber() && duration.asDouble() >= 0) clean.put("durationSeconds", duration.asDouble());
        ObjectNode root = objectMapper.createObjectNode();
        root.set("audio", clean);
        return root.toString();
    }

    // Chỉ giữ các trường mô tả tệp; fileId bắt buộc là chuỗi không rỗng. Trả null nếu không hợp lệ.
    private ObjectNode cleanFileRef(JsonNode node) {
        if (node == null || !node.isObject()) return null;
        JsonNode fileId = node.path("fileId");
        if (!fileId.isTextual() || fileId.asText().isBlank()) return null;
        ObjectNode clean = objectMapper.createObjectNode();
        clean.put("fileId", fileId.asText());
        if (node.path("fileName").isTextual()) clean.put("fileName", node.path("fileName").asText());
        if (node.path("mimeType").isTextual()) clean.put("mimeType", node.path("mimeType").asText());
        if (node.path("sizeBytes").isIntegralNumber()) clean.put("sizeBytes", node.path("sizeBytes").asLong());
        return clean;
    }

    private JsonNode parse(String json) {
        if (json == null || json.isBlank()) return objectMapper.missingNode();
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return objectMapper.missingNode();
        }
    }
}
