package pl.co.lms.entity.json;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import pl.co.lms.entity.GrammarExampleType;

import java.util.List;

/**
 * Điểm ngữ pháp tiếng Anh (loại phụ EN, IELTS): ví dụ có câu tiếng Anh, bản dịch Việt, phiên âm IPA và "lỗi thường gặp".
 * Độc lập hoàn toàn với {@link GrammarZhContent}: không có lớp cơ sở chung.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class GrammarEnContent {
    private String title;
    private String category;
    private String generalDefinition;
    private String structure;
    private String explanation;
    private String usageNote;
    private List<GrammarEnExampleItem> examples;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class GrammarEnExampleItem {
        private Integer exampleIndex;
        private GrammarExampleType exampleType;
        private String sentenceEn;
        private String translationVi;
        /** Phiên âm IPA của câu. */
        private String pronunciation;
        private String explanation;
        private String incorrectSentence;
        private String correctSentence;
    }
}
