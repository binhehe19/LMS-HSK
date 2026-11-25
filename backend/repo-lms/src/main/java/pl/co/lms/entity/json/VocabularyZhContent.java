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
 * Từ vựng tiếng Trung (loại phụ ZH): chữ Hán → nhiều cách đọc (pinyin) → nhiều nghĩa. Mỗi nghĩa có bản dịch tiếng Việt, Anh, Trung
 * và ví dụ riêng. Chữ Hán nằm ở {@code word}. Độc lập hoàn toàn với {@link VocabularyEnContent}: không có lớp cơ sở chung.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class VocabularyZhContent {
    /** Chữ cần học. */
    private String word;
    private String imageUrl;
    private Integer hskLevel;
    private String etymologyStory;
    private String etymologyStoryHtml;
    private String radical;
    private Boolean isSingleVocab;
    private String notes;
    private String notesHtml;
    private List<DictionaryPinyinItem> pinyins;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DictionaryPinyinItem {
        private String pinyin;
        private String audioUrl;
        private String sinoVietnamese;
        /** Từ loại, phân cách bằng dấu phẩy: "Động từ,Danh từ". */
        private String wordTypes;
        private Boolean isPrimary;
        /** Lượng từ, vd "个 [gè], 本 [běn]". */
        private String measureWord;
        /** JSON: [{hanzi, sinoVietnamese}]. */
        private String compounds;
        /** JSON: [{hanzi, pinyin}]. */
        private String synonyms;
        /** JSON: [{hanzi, pinyin}]. */
        private String antonyms;
        private String notes;
        private List<DictionaryMeaningItem> meanings;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DictionaryMeaningItem {
        @JsonAlias("meaning")
        private String meaningVi;
        private String meaningEn;
        private String meaningZh;
        private String meaningViHtml;
        private String meaningZhHtml;
        /** Loại từ của nghĩa này (một pinyin có thể có nhiều loại từ, mỗi nghĩa thuộc một loại). */
        private String exampleWordType;
        /** Các câu ví dụ minh họa nghĩa này; mỗi nghĩa có thể có nhiều ví dụ. */
        private List<DictionaryExampleItem> examples;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DictionaryExampleItem {
        /** Câu ví dụ bằng chữ Hán. */
        private String zh;
        private String pinyin;
        private String vi;
        private String en;
        private String zhHtml;
        private String pinyinHtml;
        private String viHtml;
    }
}
