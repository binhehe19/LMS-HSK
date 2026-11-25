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
import pl.co.lms.dto.response.ContentPackageVersionResourceResponse;
import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageType;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionStatus;
import pl.co.lms.entity.ContentPackageVersionTopic;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.LearningResourceVersion;
import pl.co.lms.entity.LearningResourceVersionStatus;
import pl.co.lms.repository.ContentPackageRepository;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.LearningResourceVersionRepository;
import pl.co.lms.service.ContentPackageService;
import pl.co.lms.service.ContentPackageVersionResourceService;
import pl.co.lms.service.ContentPackageVersionTopicService;
import pl.co.lms.service.LearningResourceService;
import pl.co.lms.service.RedisSessionLockService;
import pl.co.lms.service.studymaterials.StudyMaterialVocabularyRefreshService;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Chủ đề trong buổi: tồn tại độc lập (kể cả rỗng), ràng buộc cùng buổi, xóa không mất học liệu, sống qua sao chép học phần. */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:sessiontopic;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.flyway.enabled=false"})
@Import({JacksonAutoConfiguration.class, ContentPackageService.class, ContentPackageVersionResourceService.class,
        ContentPackageVersionTopicService.class})
class SessionTopicTest {

    @MockBean LearningResourceService learningResources;
    @MockBean RedisSessionLockService locks;
    @MockBean StudyMaterialVocabularyRefreshService vocabularyRefresh;

    @Autowired ContentPackageService packageService;
    @Autowired ContentPackageVersionResourceService links;
    @Autowired ContentPackageVersionTopicService topics;
    @Autowired ContentPackageRepository packages;
    @Autowired ContentPackageVersionRepository versions;
    @Autowired LearningResourceRepository resources;
    @Autowired LearningResourceVersionRepository resourceVersions;

    private ContentPackage pkg;
    private String versionId;
    private String resA, resAVersion, resB, resBVersion;

    @BeforeEach
    void seed() {
        pkg = packages.saveAndFlush(ContentPackage.builder().type(ContentPackageType.GRAMMAR).syllabusId("syl-1").syllabusVersionId("sv-1").build());
        ContentPackageVersion version = versions.saveAndFlush(ContentPackageVersion.builder().packageId(pkg.getId()).version(1)
                .status(ContentPackageVersionStatus.DRAFT).title("Học phần").build());
        pkg.setDraftVersionId(version.getId());
        packages.saveAndFlush(pkg);
        versionId = version.getId();
        LearningResource a = resources.saveAndFlush(LearningResource.builder().type(LearningResourceType.VOCABULARY).build());
        LearningResource b = resources.saveAndFlush(LearningResource.builder().type(LearningResourceType.VOCABULARY).build());
        resA = a.getId();
        resB = b.getId();
        resAVersion = resourceVersions.saveAndFlush(LearningResourceVersion.builder().resourceId(resA).version(1)
                .status(LearningResourceVersionStatus.PUBLISHED).build()).getId();
        resBVersion = resourceVersions.saveAndFlush(LearningResourceVersion.builder().resourceId(resB).version(1)
                .status(LearningResourceVersionStatus.PUBLISHED).build()).getId();
    }

    private ContentPackageVersionResourceResponse find(String versionId, String resourceId) {
        return links.listResourceResponses(versionId, null).stream()
                .filter(r -> r.learningResourceId().equals(resourceId)).findFirst().orElseThrow();
    }

    @Test
    void emptyTopicExistsOnItsOwnAndOrderFollowsCreation() {
        var first = topics.create(versionId, 1, "  Gia đình ");
        var second = topics.create(versionId, 1, "Trường học");
        assertThat(first.getTitle()).isEqualTo("Gia đình");
        assertThat(topics.list(versionId, 1)).extracting(ContentPackageVersionTopic::getTitle).containsExactly("Gia đình", "Trường học");
        assertThat(second.getTopicOrder()).isGreaterThan(first.getTopicOrder());

        topics.reorder(versionId, 1, List.of(second.getId(), first.getId()));
        assertThat(topics.list(versionId, 1)).extracting(ContentPackageVersionTopic::getTitle).containsExactly("Trường học", "Gia đình");
        assertThrows(ApiException.class, () -> topics.reorder(versionId, 1, List.of(first.getId())));
    }

    @Test
    void titleRulesAreEnforcedPerSession() {
        topics.create(versionId, 1, "Gia đình");
        assertThrows(ApiException.class, () -> topics.create(versionId, 1, "gia đình"));
        assertThrows(ApiException.class, () -> topics.create(versionId, 1, "   "));
        assertThrows(ApiException.class, () -> topics.create(versionId, 1, "x".repeat(201)));
        assertThrows(ApiException.class, () -> topics.create(versionId, 0, "Buổi sai"));
        assertThat(topics.create(versionId, 2, "Gia đình").getSessionNo()).isEqualTo(2);
    }

    @Test
    void resourceJoinsTopicOfItsOwnSessionOnly() {
        var session1 = topics.create(versionId, 1, "Bộ 1");
        var session2 = topics.create(versionId, 2, "Bộ khác buổi");

        assertThrows(ApiException.class, () -> links.addResourceToSession(versionId, resA, resAVersion, 1, 0, session2.getId()));
        links.addResourceToSession(versionId, resA, resAVersion, 1, 0, session1.getId());
        links.addResourceToSession(versionId, resB, resBVersion, 1, 1);

        ContentPackageVersionResourceResponse inTopic = find(versionId, resA);
        assertThat(inTopic.topicId()).isEqualTo(session1.getId());
        assertThat(inTopic.topicTitle()).isEqualTo("Bộ 1");
        assertThat(inTopic.topicOrder()).isEqualTo(session1.getTopicOrder());
        assertThat(find(versionId, resB).topicId()).isNull();
        // học viên nhận bản bỏ nội dung nhưng vẫn thấy chủ đề
        assertThat(inTopic.withoutContent().topicTitle()).isEqualTo("Bộ 1");

        assertThrows(ApiException.class, () -> links.assignTopic(versionId, resB, session2.getId()));
        links.assignTopic(versionId, resB, session1.getId());
        assertThat(find(versionId, resB).topicId()).isEqualTo(session1.getId());
        links.assignTopic(versionId, resB, null);
        assertThat(find(versionId, resB).topicId()).isNull();
    }

    @Test
    void deletingTopicKeepsResourcesAndUngroupsThem() {
        var topic = topics.create(versionId, 1, "Sẽ xóa");
        links.addResourceToSession(versionId, resA, resAVersion, 1, 0, topic.getId());

        topics.delete(versionId, topic.getId());

        assertThat(topics.list(versionId, 1)).isEmpty();
        ContentPackageVersionResourceResponse after = find(versionId, resA);
        assertThat(after.topicId()).isNull();
        assertThat(after.topicTitle()).isNull();
    }

    @Test
    void copyPackageClonesTopicsWithNewIdsAndKeepsMembership() {
        var withResource = topics.create(versionId, 1, "Có học liệu");
        var empty = topics.create(versionId, 1, "Chủ đề rỗng");
        links.addResourceToSession(versionId, resA, resAVersion, 1, 0, withResource.getId());
        links.addResourceToSession(versionId, resB, resBVersion, 1, 1);

        ContentPackage copy = packageService.copyPackage(pkg.getId(), "syl-2", "sv-2", "Bản sao");
        String copyVersionId = copy.getDraftVersionId();

        var copied = topics.list(copyVersionId, 1);
        assertThat(copied).extracting(ContentPackageVersionTopic::getTitle).containsExactly("Có học liệu", "Chủ đề rỗng");
        assertThat(copied).extracting(ContentPackageVersionTopic::getId)
                .doesNotContain(withResource.getId(), empty.getId());
        ContentPackageVersionResourceResponse member = find(copyVersionId, resA);
        assertThat(member.topicTitle()).isEqualTo("Có học liệu");
        assertThat(member.topicId()).isEqualTo(copied.get(0).getId());
        assertThat(find(copyVersionId, resB).topicId()).isNull();

        // bản gốc không bị đổi
        assertThat(find(versionId, resA).topicId()).isEqualTo(withResource.getId());
    }

    // Học phần tự do (syllabusId null) dùng topic như học phần có giáo trình, và sao chép vào giáo trình mang topic theo
    // với id mới nhưng không mang hạng mục tính điểm/CLO (thuộc syllabus nên chỉ giữ khi nguồn và đích cùng giáo trình).
    @Test
    void freePackageSupportsTopicsAndCopiesThemIntoASyllabusWithoutSyllabusBoundSettings() {
        ContentPackage freePkg = packageService.createPackage(ContentPackageType.GRAMMAR, null, null);
        ContentPackageVersion draft = versions.saveAndFlush(ContentPackageVersion.builder().packageId(freePkg.getId()).version(1)
                .status(ContentPackageVersionStatus.DRAFT).title("Học phần tự do").build());
        freePkg.setDraftVersionId(draft.getId());
        packages.saveAndFlush(freePkg);
        var topic = topics.create(draft.getId(), 1, "Chủ đề Kho");
        links.addResourceToSession(draft.getId(), resA, resAVersion, 1, 0, topic.getId());

        ContentPackage copy = packageService.copyPackage(freePkg.getId(), "syl-2", "sv-2", "Bản trong giáo trình");

        assertThat(copy.getSyllabusId()).isEqualTo("syl-2");
        assertThat(copy.getId()).isNotEqualTo(freePkg.getId());
        var copied = topics.list(copy.getDraftVersionId(), 1);
        assertThat(copied).extracting(ContentPackageVersionTopic::getTitle).containsExactly("Chủ đề Kho");
        assertThat(copied.get(0).getId()).isNotEqualTo(topic.getId());
        assertThat(find(copy.getDraftVersionId(), resA).topicTitle()).isEqualTo("Chủ đề Kho");
        assertThat(packages.findById(freePkg.getId()).orElseThrow().getSyllabusId()).isNull();
    }

    @Test
    void topicsCannotBeChangedOnPublishedVersion() {
        var topic = topics.create(versionId, 1, "Bộ");
        ContentPackageVersion version = versions.findById(versionId).orElseThrow();
        version.setStatus(ContentPackageVersionStatus.PUBLISHED);
        versions.saveAndFlush(version);

        assertThrows(ApiException.class, () -> topics.create(versionId, 1, "Mới"));
        assertThrows(ApiException.class, () -> topics.rename(versionId, topic.getId(), "Đổi tên"));
        assertThrows(ApiException.class, () -> topics.delete(versionId, topic.getId()));
    }
}
