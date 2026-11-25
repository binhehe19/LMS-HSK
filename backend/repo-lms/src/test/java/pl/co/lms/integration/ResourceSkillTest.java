package pl.co.lms.integration;

import base.co.common.event.EventPublisher;
import base.co.common.exception.ApiException;
import base.co.common.notification.NotificationPublisher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import pl.co.lms.client.CmsClient;
import pl.co.lms.dto.request.CreateLearningResourceRequest;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.service.AssessmentAttemptQuestionResolver;
import pl.co.lms.service.AssessmentAttemptResultService;
import pl.co.lms.service.AssessmentAttemptService;
import pl.co.lms.service.grading.AssessmentGradingEventPublisher;
import pl.co.lms.service.grading.AssessmentGradingNotifier;
import pl.co.lms.service.grading.AssessmentGradingService;
import pl.co.lms.service.AssessmentManualGradingService;
import pl.co.lms.service.LearningResourceService;
import pl.co.lms.service.practice.PracticeCatalogService;
import pl.co.lms.service.QuizAnswerSanitizer;
import pl.co.lms.service.RedisSessionLockService;
import pl.co.lms.service.SyllabusPackageService;
import pl.co.lms.service.grading.QuestionAutoGrader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Kỹ năng (cột skill) của học liệu: ghi lúc tạo, đổi qua classification, và bản sao từ Kho thừa hưởng. */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:resourceskill;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.flyway.enabled=false"})
@Import({JacksonAutoConfiguration.class, AssessmentAttemptService.class, AssessmentAttemptQuestionResolver.class,
        AssessmentAttemptResultService.class, AssessmentManualGradingService.class, AssessmentGradingService.class,
        AssessmentGradingEventPublisher.class, AssessmentGradingNotifier.class, QuestionAutoGrader.class, QuizAnswerSanitizer.class,
        PracticeCatalogService.class, LearningResourceService.class})
class ResourceSkillTest {

    @MockBean RedisSessionLockService redisLockService;
    @MockBean CmsClient cmsClient;
    @MockBean pl.co.lms.client.IdentityClient identityClient;
    @MockBean SyllabusPackageService mappingService;
    @MockBean EventPublisher eventPublisher;
    @MockBean NotificationPublisher notificationPublisher;

    @Autowired LearningResourceService resources;

    private String createInLibrary(String skill) {
        return resources.createResourceWithContent(new CreateLearningResourceRequest(
                LearningResourceType.ASSESSMENT, null, false, true, null, ResourceSubTypes.QUIZ, null, skill)).getId();
    }

    @Test
    void createStoresSkillAndEmptyMeansNone() {
        assertThat(resources.getResource(createInLibrary("LISTENING")).getSkill()).isEqualTo("LISTENING");
        assertThat(resources.getResource(createInLibrary("GRAMMAR_3_0")).getSkill()).isEqualTo("GRAMMAR_3_0");
        assertThat(resources.getResource(createInLibrary(null)).getSkill()).isNull();
        assertThat(resources.getResource(createInLibrary("  ")).getSkill()).isNull();
    }

    @Test
    void createRejectsMalformedSkill() {
        for (String bad : new String[] {"listening", "1ST", "HAS SPACE", "WITH-DASH", "A".repeat(31)}) {
            assertThrows(ApiException.class, () -> createInLibrary(bad), bad);
        }
        assertThat(resources.getResource(createInLibrary("A".repeat(30))).getSkill()).hasSize(30);
    }

    @Test
    void classificationSetsKeepsAndClearsSkillWithoutTouchingOtherFields() {
        String id = createInLibrary(null);
        resources.updateClassification(id, null, null, "READING");
        assertThat(resources.getResource(id).getSkill()).isEqualTo("READING");

        // null = giữ nguyên (IELTS FE chỉ gửi assessmentType/tags, không được xóa kỹ năng)
        resources.updateClassification(id, null, java.util.List.of("Tag một"), null);
        assertThat(resources.getResource(id).getSkill()).isEqualTo("READING");
        assertThat(resources.getResource(id).getTags()).containsExactly("Tag một");
        assertThat(resources.getResource(id).getSubType()).isEqualTo(ResourceSubTypes.QUIZ);

        // chuỗi rỗng = xóa
        resources.updateClassification(id, null, null, "");
        assertThat(resources.getResource(id).getSkill()).isNull();

        assertThrows(ApiException.class, () -> resources.updateClassification(id, null, null, "bad skill"));
        assertThat(resources.getResource(id).getSkill()).isNull();
    }

    @Test
    void copyFromLibraryInheritsSkillUnlessRequestSetsOne() {
        String source = createInLibrary("SPEAKING");

        var inherited = resources.createResourceWithContent(new CreateLearningResourceRequest(
                LearningResourceType.ASSESSMENT, null, false, false, source));
        assertThat(inherited.getSkill()).isEqualTo("SPEAKING");

        var overridden = resources.createResourceWithContent(new CreateLearningResourceRequest(
                LearningResourceType.ASSESSMENT, null, false, false, source, null, null, "WRITING"));
        assertThat(overridden.getSkill()).isEqualTo("WRITING");
    }
}
