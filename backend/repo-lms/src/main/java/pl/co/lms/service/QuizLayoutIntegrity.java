package pl.co.lms.service;

import com.fasterxml.jackson.databind.JsonNode;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Kiểm tra toàn vẹn giữa {@code layout} (cách hiển thị, do frontend định nghĩa) và {@code questions[]} (dữ liệu và đáp án).
 * Backend chỉ biết hai tên khoá cấu trúc: {@code sections} và {@code sections[].questionIds}. Nội dung chung của phần (văn bản,
 * tệp, audio) và cách hiển thị thuộc frontend, không kiểm ở đây.
 *
 * Layout {@code version: 2} bắt buộc mỗi phần có {@code questionIds}; layout khác chỉ kiểm khi thật sự tham chiếu câu hỏi.
 */
public final class QuizLayoutIntegrity {

    private static final int MAX_LISTED = 10;

    private QuizLayoutIntegrity() {}

    /** Danh sách vi phạm bằng tiếng Việt, mỗi dòng nêu rõ id; rỗng nghĩa là hợp lệ hoặc không áp dụng. */
    public static List<String> violations(QuizContent quiz) {
        JsonNode sections = quiz == null || quiz.getLayout() == null ? null : quiz.getLayout().path("sections");
        if (sections == null || !sections.isArray()) return List.of();

        Map<String, Integer> refs = new HashMap<>();
        Set<String> sectionIds = new HashSet<>();
        boolean v2 = quiz.getLayout().path("version").asInt(1) == 2;
        List<String> out = new ArrayList<>();
        boolean referencesQuestions = false;

        for (JsonNode section : sections) {
            addUnique(sectionIds, section.path("id"), "Phần thi", out);
            if (v2 && !section.path("questionIds").isArray()) {
                out.add("Phần thi thiếu danh sách câu hỏi (questionIds): " + section.path("id").asText(""));
            }
            for (JsonNode id : section.path("questionIds")) {
                referencesQuestions = true;
                refs.merge(id.asText(), 1, Integer::sum);
            }
        }
        if (!v2 && !referencesQuestions) return List.of();

        Set<String> known = new HashSet<>();
        if (quiz.getQuestions() != null) for (QuizQuestion q : quiz.getQuestions()) known.add(q.getQuestionId());

        refs.forEach((id, count) -> {
            if (!known.contains(id)) out.add("Bố cục trỏ tới câu hỏi không tồn tại: " + id);
            else if (count > 1) out.add("Câu hỏi được dùng nhiều lần trong bố cục: " + id);
        });
        for (String id : known) if (!refs.containsKey(id)) out.add("Câu hỏi không xuất hiện trong bố cục: " + id);
        return out;
    }

    /** Gộp thông báo, tối đa {@value #MAX_LISTED} dòng đầu kèm tổng số. */
    public static String message(List<String> violations) {
        String head = String.join("; ", violations.subList(0, Math.min(MAX_LISTED, violations.size())));
        return violations.size() > MAX_LISTED ? head + " ... (tổng " + violations.size() + " lỗi)" : head;
    }

    private static void addUnique(Set<String> seen, JsonNode id, String label, List<String> out) {
        if (id.isTextual() && !id.asText().isBlank() && !seen.add(id.asText())) out.add(label + " bị trùng mã: " + id.asText());
    }
}
