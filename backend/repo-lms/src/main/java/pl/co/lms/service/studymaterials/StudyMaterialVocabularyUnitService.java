package pl.co.lms.service.studymaterials;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.dto.response.StudyMaterialWordResponse;
import pl.co.lms.dto.response.StudyMaterialVocabularyPackageResponse;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.StudyMaterialContent.VocabularyUnit;
import pl.co.lms.entity.json.VocabularyEnContent;
import pl.co.lms.repository.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import static pl.co.lms.service.studymaterials.StudyMaterialValidation.require;

/** Dùng bản từ vựng đã ghim trong Unit, gồm cả bản sao riêng của học phần. */
@Service @Transactional(readOnly = true)
public class StudyMaterialVocabularyUnitService {
    private final ContentPackageRepository packages;
    private final ContentPackageVersionRepository packageVersions;
    private final ContentPackageVersionResourceRepository links;
    private final LearningResourceRepository resources;
    private final LearningResourceVersionRepository versions;
    private final ObjectMapper mapper;

    public StudyMaterialVocabularyUnitService(ContentPackageRepository packages, ContentPackageVersionRepository packageVersions,
            ContentPackageVersionResourceRepository links, LearningResourceRepository resources, LearningResourceVersionRepository versions, ObjectMapper mapper) {
        this.packages = packages; this.packageVersions = packageVersions; this.links = links;
        this.resources = resources; this.versions = versions; this.mapper = mapper;
    }
    public List<StudyMaterialVocabularyPackageResponse> options() {
        var result = new ArrayList<StudyMaterialVocabularyPackageResponse>();
        for (var pkg : packages.findByTypeAndDeletedFalseOrderByCreatedAtDesc(ContentPackageType.VOCABULARY)) {
            if (pkg.getPublishedVersionId() == null) continue;
            var version = packageVersions.findByIdAndDeletedFalse(pkg.getPublishedVersionId()).orElse(null);
            if (version == null || version.getStatus() != ContentPackageVersionStatus.PUBLISHED || !pkg.getId().equals(version.getPackageId())) continue;
            var rows = links.findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc(version.getId());
            int count = Math.max(Objects.requireNonNullElse(version.getSessionCount(), 0), rows.stream().mapToInt(ContentPackageVersionResource::getSessionNo).max().orElse(0));
            var units = java.util.stream.IntStream.rangeClosed(1, count).mapToObj(StudyMaterialVocabularyPackageResponse.Unit::new).toList();
            result.add(new StudyMaterialVocabularyPackageResponse(pkg.getId(), version.getId(), version.getTitle(), units));
        }
        return result;
    }

    public LinkedHashMap<String, StudyMaterialWordResponse> words(VocabularyUnit unit) {
        require(unit != null && unit.packageVersionId() != null && unit.sessionNo() > 0, "Chọn gói từ vựng và Unit cho bài Diglot");
        var version = packageVersions.findByIdAndDeletedFalse(unit.packageVersionId()).orElse(null);
        require(version != null && version.getStatus() == ContentPackageVersionStatus.PUBLISHED, "Unit phải thuộc phiên bản gói từ vựng đã xuất bản");
        var pkg = packages.findByIdAndDeletedFalse(version.getPackageId()).orElse(null);
        require(pkg != null && pkg.getType() == ContentPackageType.VOCABULARY, "Unit không thuộc gói từ vựng");
        var all = links.findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc(version.getId());
        int count = Math.max(Objects.requireNonNullElse(version.getSessionCount(), 0), all.stream().mapToInt(ContentPackageVersionResource::getSessionNo).max().orElse(0));
        require(unit.sessionNo() <= count, "Unit không tồn tại trong gói từ vựng");
        var rows = all.stream().filter(row -> row.getSessionNo() == unit.sessionNo()).toList();
        var result = new LinkedHashMap<String, StudyMaterialWordResponse>();
        if (rows.isEmpty()) return result;
        var byResource = resources.findByIdInAndDeletedFalse(rows.stream().map(ContentPackageVersionResource::getLearningResourceId).distinct().toList()).stream()
                .filter(resource -> resource.getType() == LearningResourceType.VOCABULARY && ResourceSubTypes.isEnglish(resource.getSubType())).collect(Collectors.toMap(LearningResource::getId, Function.identity()));
        var byVersion = versions.findByIdInAndDeletedFalse(rows.stream().map(ContentPackageVersionResource::getLearningResourceVersionId).distinct().toList()).stream()
                .collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));
        for (var row : rows) {
            var word = byResource.get(row.getLearningResourceId()); var published = byVersion.get(row.getLearningResourceVersionId());
            if (word == null || published == null || published.getStatus() != LearningResourceVersionStatus.PUBLISHED || !word.getId().equals(published.getResourceId())) continue;
            var content = published.getContentAs(VocabularyEnContent.class, mapper);
            if (content == null || content.getWord() == null || content.getWord().isBlank()) continue;
            result.putIfAbsent(word.getId(), new StudyMaterialWordResponse(word.getId(), published.getId(), content, false, false));
        }
        return result;
    }
}
