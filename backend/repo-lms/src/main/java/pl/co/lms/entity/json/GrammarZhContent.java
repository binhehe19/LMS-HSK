package pl.co.lms.entity.json;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Điểm ngữ pháp tiếng Trung (loại phụ ZH, HSK): mỗi ví dụ có câu tiếng Trung, pinyin và bản dịch Việt; có cấp HSK.
 * Hình dạng theo GrammarPoint của LMS 1.0. Độc lập hoàn toàn với {@link GrammarEnContent}: không có lớp cơ sở chung,
 * không có câu tiếng Anh và không có "lỗi thường gặp".
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class GrammarZhContent {
    private String title;
    private String category;
    private String generalDefinition;
    private String structure;
    private String explanation;
    private String usageNote;
    private RichText richText;
    /** Cấp HSK dạng chuỗi (HSK FE gửi "1".."9"); được phản chiếu vào cột cefr_level để lọc. */
    private String hskLevel;
    private List<GrammarZhExampleItem> examples;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RichText(
            String structure,
            String explanation,
            String note,
            String exampleSentenceZh,
            String exampleSentencePinyin,
            String exampleSentenceVi
    ) {}

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class GrammarZhExampleItem {
        private Integer exampleIndex;
        private String sentenceZh;
        /** Pinyin của câu; dữ liệu cũ lưu ở khóa pronunciation. */
        @JsonAlias("pronunciation")
        private String pinyin;
        private String translationVi;
        private String explanation;
    }
}
