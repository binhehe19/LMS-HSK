package pl.co.lms.service;

import base.co.common.exception.ApiException;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import pl.co.lms.client.CmsClient;
import pl.co.lms.client.dto.CmsSyllabusVersionSummary;
import pl.co.lms.dto.response.ContentPackageResponse;
import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageType;
import pl.co.lms.entity.ContentPackageVersionResource;
import pl.co.lms.entity.json.PlacementSettings;
import pl.co.lms.repository.ContentPackageRepository;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.repository.ContentPackageVersionResourceRepository;
import pl.co.lms.service.studymaterials.StudyMaterialVocabularyRefreshService;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/** Học phần tự do (syllabusId null): bộ lọc freeOnly và gắn tại chỗ chạy trên DB thật (H2) vì cập nhật có điều kiện cần kiểm bằng câu SQL. */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = {"spring.datasource.url=jdbc:h2:mem:freepackage;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect", "spring.flyway.enabled=false"})
@Import(ContentPackageService.class)
class FreePackageAttachTest {
    @MockBean CmsClient cmsClient;
    @MockBean LearningResourceService learningResources;
    @MockBean RedisSessionLockService locks;
    @MockBean StudyMaterialVocabularyRefreshService vocabularyRefresh;
    @Autowired ContentPackageService service;
    @Autowired ContentPackageRepository packages;
    @Autowired ContentPackageVersionRepository versions;
    @Autowired ContentPackageVersionResourceRepository links;
    @Autowired EntityManager entityManager;

    private ContentPackage free;
    private ContentPackage owned;

    @BeforeEach void seed() {
        packages.deleteAll(); versions.deleteAll();
        free = service.createPackage(ContentPackageType.GRAMMAR, null, null);
        owned = service.createPackage(ContentPackageType.GRAMMAR, "syl-1", "sv-1");
        service.createPackage(ContentPackageType.VOCABULARY, null, null);
        packages.flush();
    }

    private List<String> ids(boolean freeOnly, String syllabusId) {
        return service.searchPackageResponses(ContentPackageType.GRAMMAR, syllabusId, freeOnly, null, null, null, 0, 20)
                .getItems().stream().map(ContentPackageResponse::id).toList();
    }

    @Test void freeOnlyReturnsPackagesWithoutSyllabusOfTheTypeAndPagesCorrectly() {
        assertThat(ids(true, null)).containsExactly(free.getId());
        assertThat(ids(false, null)).containsExactlyInAnyOrder(free.getId(), owned.getId());
        var page = service.searchPackageResponses(ContentPackageType.GRAMMAR, null, true, null, null, null, 0, 1);
        assertThat(page.getTotalElements()).isEqualTo(1);
    }

    @Test void attachMovesTheSamePackageIntoTheSyllabusAndLeavesTheFreeList() {
        syllabusVersion("syl-9", "sv-9");
        ContentPackage attached = service.attachToSyllabus(free.getId(), "syl-9", "sv-9");

        assertThat(attached.getId()).isEqualTo(free.getId());
        assertThat(attached.getSyllabusId()).isEqualTo("syl-9");
        assertThat(attached.getSyllabusVersionId()).isEqualTo("sv-9");
        assertThat(ids(true, null)).isEmpty();
        assertThat(ids(false, "syl-9")).containsExactly(free.getId());
        assertThat(packages.count()).isEqualTo(3);
    }

    @Test void movesBoundPackageWithoutCreatingACopy() {
        syllabusVersion("syl-2", "sv-2");
        ContentPackage moved = service.attachToSyllabus(owned.getId(), "syl-2", "sv-2");

        assertThat(moved.getId()).isEqualTo(owned.getId());
        assertThat(moved.getSyllabusId()).isEqualTo("syl-2");
        assertThat(moved.getSyllabusVersionId()).isEqualTo("sv-2");
        assertThat(ids(false, "syl-1")).isEmpty();
        assertThat(ids(false, "syl-2")).containsExactly(owned.getId());
        assertThat(packages.count()).isEqualTo(3);
        assertThat(packages.acknowledgeSyllabusVersion("syl-1", "sv-old-next", java.time.Instant.now())).isZero();
        assertThat(packages.findById(owned.getId()).orElseThrow().getSyllabusVersionId()).isEqualTo("sv-2");
    }

    @Test void rejectsAVersionThatDoesNotBelongToTheDestination() {
        syllabusVersion("syl-2", "sv-2");
        assertThatThrownBy(() -> service.attachToSyllabus(owned.getId(), "syl-2", "sv-1"))
                .isInstanceOf(ApiException.class).hasMessageContaining("không thuộc");
        assertThat(packages.findById(owned.getId()).orElseThrow().getSyllabusId()).isEqualTo("syl-1");
    }

    @Test void moveClearsOnlySyllabusSpecificPlacementSettingsFromLiveVersions() {
        owned.setDraftVersionId("draft");
        owned.setPublishedVersionId("published");
        packages.saveAndFlush(owned);
        for (String versionId : List.of("draft", "published")) {
            links.save(ContentPackageVersionResource.builder()
                    .contentPackageVersionId(versionId).learningResourceId("resource")
                    .learningResourceVersionId("resource-version").sessionNo(2).displayOrder(3)
                    .settings(PlacementSettings.builder().maxAttempts(2).cloCodes(List.of("CLO1"))
                            .gradingItem(PlacementSettings.GradingItemRef.builder().name("Giữa kỳ").build()).build())
                    .build());
        }
        syllabusVersion("syl-2", "sv-2");

        service.attachToSyllabus(owned.getId(), "syl-2", "sv-2");
        links.flush();
        entityManager.clear();
        for (String versionId : List.of("draft", "published")) {
            var stored = links.findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc(versionId);
            assertThat(stored).singleElement().satisfies(link -> {
                assertThat(link.getLearningResourceVersionId()).isEqualTo("resource-version");
                assertThat(link.getSessionNo()).isEqualTo(2);
                assertThat(link.getDisplayOrder()).isEqualTo(3);
                assertThat(link.getSettings().getMaxAttempts()).isEqualTo(2);
                assertThat(link.getSettings().getCloCodes()).isNull();
                assertThat(link.getSettings().getGradingItem()).isNull();
            });
        }
    }

    private void syllabusVersion(String syllabusId, String versionId) {
        var version = new CmsSyllabusVersionSummary();
        version.setId(versionId);
        when(cmsClient.listSyllabusVersions(syllabusId)).thenReturn(List.of(version));
    }

    @Test void attachRejectsAnUnknownPackage() {
        assertThatThrownBy(() -> service.attachToSyllabus("does-not-exist", "syl-9", "sv-9"))
                .isInstanceOf(ApiException.class);
    }
}
