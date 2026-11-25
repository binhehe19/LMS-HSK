package pl.co.lms.entity;

import lombok.Getter;
import pl.co.lms.entity.json.*;

/**
 * Loại tài nguyên học tập. Mỗi lần gắn 1 resource có sẵn từ Kho vào buổi tạo ra 1 bản sao độc lập
 * (copy-on-attach, xử lý ở FE: tạo LearningResource mới từ content nguồn rồi mới addResourceToSession)
 * — không còn resource "dùng chung" giữa các học phần, nên không cần phân biệt reuseMode/sync nữa.
 */
@Getter
public enum LearningResourceType {
    // Cấu trúc nội dung ngữ pháp cũng phụ thuộc loại phụ (EN/ZH độc lập): dùng contentClassOf(subType); lớp ở đây chỉ là mặc định.
    GRAMMAR(GrammarEnContent.class),
    // Cấu trúc nội dung từ vựng phụ thuộc loại phụ: dùng contentClassOf(subType) (EN và ZH độc lập, không có lớp chung); lớp ở đây chỉ là mặc định.
    VOCABULARY(VocabularyEnContent.class),
    SLIDE(SlideMaterialContent.class),
    MATERIAL(SlideMaterialContent.class),
    ASSESSMENT(QuizContent.class),
    // Một bài audio có các đoạn transcript dùng chung cho Shadowing và Dictation.
    AUDIO_PRACTICE(AudioPracticeContent.class),
    STUDY_MATERIAL(StudyMaterialContent.class);

    private final Class<?> contentClass;

    LearningResourceType(Class<?> contentClass) {
        this.contentClass = contentClass;
    }

    /**
     * Class nội dung của một học liệu thuộc type này với loại phụ {@code subType}: nơi duy nhất chọn class. Từ vựng và ngữ pháp ZH dùng
     * lớp ZH, còn lại (kể cả chưa có loại phụ ở dữ liệu cũ) dùng lớp EN.
     */
    public Class<?> contentClassOf(String subType) {
        boolean zh = ResourceSubTypes.ZH.equals(subType);
        return switch (this) {
            case VOCABULARY -> zh ? VocabularyZhContent.class : VocabularyEnContent.class;
            case GRAMMAR -> zh ? GrammarZhContent.class : GrammarEnContent.class;
            default -> contentClass;
        };
    }
}
