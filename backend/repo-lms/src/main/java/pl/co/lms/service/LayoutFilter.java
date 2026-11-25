package pl.co.lms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.Iterator;
import java.util.Map;
import java.util.Set;

/**
 * Lọc {@code layout} (JSON mờ) trước khi gửi cho học viên: bỏ mọi khoá {@code grading} ở mọi độ sâu, và bỏ thêm khoá
 * {@code explanation} và {@code transcript} (lời thoại của audio/video, có thể là đáp án của câu nghe) khi lượt làm chưa nộp. Backend không hiểu nội dung bên trong, chỉ lọc theo tên khoá.
 */
public final class LayoutFilter {

    public static final String GRADING = "grading";
    public static final String EXPLANATION = "explanation";
    /** Khoá dành riêng ở mọi độ sâu của layout: không dùng cho dữ liệu hiển thị khác. */
    public static final String TRANSCRIPT = "transcript";

    private LayoutFilter() {}

    /** Bản sao đã lọc dành cho học viên; null nếu không có layout. */
    public static JsonNode forStudent(JsonNode layout, boolean submitted) {
        if (layout == null || layout.isNull() || layout.isMissingNode()) return null;
        return strip(layout, submitted ? Set.of(GRADING) : Set.of(GRADING, EXPLANATION, TRANSCRIPT));
    }

    /** Bản đầy đủ cho người chấm (không lọc). */
    public static JsonNode forGrader(JsonNode layout) {
        return layout == null || layout.isNull() || layout.isMissingNode() ? null : layout.deepCopy();
    }

    private static JsonNode strip(JsonNode node, Set<String> hidden) {
        if (node.isObject()) {
            ObjectNode copy = JsonNodeFactory.instance.objectNode();
            Iterator<Map.Entry<String, JsonNode>> it = node.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> e = it.next();
                if (hidden.contains(e.getKey())) continue;
                copy.set(e.getKey(), strip(e.getValue(), hidden));
            }
            return copy;
        }
        if (node.isArray()) {
            ArrayNode copy = JsonNodeFactory.instance.arrayNode();
            node.forEach(child -> copy.add(strip(child, hidden)));
            return copy;
        }
        return node;
    }
}