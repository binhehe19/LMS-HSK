package pl.co.lms.dto.response;

import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.json.VocabularyZhContent;

import java.time.Instant;
import java.util.List;

/** Hình dạng khớp 1:1 với `Vocabulary` phía FE (types/dictionary.ts) cho Từ điển Hán tự. */
public record DictionaryWordResponse(
        String id,
        String hanzi,
        Integer hskLevel,
        String imageUrl,
        String etymologyStory,
        String etymologyStoryHtml,
        String radical,
        Boolean isSingleVocab,
        String notes,
        String notesHtml,
        String status,
        List<VocabularyZhContent.DictionaryPinyinItem> pinyins,
        Instant createdAt,
        Instant updatedAt,
        /** Chữ thành phần của từ ghép — chỉ có ở chi tiết cho học viên (GET /dictionary/{id}?language=zh); danh sách để null. */
        List<Component> components
) {
    /** Một chữ thành phần; {@code id} null khi chữ chưa có trong từ điển đã xuất bản. Phiên âm/nghĩa lấy từ phiên âm chính và nghĩa đầu. */
    public record Component(String id, String hanzi, String pinyin, String meaning) {
        public static Component from(String id, String hanzi, VocabularyZhContent content) {
            List<VocabularyZhContent.DictionaryPinyinItem> pinyins = content.getPinyins() == null ? List.of() : content.getPinyins();
            VocabularyZhContent.DictionaryPinyinItem primary = pinyins.stream().filter(p -> Boolean.TRUE.equals(p.getIsPrimary())).findFirst()
                    .orElse(pinyins.isEmpty() ? null : pinyins.get(0));
            String meaning = primary == null || primary.getMeanings() == null || primary.getMeanings().isEmpty() ? null
                    : primary.getMeanings().get(0).getMeaningVi();
            return new Component(id, hanzi, primary == null ? null : primary.getPinyin(), meaning);
        }
    }

    public static DictionaryWordResponse from(LearningResource resource, VocabularyZhContent content) {
        return from(resource, content, null);
    }

    public static DictionaryWordResponse from(LearningResource resource, VocabularyZhContent content, List<Component> components) {
        String status = resource.getPublishedVersionId() != null ? "published" : "draft";
        return new DictionaryWordResponse(
                resource.getId(), content.getWord(), content.getHskLevel(),
                content.getImageUrl(), content.getEtymologyStory(), content.getEtymologyStoryHtml(),
                content.getRadical(), content.getIsSingleVocab(), content.getNotes(), content.getNotesHtml(),
                status, content.getPinyins(), resource.getCreatedAt(), resource.getUpdatedAt(), components);
    }
}
