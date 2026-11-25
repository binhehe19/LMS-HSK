package pl.co.lms.integration;

import base.co.common.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageType;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionSession;
import pl.co.lms.entity.ContentPackageVersionStatus;
import pl.co.lms.repository.ContentPackageRepository;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.service.ContentPackageService;
import pl.co.lms.service.ContentPackageVersionSessionService;
import pl.co.lms.service.LearningResourceService;
import pl.co.lms.service.RedisSessionLockService;
import pl.co.lms.service.studymaterials.StudyMaterialVocabularyRefreshService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

/** Tên buổi: tùy chọn, mỗi buổi một dòng, chỉ ghi trên bản nháp, sống qua tạo bản nháp/sao chép và mất khi hủy nháp. */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:sessionname;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.flyway.enabled=false"})
@Import({JacksonAutoConfiguration.class, ContentPackageService.class, ContentPackageVersionSessionService.class})
class SessionNameTest {

    @MockBean LearningResourceService learningResources;
    @MockBean RedisSessionLockService locks;
    @MockBean StudyMaterialVocabularyRefreshService vocabularyRefresh;

    @Autowired ContentPackageService packageService;
    @Autowired ContentPackageVersionSessionService sessions;
    @Autowired ContentPackageRepository packages;
    @Autowired ContentPackageVersionRepository versions;

    private ContentPackage pkg;
    private String versionId;

    @BeforeEach
    void seed() {
        pkg = packages.saveAndFlush(ContentPackage.builder().type(ContentPackageType.GRAMMAR).build());
        ContentPackageVersion version = versions.saveAndFlush(ContentPackageVersion.builder().packageId(pkg.getId()).version(1)
                .status(ContentPackageVersionStatus.DRAFT).title("Học phần").build());
        pkg.setDraftVersionId(version.getId());
        packages.saveAndFlush(pkg);
        versionId = version.getId();
    }

    private void publish() {
        ContentPackageVersion version = versions.findById(versionId).orElseThrow();
        version.setStatus(ContentPackageVersionStatus.PUBLISHED);
        versions.saveAndFlush(version);
        pkg.setPublishedVersionId(versionId);
        pkg.setDraftVersionId(null);
        packages.saveAndFlush(pkg);
    }

    @Test
    void settingTheSameSessionTwiceRenamesInPlaceAndListIsOrderedBySession() {
        var first = sessions.set(versionId, 1, "  Bài 01 ");
        assertThat(first.getTitle()).isEqualTo("Bài 01");

        var renamed = sessions.set(versionId, 1, "Bài 1 mới");
        assertThat(renamed.getId()).isEqualTo(first.getId());
        sessions.set(versionId, 3, "Bài 03");

        var list = sessions.list(versionId);
        assertThat(list).extracting(ContentPackageVersionSession::getSessionNo).containsExactly(1, 3);
        assertThat(list).extracting(ContentPackageVersionSession::getTitle).containsExactly("Bài 1 mới", "Bài 03");
    }

    @Test
    void titleAndSessionNoRulesAreEnforced() {
        assertThrows(ApiException.class, () -> sessions.set(versionId, 1, "   "));
        assertThrows(ApiException.class, () -> sessions.set(versionId, 1, null));
        assertThrows(ApiException.class, () -> sessions.set(versionId, 1, "x".repeat(201)));
        assertThrows(ApiException.class, () -> sessions.set(versionId, 0, "Buổi sai"));
        assertThrows(ApiException.class, () -> sessions.clear(versionId, 0));
        assertThat(sessions.list(versionId)).isEmpty();
    }

    @Test
    void sameTitleIsAllowedOnDifferentSessions() {
        sessions.set(versionId, 1, "Nghe");
        sessions.set(versionId, 2, "Nghe");
        assertThat(sessions.list(versionId)).hasSize(2);
    }

    @Test
    void clearRemovesOnlyTheNameAndNamingAgainCreatesASingleRow() {
        sessions.set(versionId, 2, "Bài 02");
        sessions.clear(versionId, 2);
        assertThat(sessions.list(versionId)).isEmpty();

        sessions.clear(versionId, 2); // không có tên thì không lỗi
        sessions.set(versionId, 2, "Bài 02 lại");
        assertThat(sessions.list(versionId)).extracting(ContentPackageVersionSession::getTitle).containsExactly("Bài 02 lại");
    }

    @Test
    void sessionNamesCannotBeChangedOnPublishedVersion() {
        sessions.set(versionId, 1, "Bài 01");
        publish();

        assertThrows(ApiException.class, () -> sessions.set(versionId, 1, "Đổi tên"));
        assertThrows(ApiException.class, () -> sessions.clear(versionId, 1));
        assertThat(sessions.list(versionId)).extracting(ContentPackageVersionSession::getTitle).containsExactly("Bài 01");
    }

    @Test
    void draftFromPublishedKeepsNamesWithNewIdsAndDiscardingTheDraftRemovesOnlyItsNames() {
        var original = sessions.set(versionId, 1, "Bài 01");
        publish();

        ContentPackageVersion draft = packageService.ensureDraftForEdit(pkg.getId());

        assertThat(draft.getId()).isNotEqualTo(versionId);
        var cloned = sessions.list(draft.getId());
        assertThat(cloned).extracting(ContentPackageVersionSession::getTitle).containsExactly("Bài 01");
        assertThat(cloned.get(0).getId()).isNotEqualTo(original.getId());

        when(locks.isHeldBy("pkg-edit-lock", pkg.getId(), "tok")).thenReturn(true);
        packageService.discardDraft(pkg.getId(), "tok");

        assertThat(sessions.list(draft.getId())).isEmpty();
        assertThat(sessions.list(versionId)).extracting(ContentPackageVersionSession::getTitle).containsExactly("Bài 01");
    }

    @Test
    void copyPackageClonesSessionNamesAndLeavesTheSourceUntouched() {
        var original = sessions.set(versionId, 1, "Bài 01");
        sessions.set(versionId, 2, "Bài 02");

        ContentPackage copy = packageService.copyPackage(pkg.getId(), "syl-2", "sv-2", "Bản sao");

        var copied = sessions.list(copy.getDraftVersionId());
        assertThat(copied).extracting(ContentPackageVersionSession::getTitle).containsExactly("Bài 01", "Bài 02");
        assertThat(copied).extracting(ContentPackageVersionSession::getId).doesNotContain(original.getId());
        assertThat(sessions.list(versionId)).hasSize(2);
    }

    @Test
    void packageWithoutAnyNamedSessionStillClonesAndCopies() {
        publish();

        ContentPackageVersion draft = packageService.ensureDraftForEdit(pkg.getId());
        ContentPackage copy = packageService.copyPackage(pkg.getId(), "syl-2", "sv-2", "Bản sao");

        assertThat(sessions.list(draft.getId())).isEmpty();
        assertThat(sessions.list(copy.getDraftVersionId())).isEmpty();
    }
}
