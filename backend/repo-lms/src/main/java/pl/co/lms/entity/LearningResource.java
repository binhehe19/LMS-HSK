package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "learning_resources")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LearningResource extends BaseEntity {

    // Cột nào dùng cho loại nào (các cột riêng của một loại luôn null ở loại khác):
    //  - mọi loại: type, sub_type, skill, archived, tags, in_library, source_resource_id, search_title/search_text/search_tags, các id phiên bản.
    //  - VOCABULARY (cả EN và ZH): word_key.
    //  - VOCABULARY EN: cefr_level, topic.   VOCABULARY ZH: vocabulary_facets (cấp HSK, từ đơn, bộ thủ, loại từ).
    //  - STUDY_MATERIAL (tài liệu tự học IELTS): study_*, và topic.

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private LearningResourceType type;

    @Column(name = "published_version_id", length = 26)
    private String publishedVersionId;

    @Column(name = "draft_version_id", length = 26)
    private String draftVersionId;

    // Loại phụ trong phạm vi type (xem ResourceSubTypes): bài đánh giá QUIZ/PRACTICE_*/PLACEMENT_*..., từ vựng EN/ZH. Null = type chưa có loại phụ.
    @Column(name = "sub_type", length = 30)
    private String subType;

    // Kỹ năng bài này luyện (LISTENING, READING, PRONUNCIATION...): token tự do (^[A-Z][A-Z0-9_]{0,29}$), độc lập với subType.
    // subType là LOẠI bài (quyết định bài có được xếp vào buổi học hay không), skill chỉ là chiều kỹ năng để phân nhóm/hiển thị.
    @Column(name = "skill", length = 30)
    private String skill;

    // true = ngừng nhận lượt làm mới (hiện chỉ Test đầu vào dùng); bản đã xuất bản và các lượt đang làm vẫn giữ nguyên.
    @Builder.Default
    @Column(name = "archived", nullable = false, columnDefinition = "boolean not null default false")
    private boolean archived = false;

    // Tag tự do để lọc.
    @Builder.Default
    // Truy vấn JPQL bỏ qua EAGER và nạp tag từng resource một (N+1); BatchSize gộp thành vài truy vấn khi đọc cả Kho.
    @org.hibernate.annotations.BatchSize(size = 500)
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "learning_resource_tags", joinColumns = @JoinColumn(name = "resource_id"))
    @Column(name = "tag", length = 60)
    private Set<String> tags = new LinkedHashSet<>();

    // true = tài nguyên của Kho (soạn sẵn, dùng để chọn); false = bản sao riêng của một học phần.
    @Builder.Default
    @Column(name = "in_library", nullable = false, columnDefinition = "boolean not null default false")
    private boolean inLibrary = false;

    // Bản sao riêng của học phần được tạo từ tài nguyên Kho nào (để đồng bộ lại khi Kho đổi); null = không có nguồn.
    @Column(name = "source_resource_id", length = 26)
    private String sourceResourceId;

    // ── Cột tìm kiếm, suy ra từ phiên bản đang hiển thị (đã xuất bản, chưa có thì bản nháp) và tag ──
    // Chỉ ghi qua LearningResourceService.refreshSearchColumns; giá trị đã chuẩn hoá (chữ thường, bỏ dấu) bởi ResourceSearchColumns.
    // null = chưa điền (runner điền dữ liệu cũ sẽ xử lý); "" = đã điền nhưng không có nội dung.

    /** Tiêu đề để tìm: VOCABULARY từ; GRAMMAR/ASSESSMENT tiêu đề; SLIDE/MATERIAL tên tệp. */
    @Column(name = "search_title", length = ResourceSearchLimits.TITLE)
    private String searchTitle;

    /** Nội dung để tìm: nghĩa, collocation, định nghĩa, mô tả… */
    @Column(name = "search_text", length = ResourceSearchLimits.TEXT)
    private String searchText;

    /** Các tag (đã chuẩn hoá) cách nhau bằng khoảng trắng; mọi loại resource đều có. */
    @Column(name = "search_tags", length = ResourceSearchLimits.TAGS)
    private String searchTags;

    /** Chỉ từ vựng (EN và ZH): từ ở dạng chữ thường, gộp khoảng trắng, GIỮ dấu; dùng để kiểm tra trùng khi nhập. */
    @Column(name = "word_key", length = ResourceSearchLimits.WORD_KEY)
    private String wordKey;

    /** Cấp độ để lọc (chữ hoa): CEFR của từ vựng EN; sau này cấp HSK của ngữ pháp ZH (xem kế hoạch tách ngữ pháp EN/ZH). */
    @Column(name = "cefr_level", length = ResourceSearchLimits.CEFR)
    private String cefrLevel;

    /** Từ vựng EN và STUDY_MATERIAL: chủ đề để lọc/nhóm (giữ nguyên cách viết). */
    @Column(name = "topic", length = ResourceSearchLimits.TOPIC)
    private String topic;

    // Chỉ STUDY_MATERIAL (tài liệu tự học IELTS): bộ lọc của bản đã xuất bản, làm mới cùng các cột tìm kiếm.
    @Column(name = "study_category", length = 20)
    private String studyCategory;
    @Column(name = "study_source", length = 200)
    private String studySource;
    @Column(name = "study_band", length = 40)
    private String studyBand;
    @Column(name = "study_tier", length = 10)
    private String studyTier;
    @Column(name = "study_skill", length = 20)
    private String studySkill;
    @Column(name = "study_part", length = 10)
    private String studyPart;

    /** Chỉ từ vựng ZH: các bộ lọc đã chuẩn hoá (cấp HSK, từ đơn, bộ thủ, loại từ), mỗi giá trị có tên trường và dấu phân cách. */
    @Column(name = "vocabulary_facets", columnDefinition = "text")
    private String vocabularyFacets;

    /**
     * Chốt chặn cuối trước khi INSERT: cột tìm kiếm không bao giờ null cho dòng mới (null chỉ còn là dữ liệu có từ trước khi có cột). Giá trị đúng
     * do LearningResourceService.refreshSearchColumns tính; đây chỉ bảo đảm một dòng mới không lọt vào DB ở trạng thái "chưa điền".
     */
    @PrePersist
    void ensureSearchColumns() {
        if (searchTitle == null) searchTitle = "";
        if (searchText == null) searchText = "";
        if (searchTags == null) searchTags = "";
    }
}
