package pl.co.lms.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.dto.response.ContentPackageResponse;
import pl.co.lms.dto.response.ContentPackageVersionResourceResponse;
import pl.co.lms.dto.response.SessionResourceGroupResponse;
import pl.co.lms.dto.response.SyllabusPackageSummaryResponse;
import pl.co.lms.dto.response.SyllabusGradingSummaryResponse;
import pl.co.lms.dto.response.SyllabusSessionResourcesResponse;
import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionStatus;
import pl.co.lms.entity.ExercisePool;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.repository.ContentPackageRepository;
import pl.co.lms.repository.ContentPackageVersionRepository;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

// Học phần thuộc đúng một syllabus (cột syllabus_id trên content_packages): tra học phần theo syllabus cho giáo trình
// và cho học viên. syllabusId/syllabusVersionId là ID bên CMS (không FK cứng, CMS là hệ thống ngoài).
@Service
@RequiredArgsConstructor
@Transactional
public class SyllabusPackageService {

    private final ContentPackageRepository packageRepository;
    private final ContentPackageVersionRepository versionRepository;
    private final ContentPackageService packageService;
    private final ContentPackageVersionResourceService resourceService;

    @Transactional(readOnly = true)
    public List<ContentPackageResponse> listBySyllabusId(String syllabusId) {
        return packageService.listPackageResponsesByIds(
                packageRepository.findBySyllabusIdAndDeletedFalse(syllabusId).stream().map(ContentPackage::getId).toList());
    }

    // Các bài tập (ASSESSMENT) trong phiên bản đang dùng của từng học phần (đã xuất bản, chưa có thì bản nháp) kèm điều kiện đặt bài.
    @Transactional(readOnly = true)
    public SyllabusGradingSummaryResponse getGradingSummary(String syllabusId) {
        List<SyllabusGradingSummaryResponse.Item> items = new ArrayList<>();
        for (ContentPackageResponse pkg : listBySyllabusId(syllabusId)) {
            var version = pkg.publishedVersion() != null ? pkg.publishedVersion() : pkg.draftVersion();
            if (version == null) continue;
            for (ContentPackageVersionResourceResponse r : resourceService.listResourceResponses(version.id(), null)) {
                if (r.resourceType() != LearningResourceType.ASSESSMENT) continue;
                String title = r.resourceContent() instanceof QuizContent quiz ? quiz.getTitle() : null;
                items.add(new SyllabusGradingSummaryResponse.Item(
                        pkg.id(), version.title(), r.learningResourceId(), title, r.sessionNo(), r.settings()));
            }
        }
        return new SyllabusGradingSummaryResponse(items);
    }

    // Xác nhận đã rà lại học liệu sau khi giáo trình đổi phiên bản: đóng dấu phiên bản hiện tại lên mọi học phần của giáo trình.
    public int acknowledgeSyllabusVersion(String syllabusId, String syllabusVersionId) {
        return packageRepository.acknowledgeSyllabusVersion(syllabusId, syllabusVersionId, java.time.Instant.now());
    }

    @Transactional(readOnly = true)
    public List<SyllabusPackageSummaryResponse> getSyllabusPackageSummaries(List<String> syllabusIds) {
        if (syllabusIds == null || syllabusIds.isEmpty()) return List.of();

        List<ContentPackage> packages = packageRepository.findBySyllabusIdInAndDeletedFalse(syllabusIds);
        if (packages.isEmpty()) return List.of();

        Map<String, ContentPackageResponse> responsesById = packageService
                .listPackageResponsesByIds(packages.stream().map(ContentPackage::getId).toList()).stream()
                .collect(Collectors.toMap(ContentPackageResponse::id, Function.identity()));

        Map<String, List<SyllabusPackageSummaryResponse.Item>> bySyllabus = new java.util.LinkedHashMap<>();
        for (ContentPackage p : packages) {
            ContentPackageResponse pkg = responsesById.get(p.getId());
            if (pkg == null) continue;
            var version = pkg.publishedVersion() != null ? pkg.publishedVersion() : pkg.draftVersion();
            bySyllabus.computeIfAbsent(p.getSyllabusId(), k -> new ArrayList<>())
                    .add(new SyllabusPackageSummaryResponse.Item(
                            pkg.id(), pkg.type(),
                            version != null ? version.title() : null,
                            version != null ? version.level() : null,
                            version != null ? version.status().name() : null,
                            pkg.publishedVersion() != null && pkg.draftVersion() != null));
        }

        return bySyllabus.entrySet().stream()
                .map(e -> new SyllabusPackageSummaryResponse(e.getKey(), e.getValue()))
                .toList();
    }

    // Phiên bản học phần này có thuộc giáo trình (đang publish) và loại học phần có mở bài tập cho học viên không.
    // Dùng để kiểm tra phía server trước khi cho học sinh bắt đầu một bài (cùng quy tắc với getSessionResources).
    @Transactional(readOnly = true)
    public boolean isQuizAssignedToSyllabus(String syllabusId, String contentPackageVersionId) {
        return packageRepository.findBySyllabusIdAndDeletedFalse(syllabusId).stream()
                .anyMatch(pkg -> contentPackageVersionId.equals(pkg.getPublishedVersionId())
                        && pkg.getType().showsToStudents(LearningResourceType.ASSESSMENT));
    }

    @Transactional(readOnly = true)
    public SyllabusSessionResourcesResponse getSessionResources(String syllabusId, Integer sessionNo) {
        List<ContentPackage> packages = packageRepository.findBySyllabusIdAndDeletedFalse(syllabusId);
        if (packages.isEmpty()) {
            return SyllabusSessionResourcesResponse.EMPTY;
        }

        Map<LearningResourceType, List<ContentPackageVersionResourceResponse>> freeByType = new EnumMap<>(LearningResourceType.class);
        Map<ExercisePool, List<ContentPackageVersionResourceResponse>> exercisesByPool = new EnumMap<>(ExercisePool.class);

        for (ContentPackage pkg : packages) {
            // Học phần chưa publish (nháp) thì học sinh chưa thấy.
            if (pkg.getPublishedVersionId() == null) continue;
            ContentPackageVersion version = versionRepository.findByIdAndDeletedFalse(pkg.getPublishedVersionId()).orElse(null);
            if (version == null || version.getStatus() != ContentPackageVersionStatus.PUBLISHED) continue;

            List<ContentPackageVersionResourceResponse> resources =
                    resourceService.listResourceResponses(version.getId(), sessionNo);
            for (ContentPackageVersionResourceResponse r : resources) {
                // Chỉ lấy loại resource mà loại học phần này mở cho học viên (xem ContentPackageType).
                if (r.resourceType() == null || !pkg.getType().showsToStudents(r.resourceType())) continue;
                if (r.resourceType() == LearningResourceType.ASSESSMENT) {
                    // QUIZ resource: xếp vào nhóm bài tập theo loại học phần — không lộ nội dung, học sinh POST /assessment-attempts để nhận.
                    exercisesByPool.computeIfAbsent(pkg.getType().exercisePool(), k -> new ArrayList<>())
                            .add(r.withoutContent());
                } else {
                    freeByType.computeIfAbsent(r.resourceType(), k -> new ArrayList<>()).add(r);
                }
            }
        }

        return new SyllabusSessionResourcesResponse(
                group(LearningResourceType.SLIDE, freeByType),
                group(LearningResourceType.MATERIAL, freeByType),
                group(LearningResourceType.GRAMMAR, freeByType),
                group(LearningResourceType.VOCABULARY, freeByType),
                exerciseGroup(ExercisePool.QUICK_TEST, exercisesByPool),
                exerciseGroup(ExercisePool.GRAMMAR, exercisesByPool),
                exerciseGroup(ExercisePool.VOCABULARY, exercisesByPool));
    }

    private SessionResourceGroupResponse exerciseGroup(
            ExercisePool pool,
            Map<ExercisePool, List<ContentPackageVersionResourceResponse>> exercises) {
        return new SessionResourceGroupResponse(exercises.getOrDefault(pool, List.of()));
    }

    private SessionResourceGroupResponse group(
            LearningResourceType type,
            Map<LearningResourceType, List<ContentPackageVersionResourceResponse>> freeByType) {
        return new SessionResourceGroupResponse(freeByType.getOrDefault(type, List.of()));
    }
}
