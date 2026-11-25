package pl.co.lms.service;

import base.co.common.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageType;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionResource;
import pl.co.lms.entity.ContentPackageVersionStatus;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.LearningResourceVersion;
import pl.co.lms.repository.ContentPackageRepository;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.repository.ContentPackageVersionResourceRepository;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.LearningResourceVersionRepository;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContentPackageVersionResourceServiceTest {

    @Mock private ContentPackageVersionResourceRepository linkRepository;
    @Mock private ContentPackageVersionRepository packageVersionRepository;
    @Mock private ContentPackageRepository packageRepository;
    @Mock private LearningResourceRepository resourceRepository;
    @Mock private LearningResourceVersionRepository resourceVersionRepository;
    @Mock private LearningResourceService learningResourceService;
    @Mock private pl.co.lms.repository.ContentPackageVersionTopicRepository topicRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private ContentPackageVersionResourceService service;

    @BeforeEach
    void setUp() {
        service = new ContentPackageVersionResourceService(
                linkRepository, packageVersionRepository, packageRepository, resourceRepository,
                resourceVersionRepository, learningResourceService, objectMapper, topicRepository);
    }

    // ── Shared helpers ────────────────────────────────────────────────────────

    private static ContentPackageVersion draftVersion() {
        ContentPackageVersion v = new ContentPackageVersion();
        v.setStatus(ContentPackageVersionStatus.DRAFT);
        v.setPackageId("pkg-1");
        return v;
    }

    private static ContentPackageVersion publishedVersion() {
        ContentPackageVersion v = new ContentPackageVersion();
        v.setStatus(ContentPackageVersionStatus.PUBLISHED);
        return v;
    }

    private void stubDraftVersion() {
        when(packageVersionRepository.findByIdAndDeletedFalse("cpv-1")).thenReturn(Optional.of(draftVersion()));
    }

    private void packageOfType(ContentPackageType type) {
        when(packageRepository.findByIdAndDeletedFalse("pkg-1"))
                .thenReturn(Optional.of(ContentPackage.builder().type(type).build()));
    }

    private LearningResource resourceOfType(String id, LearningResourceType type) {
        LearningResource resource = LearningResource.builder().type(type).build();
        resource.setId(id);
        when(resourceRepository.findByIdAndDeletedFalse(id)).thenReturn(Optional.of(resource));
        return resource;
    }

    private ContentPackageVersionResource linkTo(String resourceId, String versionId) {
        ContentPackageVersionResource link = ContentPackageVersionResource.builder()
                .contentPackageVersionId("cpv-1").learningResourceId(resourceId)
                .learningResourceVersionId(versionId).sessionNo(1).displayOrder(0).build();
        when(linkRepository.findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc("cpv-1"))
                .thenReturn(List.of(link));
        return link;
    }

    // ── addResourceToSession ──────────────────────────────────────────────────

    @Test
    void addResourceToSession_OnPublishedVersion_Throws() {
        when(packageVersionRepository.findByIdAndDeletedFalse("cpv-1")).thenReturn(Optional.of(publishedVersion()));

        assertThatThrownBy(() -> service.addResourceToSession("cpv-1", "res-1", "ver-1", 1, 0))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("DRAFT");
    }

    @Test
    void addResourceToSession_SessionNoZero_Throws() {
        stubDraftVersion();
        packageOfType(ContentPackageType.GRAMMAR);

        assertThatThrownBy(() -> service.addResourceToSession("cpv-1", "res-1", "ver-1", 0, 0))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining(">= 1");
    }

    @Test
    void addResourceToSession_QuizInGrammarPackage_Succeeds() {
        // Package không giới hạn loại resource được gắn — chỉ để phân loại hiển thị cho người soạn.
        stubDraftVersion();
        resourceOfType("res-1", LearningResourceType.ASSESSMENT);
        when(resourceVersionRepository.findByIdAndDeletedFalse("ver-1")).thenReturn(Optional.of(new LearningResourceVersion()));
        when(linkRepository.existsByContentPackageVersionIdAndSessionNoAndDisplayOrderAndDeletedFalse("cpv-1", 1, 0)).thenReturn(false);
        when(linkRepository.save(any(ContentPackageVersionResource.class))).thenAnswer(i -> i.getArgument(0));

        ContentPackageVersionResource result = service.addResourceToSession("cpv-1", "res-1", "ver-1", 1, 0);
        assertThat(result.getSessionNo()).isEqualTo(1);
    }

    @Test
    void addResourceToSession_SkillPracticeTest_Throws() {
        // Đề luyện kỹ năng chỉ dành cho màn luyện đề của học sinh, không xếp vào buổi học.
        stubDraftVersion();
        resourceOfType("res-1", LearningResourceType.ASSESSMENT).setSubType(ResourceSubTypes.PRACTICE_READING);

        assertThatThrownBy(() -> service.addResourceToSession("cpv-1", "res-1", "ver-1", 1, 0))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("QUIZ");
    }

    @Test
    void addResourceToSession_QuizTypedAssessment_Succeeds() {
        stubDraftVersion();
        resourceOfType("res-1", LearningResourceType.ASSESSMENT).setSubType(ResourceSubTypes.QUIZ);
        when(resourceVersionRepository.findByIdAndDeletedFalse("ver-1")).thenReturn(Optional.of(new LearningResourceVersion()));
        when(linkRepository.existsByContentPackageVersionIdAndSessionNoAndDisplayOrderAndDeletedFalse("cpv-1", 1, 0)).thenReturn(false);
        when(linkRepository.save(any(ContentPackageVersionResource.class))).thenAnswer(i -> i.getArgument(0));

        assertThat(service.addResourceToSession("cpv-1", "res-1", "ver-1", 1, 0).getSessionNo()).isEqualTo(1);
    }

    @Test
    void addResourceToSession_Success() {
        stubDraftVersion();
        resourceOfType("res-1", LearningResourceType.GRAMMAR);
        when(resourceVersionRepository.findByIdAndDeletedFalse("ver-1")).thenReturn(Optional.of(new LearningResourceVersion()));
        when(linkRepository.existsByContentPackageVersionIdAndSessionNoAndDisplayOrderAndDeletedFalse("cpv-1", 1, 0)).thenReturn(false);
        when(linkRepository.save(any(ContentPackageVersionResource.class))).thenAnswer(i -> {
            ContentPackageVersionResource r = i.getArgument(0);
            r.setId("link-1");
            return r;
        });

        ContentPackageVersionResource result = service.addResourceToSession("cpv-1", "res-1", "ver-1", 1, 0);
        assertThat(result.getId()).isEqualTo("link-1");
        assertThat(result.getSessionNo()).isEqualTo(1);
        assertThat(result.getDisplayOrder()).isEqualTo(0);
    }

    @Test
    void addResourceToSession_DuplicateSlotThrows() {
        stubDraftVersion();
        resourceOfType("res-1", LearningResourceType.GRAMMAR);
        when(resourceVersionRepository.findByIdAndDeletedFalse("ver-1")).thenReturn(Optional.of(new LearningResourceVersion()));
        when(linkRepository.existsByContentPackageVersionIdAndSessionNoAndDisplayOrderAndDeletedFalse("cpv-1", 1, 0)).thenReturn(true);

        assertThatThrownBy(() -> service.addResourceToSession("cpv-1", "res-1", "ver-1", 1, 0))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already exists");
    }

    // ── removeResourceFromSession ─────────────────────────────────────────────

    @Test
    void removeResourceFromSession_OnPublishedVersion_Throws() {
        when(packageVersionRepository.findByIdAndDeletedFalse("cpv-1")).thenReturn(Optional.of(publishedVersion()));

        assertThatThrownBy(() -> service.removeResourceFromSession("cpv-1", "res-1"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("DRAFT");
    }

    // ── reorderSessionResources ───────────────────────────────────────────────

    @Test
    void reorderSessionResources_OnPublishedVersion_Throws() {
        when(packageVersionRepository.findByIdAndDeletedFalse("cpv-1")).thenReturn(Optional.of(publishedVersion()));

        assertThatThrownBy(() -> service.reorderSessionResources("cpv-1", 1, List.of("res-A", "res-B")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("DRAFT");
    }

    @Test
    void reorderSessionResources_UpdatesOrders() {
        stubDraftVersion();

        ContentPackageVersionResource linkA = ContentPackageVersionResource.builder()
                .contentPackageVersionId("cpv-1").learningResourceId("res-A").sessionNo(1).displayOrder(0).build();
        ContentPackageVersionResource linkB = ContentPackageVersionResource.builder()
                .contentPackageVersionId("cpv-1").learningResourceId("res-B").sessionNo(1).displayOrder(1).build();

        when(linkRepository.findByContentPackageVersionIdAndSessionNoAndDeletedFalseOrderByDisplayOrderAsc("cpv-1", 1))
                .thenReturn(List.of(linkA, linkB));

        service.reorderSessionResources("cpv-1", 1, List.of("res-B", "res-A"));

        assertThat(linkB.getDisplayOrder()).isEqualTo(0);
        assertThat(linkA.getDisplayOrder()).isEqualTo(1);
        verify(linkRepository, times(2)).saveAll(List.of(linkA, linkB));
        verify(linkRepository).flush();
    }

    // ── updateResourceContentWithinPackage ────────────────────────────────────

    @Test
    void updateResourceContent_UpdatesLinkToNewPublishedVersion() {
        stubDraftVersion();
        ContentPackageVersionResource link = linkTo("res-1", "ver-1-old");
        resourceOfType("res-1", LearningResourceType.VOCABULARY);

        Object content = new pl.co.lms.entity.json.VocabularyEnContent();
        LearningResourceVersion newVersion = LearningResourceVersion.builder().resourceId("res-1").version(2).build();
        newVersion.setId("ver-1-v2");
        when(learningResourceService.createDraftVersion("res-1", content)).thenReturn(newVersion);
        when(learningResourceService.publishVersion("res-1", "ver-1-v2")).thenReturn(newVersion);

        LearningResourceVersion result = service.updateResourceContentWithinPackage("cpv-1", "res-1", content);

        assertThat(result.getId()).isEqualTo("ver-1-v2");
        assertThat(link.getLearningResourceVersionId()).isEqualTo("ver-1-v2");
        verify(linkRepository).save(link);
    }

    // ── updateSettings (điều kiện của bài trong học phần) ─────────────────────

    @Test
    void updateSettings_OnDraftAssessment_SavesAndValidates() {
        stubDraftVersion();
        resourceOfType("res-1", LearningResourceType.ASSESSMENT);
        ContentPackageVersionResource link = linkTo("res-1", "ver-1");
        when(linkRepository.save(any(ContentPackageVersionResource.class))).thenAnswer(i -> i.getArgument(0));

        var settings = pl.co.lms.entity.json.PlacementSettings.builder().maxAttempts(2).passThresholdPct(70).build();
        service.updateSettings("cpv-1", "res-1", settings);
        assertThat(link.getSettings()).isSameAs(settings);

        service.updateSettings("cpv-1", "res-1", null);
        assertThat(link.getSettings()).isNull();

        var invalid = pl.co.lms.entity.json.PlacementSettings.builder().maxAttempts(9).build();
        assertThatThrownBy(() -> service.updateSettings("cpv-1", "res-1", invalid)).isInstanceOf(ApiException.class);
    }

    @Test
    void updateSettings_OnPublishedVersionOrNonAssessment_Throws() {
        when(packageVersionRepository.findByIdAndDeletedFalse("cpv-1")).thenReturn(Optional.of(publishedVersion()));
        assertThatThrownBy(() -> service.updateSettings("cpv-1", "res-1", null))
                .isInstanceOf(ApiException.class).hasMessageContaining("DRAFT");
    }

    @Test
    void updateSettings_NonAssessmentResource_Throws() {
        stubDraftVersion();
        resourceOfType("res-2", LearningResourceType.VOCABULARY);
        linkTo("res-2", "ver-2");
        assertThatThrownBy(() -> service.updateSettings("cpv-1", "res-2", new pl.co.lms.entity.json.PlacementSettings()))
                .isInstanceOf(ApiException.class).hasMessageContaining("bài tập");
    }}
