package pl.co.lms.service.studymaterials;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.StudyMaterialContent;
import pl.co.lms.repository.*;
import pl.co.lms.service.LearningResourceService;

/** Cập nhật chỉ khi xuất bản bộ từ mới; học viên mở bài không chạy quy trình này. */
@Service @Transactional
public class StudyMaterialVocabularyRefreshService {
    private final LearningResourceRepository resources;
    private final LearningResourceVersionRepository versions;
    private final ContentPackageVersionRepository packages;
    private final LearningResourceService library;
    private final StudyMaterialVocabularyService vocabulary;
    private final ObjectMapper mapper;

    public StudyMaterialVocabularyRefreshService(LearningResourceRepository resources, LearningResourceVersionRepository versions,
            ContentPackageVersionRepository packages, LearningResourceService library, StudyMaterialVocabularyService vocabulary, ObjectMapper mapper) {
        this.resources = resources; this.versions = versions; this.packages = packages;
        this.library = library; this.vocabulary = vocabulary; this.mapper = mapper;
    }
    public void refreshPackage(String packageId, String packageVersionId) {
        // Chỉ học liệu Diglot mới gắn với Unit của gói từ vựng; lọc ngay ở DB (cột study_category có chỉ mục) thay vì khoá mọi học liệu.
        for (var candidate : resources.findByTypeAndStudyCategoryAndDeletedFalseOrderByCreatedAtDesc(
                LearningResourceType.STUDY_MATERIAL, StudyMaterialCategory.DIGLOT.path())) {
            var resource = resources.findByIdForStart(candidate.getId()).orElse(null);
            if (resource == null) continue;
            String draftId = resource.getDraftVersionId();
            var published = bound(resource.getPublishedVersionId(), packageId, packageVersionId);
            if (published != null) {
                published.setVocabularyUnit(new StudyMaterialContent.VocabularyUnit(packageVersionId, published.getVocabularyUnit().sessionNo()));
                vocabulary.precompute(published);
                var next = library.createDraftVersion(resource.getId(), published);
                library.publishVersion(resource.getId(), next.getId());
                // Bản nháp tác giả đang soạn có nội dung riêng, cần giữ lại.
                library.restoreDraftVersion(resource.getId(), draftId);
            }
            var draft = bound(draftId, packageId, packageVersionId);
            if (draft != null) {
                draft.setVocabularyUnit(new StudyMaterialContent.VocabularyUnit(packageVersionId, draft.getVocabularyUnit().sessionNo()));
                vocabulary.precompute(draft);
                library.updateDraftVersion(resource.getId(), draftId, draft);
            }
        }
    }
    private StudyMaterialContent bound(String versionId, String packageId, String nextVersionId) {
        if (versionId == null) return null;
        var version = versions.findByIdAndDeletedFalse(versionId).orElse(null);
        if (version == null) return null;
        var content = version.getContentAs(StudyMaterialContent.class, mapper);
        if (content == null || content.getCategory() != StudyMaterialCategory.DIGLOT || content.getVocabularyUnit() == null) return null;
        var source = content.getVocabularyUnit();
        if (nextVersionId.equals(source.packageVersionId()) && content.getVocabularyIndex() != null) return null;
        var pkg = packages.findByIdAndDeletedFalse(source.packageVersionId()).orElse(null);
        return pkg != null && packageId.equals(pkg.getPackageId()) ? content : null;
    }
}
