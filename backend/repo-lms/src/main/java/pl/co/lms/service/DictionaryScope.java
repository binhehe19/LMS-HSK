package pl.co.lms.service;

import java.util.Locale;

/**
 * Phạm vi cấp độ CEFR / chủ đề của từ điển, dạng tham số cho các truy vấn native (cùng quy ước với bộ lọc /dictionary):
 * mode 0 = không lọc, 1 = chưa phân loại (trống), 2 = bằng giá trị (cefr chữ hoa; topic chữ thường, không phân biệt hoa thường).
 */
public record DictionaryScope(int cefrMode, String cefr, int topicMode, String topicLower) {
    public static final String UNCLASSIFIED = "Chưa phân loại";

    public static DictionaryScope of(String cefrLevel, String topic) {
        String cefrValue = cefrLevel == null ? "" : cefrLevel.strip();
        String topicValue = topic == null ? "" : topic.strip();
        int cefrMode = cefrValue.isEmpty() ? 0 : UNCLASSIFIED.equalsIgnoreCase(cefrValue) ? 1 : 2;
        int topicMode = topicValue.isEmpty() ? 0 : UNCLASSIFIED.equalsIgnoreCase(topicValue) ? 1 : 2;
        return new DictionaryScope(
                cefrMode, cefrMode == 2 ? cefrValue.toUpperCase(Locale.ROOT) : "",
                topicMode, topicMode == 2 ? topicValue.toLowerCase(Locale.ROOT) : "");
    }

    /** Cùng cấp độ nhưng thu hẹp vào đúng một chủ đề ('' = các từ chưa có chủ đề). */
    public DictionaryScope withTopicBucket(String topic) {
        String value = topic == null ? "" : topic.strip();
        return value.isEmpty()
                ? new DictionaryScope(cefrMode, cefr, 1, "")
                : new DictionaryScope(cefrMode, cefr, 2, value.toLowerCase(Locale.ROOT));
    }

    /** Từ có cấp độ / chủ đề này nằm trong phạm vi không. */
    public boolean contains(String wordCefr, String wordTopic) {
        boolean cefrOk = cefrMode == 0
                || (cefrMode == 1 && (wordCefr == null || wordCefr.isBlank()))
                || (cefrMode == 2 && wordCefr != null && wordCefr.equalsIgnoreCase(cefr));
        boolean topicOk = topicMode == 0
                || (topicMode == 1 && (wordTopic == null || wordTopic.isBlank()))
                || (topicMode == 2 && wordTopic != null && wordTopic.toLowerCase(Locale.ROOT).equals(topicLower));
        return cefrOk && topicOk;
    }
}
