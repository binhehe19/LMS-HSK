package pl.co.lms.service;

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
import pl.co.lms.dto.response.ContentPackageResponse;
import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageType;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionStatus;
import pl.co.lms.repository.ContentPackageRepository;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.service.studymaterials.StudyMaterialVocabularyRefreshService;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Admin package list: keyword, status and level are applied by the server query, so paging and totals count only matches. */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = {"spring.datasource.url=jdbc:h2:mem:packagesearch;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect", "spring.flyway.enabled=false"})
@Import(ContentPackageService.class)
class ContentPackageSearchTest {
    @MockBean CmsClient cmsClient;
    @MockBean LearningResourceService learningResources;
    @MockBean RedisSessionLockService locks;
    @MockBean StudyMaterialVocabularyRefreshService vocabularyRefresh;
    @Autowired ContentPackageService service;
    @Autowired ContentPackageRepository packages;
    @Autowired ContentPackageVersionRepository versions;

    private ContentPackage present, past, modal;

    private ContentPackage create(ContentPackageType type, String title, String description, String level, boolean published) {
        ContentPackage pkg = packages.saveAndFlush(ContentPackage.builder().type(type).syllabusId("syl-1").syllabusVersionId("sv-1").build());
        ContentPackageVersion version = versions.saveAndFlush(ContentPackageVersion.builder().packageId(pkg.getId()).version(1)
                .status(published ? ContentPackageVersionStatus.PUBLISHED : ContentPackageVersionStatus.DRAFT)
                .title(title).description(description).level(level).build());
        if (published) pkg.setPublishedVersionId(version.getId()); else pkg.setDraftVersionId(version.getId());
        return packages.saveAndFlush(pkg);
    }

    @BeforeEach void seed() {
        packages.deleteAll(); versions.deleteAll();
        present = create(ContentPackageType.GRAMMAR, "Present tenses", "<p>basics of time</p>", "A1", true);
        past = create(ContentPackageType.GRAMMAR, "Past tenses", "", "B1", false);
        modal = create(ContentPackageType.GRAMMAR, "Modal verbs", "can, must, should", "A1", true);
        create(ContentPackageType.VOCABULARY, "Present vocabulary", "", "A1", true);
    }

    private List<String> titles(String keyword, String status, String level, int page, int size) {
        return service.searchPackageResponses(ContentPackageType.GRAMMAR, null, keyword, status, level, page, size)
                .getItems().stream().map(ContentPackageResponse::id).toList();
    }

    @Test void keywordMatchesTitleDescriptionAndCodeWithoutCaseSensitivity() {
        assertThat(titles("PRESENT", null, null, 0, 20)).containsExactly(present.getId());
        assertThat(titles("tenses", null, null, 0, 20)).containsExactlyInAnyOrder(present.getId(), past.getId());
        assertThat(titles("must", null, null, 0, 20)).containsExactly(modal.getId());
        assertThat(titles(modal.getId().toLowerCase(),null, null, 0, 20)).containsExactly(modal.getId());
        assertThat(titles("100%", null, null, 0, 20)).isEmpty();
    }

    @Test void statusAndLevelNarrowTheResultAndCombineWithKeyword() {
        assertThat(titles(null, "DRAFT", null, 0, 20)).containsExactly(past.getId());
        assertThat(titles(null, "PUBLISHED", null, 0, 20)).containsExactlyInAnyOrder(present.getId(), modal.getId());
        assertThat(titles(null, null, "A1", 0, 20)).containsExactlyInAnyOrder(present.getId(), modal.getId());
        assertThat(titles("modal", null, "A1", 0, 20)).containsExactly(modal.getId());
        assertThat(titles("modal", null, "B1", 0, 20)).isEmpty();
    }

    @Test void totalsAndPagesCountOnlyTheMatchesOfThePackageType() {
        var page = service.searchPackageResponses(ContentPackageType.GRAMMAR, null, null, null, null, 0, 2);
        assertThat(page.getTotalElements()).isEqualTo(3);
        assertThat(page.getTotalPages()).isEqualTo(2);
        assertThat(page.getItems()).hasSize(2);
        assertThat(titles(null, null, null, 1, 2)).hasSize(1);
        assertThat(service.searchPackageResponses(ContentPackageType.GRAMMAR, null, "tenses", null, null, 0, 20).getTotalElements()).isEqualTo(2);
    }
}
