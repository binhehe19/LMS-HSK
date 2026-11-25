package pl.co.lms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.ResourceSearchLimits;
import pl.co.lms.entity.ResourceSubTypes;

import java.text.Normalizer;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Dựng giá trị các cột tìm kiếm của {@code learning_resources} từ nội dung phiên bản và tag. Lớp thuần (không dùng DB) để test dễ;
 * là nơi DUY NHẤT định nghĩa trường nào của loại resource nào được đưa vào tìm kiếm. Từ khoá người dùng gõ cũng phải đi qua
 * {@link #normalize} để khớp với giá trị đã lưu.
 */
public final class ResourceSearchColumns {

    /** Mã bộ lọc từ vựng dùng chung giữa chỉ mục và truy vấn. */
    public static String vocabularyFacet(String field, String value) {
        String normalized = normalize(value).replace("|", " ");
        return normalized.isEmpty() ? "" : "|" + field + "=" + normalized + "|";
    }

    /** Ký tự bộ thủ từ cách lưu của DB cũ ("NHẤT 一" → "一") hoặc chính ký tự; rỗng → null. */
    public static String radicalChar(String radical) {
        if (radical == null || radical.isBlank()) return null;
        String value = radical.strip();
        int space = value.lastIndexOf(' ');
        String ch = space < 0 ? value : value.substring(space + 1);
        return ch.length() > 16 ? ch.substring(0, 16) : ch;
    }

    public record VocabularyMetadata(String facets) {}

    /** Bộ lọc (facets) chỉ có ở từ vựng ZH (cấp HSK, từ đơn, bộ thủ, loại từ); từ vựng EN không có bộ lọc dạng này. */
    public static VocabularyMetadata vocabularyMetadata(String subType, JsonNode content) {
        if (content == null) return new VocabularyMetadata(null);
        Set<String> facets = new LinkedHashSet<>();
        if (ResourceSubTypes.ZH.equals(subType)) {
            facets.add(vocabularyFacet("level", content.path("hskLevel").asText("")));
            facets.add(vocabularyFacet("single", content.path("isSingleVocab").asText("")));
            facets.add(vocabularyFacet("radical", radicalChar(text(content, "radical"))));
            for (JsonNode p : content.path("pinyins")) {
                for (String type : text(p, "wordTypes").split(",")) {
                    facets.add(vocabularyFacet("wordType", type));
                }
            }
        }
        return new VocabularyMetadata(String.join("", facets));
    }

    /** Giá trị các cột; không có trường nào null (rỗng = không có nội dung). */
    public record Values(String title, String text, String tags, String wordKey, String cefrLevel, String topic) {
        public static final Values EMPTY = new Values("", "", "", null, null, null);
    }

    private ResourceSearchColumns() {}

    /** Chữ thường, bỏ dấu (kể cả đ → d), gộp khoảng trắng, cắt đầu/cuối. null → "". */
    public static String normalize(String value) {
        if (value == null || value.isBlank()) return "";
        String folded = Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd');
        return folded.replaceAll("\\s+", " ").trim();
    }

    /** Khoá so sánh để kiểm tra trùng từ: chữ thường, gộp khoảng trắng, GIỮ dấu (resume ≠ résumé); null nếu trống hoặc quá dài. */
    public static String wordKey(String word) {
        if (word == null || word.isBlank()) return null;
        String key = word.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
        return key.length() > ResourceSearchLimits.WORD_KEY ? null : key;
    }

    /** Bỏ thẻ HTML (nội dung soạn bằng rich editor) trước khi chuẩn hoá. */
    private static String plain(String html) {
        if (html == null) return "";
        return html.replaceAll("<[^>]*>", " ")
                .replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'");
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() || !value.isTextual() ? "" : value.asText();
    }

    private static String cut(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static String join(Set<String> parts, int max) {
        return cut(String.join(" ", parts), max);
    }

    private static void add(Set<String> parts, String raw) {
        String value = normalize(plain(raw));
        if (!value.isEmpty()) parts.add(value);
    }

    /**
     * @param contentJson nội dung JSON của phiên bản đang hiển thị; null/không đọc được → chỉ có tag
     * @param tags tag của resource (dạng gốc)
     */
    /** Như bản có subType khi chưa biết loại phụ: từ vựng thì suy loại phụ từ nội dung (dữ liệu cũ). */
    public static Values build(LearningResourceType type, String contentJson, Collection<String> tags, ObjectMapper mapper) {
        return build(type, null, contentJson, tags, mapper);
    }

    /** subType: loại phụ của học liệu; từ vựng EN và ZH được lập chỉ mục bằng hai đoạn riêng, mỗi đoạn chỉ đọc trường của lớp mình. */
    public static Values build(LearningResourceType type, String subType, String contentJson, Collection<String> tags, ObjectMapper mapper) {
        Set<String> tagParts = new LinkedHashSet<>();
        if (tags != null) tags.forEach((t) -> add(tagParts, t));
        String tagText = join(tagParts, ResourceSearchLimits.TAGS);

        JsonNode content = null;
        if (contentJson != null && !contentJson.isBlank()) {
            try {
                content = mapper.readTree(contentJson);
            } catch (Exception ignored) {
                // Nội dung hỏng: vẫn cho tìm theo tag, tiêu đề/nội dung để trống.
            }
        }
        if (content == null || type == null) {
            return new Values("", "", tagText, null, null, null);
        }

        Set<String> body = new LinkedHashSet<>();
        String title = "";
        String wordKey = null;
        String cefr = null;
        String topic = null;
        switch (type) {
            case VOCABULARY -> {
                String word = text(content, "word");
                title = normalize(word);
                wordKey = wordKey(word);
                if (ResourceSubTypes.ZH.equals(subType != null ? subType : ResourceSubTypes.inferVocabulary(content))) {
                    for (JsonNode pinyin : content.path("pinyins")) add(body, text(pinyin, "pinyin"));
                } else {
                    String level = text(content, "cefrLevel").strip();
                    cefr = level.isEmpty() ? null : cut(level.toUpperCase(Locale.ROOT), ResourceSearchLimits.CEFR);
                    String topicValue = text(content, "topic").strip();
                    topic = topicValue.isEmpty() ? null : cut(topicValue, ResourceSearchLimits.TOPIC);
                    addEnVocabularyText(body, content);
                }
            }
            case GRAMMAR -> {
                title = normalize(text(content, "title"));
                add(body, text(content, "generalDefinition"));
                add(body, text(content, "category"));
                add(body, text(content, "structure"));
                // Ngữ pháp ZH: cấp HSK được phản chiếu vào cột cefr_level để lọc theo cấp (cùng cột với CEFR của từ vựng EN).
                if (ResourceSubTypes.ZH.equals(subType != null ? subType : ResourceSubTypes.inferGrammar(content))) {
                    String hsk = content.path("hskLevel").asText("").strip();
                    cefr = hsk.isEmpty() ? null : cut(hsk.toUpperCase(Locale.ROOT), ResourceSearchLimits.CEFR);
                }
            }
            case ASSESSMENT, AUDIO_PRACTICE -> {
                title = normalize(text(content, "title"));
                add(body, text(content, "description"));
            }
            case STUDY_MATERIAL -> {
                title = normalize(text(content, "title"));
                add(body, text(content, "subtitle"));
                add(body, text(content, "description"));
                add(body, text(content, "source"));
                add(body, text(content, "topic"));
                String topicValue = text(content, "topic").strip();
                topic = topicValue.isEmpty() ? null : cut(topicValue, ResourceSearchLimits.TOPIC);
                JsonNode paragraphs = content.get("paragraphs");
                if (paragraphs != null && paragraphs.isArray()) for (JsonNode paragraph : paragraphs) {
                    add(body, text(paragraph, "en")); add(body, text(paragraph, "vi"));
                }
            }
            case SLIDE, MATERIAL -> {
                // Tìm theo tên hiển thị (title), thiếu thì theo tên tệp; tên tệp vẫn tìm được qua phần nội dung.
                String name = text(content, "title").isBlank() ? text(content, "fileName") : text(content, "title");
                title = normalize(name);
                add(body, text(content, "fileName"));
            }
            default -> { }
        }
        return new Values(cut(title, ResourceSearchLimits.TITLE), join(body, ResourceSearchLimits.TEXT), tagText, wordKey, cefr, topic);
    }

    /** Từ vựng EN: nghĩa thông dụng, các định nghĩa (kể cả bản dịch Trung và phiên âm) và từ trong collocation; không đọc ví dụ. */
    private static void addEnVocabularyText(Set<String> body, JsonNode content) {
        add(body, text(content, "commonMeaning"));
        JsonNode definitions = content.get("definitions");
        if (definitions != null && definitions.isArray()) {
            for (JsonNode d : definitions) {
                add(body, text(d, "meaningVi"));
                add(body, text(d, "definitionEn"));
                add(body, text(d, "meaningZh"));
                add(body, text(d, "pinyin"));
            }
        }
        JsonNode collocations = content.get("collocations");
        if (collocations != null && collocations.isArray()) {
            for (JsonNode c : collocations) {
                JsonNode words = c.get("words");
                if (words != null && words.isArray()) words.forEach((w) -> add(body, w.isTextual() ? w.asText() : ""));
            }
        }
    }
}
