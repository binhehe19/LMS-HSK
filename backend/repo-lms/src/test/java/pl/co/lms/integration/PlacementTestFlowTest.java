package pl.co.lms.integration;

import base.co.common.event.EventPublisher;
import base.co.common.exception.ApiException;
import base.co.common.filter.principal.AuthPrincipal;
import base.co.common.notification.NotificationPublisher;
import com.fasterxml.jackson.databind.*;
import pl.co.lms.entity.json.QuizQuestion;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.*;
import pl.co.lms.client.*;
import pl.co.lms.dto.request.*;
import pl.co.lms.dto.response.AssessmentAttemptResponse;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.repository.*;
import pl.co.lms.service.*;
import pl.co.lms.service.grading.*;
import pl.co.lms.service.grading.ai.AiGradingClient;
import pl.co.lms.service.placement.*;
import pl.co.lms.service.practice.PracticeCatalogService;
import pl.co.lms.controller.PlacementTestController;
import pl.co.lms.controller.PlacementManagementController;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace=AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties={"spring.datasource.url=jdbc:h2:mem:placement;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect", "spring.flyway.enabled=false"})
@Import({JacksonAutoConfiguration.class, PlacementTestService.class, PlacementAttemptService.class, PlacementConsultationService.class,
        LearningResourceService.class, PracticeCatalogService.class, AssessmentAttemptService.class, AssessmentAttemptResultService.class,
        AssessmentAttemptQuestionResolver.class, QuizAnswerSanitizer.class, QuestionAutoGrader.class, AssessmentGradingService.class,
        AssessmentGradingEventPublisher.class, AssessmentGradingNotifier.class, AssessmentManualGradingService.class})
class PlacementTestFlowTest {
    @MockBean RedisSessionLockService redis;
    @MockBean CmsClient cms;
    @MockBean IdentityClient identity;
    @MockBean SyllabusPackageService mappings;
    @MockBean EventPublisher events;
    @MockBean NotificationPublisher notifications;
    @MockBean AiGradingClient ai;
    @Autowired ObjectMapper mapper;
    @Autowired LearningResourceService library;
    @Autowired PlacementTestService tests;
    @Autowired PlacementAttemptService attempts;
    @Autowired PlacementConsultationService consultations;
    @Autowired AssessmentAttemptRepository assessments;
    @Autowired AssessmentAnswerRepository answers;
    @Autowired PlacementAttemptRepository placementAttempts;
    @Autowired PlacementConsultationRepository consultationRepository;
    @Autowired AssessmentGradingService grading;
    @Autowired AssessmentManualGradingService manual;
    @Autowired AssessmentAttemptService engine;
    @Autowired LearningResourceRepository resources;

    @BeforeEach void admin() { login("admin", true); }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }
    private void login(String id, boolean admin) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthPrincipal(id, false, Set.of()), null, admin ? List.of(new SimpleGrantedAuthority("ROLE_ADMIN")) : List.of()));
    }
    private static final String BANK = """
        {"title":"Questions","timeLimits":{"default":600},"questions":[
          {"questionId":"mc1","questionType":"MULTIPLE_CHOICE","points":1,"questionText":"Choose one",
           "options":[{"optionIndex":0,"content":"Yes","correct":true},{"optionIndex":1,"content":"No","correct":false}]},
          {"questionId":"mc2","questionType":"MULTIPLE_CHOICE","points":1,"questionText":"True or false",
           "options":[{"optionIndex":0,"content":"True","correct":true},{"optionIndex":1,"content":"False","correct":false}]},
          {"questionId":"essay","questionType":"ESSAY","points":9,"questionText":"Should students wear uniforms?"}]}
        """;
    /** Inline content holding only the named questions of {@link #BANK}. */
    private QuizContent quiz(String... keep) throws Exception {
        var wanted = List.of(keep);
        var questions = mapper.readValue(BANK, QuizContent.class).getQuestions().stream().filter(q -> wanted.contains(q.getQuestionId())).toList();
        return QuizContent.builder().title("Questions").questions(questions).build();
    }
    private PlacementRequests.Section section(String key, String title, String description, String... questionIds) throws Exception {
        return new PlacementRequests.Section(key, title, description, quiz(questionIds));
    }
    private final Map<String, String> ids = new HashMap<>();
    private JsonNode create(String alias, PlacementRequests.Test request) {
        JsonNode created = tests.create(request);
        ids.put(alias, created.path("id").asText());
        return created;
    }
    private String id(String alias) { return ids.getOrDefault(alias, alias); }
    private PlacementRequests.Test request(String title) throws Exception {
        return new PlacementRequests.Test(PlacementRequests.Category.IELTS, title, "Entry assessment", 2400, List.of(
                section("reading", "Reading", "Read the passage", "mc1", "mc2"),
                section("writing", "Writing", "Write 150 words", "essay")));
    }
    private void published() throws Exception {
        JsonNode draft = create("test-a", request("Test A"));
        tests.publish(id("test-a"), draft.path("draftVersionId").asText());
    }
    private boolean has(JsonNode node, String key) {
        if (node == null) return false;
        if (node.isObject() && node.has(key)) return true;
        for (JsonNode child : node) if (has(child, key)) return true;
        return false;
    }

    @Test void categoryAndFoundationKindAreStoredAsTheResourceAssessmentType() throws Exception {
        var expected = Map.of(PlacementRequests.Category.IELTS, ResourceSubTypes.PLACEMENT_IELTS, PlacementRequests.Category.PACE, ResourceSubTypes.PLACEMENT_PACE);
        var sections = request("T").sections();
        expected.forEach((category, type) -> {
            JsonNode created = tests.create(new PlacementRequests.Test(category, "T", "", 600, sections));
            assertThat(created.path("category").asText()).isEqualTo(category.name());
            assertThat(library.getResource(created.path("id").asText()).getSubType()).isEqualTo(type);
        });
        assertThat(PlacementTestService.typeOf(PlacementRequests.Category.FOUNDATION, new PlacementRequests.Foundation(PlacementRequests.FoundationKind.PRONUNCIATION, null, null))).isEqualTo(ResourceSubTypes.FOUNDATION_PRON);
        assertThat(PlacementTestService.typeOf(PlacementRequests.Category.FOUNDATION, new PlacementRequests.Foundation(PlacementRequests.FoundationKind.VOCABULARY, null, null))).isEqualTo(ResourceSubTypes.FOUNDATION_VOCAB);
        assertThat(PlacementTestService.typeOf(PlacementRequests.Category.FOUNDATION, new PlacementRequests.Foundation(PlacementRequests.FoundationKind.GRAMMAR, null, null))).isEqualTo(ResourceSubTypes.FOUNDATION_GRAMMAR);
        assertThatThrownBy(() -> PlacementTestService.typeOf(PlacementRequests.Category.FOUNDATION, null)).isInstanceOf(ApiException.class);
    }

    @Test void adminListIsPagedAndFilteredOnTheServer() throws Exception {
        var sections = request("x").sections();
        create("alpha", new PlacementRequests.Test(PlacementRequests.Category.IELTS, "Alpha Listening", "", 600, sections));
        create("beta", new PlacementRequests.Test(PlacementRequests.Category.IELTS, "Beta Writing", "", 600, sections));
        create("gamma", new PlacementRequests.Test(PlacementRequests.Category.PACE, "Gamma Pace", "", 600, sections));
        var language = List.of(section("language", "Language", "", "mc1", "mc2"));
        create("delta", new PlacementRequests.Test(PlacementRequests.Category.FOUNDATION, "Delta Vocab", "", 600, language,
                new PlacementRequests.Foundation(PlacementRequests.FoundationKind.VOCABULARY, null, null)));
        create("epsilon", new PlacementRequests.Test(PlacementRequests.Category.FOUNDATION, "Epsilon Grammar", "", 600, language,
                new PlacementRequests.Foundation(PlacementRequests.FoundationKind.GRAMMAR, null, null)));
        assertThat(tests.managementPage(null, null, null, 0, 20).path("totalElements").asInt()).isEqualTo(5);
        assertThat(tests.managementPage(PlacementRequests.Category.IELTS, null, null, 0, 20).path("totalElements").asInt()).isEqualTo(2);
        assertThat(tests.managementPage(PlacementRequests.Category.PACE, null, null, 0, 20).path("totalElements").asInt()).isEqualTo(1);
        assertThat(tests.managementPage(PlacementRequests.Category.FOUNDATION, null, null, 0, 20).path("totalElements").asInt()).isEqualTo(2);
        var vocabulary = tests.managementPage(PlacementRequests.Category.FOUNDATION, PlacementRequests.FoundationKind.VOCABULARY, null, 0, 20);
        assertThat(vocabulary.path("totalElements").asInt()).isEqualTo(1);
        assertThat(vocabulary.at("/items/0/title").asText()).isEqualTo("Delta Vocab");
        assertThat(tests.managementPage(null, null, " ALPHA ", 0, 20).at("/items/0/title").asText()).isEqualTo("Alpha Listening");
        var firstPage = tests.managementPage(null, null, null, 0, 2);
        assertThat(firstPage.path("items").size()).isEqualTo(2);
        assertThat(firstPage.path("totalPages").asInt()).isEqualTo(3);
        assertThat(tests.managementPage(null, null, null, 2, 2).path("items").size()).isEqualTo(1);
        login("learner", false);
        assertThatThrownBy(() -> tests.managementPage(null, null, null, 0, 20)).isInstanceOf(ApiException.class);
    }

    @Test void archivingStopsNewAttemptsButRepublishingReopensTheTest_andCatalogFiltersByCategory() throws Exception {
        published();
        String id = id("test-a");
        login("learner", false);
        AssessmentAttemptResponse running = attempts.start(id);
        assertThat(tests.catalog("IELTS")).extracting(n -> n.path("id").asText()).containsExactly(id);
        assertThat(tests.catalog("PACE")).isEmpty();
        admin();
        assertThat(tests.archive(id).path("status").asText()).isEqualTo("ARCHIVED");
        login("learner", false);
        assertThat(tests.catalog(null)).isEmpty();
        assertThatThrownBy(() -> attempts.start(id)).isInstanceOf(ApiException.class);
        assertThat(attempts.get(running.attemptId()).attemptId()).isEqualTo(running.attemptId());
        admin();
        JsonNode draft = tests.update(id, request("Reopened"));
        assertThat(tests.publish(id, draft.path("draftVersionId").asText()).path("status").asText()).isEqualTo("PUBLISHED");
        login("learner", false);
        assertThat(tests.catalog(null)).hasSize(1);
        assertThat(attempts.start(id).attemptId()).isEqualTo(running.attemptId());
    }

        @Test void placementTestsAreOutsideTheLibrary_andTheirTypeCannotBeChangedFromIt() throws Exception {
        published();
        String id = id("test-a");
        assertThat(library.getResource(id).isInLibrary()).isFalse();
        assertThat(resources.findByInLibraryTrueAndDeletedFalseOrderByCreatedAtDesc(PageRequest.of(0, 50)).getContent())
                .extracting(LearningResource::getId).doesNotContain(id);
        var libraryQuiz = library.createResourceWithContent(new CreateLearningResourceRequest(LearningResourceType.ASSESSMENT, quiz("mc1"), true, true));
        assertThatThrownBy(() -> library.updateClassification(id, ResourceSubTypes.QUIZ, null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> library.updateClassification(libraryQuiz.getId(), ResourceSubTypes.PLACEMENT_IELTS, null)).isInstanceOf(ApiException.class);
    }

    @Test void theAttemptEngineStillRejectsPrivateNonPlacementAssessments() throws Exception {
        var privateQuiz = library.createResourceWithContent(new CreateLearningResourceRequest(LearningResourceType.ASSESSMENT, quiz("mc1"), true, false));
        login("learner", false);
        assertThatThrownBy(() -> engine.startOrResumeSelfStudy(new StartSelfStudyAttemptRequest(privateQuiz.getId(), "default", "x", null)))
                .isInstanceOf(ApiException.class);
    }
        @Test void creationStartsAsDraftOutsideTheLibraryWithoutLeakingToStudents() throws Exception {
        JsonNode draft = create("test-a", request("Test A"));
        assertThat(draft.path("status").asText()).isEqualTo("DRAFT");
        assertThat(draft.path("available").asBoolean()).isFalse();
        JsonNode authored = tests.detail(id("test-a")).get("content");
        assertThat(authored.get("questions").size()).isEqualTo(3);
        assertThat(authored.at("/layout/sections/0/questionIds/0").asText()).isEqualTo(authored.at("/questions/0/questionId").asText());
        login("learner", false);
        assertThat(tests.catalog(null)).isEmpty();
        assertThatThrownBy(() -> attempts.start(id("test-a"))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> tests.detail(id("test-a"))).isInstanceOf(ApiException.class);
    }
    @Test void snapshotsRemainStableAcrossDraftChangesAndRepublishing_andArchivedAttemptsStayReadable() throws Exception {
        published();
        login("learner", false);
        AssessmentAttemptResponse first = attempts.start(id("test-a"));
        assertThat(attempts.start(id("test-a")).attemptId()).isEqualTo(first.attemptId());
        assertThat(first.remainingSeconds()).isBetween(2395L,2400L);
        assertThat(has(first.layout(), "grading")).isFalse();
        assertThat(has(first.layout(), "explanation")).isFalse();
        assertThat(mapper.valueToTree(first.questions()).toString()).doesNotContain("\"correct\"");
        admin();
        JsonNode draft = tests.update(id("test-a"), request("Test A changed"));
        login("learner", false);
        assertThat(tests.instructions(id("test-a")).get("title").asText()).isEqualTo("Test A");
        admin(); tests.publish(id("test-a"), draft.get("draftVersionId").asText());
        login("learner", false);
        assertThat(tests.instructions(id("test-a")).get("title").asText()).isEqualTo("Test A changed");
        assertThat(attempts.get(first.attemptId()).questions()).extracting("questionId").containsExactlyElementsOf(first.questions().stream().map(AssessmentAttemptResponse.QuizQuestionItem::questionId).toList());
        admin(); tests.archive(id("test-a")); login("learner", false);
        assertThatThrownBy(() -> attempts.start(id("test-a"))).isInstanceOf(ApiException.class);
        assertThat(attempts.get(first.attemptId()).attemptId()).isEqualTo(first.attemptId());
    }

    @Test void draftOwnershipRevisionAndDeadlinesAreEnforced() throws Exception {
        published(); login("learner", false);
        var attempt = attempts.start(id("test-a"));
        var saved = attempts.save(attempt.attemptId(), new SaveAttemptDraftRequest(0L, Map.of(attempt.questions().getFirst().questionId(), "{\"selectedOptionIndex\":0}"), mapper.createObjectNode().put("active",1)));
        assertThat(saved.revision()).isEqualTo(1);
        assertThat(saved.savedAnswers().getFirst().answerJson()).contains("selectedOptionIndex");
        assertThatThrownBy(() -> attempts.save(attempt.attemptId(), new SaveAttemptDraftRequest(0L, Map.of(), null))).isInstanceOf(ApiException.class);
        login("other-learner", false);
        assertThatThrownBy(() -> attempts.get(attempt.attemptId())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> attempts.result(attempt.attemptId())).isInstanceOf(ApiException.class);
        login("learner", false);
        assessments.findById(attempt.attemptId()).orElseThrow().setEndsAt(Instant.now().minusSeconds(10));
        assertThatThrownBy(() -> attempts.save(attempt.attemptId(), new SaveAttemptDraftRequest(saved.revision(), Map.of(), null))).isInstanceOf(ApiException.class);
    }

    @Test void mentorSubmissionIsIdempotent_skipsAi_andReusesExistingManualGrading() throws Exception {
        published(); login("learner", false);
        var started = attempts.start(id("test-a"));
        Map<String,String> input = new LinkedHashMap<>();
        started.questions().forEach(q -> input.put(q.questionId(), q.content().getQuestionType() == ExerciseQuestionType.ESSAY ? "{\"text\":\"My essay answer\"}" : "{\"selectedOptionIndex\":0}"));
        var saved = attempts.save(started.attemptId(), new SaveAttemptDraftRequest(0L,input,null));
        var request = new PlacementRequests.Submit(PlacementRequests.FeedbackMethod.MENTOR,saved.revision(),List.of(),null);
        assertThat(attempts.submit(started.attemptId(),request).get("feedbackMethod").asText()).isEqualTo("MENTOR");
        var submittedAt = attempts.receipt(started.attemptId()).get("submittedAt");
        assertThat(attempts.submit(started.attemptId(),request).get("submittedAt")).isEqualTo(submittedAt);
        assertThat(placementAttempts.count()).isEqualTo(1);
        when(ai.supports(any())).thenReturn(true);
        grading.gradeAttempt(started.attemptId());
        verify(ai, never()).supports(any());
        assertThat(attempts.result(started.attemptId()).gradingStatus()).isEqualTo(AssessmentGradingStatus.MANUAL_GRADING);
        admin(); assertThat(attempts.mentorQueue(0,20,null).get("items").size()).isEqualTo(1);
        AssessmentAnswer essay = answers.findByAttemptIdAndDeletedFalse(started.attemptId()).stream().filter(a -> a.getGradingStatus() == AssessmentAnswerGradingStatus.MANUAL_PENDING).findFirst().orElseThrow();
        when(redis.isHeldBy(anyString(),eq(started.attemptId()),eq("grading-token"))).thenReturn(true);
        manual.save(started.attemptId(),new SaveAssessmentManualGradingRequest("grading-token",List.of(new SaveAssessmentManualGradingRequest.Item(essay.getId(),BigDecimal.valueOf(6),"Good structure"))));
        login("learner", false);
        assertThat(attempts.result(started.attemptId()).gradingStatus()).isEqualTo(AssessmentGradingStatus.GRADED);
        assertThat(attempts.result(started.attemptId()).questions()).anySatisfy(q -> assertThat(q.graderComment()).isEqualTo("Good structure"));
    }

    private static IdentityClient.UserSummary user(String id, String name, String email) {
        var summary = new IdentityClient.UserSummary();
        summary.setUserId(id); summary.setFullName(name); summary.setEmail(email); summary.setUserCode("HB-" + id);
        return summary;
    }

    @Test void adminQueuesShowAuthNamesAndFilterByStudentOnTheServer() throws Exception {
        published(); login("learner", false);
        var started = attempts.start(id("test-a"));
        attempts.submit(started.attemptId(), new PlacementRequests.Submit(PlacementRequests.FeedbackMethod.MENTOR, 0L, List.of(), null));
        consultations.request(new PlacementRequests.Consult("request-key-0002"));
        when(identity.lookupByIds(any())).thenReturn(Map.of("learner", user("learner", "Alice Nguyen", "alice@example.test")));
        when(identity.searchUserIds("alice")).thenReturn(new IdentityClient.UserSearchResult(Set.of("learner"), false));
        when(identity.searchUserIds("nobody")).thenReturn(new IdentityClient.UserSearchResult(Set.of(), false));
        admin();
        JsonNode submission = attempts.mentorQueue(0, 20, null).at("/items/0");
        assertThat(submission.path("userId").asText()).isEqualTo("learner");
        assertThat(submission.path("userName").asText()).isEqualTo("Alice Nguyen");
        assertThat(submission.path("userEmail").asText()).isEqualTo("alice@example.test");
        assertThat(attempts.mentorQueue(0, 20, " alice ").path("totalElements").asInt()).isEqualTo(1);
        assertThat(attempts.mentorQueue(0, 20, "nobody").path("totalElements").asInt()).isZero();
        JsonNode request = consultations.list(0, 20, null).at("/items/0");
        assertThat(request.path("userName").asText()).isEqualTo("Alice Nguyen");
        assertThat(consultations.list(0, 20, "alice").path("totalElements").asInt()).isEqualTo(1);
        assertThat(consultations.list(0, 20, "nobody").path("items").size()).isZero();
        login("learner", false);
        assertThat(attempts.history(0, 20).at("/items/0").has("userName")).isFalse();
    }

    @Test void unsupportedAiDoesNotSubmitTheAttempt_andAnotherUserCannotSubmitIt() throws Exception {
        published(); login("learner", false);
        var started = attempts.start(id("test-a"));
        assertThatThrownBy(() -> attempts.submit(started.attemptId(),new PlacementRequests.Submit(PlacementRequests.FeedbackMethod.AI,0L,List.of(),null))).isInstanceOf(ApiException.class);
        assertThat(assessments.findById(started.attemptId()).orElseThrow().getStatus()).isEqualTo(AssessmentAttemptStatus.IN_PROGRESS);
        login("other",false);
        assertThatThrownBy(() -> attempts.submit(started.attemptId(),new PlacementRequests.Submit(PlacementRequests.FeedbackMethod.MENTOR,0L,List.of(),null))).isInstanceOf(ApiException.class);
    }

    @Test void timeoutReceiptNeverReopensAttemptOrStoresLateAnswers() throws Exception {
        published(); login("learner",false);
        var started = attempts.start(id("test-a"));
        AssessmentAttempt closed = assessments.findById(started.attemptId()).orElseThrow();
        closed.setStatus(AssessmentAttemptStatus.TIME_OUT); closed.setSubmittedAt(Instant.now());
        var late = List.of(new HeartbeatAssessmentAttemptRequest.AnswerItem(started.questions().getFirst().questionId(),"{\"selectedOptionIndex\":0}"));
        attempts.submit(started.attemptId(),new PlacementRequests.Submit(PlacementRequests.FeedbackMethod.MENTOR,0L,late,null));
        assertThat(closed.getStatus()).isEqualTo(AssessmentAttemptStatus.TIME_OUT);
        assertThat(answers.findByAttemptIdAndDeletedFalse(started.attemptId())).allSatisfy(a -> assertThat(a.getAnswerJson()).isNull());
    }

    @Test void consultationRequestsAreDurableIdempotentAndPrivateWithAnAdminQueue() {
        login("learner",false);
        var request = new PlacementRequests.Consult("request-key-0001");
        JsonNode first = consultations.request(request);
        assertThat(consultations.request(request).get("id")).isEqualTo(first.get("id"));
        assertThat(consultationRepository.count()).isEqualTo(1);
        assertThat(Instant.parse(first.get("contactDueAt").asText())).isBetween(Instant.now().plusSeconds(86390),Instant.now().plusSeconds(86410));
        assertThatThrownBy(() -> consultations.list(0,20,null)).isInstanceOf(ApiException.class);
        login("other",false); assertThat(consultations.mine(0,20).get("items").isEmpty()).isTrue();
        admin(); consultations.handle(first.get("id").asText(),new PlacementRequests.HandleConsult(PlacementRequests.ConsultationStatus.CONTACTED,"Internal advisor note"));
        login("learner",false);
        JsonNode mine = consultations.mine(0,20).get("items").get(0);
        assertThat(mine.get("status").asText()).isEqualTo("CONTACTED");
        assertThat(mine.has("internalNote")).isFalse();
    }

        @Test void rejectsStalePublishAndUnknownVersions() throws Exception {
        JsonNode firstDraft = create("test-a", request("Test"));
        tests.update(id("test-a"), request("Changed draft"));
        assertThatThrownBy(() -> tests.publish(id("test-a"), firstDraft.get("draftVersionId").asText())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> tests.publish(id("test-a"), "wrong-version")).isInstanceOf(ApiException.class);
    }
    @Test void mentorReviewsAnUnansweredEssayInsteadOfReportingAnAutomaticFinalGrade() throws Exception {
        published(); login("learner",false);
        var started = attempts.start(id("test-a"));
        attempts.submit(started.attemptId(),new PlacementRequests.Submit(PlacementRequests.FeedbackMethod.MENTOR,0L,List.of(),null));
        grading.gradeAttempt(started.attemptId());
        assertThat(attempts.result(started.attemptId()).gradingStatus()).isEqualTo(AssessmentGradingStatus.MANUAL_GRADING);
        assertThat(answers.findByAttemptIdAndDeletedFalse(started.attemptId())).anySatisfy(a -> assertThat(a.getGradingStatus()).isEqualTo(AssessmentAnswerGradingStatus.MANUAL_PENDING));
    }

    @Test void foundationQuizzesGradeRealAnswersAndUseThePublishedScale() throws Exception {
        for (var kind : List.of(PlacementRequests.FoundationKind.VOCABULARY, PlacementRequests.FoundationKind.GRAMMAR)) {
            admin();
            String code = "foundation-" + kind.name().toLowerCase(Locale.ROOT);
            var scale = List.of(new PlacementRequests.FoundationBand(0, "Cần củng cố", "Ôn tập kiến thức cơ bản"),
                    new PlacementRequests.FoundationBand(75, "Đạt yêu cầu của đề", "Luyện tập nâng cao"));
            var config = new PlacementRequests.Foundation(kind, PlacementRequests.FoundationDifficulty.INTERMEDIATE, scale);
            var input = new PlacementRequests.Test(PlacementRequests.Category.FOUNDATION, "Foundation", "Real bank", 600,
                    List.of(section("language", "Language", "", "mc1", "mc2")), config);
            var created = create(code, input);
            tests.publish(id(code), created.path("draftVersionId").asText());
            login("learner", false);
            assertThat(tests.instructions(id(code)).at("/foundation/kind").asText()).isEqualTo(kind.name());
            var attempt = attempts.start(id(code));
            assertThat(mapper.valueToTree(attempt.questions()).toString()).doesNotContain("\"correct\"");
            Map<String,String> response = new LinkedHashMap<>();
            for (var question : attempt.questions()) response.put(question.questionId(), "{\"selectedOptionIndex\":0}");
            var state = mapper.createObjectNode().put("foundationQuestionIndex",1);
            var saved = attempts.save(attempt.attemptId(), new SaveAttemptDraftRequest(0L,response,state));
            assertThat(attempts.get(attempt.attemptId()).clientState().path("foundationQuestionIndex").asInt()).isEqualTo(1);
            attempts.submit(attempt.attemptId(),new PlacementRequests.Submit(PlacementRequests.FeedbackMethod.MENTOR,saved.revision(),List.of(),state));
            var initialResult = attempts.resultView(attempt.attemptId());
            if (!"GRADED".equals(initialResult.path("gradingStatus").asText()))
                assertThat(initialResult.path("foundationEvaluation").isNull()).isTrue();
            grading.gradeAttempt(attempt.attemptId());
            var result = attempts.resultView(attempt.attemptId());
            assertThat(result.path("gradingStatus").asText()).isEqualTo("GRADED");
            assertThat(result.path("percent").asInt()).isEqualTo(100);
            assertThat(result.at("/foundationEvaluation/label").asText()).isEqualTo("Đạt yêu cầu của đề");
            assertThat(attempts.history(0,20).at("/items/0/foundation/kind").asText()).isEqualTo(kind.name());
            admin();
            var changed = new PlacementRequests.Test(input.category(),input.title(),input.description(),input.durationSeconds(),input.sections(),
                    new PlacementRequests.Foundation(kind,null,List.of(new PlacementRequests.FoundationBand(0,"Changed scale","Different"))));
            tests.update(id(code),changed); tests.archive(id(code));
            login("learner",false);
            assertThat(attempts.resultView(attempt.attemptId()).at("/foundationEvaluation/label").asText()).isEqualTo("Đạt yêu cầu của đề");
            login("other",false);
            assertThatThrownBy(() -> attempts.resultView(attempt.attemptId())).isInstanceOf(ApiException.class);
        }
    }

    @Test void foundationPronunciationPersistsAudioAndReturnsMentorFeedbackWithoutFakeEvaluation() throws Exception {
        QuizContent content = mapper.readValue("""
            {"title":"Pronunciation bank","timeLimits":{"default":600},"questions":[
              {"questionId":"audio","questionType":"AUDIO_RESPONSE","points":10,"questionText":"Read this passage aloud."}]}
            """, QuizContent.class);
        var config = new PlacementRequests.Foundation(PlacementRequests.FoundationKind.PRONUNCIATION,PlacementRequests.FoundationDifficulty.BEGINNER,List.of());
        var input = new PlacementRequests.Test(PlacementRequests.Category.FOUNDATION,"Pronunciation","Read and record",600,
                List.of(new PlacementRequests.Section("speech","Speech","",content)),config);
        var created = create("foundation-speech", input); tests.publish(id("foundation-speech"),created.path("draftVersionId").asText());
        login("learner",false); var attempt = attempts.start(id("foundation-speech"));
        String audio = "{\"audio\":{\"fileId\":\"stored-recording\",\"mimeType\":\"audio/webm\",\"sizeBytes\":1024,\"durationSeconds\":12}}";
        var saved = attempts.save(attempt.attemptId(),new SaveAttemptDraftRequest(0L,Map.of(attempt.questions().get(0).questionId(),audio),null));
        attempts.submit(attempt.attemptId(),new PlacementRequests.Submit(PlacementRequests.FeedbackMethod.MENTOR,saved.revision(),List.of(),null));
        grading.gradeAttempt(attempt.attemptId());
        var pending = attempts.resultView(attempt.attemptId());
        assertThat(pending.path("gradingStatus").asText()).isEqualTo("MANUAL_GRADING");
        assertThat(pending.path("foundationEvaluation").isNull()).isTrue();
        assertThat(pending.at("/questions/0/answerJson").asText()).contains("stored-recording");
        verify(ai,never()).grade(any());
        admin();
        var answer = answers.findByAttemptIdAndDeletedFalse(attempt.attemptId()).get(0);
        when(redis.isHeldBy(anyString(),eq(attempt.attemptId()),eq("grading-token"))).thenReturn(true);
        JsonNode rubric = mapper.readTree("{\"criteria\":[{\"id\":\"pronunciation\",\"label\":\"Phát âm\",\"bandScore\":6,\"feedback\":\"Luyện trọng âm\"}]}");
        manual.save(attempt.attemptId(),new SaveAssessmentManualGradingRequest("grading-token",List.of(new SaveAssessmentManualGradingRequest.Item(answer.getId(),BigDecimal.valueOf(6),"Cần luyện trọng âm",rubric))));
        login("learner",false);
        var result = attempts.resultView(attempt.attemptId());
        assertThat(result.path("gradingStatus").asText()).isEqualTo("GRADED");
        assertThat(result.at("/questions/0/graderComment").asText()).isEqualTo("Cần luyện trọng âm");
        assertThat(result.at("/questions/0/rubricScores/criteria/0/feedback").asText()).isEqualTo("Luyện trọng âm");
        assertThat(result.path("foundationEvaluation").isNull()).isTrue();
    }

    @Test void foundationAuthoringRejectsMixedQuestionTypesAndAmbiguousScales() throws Exception {
        var speech = new PlacementRequests.Foundation(PlacementRequests.FoundationKind.PRONUNCIATION,null,List.of());
        assertThatThrownBy(() -> create("invalid-speech", new PlacementRequests.Test(PlacementRequests.Category.FOUNDATION,"Speech","",600,
                List.of(section("speech","Speech","","mc1")),speech))).isInstanceOf(ApiException.class);
        var badScale = new PlacementRequests.Foundation(PlacementRequests.FoundationKind.GRAMMAR,null,
                List.of(new PlacementRequests.FoundationBand(75,"Only level","")));
        assertThatThrownBy(() -> create("invalid-scale", new PlacementRequests.Test(PlacementRequests.Category.FOUNDATION,"Grammar","",600,
                List.of(section("grammar","Grammar","","mc1")),badScale))).isInstanceOf(ApiException.class);
    }

    @Test void httpContractSupportsAdminAuthoringStudentDraftMentorReceiptAndFeedbackOptions() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new PlacementTestController(tests,attempts,consultations),
                new PlacementManagementController(tests,attempts,consultations))
                .setMessageConverters(new MappingJackson2HttpMessageConverter(mapper)).build();
        var created = mvc.perform(post("/management/placement-tests").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(request("HTTP Test A"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("DRAFT")).andReturn();
        String version = mapper.readTree(created.getResponse().getContentAsString()).at("/data/draftVersionId").asText();
        String testId = mapper.readTree(created.getResponse().getContentAsString()).at("/data/id").asText();
        mvc.perform(post("/management/placement-tests/{id}/publish", testId).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(new PlacementRequests.Publish(version)))).andExpect(status().isOk());
        login("learner",false);
        var started = mvc.perform(post("/placement-tests/{id}/attempts", testId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questions[0].content.options[0].correct").doesNotExist()).andReturn();
        JsonNode body = mapper.readTree(started.getResponse().getContentAsString()).get("data");
        String id = body.get("attemptId").asText();
        String question = body.at("/questions/0/questionId").asText();
        mvc.perform(get("/placement-tests/attempts/{id}/feedback-options",id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mentor.available").value(true)).andExpect(jsonPath("$.data.ai.available").value(false));
        mvc.perform(put("/placement-tests/attempts/{id}/draft",id).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(new SaveAttemptDraftRequest(0L,Map.of(question,"{\"selectedOptionIndex\":0}"),null))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.revision").value(1));
        mvc.perform(post("/placement-tests/attempts/{id}/submit",id).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsBytes(new PlacementRequests.Submit(PlacementRequests.FeedbackMethod.MENTOR,1L,List.of(),null))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.feedbackMethod").value("MENTOR"));
        mvc.perform(get("/placement-tests/attempts/{id}/receipt",id)).andExpect(status().isOk()).andExpect(jsonPath("$.data.submittedAt").isNotEmpty());
        mvc.perform(get("/placement-tests/attempts")).andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1));
        admin();
        mvc.perform(get("/management/placement-tests/submissions")).andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].attemptId").value(id));
    }
    private QuizContent inlineQuiz() throws Exception {
        return mapper.readValue("""
            {"title":"Questions","questions":[{"questionId":"inline-mc","questionType":"MULTIPLE_CHOICE","questionText":"Choose the correct answer","points":1,
              "options":[{"optionIndex":0,"content":"Yes","correct":true},{"optionIndex":1,"content":"No","correct":false}]}]}
            """, QuizContent.class);
    }

    @Test void inlineAuthoringCreatesPublishableTestWithoutAnyBankSource() throws Exception {
        var section = new PlacementRequests.Section("general", "Questions", "", inlineQuiz());
        var request = new PlacementRequests.Test(PlacementRequests.Category.IELTS, "Direct entry test", "New questions", 1200, List.of(section));
        JsonNode created = create("direct-test", request);
        assertThat(created.path("available").asBoolean()).isFalse();
        JsonNode detail = tests.detail(id("direct-test")).path("content");
        assertThat(detail.at("/questions/0/questionId").asText()).isEqualTo("inline-mc");
        assertThat(detail.at("/layout/version").asInt()).isEqualTo(2);
        assertThat(detail.at("/layout/sections/0/sources").isMissingNode()).isTrue();
        assertThat(detail.at("/layout/sections/0/questionIds/0").asText()).isEqualTo("inline-mc");
        tests.publish(id("direct-test"), created.path("draftVersionId").asText());
        login("learner", false);
        var started = attempts.start(id("direct-test"));
        assertThat(started.questions()).hasSize(1);
        assertThat(mapper.valueToTree(started.questions()).toString()).doesNotContain("\"correct\"");
        var saved = attempts.save(started.attemptId(), new SaveAttemptDraftRequest(0L, Map.of("inline-mc", "{\"selectedOptionIndex\":0}"), null));
        attempts.submit(started.attemptId(), new PlacementRequests.Submit(PlacementRequests.FeedbackMethod.MENTOR, saved.revision(), List.of(), null));
        assertThat(attempts.receipt(started.attemptId()).path("feedbackMethod").asText()).isEqualTo("MENTOR");
    }

    // Trình soạn gửi layout v2 của phần thi (đúng một phần); backend ghi thành một phần phẳng của layout đề.
    private QuizContent sectionQuiz(String sectionId, String questionId, String text) throws Exception {
        var layout = mapper.readTree("""
            {"version":2,"sections":[{"id":"%s","content":"%s","files":[{"url":"/api/storage/file/abc","name":"map.png","mimeType":"image/png"}],
              "media":[{"kind":"audio","url":"/api/storage/file/def","transcript":[{"speaker":"A","start":0,"text":"secret transcript"}]}],
              "questionIds":["%s"]}]}""".formatted(sectionId, text, questionId));
        return QuizContent.builder().title("Questions").questions(inlineQuiz().getQuestions()).layout(layout).build();
    }

    @Test void sectionContentIsCopiedIntoAFlatSection_keptOnEdit_andTranscriptHiddenFromStudentsUntilSubmitted() throws Exception {
        var section = new PlacementRequests.Section("general", "Questions", "About the test", sectionQuiz("inner", "inline-mc", "<p>A kept passage</p>"));
        JsonNode created = create("flat-test", new PlacementRequests.Test(PlacementRequests.Category.IELTS, "Flat", "", 600, List.of(section)));
        JsonNode content = tests.detail(id("flat-test")).path("content");
        assertThat(content.at("/layout/sections")).hasSize(1);
        assertThat(content.at("/layout/sections/0/id").asText()).isEqualTo("general");
        assertThat(content.at("/layout/sections/0/description").asText()).isEqualTo("About the test");
        assertThat(content.at("/layout/sections/0/content").asText()).isEqualTo("<p>A kept passage</p>");
        assertThat(content.at("/layout/sections/0/files/0/url").asText()).isEqualTo("/api/storage/file/abc");
        assertThat(content.at("/layout/sections/0/questionIds/0").asText()).isEqualTo("inline-mc");
        assertThat(content.at("/layout/sections/0/sources").isMissingNode()).isTrue();
        tests.update(id("flat-test"), new PlacementRequests.Test(PlacementRequests.Category.IELTS, "Flat edited", "", 600, List.of(section)));
        assertThat(tests.detail(id("flat-test")).at("/content/layout/sections/0/content").asText()).isEqualTo("<p>A kept passage</p>");
        tests.publish(id("flat-test"), tests.detail(id("flat-test")).path("draftVersionId").asText());
        login("learner", false);
        var started = attempts.start(id("flat-test"));
        assertThat(mapper.valueToTree(started).toString()).contains("A kept passage").contains("/api/storage/file/def").doesNotContain("secret transcript");
    }

    @Test void sectionWithSeveralInnerSectionsIsRejected() throws Exception {
        var layout = mapper.readTree("{\"version\":2,\"sections\":[{\"id\":\"a\",\"questionIds\":[]},{\"id\":\"b\",\"questionIds\":[]}]}");
        var content = QuizContent.builder().title("Questions").questions(inlineQuiz().getQuestions()).layout(layout).build();
        var section = new PlacementRequests.Section("general", "Questions", "", content);
        assertThatThrownBy(() -> create("bad-tree", new PlacementRequests.Test(PlacementRequests.Category.IELTS, "Bad", "", 600, List.of(section))))
                .isInstanceOf(ApiException.class).hasMessageContaining("general");
    }
    @Test void sourceAndCoverAreStoredAndReturnedInTheSummary() throws Exception {
        var section = new PlacementRequests.Section("general", "Questions", "", inlineQuiz());
        var request = new PlacementRequests.Test(PlacementRequests.Category.IELTS, "With meta", "", 600, List.of(section), null, " Cambridge ", "/api/storage/file/abc");
        JsonNode created = create("meta-test", request);
        JsonNode detail = tests.detail(id("meta-test"));
        assertThat(detail.path("source").asText()).isEqualTo("Cambridge");
        assertThat(detail.path("cover").asText()).isEqualTo("/api/storage/file/abc");
        assertThat(created.path("source").asText()).isEqualTo("Cambridge");
        // Thời gian lưu theo cùng cấu trúc ba mốc như Kho và Luyện đề; đề một đồng hồ chỉ có mốc mặc định.
        JsonNode limits = detail.path("content").path("timeLimits");
        assertThat(limits.path("default").asInt()).isEqualTo(600);
        assertThat(limits.path("hard").isNull()).isTrue();
        assertThat(limits.path("easy").isNull()).isTrue();
        // Không nhập thì không có khoá.
        JsonNode plain = create("plain-meta", new PlacementRequests.Test(PlacementRequests.Category.IELTS, "No meta", "", 600, List.of(section)));
        assertThat(plain.has("source")).isFalse();
        assertThat(plain.has("cover")).isFalse();
    }

    @Test void thereIsNoLimitOnSectionsOrQuestions() throws Exception {
        // 12 phần, mỗi phần 20 câu = 240 câu: cả số phần (>10) lẫn số câu (>200) đều được nhận.
        var sections = new java.util.ArrayList<PlacementRequests.Section>();
        for (int s = 0; s < 12; s++) {
            var json = new StringBuilder("{\"title\":\"S\",\"questions\":[");
            for (int q = 0; q < 20; q++) {
                if (q > 0) json.append(',');
                json.append("{\"questionId\":\"big-").append(s).append('-').append(q).append("\",\"questionType\":\"MULTIPLE_CHOICE\",\"questionText\":\"Q\",\"points\":1,")
                        .append("\"options\":[{\"optionIndex\":0,\"content\":\"a\",\"correct\":true},{\"optionIndex\":1,\"content\":\"b\",\"correct\":false}]}");
            }
            json.append("]}");
            sections.add(new PlacementRequests.Section("part-" + s, "Part " + s, "", mapper.readValue(json.toString(), QuizContent.class)));
        }
        JsonNode created = create("big-test", new PlacementRequests.Test(PlacementRequests.Category.IELTS, "Big", "", 3600, sections));
        assertThat(tests.detail(created.path("id").asText()).path("content").path("questions").size()).isEqualTo(240);
    }

    @Test void inlineSectionsRejectDuplicateIdsAndEmptyQuestions() throws Exception {
        var quiz = inlineQuiz();
        var duplicate = List.of(new PlacementRequests.Section("first", "First", "", quiz), new PlacementRequests.Section("second", "Second", "", quiz));
        assertThatThrownBy(() -> create("duplicate-inline", new PlacementRequests.Test(PlacementRequests.Category.IELTS, "Duplicate", "", 600, duplicate))).isInstanceOf(ApiException.class);
        var empty = new PlacementRequests.Section("general", "Empty", "", QuizContent.builder().title("Empty").questions(List.of()).build());
        assertThatThrownBy(() -> create("empty-inline", new PlacementRequests.Test(PlacementRequests.Category.IELTS, "Empty", "", 600, List.of(empty)))).isInstanceOf(ApiException.class);
    }

}
