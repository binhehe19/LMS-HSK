package pl.co.lms.entity;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;

import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Loại phụ (sub type) của một học liệu, là nhãn phân loại trong phạm vi một {@link LearningResourceType}.
 * <p>
 * Mỗi {@code type} chỉ nhận các giá trị ghi ở {@link #ALLOWED}; type chưa có tập nào thì không có loại phụ. Riêng bài đánh giá,
 * các giá trị Test đầu vào ({@link #PLACEMENT}) quyết định bài có nằm ngoài Kho và do luồng Test đầu vào quản lý.
 * Giá trị là token IN HOA, tối đa {@link #MAX_LENGTH} ký tự (cột lưu dài 30).
 */
public final class ResourceSubTypes {

    public static final int MAX_LENGTH = 30;
    private static final Pattern TOKEN = Pattern.compile("^[A-Z][A-Z0-9_]{0,29}$");

    /** Tiền tố của bốn loại luyện kỹ năng. */
    public static final String PRACTICE_PREFIX = "PRACTICE_";

    // ── Nhóm theo sản phẩm (mã dùng chung một backend; mỗi app có DB riêng và chỉ dùng loại của mình, code không ép buộc) ──
    //  - Chung cho hai app: QUIZ, PRACTICE_* (bài đánh giá), và EN/ZH của từ vựng và ngữ pháp (EN dùng cho IELTS, ZH cho HSK).
    //  - Riêng IELTS: PLACEMENT_IELTS, PLACEMENT_PACE, FOUNDATION_* (Test đầu vào).
    //  - Riêng HSK: QUICK_QUIZ (Quick quiz).

    // Bài đánh giá: chung.
    public static final String QUIZ = "QUIZ";
    public static final String PRACTICE_READING = "PRACTICE_READING";
    public static final String PRACTICE_LISTENING = "PRACTICE_LISTENING";
    public static final String PRACTICE_WRITING = "PRACTICE_WRITING";
    public static final String PRACTICE_SPEAKING = "PRACTICE_SPEAKING";
    // Riêng IELTS: Test đầu vào.
    public static final String PLACEMENT_IELTS = "PLACEMENT_IELTS";
    public static final String PLACEMENT_PACE = "PLACEMENT_PACE";
    public static final String FOUNDATION_PRON = "FOUNDATION_PRON";
    public static final String FOUNDATION_VOCAB = "FOUNDATION_VOCAB";
    public static final String FOUNDATION_GRAMMAR = "FOUNDATION_GRAMMAR";
    // Riêng HSK: Quick quiz, bài tự luyện của Kho không gắn buổi học (danh mục /assessment-practice/catalog?type=QUICK_QUIZ,
    // làm bài qua lượt tự luyện). Như PRACTICE_*, không xếp vào buổi học (chỉ QUIZ được đặt vào học phần).
    public static final String QUICK_QUIZ = "QUICK_QUIZ";

    // Từ vựng và ngữ pháp: ngôn ngữ nguồn (EN = IELTS, ZH = HSK).
    public static final String EN = "EN";
    public static final String ZH = "ZH";

    /** Bốn loại luyện kỹ năng; không phải kỹ năng ({@code skill}) của bài. */
    public static final Set<String> PRACTICE = Set.of(PRACTICE_READING, PRACTICE_LISTENING, PRACTICE_WRITING, PRACTICE_SPEAKING);

    /** Loại của Test đầu vào: đề nằm ngoài Kho và chỉ luồng Test đầu vào được đặt hoặc đổi. */
    public static final Set<String> PLACEMENT = Set.of(PLACEMENT_IELTS, PLACEMENT_PACE, FOUNDATION_PRON, FOUNDATION_VOCAB, FOUNDATION_GRAMMAR);

    private static final Set<String> ASSESSMENT = Set.of(
            QUIZ, PRACTICE_READING, PRACTICE_LISTENING, PRACTICE_WRITING, PRACTICE_SPEAKING, QUICK_QUIZ,
            PLACEMENT_IELTS, PLACEMENT_PACE, FOUNDATION_PRON, FOUNDATION_VOCAB, FOUNDATION_GRAMMAR);

    public static final Map<LearningResourceType, Set<String>> ALLOWED = Map.of(
            LearningResourceType.ASSESSMENT, ASSESSMENT,
            LearningResourceType.VOCABULARY, Set.of(EN, ZH),
            LearningResourceType.GRAMMAR, Set.of(EN, ZH));

    private ResourceSubTypes() {}

    /** Loại phụ của một từ vựng chưa có loại phụ, suy từ nội dung: có phiên âm theo cách đọc (pinyins), cấp HSK hoặc language zh thì là ZH. */
    public static String inferVocabulary(com.fasterxml.jackson.databind.JsonNode content) {
        if (content == null) return EN;
        boolean zh = "zh".equalsIgnoreCase(content.path("language").asText(""))
                || (content.path("pinyins").isArray() && content.path("pinyins").size() > 0)
                || content.has("hskLevel");
        return zh ? ZH : EN;
    }

    /** Loại phụ của một ngữ pháp chưa có loại phụ, suy từ nội dung: có cấp HSK, hoặc một ví dụ có câu tiếng Trung hay pinyin thì là ZH. */
    public static String inferGrammar(com.fasterxml.jackson.databind.JsonNode content) {
        if (content == null) return EN;
        boolean zh = content.has("hskLevel");
        for (com.fasterxml.jackson.databind.JsonNode example : content.path("examples")) {
            if (example.has("sentenceZh") || example.has("pinyin")) zh = true;
        }
        return zh ? ZH : EN;
    }

    /** Suy loại phụ của một học liệu chưa có loại phụ theo type (từ vựng hoặc ngữ pháp); type khác không có loại phụ suy được. */
    public static String infer(LearningResourceType type, com.fasterxml.jackson.databind.JsonNode content) {
        if (type == LearningResourceType.GRAMMAR) return inferGrammar(content);
        if (type == LearningResourceType.VOCABULARY) return inferVocabulary(content);
        return null;
    }

    /** Từ vựng EN, kể cả hàng chưa có loại phụ (đọc như EN, cùng quy ước với contentClassOf); dùng ở chỗ chỉ xử lý từ tiếng Anh. */
    public static boolean isEnglish(String subType) {
        return subType == null || EN.equals(subType);
    }

    public static boolean isPlacement(String subType) {
        return subType != null && PLACEMENT.contains(subType);
    }

    public static boolean isPractice(String subType) {
        return subType != null && PRACTICE.contains(subType);
    }

    /** Tên token của kỹ năng luyện tập ("PRACTICE_READING" => "READING"); chỉ dùng để dựng đường dẫn và tên. */
    public static String practiceSkillOf(String subType) {
        return isPractice(subType) ? subType.substring("PRACTICE_".length()) : null;
    }

    /** Chuẩn hóa giá trị người dùng gửi lên: cắt khoảng trắng, đổi sang IN HOA; rỗng => null. */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return raw.strip().toUpperCase(java.util.Locale.ROOT);
    }

    /** Chuẩn hóa rồi kiểm tra giá trị hợp lệ cho {@code type}; null/rỗng => null (không có loại phụ). */
    public static String validate(LearningResourceType type, String raw) {
        String value = normalize(raw);
        if (value == null) return null;
        if (!TOKEN.matcher(value).matches()) {
            throw new ApiException(ErrorCode.E200, "Loại phụ không hợp lệ: chỉ chữ IN HOA, số và gạch dưới, bắt đầu bằng chữ, tối đa " + MAX_LENGTH + " ký tự");
        }
        Set<String> allowed = type == null ? null : ALLOWED.get(type);
        if (allowed == null) {
            throw new ApiException(ErrorCode.E200, "Loại học liệu này không có loại phụ");
        }
        if (!allowed.contains(value)) {
            throw new ApiException(ErrorCode.E200, "Loại phụ không hợp lệ cho " + type + ": " + value);
        }
        return value;
    }
}
