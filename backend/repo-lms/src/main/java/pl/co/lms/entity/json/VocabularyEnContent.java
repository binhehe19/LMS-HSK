package pl.co.lms.entity.json;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import pl.co.lms.entity.VocabularyReferenceType;
import pl.co.lms.entity.VocabularyRelationType;

import java.util.List;

/**
 * Từ vựng tiếng Anh (loại phụ EN): nghĩa theo từng định nghĩa, kèm bản dịch tiếng Việt và tiếng Trung. Bản dịch tiếng Trung
 * ({@code meaningZh}, ví dụ {@code zh}) là của từ tiếng Anh, khác cấu trúc từ vựng tiếng Trung ({@link VocabularyZhContent}).
 * Độc lập hoàn toàn với {@link VocabularyZhContent}: không có lớp cơ sở chung, mỗi loại tự khai báo đủ trường để sửa riêng.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class VocabularyEnContent {
    /** Chữ cần học. */
    private String word;
    private String imageUrl;
    private String note;
    private String partOfSpeech;
    private String cefrLevel;
    private String topic;
    private String ukPhonetic;
    private String usPhonetic;
    private String ukAudioUrl;
    private String usAudioUrl;
    private Integer frequency;
    private Boolean academicWordList;
    private String wordFamily;
    private String usageNote;

    /** Nghĩa thông dụng (Anh – Việt) ở dải tóm tắt; bỏ trống thì hiển thị nghĩa tiếng Việt của định nghĩa đầu tiên. */
    private String commonMeaning;
    private List<VocabularyExtraField> extraFields;
    private List<VocabularyDefinitionItem> definitions;
    /** Cụm từ đi kèm: nhãn mẫu (ADJ, VERB + word…), danh sách từ và một câu ví dụ. */
    private List<VocabularyCollocationItem> collocations;
    /** Từ đồng nghĩa / trái nghĩa theo từng nghĩa. */
    private List<VocabularyThesaurusItem> thesaurus;
    /** Lỗi thường gặp: cách dùng đúng, cách dùng sai, ví dụ và lý do. */
    private List<VocabularyMistakeItem> commonMistakes;
    /** Ví dụ thực tế của từ (tab Examples). */
    private List<VocabularyExampleItem> examples;
    /** Dạng văn bản tự do cũ; từ điển chỉ dùng khi các danh sách có cấu trúc ở trên không có dữ liệu. */
    private List<VocabularyReferenceItem> references;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class VocabularyExtraField {
        private String label;
        private String value;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class VocabularyDefinitionItem {
        private Integer definitionIndex;
        private String definitionEn;
        private String meaningVi;
        private String meaningZh;
        private String pinyin;
        private String grammarNote;
        private String exampleEn;
        private String exampleVi;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class VocabularyReferenceItem {
        private VocabularyReferenceType referenceType;
        private Integer referenceIndex;
        private String content;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class VocabularyCollocationItem {
        private String pattern;
        private List<String> words;
        private String exampleEn;
        private String exampleVi;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class VocabularyThesaurusItem {
        private VocabularyRelationType relation;
        private String partOfSpeech;
        /** Giải thích tiếng Anh của nghĩa mà nhóm từ này thuộc về. */
        private String gloss;
        private List<String> words;
        private String meaningVi;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class VocabularyMistakeItem {
        private String title;
        private String correct;
        private String incorrect;
        private String exampleEn;
        private String exampleVi;
        private String explanation;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class VocabularyExampleItem {
        private String en;
        private String vi;
        private String zh;
        private String pinyin;
    }
}
