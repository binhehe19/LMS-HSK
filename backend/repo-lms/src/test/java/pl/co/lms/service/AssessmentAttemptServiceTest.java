package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.filter.principal.AuthPrincipal;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import pl.co.lms.client.CmsClient;
import pl.co.lms.client.dto.CmsMyClass;
import pl.co.lms.client.dto.CmsMySessionShared;
import pl.co.lms.dto.request.AcquireAssessmentLockRequest;
import pl.co.lms.dto.request.HeartbeatAssessmentAttemptRequest;
import pl.co.lms.dto.request.StartAssessmentAttemptRequest;
import pl.co.lms.dto.request.SubmitAssessmentAttemptRequest;
import pl.co.lms.dto.response.HeartbeatAssessmentAttemptResponse;
import pl.co.lms.dto.response.AssessmentAttemptResponse;
import pl.co.lms.dto.response.AssessmentLockResponse;
import pl.co.lms.dto.response.SubmitAssessmentAttemptResponse;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionStatus;
import pl.co.lms.entity.AssessmentAnswer;
import pl.co.lms.entity.AssessmentAnswerGradingStatus;
import pl.co.lms.entity.AssessmentAttempt;
import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.entity.AssessmentGradingStatus;
import pl.co.lms.entity.ContentPackageVersionResource;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.ContentPackageVersionResourceRepository;
import pl.co.lms.repository.AssessmentAnswerRepository;
import pl.co.lms.repository.AssessmentAttemptRepository;
import pl.co.lms.service.grading.AssessmentGradingEventPublisher;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssessmentAttemptServiceTest {

    @Mock
    private AssessmentAttemptRepository attemptRepository;
    @Mock
    private AssessmentAnswerRepository answerRepository;
    @Mock
    private LearningResourceRepository resourceRepository;
    @Mock
    private ContentPackageVersionRepository versionRepository;
    @Mock
    private ContentPackageVersionResourceRepository versionResourceRepository;
    @Mock
    private AssessmentAttemptQuestionResolver questionResolver;
    @Mock
    private RedisSessionLockService redisLockService;
    @Mock
    private CmsClient cmsClient;
    @Mock
    private AssessmentGradingEventPublisher gradingEventPublisher;
    @Mock
    private SyllabusPackageService mappingService;
    @Mock
    private pl.co.lms.service.grading.AssessmentGradingService gradingService;
    @Mock
    private pl.co.lms.service.practice.PracticeCatalogService practiceCatalog;

    private AssessmentAttemptService service;

    @BeforeEach
    void setUp() {
        service = new AssessmentAttemptService(
                attemptRepository, answerRepository, resourceRepository, versionRepository, versionResourceRepository,
                questionResolver, redisLockService, cmsClient, gradingEventPublisher, mappingService,
                new QuizAnswerSanitizer(new ObjectMapper()),
                gradingService, practiceCatalog, new pl.co.lms.service.grading.QuestionAutoGrader(new ObjectMapper()));

        Authentication auth = mock(Authentication.class);
        when(auth.isAuthenticated()).thenReturn(true);
        when(auth.getPrincipal()).thenReturn(new AuthPrincipal("user-1", false, Set.of()));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // ── enrollment helper ──────────────────────────────────────────────────────────

    // Học sinh thuộc class-1 (giáo trình syl-1); buổi `sessionId` là buổi số 1 của lớp đó.
    private void mockEnrollment(String sessionId) {
        CmsMyClass myClass = new CmsMyClass();
        myClass.setId("class-1");
        myClass.setSyllabusId("syl-1");
        CmsMySessionShared session = new CmsMySessionShared();
        session.setId(sessionId);
        session.setSessionNo(1);
        when(cmsClient.getMyClasses(null)).thenReturn(List.of(myClass));
        when(cmsClient.getMyClassSessions("class-1")).thenReturn(List.of(session));
    }

    // ── startOrResume tests ────────────────────────────────────────────────────────

    @Test
    void startOrResume_CreatesNewAttempt() {
        mockEnrollment("session-1");

        ContentPackageVersion version = ContentPackageVersion.builder()
                .packageId("pkg-1")
                .status(ContentPackageVersionStatus.PUBLISHED)
                .build();
        version.setId("ver-1");
        when(versionRepository.findByIdAndDeletedFalse("ver-1")).thenReturn(Optional.of(version));

        ContentPackageVersionResource link = ContentPackageVersionResource.builder()
                .contentPackageVersionId("ver-1")
                .learningResourceId("res-1")
                .learningResourceVersionId("res-ver-1")
                .sessionNo(1)
                .build();
        when(versionResourceRepository.findByContentPackageVersionIdAndLearningResourceIdAndDeletedFalse("ver-1", "res-1"))
                .thenReturn(Optional.of(link));

        when(attemptRepository.findByUserIdAndLearningResourceIdAndSessionIdAndStatusAndDeletedFalse(
                "user-1", "res-1", "session-1", AssessmentAttemptStatus.IN_PROGRESS))
                .thenReturn(Optional.empty());
        when(attemptRepository.save(any(AssessmentAttempt.class))).thenAnswer(i -> {
            AssessmentAttempt a = i.getArgument(0);
            a.setId("att-1");
            return a;
        });
        when(questionResolver.getQuizContent("res-ver-1")).thenReturn(new QuizContent());
        when(answerRepository.findByAttemptIdAndDeletedFalse("att-1")).thenReturn(List.of());
        when(mappingService.isQuizAssignedToSyllabus("syl-1", "ver-1")).thenReturn(true);

        AssessmentAttemptResponse resp = service.startOrResume(
                new StartAssessmentAttemptRequest("session-1", 1, "ver-1", "res-1"));

        assertThat(resp.status()).isEqualTo(AssessmentAttemptStatus.IN_PROGRESS);
        assertThat(resp.attemptId()).isEqualTo("att-1");
    }

    // sessionNo của client bị bỏ qua: số buổi lưu vào bài làm lấy từ buổi do CMS trả về.
    @Test
    void startOrResume_UsesSessionNoFromCmsNotFromClient() {
        mockEnrollment("session-1");
        stubPublishedVersionWithLink("ver-1", "res-1", 1);
        when(attemptRepository.findByUserIdAndLearningResourceIdAndSessionIdAndStatusAndDeletedFalse(
                "user-1", "res-1", "session-1", AssessmentAttemptStatus.IN_PROGRESS)).thenReturn(Optional.empty());
        when(mappingService.isQuizAssignedToSyllabus("syl-1", "ver-1")).thenReturn(true);
        when(attemptRepository.save(any(AssessmentAttempt.class))).thenAnswer(i -> {
            AssessmentAttempt a = i.getArgument(0);
            a.setId("att-1");
            return a;
        });
        when(questionResolver.getQuizContent("res-ver-1")).thenReturn(new QuizContent());
        when(answerRepository.findByAttemptIdAndDeletedFalse("att-1")).thenReturn(List.of());

        service.startOrResume(new StartAssessmentAttemptRequest("session-1", 99, "ver-1", "res-1"));

        org.mockito.ArgumentCaptor<AssessmentAttempt> saved = org.mockito.ArgumentCaptor.forClass(AssessmentAttempt.class);
        verify(attemptRepository).save(saved.capture());
        assertThat(saved.getValue().getSessionNo()).isEqualTo(1);
    }

    @Test
    void startOrResume_QuizNotAssignedToSyllabus_Throws() {
        mockEnrollment("session-1");
        stubPublishedVersionWithLink("ver-1", "res-1", 1);
        when(attemptRepository.findByUserIdAndLearningResourceIdAndSessionIdAndStatusAndDeletedFalse(
                "user-1", "res-1", "session-1", AssessmentAttemptStatus.IN_PROGRESS)).thenReturn(Optional.empty());
        when(mappingService.isQuizAssignedToSyllabus("syl-1", "ver-1")).thenReturn(false);

        assertThatThrownBy(() -> service.startOrResume(new StartAssessmentAttemptRequest("session-1", 1, "ver-1", "res-1")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("không thuộc buổi");
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void startOrResume_QuizLinkedToAnotherSession_Throws() {
        mockEnrollment("session-1");
        stubPublishedVersionWithLink("ver-1", "res-1", 2);
        when(attemptRepository.findByUserIdAndLearningResourceIdAndSessionIdAndStatusAndDeletedFalse(
                "user-1", "res-1", "session-1", AssessmentAttemptStatus.IN_PROGRESS)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.startOrResume(new StartAssessmentAttemptRequest("session-1", 1, "ver-1", "res-1")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("không thuộc buổi");
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void startOrResume_SessionNotInMyClasses_Throws() {
        mockEnrollment("another-session");

        assertThatThrownBy(() -> service.startOrResume(new StartAssessmentAttemptRequest("session-1", 1, "ver-1", "res-1")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("không tham gia lớp");
    }

    // Có classId thì chỉ tra buổi trong lớp đó: buổi nằm ở lớp khác của học sinh vẫn bị từ chối.
    @Test
    void startOrResume_ClassIdRestrictsLookupToThatClass() {
        CmsMyClass classA = new CmsMyClass();
        classA.setId("class-a");
        CmsMyClass classB = new CmsMyClass();
        classB.setId("class-b");
        when(cmsClient.getMyClasses(null)).thenReturn(List.of(classA, classB));
        when(cmsClient.getMyClassSessions("class-b")).thenReturn(List.of());

        assertThatThrownBy(() -> service.startOrResume(
                new StartAssessmentAttemptRequest("session-1", 1, "ver-1", "res-1", "class-b")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("không tham gia lớp");
        verify(cmsClient, never()).getMyClassSessions("class-a");
    }

    // ── giới hạn số lần làm ───────────────────────────────────────────────────────

    private void stubNewAttemptFlow(QuizContent content) {
        mockEnrollment("session-1");
        stubPublishedVersionWithLink("ver-1", "res-1", 1);
        when(attemptRepository.findByUserIdAndLearningResourceIdAndSessionIdAndStatusAndDeletedFalse(
                "user-1", "res-1", "session-1", AssessmentAttemptStatus.IN_PROGRESS)).thenReturn(Optional.empty());
        when(mappingService.isQuizAssignedToSyllabus("syl-1", "ver-1")).thenReturn(true);
        when(questionResolver.getQuizContent("res-ver-1")).thenReturn(content);
    }

    // Không giới hạn số lần làm: học sinh luôn được bắt đầu lần mới khi không có lần nào đang làm dở.
    @Test
    void startOrResume_NoAttemptInProgress_AlwaysCreatesNewAttempt() {
        stubNewAttemptFlow(new QuizContent());
        when(attemptRepository.save(any(AssessmentAttempt.class))).thenAnswer(i -> {
            AssessmentAttempt a = i.getArgument(0);
            a.setId("att-new");
            return a;
        });
        when(answerRepository.findByAttemptIdAndDeletedFalse("att-new")).thenReturn(List.of());

        AssessmentAttemptResponse resp = service.startOrResume(new StartAssessmentAttemptRequest("session-1", 1, "ver-1", "res-1"));

        assertThat(resp.attemptId()).isEqualTo("att-new");
    }

    // Lần đang làm dở được tiếp tục thay vì tạo lần mới.
    @Test
    void startOrResume_ResumesAttemptInProgress() {
        mockEnrollment("session-1");
        stubPublishedVersionWithLink("ver-1", "res-1", 1);
        AssessmentAttempt existing = AssessmentAttempt.builder()
                .contentPackageVersionId("ver-1").contentPackageId("pkg-1").learningResourceId("res-1")
                .learningResourceVersionId("res-ver-1").sessionId("session-1").sessionNo(1)
                .status(AssessmentAttemptStatus.IN_PROGRESS).gradingStatus(AssessmentGradingStatus.NOT_SUBMITTED).build();
        existing.setId("att-existing");
        when(attemptRepository.findByUserIdAndLearningResourceIdAndSessionIdAndStatusAndDeletedFalse(
                "user-1", "res-1", "session-1", AssessmentAttemptStatus.IN_PROGRESS)).thenReturn(Optional.of(existing));
        when(questionResolver.getQuizContent("res-ver-1")).thenReturn(new QuizContent());
        when(answerRepository.findByAttemptIdAndDeletedFalse("att-existing")).thenReturn(List.of());

        AssessmentAttemptResponse resp = service.startOrResume(new StartAssessmentAttemptRequest("session-1", 1, "ver-1", "res-1"));

        assertThat(resp.attemptId()).isEqualTo("att-existing");
    }

    // ── lịch sử các lần làm ───────────────────────────────────────────────────────

    private AssessmentAttempt finishedAttempt(String id, AssessmentAttemptStatus status, AssessmentGradingStatus grading,
            String earned, String total) {
        AssessmentAttempt a = AssessmentAttempt.builder()
                .contentPackageVersionId("ver-1").contentPackageId("pkg-1").learningResourceId("res-1")
                .learningResourceVersionId("res-ver-1").sessionId("session-1").sessionNo(1)
                .status(status).gradingStatus(grading)
                .earnedPoints(new java.math.BigDecimal(earned)).totalPoints(new java.math.BigDecimal(total))
                .build();
        a.setId(id);
        a.setCreatedAt(Instant.now());
        return a;
    }

    @Test
    void listMyAttempts_NewestFirstWithAttemptNoAndPercent() {
        AssessmentAttempt newest = finishedAttempt("att-2", AssessmentAttemptStatus.SUBMITTED, AssessmentGradingStatus.GRADED, "7", "10");
        AssessmentAttempt oldest = finishedAttempt("att-1", AssessmentAttemptStatus.TIME_OUT, AssessmentGradingStatus.GRADED, "3", "10");
        when(attemptRepository
                .findTop100ByUserIdAndLearningResourceIdAndSessionIdAndDeletedFalseOrderByCreatedAtDesc(
                        "user-1", "res-1", "session-1")).thenReturn(List.of(newest, oldest));
        when(attemptRepository.countByUserIdAndLearningResourceIdAndSessionIdAndDeletedFalse(
                "user-1", "res-1", "session-1")).thenReturn(2L);

        var history = service.listMyAttempts("res-1", "session-1");

        assertThat(history.attempts()).extracting(i -> i.attemptId()).containsExactly("att-2", "att-1");
        assertThat(history.attempts()).extracting(i -> i.attemptNo()).containsExactly(2, 1);
        assertThat(history.attempts().get(0).percent()).isEqualByComparingTo("70");
        assertThat(history.attempts().get(0).remainingSeconds()).isNull();
    }

    @Test
    void listMyAttempts_NoAttempts_ReturnsEmpty() {
        when(attemptRepository
                .findTop100ByUserIdAndLearningResourceIdAndSessionIdAndDeletedFalseOrderByCreatedAtDesc(
                        "user-1", "res-1", "session-1")).thenReturn(List.of());
        when(attemptRepository.countByUserIdAndLearningResourceIdAndSessionIdAndDeletedFalse(
                "user-1", "res-1", "session-1")).thenReturn(0L);

        var history = service.listMyAttempts("res-1", "session-1");

        assertThat(history.attempts()).isEmpty();
    }

    private void stubPublishedVersionWithLink(String versionId, String resourceId, int linkSessionNo) {
        ContentPackageVersion version = ContentPackageVersion.builder()
                .packageId("pkg-1")
                .status(ContentPackageVersionStatus.PUBLISHED)
                .build();
        version.setId(versionId);
        lenient().when(versionRepository.findByIdAndDeletedFalse(versionId)).thenReturn(Optional.of(version));
        ContentPackageVersionResource link = ContentPackageVersionResource.builder()
                .contentPackageVersionId(versionId)
                .learningResourceId(resourceId)
                .learningResourceVersionId("res-ver-1")
                .sessionNo(linkSessionNo)
                .build();
        when(versionResourceRepository.findByContentPackageVersionIdAndLearningResourceIdAndDeletedFalse(
                versionId, resourceId)).thenReturn(Optional.of(link));
    }

    @Test
    void startOrResume_ResumesExistingAttempt() {
        mockEnrollment("session-1");

        ContentPackageVersion version = ContentPackageVersion.builder()
                .packageId("pkg-1")
                .status(ContentPackageVersionStatus.PUBLISHED)
                .build();
        version.setId("ver-1");
        when(versionRepository.findByIdAndDeletedFalse("ver-1")).thenReturn(Optional.of(version));

        ContentPackageVersionResource link = ContentPackageVersionResource.builder()
                .contentPackageVersionId("ver-1")
                .learningResourceId("res-1")
                .learningResourceVersionId("res-ver-1")
                .sessionNo(1)
                .build();
        when(versionResourceRepository.findByContentPackageVersionIdAndLearningResourceIdAndDeletedFalse("ver-1", "res-1"))
                .thenReturn(Optional.of(link));

        AssessmentAttempt existing = AssessmentAttempt.builder()
                .contentPackageVersionId("ver-1")
                .contentPackageId("pkg-1")
                .learningResourceId("res-1")
                .learningResourceVersionId("res-ver-1")
                .sessionId("session-1")
                .sessionNo(1)
                .status(AssessmentAttemptStatus.IN_PROGRESS)
                .gradingStatus(AssessmentGradingStatus.PENDING)
                .build();
        existing.setId("att-existing");
        when(attemptRepository.findByUserIdAndLearningResourceIdAndSessionIdAndStatusAndDeletedFalse(
                "user-1", "res-1", "session-1", AssessmentAttemptStatus.IN_PROGRESS))
                .thenReturn(Optional.of(existing));
        when(questionResolver.getQuizContent("res-ver-1")).thenReturn(new QuizContent());
        when(answerRepository.findByAttemptIdAndDeletedFalse("att-existing")).thenReturn(List.of());

        AssessmentAttemptResponse resp = service.startOrResume(
                new StartAssessmentAttemptRequest("session-1", 1, "ver-1", "res-1"));

        assertThat(resp.attemptId()).isEqualTo("att-existing");
        assertThat(resp.status()).isEqualTo(AssessmentAttemptStatus.IN_PROGRESS);
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void startOrResume_UnpublishedVersion_Throws() {
        mockEnrollment("session-1");

        ContentPackageVersion draftVersion = ContentPackageVersion.builder()
                .packageId("pkg-1")
                .status(ContentPackageVersionStatus.DRAFT)
                .build();
        draftVersion.setId("ver-draft");
        when(versionRepository.findByIdAndDeletedFalse("ver-draft")).thenReturn(Optional.of(draftVersion));

        assertThatThrownBy(() -> service.startOrResume(
                new StartAssessmentAttemptRequest("session-1", 1, "ver-draft", "res-1")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("PUBLISHED");
    }

    // ── effectiveStatus tests (via heartbeat) ─────────────────────────────────────

    @Test
    void effectiveStatus_TimeOut_WhenEndsAtPassedSubmitGrace() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .contentPackageVersionId("ver-1")
                .contentPackageId("pkg-1")
                .sessionId("session-1")
                .sessionNo(1)
                .status(AssessmentAttemptStatus.IN_PROGRESS)
                .gradingStatus(AssessmentGradingStatus.PENDING)
                .endsAt(Instant.now().minusSeconds(180))
                .build();
        attempt.setId("att-1");
        attempt.setUserId("user-1");

        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(attempt));
        when(redisLockService.acquireOrRenew("assessment-attempt-lock", "att-1", "user-1", "tok", 60L, false))
                .thenReturn(new RedisSessionLockService.LockResult(true, "user-1", Instant.now().plusSeconds(60)));

        HeartbeatAssessmentAttemptResponse resp = service.heartbeat(
                "att-1", new HeartbeatAssessmentAttemptRequest("tok", null));

        assertThat(resp.effectiveStatus()).isEqualTo(AssessmentAttemptStatus.TIME_OUT);
        assertThat(resp.remainingSeconds()).isEqualTo(0L);
    }

    @Test
    void effectiveStatus_InProgress_WhenEndsAtNotReached() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .contentPackageVersionId("ver-1")
                .contentPackageId("pkg-1")
                .sessionId("session-1")
                .sessionNo(1)
                .status(AssessmentAttemptStatus.IN_PROGRESS)
                .gradingStatus(AssessmentGradingStatus.PENDING)
                .endsAt(Instant.now().plusSeconds(120))
                .build();
        attempt.setId("att-1");
        attempt.setUserId("user-1");

        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(attempt));
        when(redisLockService.acquireOrRenew("assessment-attempt-lock", "att-1", "user-1", "tok", 60L, false))
                .thenReturn(new RedisSessionLockService.LockResult(true, "user-1", Instant.now().plusSeconds(60)));

        HeartbeatAssessmentAttemptResponse resp = service.heartbeat(
                "att-1", new HeartbeatAssessmentAttemptRequest("tok", null));

        assertThat(resp.effectiveStatus()).isEqualTo(AssessmentAttemptStatus.IN_PROGRESS);
        assertThat(resp.remainingSeconds()).isGreaterThan(0L);
    }

    // ── acquireLock tests ──────────────────────────────────────────────────────────

    @Test
    void acquireLock_Success() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .contentPackageVersionId("ver-1")
                .contentPackageId("pkg-1")
                .sessionId("session-1")
                .sessionNo(1)
                .status(AssessmentAttemptStatus.IN_PROGRESS)
                .gradingStatus(AssessmentGradingStatus.PENDING)
                .build();
        attempt.setId("att-1");
        attempt.setUserId("user-1");

        when(attemptRepository.findByIdAndDeletedFalse("att-1")).thenReturn(Optional.of(attempt));
        when(redisLockService.acquireOrRenew("assessment-attempt-lock", "att-1", "user-1", "tok", 60L, false))
                .thenReturn(new RedisSessionLockService.LockResult(true, "user-1", Instant.now().plusSeconds(60)));

        AssessmentLockResponse resp = service.acquireLock("att-1", new AcquireAssessmentLockRequest("tok", false));

        assertThat(resp.acquired()).isTrue();
        assertThat(resp.holderUserId()).isEqualTo("user-1");
    }

    @Test
    void acquireLock_Denied() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .contentPackageVersionId("ver-1")
                .contentPackageId("pkg-1")
                .sessionId("session-1")
                .sessionNo(1)
                .status(AssessmentAttemptStatus.IN_PROGRESS)
                .gradingStatus(AssessmentGradingStatus.PENDING)
                .build();
        attempt.setId("att-1");
        attempt.setUserId("user-1");

        when(attemptRepository.findByIdAndDeletedFalse("att-1")).thenReturn(Optional.of(attempt));
        when(redisLockService.acquireOrRenew("assessment-attempt-lock", "att-1", "user-1", "tok", 60L, false))
                .thenReturn(new RedisSessionLockService.LockResult(false, "other-user", Instant.now().plusSeconds(30)));

        AssessmentLockResponse resp = service.acquireLock("att-1", new AcquireAssessmentLockRequest("tok", false));

        assertThat(resp.acquired()).isFalse();
        assertThat(resp.holderUserId()).isEqualTo("other-user");
    }

    // ── heartbeat tests ────────────────────────────────────────────────────────────

    @Test
    void heartbeat_SavesAnswers_WhenLockAcquired() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .contentPackageVersionId("ver-1")
                .contentPackageId("pkg-1")
                .sessionId("session-1")
                .sessionNo(1)
                .status(AssessmentAttemptStatus.IN_PROGRESS)
                .gradingStatus(AssessmentGradingStatus.PENDING)
                .build();
        attempt.setId("att-1");
        attempt.setUserId("user-1");

        AssessmentAnswer existingAnswer = AssessmentAnswer.builder()
                .attemptId("att-1")
                .questionId("q-1")
                .gradingStatus(AssessmentAnswerGradingStatus.UNGRADED)
                .build();
        existingAnswer.setId("ans-1");

        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(attempt));
        when(redisLockService.acquireOrRenew("assessment-attempt-lock", "att-1", "user-1", "tok", 60L, false))
                .thenReturn(new RedisSessionLockService.LockResult(true, "user-1", Instant.now().plusSeconds(60)));
        when(answerRepository.findByAttemptIdAndDeletedFalse("att-1")).thenReturn(List.of(existingAnswer));

        HeartbeatAssessmentAttemptRequest req = new HeartbeatAssessmentAttemptRequest("tok",
                List.of(new HeartbeatAssessmentAttemptRequest.AnswerItem("q-1", "{\"a\":\"yes\"}")));

        HeartbeatAssessmentAttemptResponse resp = service.heartbeat("att-1", req);

        assertThat(resp.lockRenewed()).isTrue();
        assertThat(resp.savedAnswerIds()).contains("ans-1");
        verify(answerRepository).save(existingAnswer);
    }

    // ── submit tests ───────────────────────────────────────────────────────────────

    @Test
    void submit_MarksAttemptSubmitted() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .contentPackageVersionId("ver-1")
                .contentPackageId("pkg-1")
                .sessionId("session-1")
                .sessionNo(1)
                .status(AssessmentAttemptStatus.IN_PROGRESS)
                .gradingStatus(AssessmentGradingStatus.NOT_SUBMITTED)
                .build();
        attempt.setId("att-1");
        attempt.setUserId("user-1");

        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(attempt));

        SubmitAssessmentAttemptResponse resp = service.submit(
                "att-1", new SubmitAssessmentAttemptRequest("tok", null));

        assertThat(attempt.getStatus()).isEqualTo(AssessmentAttemptStatus.SUBMITTED);
        assertThat(attempt.getGradingStatus()).isEqualTo(AssessmentGradingStatus.PENDING);
        assertThat(resp.answersIgnored()).isFalse();
        assertThat(attempt.getSubmittedAt()).isNotNull();
        assertThat(resp.attemptId()).isEqualTo("att-1");
        verify(attemptRepository).save(attempt);
        verify(gradingEventPublisher).publishAttemptGrade("att-1");
    }

    // Đáp án câu nộp file / ghi âm được làm sạch khi nộp: tệp thừa bị cắt, đáp án sai cấu trúc bị xoá.
    @Test
    void submit_SanitizesFileAndAudioAnswers() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .contentPackageVersionId("ver-1").contentPackageId("pkg-1").learningResourceId("res-1")
                .learningResourceVersionId("res-ver-1").sessionId("session-1").sessionNo(1)
                .status(AssessmentAttemptStatus.IN_PROGRESS).gradingStatus(AssessmentGradingStatus.NOT_SUBMITTED).build();
        attempt.setId("att-1");
        attempt.setUserId("user-1");
        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(attempt));

        QuizContent quiz = new QuizContent();
        quiz.setQuestions(List.of(
                pl.co.lms.entity.json.QuizQuestion.builder().questionId("q-file")
                        .questionType(pl.co.lms.entity.ExerciseQuestionType.FILE_UPLOAD).maxFiles(1).build(),
                pl.co.lms.entity.json.QuizQuestion.builder().questionId("q-audio")
                        .questionType(pl.co.lms.entity.ExerciseQuestionType.AUDIO_RESPONSE).build()));
        when(questionResolver.getQuizContent("res-ver-1")).thenReturn(quiz);

        AssessmentAnswer fileRow = AssessmentAnswer.builder().attemptId("att-1").questionId("q-file")
                .gradingStatus(AssessmentAnswerGradingStatus.UNGRADED).build();
        AssessmentAnswer audioRow = AssessmentAnswer.builder().attemptId("att-1").questionId("q-audio")
                .gradingStatus(AssessmentAnswerGradingStatus.UNGRADED).build();
        when(answerRepository.findByAttemptIdAndDeletedFalse("att-1")).thenReturn(List.of(fileRow, audioRow));

        service.submit("att-1", new SubmitAssessmentAttemptRequest("tok", List.of(
                new HeartbeatAssessmentAttemptRequest.AnswerItem("q-file",
                        "{\"files\":[{\"fileId\":\"a\",\"x\":1},{\"fileId\":\"b\"}]}"),
                new HeartbeatAssessmentAttemptRequest.AnswerItem("q-audio", "{\"audio\":{\"mimeType\":\"audio/webm\"}}"))));

        assertThat(fileRow.getAnswerJson()).isEqualTo("{\"files\":[{\"fileId\":\"a\"}]}");
        assertThat(audioRow.getAnswerJson()).isEmpty();
    }

    @Test
    void submit_Throws409_WhenClosedByTimeoutJob() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .contentPackageVersionId("ver-1")
                .contentPackageId("pkg-1")
                .sessionId("session-1")
                .sessionNo(1)
                .status(AssessmentAttemptStatus.TIME_OUT)
                .gradingStatus(AssessmentGradingStatus.PENDING)
                .build();
        attempt.setId("att-1");
        attempt.setUserId("user-1");

        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> service.submit("att-1", new SubmitAssessmentAttemptRequest("tok", null)))
                .isInstanceOf(ApiException.class);
        verify(attemptRepository, never()).save(any());
        verify(gradingEventPublisher, never()).publishAttemptGrade(any());
    }

    @Test
    void submit_Throws409_WhenAlreadySubmitted() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .contentPackageVersionId("ver-1")
                .contentPackageId("pkg-1")
                .sessionId("session-1")
                .sessionNo(1)
                .status(AssessmentAttemptStatus.SUBMITTED)
                .gradingStatus(AssessmentGradingStatus.PENDING)
                .build();
        attempt.setId("att-1");
        attempt.setUserId("user-1");

        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> service.submit("att-1", new SubmitAssessmentAttemptRequest("tok", null)))
                .isInstanceOf(ApiException.class);
        verify(attemptRepository, never()).save(any());
        verify(gradingEventPublisher, never()).publishAttemptGrade(any());
    }

    // ── tự luyện (SELF_STUDY) ─────────────────────────────────────────────────────

    private pl.co.lms.entity.LearningResource libraryQuiz(String id, String publishedVersionId) {
        pl.co.lms.entity.LearningResource r = pl.co.lms.entity.LearningResource.builder()
                .type(pl.co.lms.entity.LearningResourceType.ASSESSMENT).inLibrary(true).publishedVersionId(publishedVersionId).build();
        r.setId(id);
        return r;
    }

    private QuizContent timedQuiz(Integer defaultSeconds, Integer hardSeconds) {
        QuizContent content = new QuizContent();
        pl.co.lms.entity.json.TimeLimits limits = new pl.co.lms.entity.json.TimeLimits();
        limits.setStandard(defaultSeconds);
        limits.setHard(hardSeconds);
        content.setTimeLimits(limits);
        content.setQuestions(List.of(
                pl.co.lms.entity.json.QuizQuestion.builder().questionId("q-1")
                        .questionType(pl.co.lms.entity.ExerciseQuestionType.MULTIPLE_CHOICE).build(),
                pl.co.lms.entity.json.QuizQuestion.builder().questionId("q-2")
                        .questionType(pl.co.lms.entity.ExerciseQuestionType.FILL_IN_BLANK).build()));
        return content;
    }

    private void stubSelfStudyStart(String resourceId, QuizContent content, String mode, String contextKey) {
        when(resourceRepository.findByIdForStart(resourceId)).thenReturn(Optional.of(libraryQuiz(resourceId, "rv-1")));
        when(attemptRepository.findByUserIdAndLearningResourceIdAndContextKeyAndStatusAndDeletedFalse(
                "user-1", resourceId, contextKey, AssessmentAttemptStatus.IN_PROGRESS)).thenReturn(Optional.empty());
        when(questionResolver.getQuizContent("rv-1")).thenReturn(content);
        when(attemptRepository.save(any(AssessmentAttempt.class))).thenAnswer(i -> {
            AssessmentAttempt a = i.getArgument(0);
            a.setId("att-self");
            return a;
        });
    }

    @Test
    void startOrResumeSelfStudy_DefaultMode_CreatesAttemptWithDeadlineAndAnswerRows() {
        stubSelfStudyStart("res-r", timedQuiz(1200, 900), "default", "SELF:default");

        service.startOrResumeSelfStudy(new pl.co.lms.dto.request.StartSelfStudyAttemptRequest("res-r", "default", null, null));

        org.mockito.ArgumentCaptor<AssessmentAttempt> saved = org.mockito.ArgumentCaptor.forClass(AssessmentAttempt.class);
        verify(attemptRepository).save(saved.capture());
        AssessmentAttempt a = saved.getValue();
        assertThat(a.getContextType()).isEqualTo(pl.co.lms.entity.AssessmentContextType.SELF_STUDY);
        assertThat(a.getSubType()).isEqualTo(pl.co.lms.entity.ResourceSubTypes.QUIZ);
        assertThat(a.getContextKey()).isEqualTo("SELF:default");
        assertThat(a.getUserId()).isEqualTo("user-1");
        assertThat(a.getSessionId()).isNull();
        assertThat(a.getContentPackageId()).isNull();
        assertThat(a.getEndsAt()).isNotNull();
        assertThat(a.getLearningResourceVersionId()).isEqualTo("rv-1");
        verify(answerRepository, org.mockito.Mockito.times(2)).save(any(AssessmentAnswer.class));
    }

    // Mỗi chế độ lấy đúng mốc thời gian của nó; mốc null nghĩa là không giới hạn.
    @Test
    void startOrResumeSelfStudy_HardModeUsesHardLimit_EasyModeWithoutLimitHasNoDeadline() {
        stubSelfStudyStart("res-r", timedQuiz(1200, 600), "hard", "SELF:hard");
        java.time.Instant before = java.time.Instant.now();
        service.startOrResumeSelfStudy(new pl.co.lms.dto.request.StartSelfStudyAttemptRequest("res-r", "hard", null, null));
        org.mockito.ArgumentCaptor<AssessmentAttempt> saved = org.mockito.ArgumentCaptor.forClass(AssessmentAttempt.class);
        verify(attemptRepository).save(saved.capture());
        assertThat(saved.getValue().getEndsAt()).isBetween(before.plusSeconds(599), java.time.Instant.now().plusSeconds(601));

        org.mockito.Mockito.reset(attemptRepository);
        stubSelfStudyStart("res-r", timedQuiz(1200, 600), "easy", "SELF:easy");
        service.startOrResumeSelfStudy(new pl.co.lms.dto.request.StartSelfStudyAttemptRequest("res-r", "easy", null, null));
        org.mockito.ArgumentCaptor<AssessmentAttempt> saved2 = org.mockito.ArgumentCaptor.forClass(AssessmentAttempt.class);
        verify(attemptRepository).save(saved2.capture());
        assertThat(saved2.getValue().getEndsAt()).isNull();
    }
    @Test
    void startOrResumeSelfStudy_ExistingInProgress_ResumesWithoutCreating() throws Exception {
        AssessmentAttempt existing = AssessmentAttempt.builder().userId("user-1").subType(pl.co.lms.entity.ResourceSubTypes.PRACTICE_READING)
                .contextType(pl.co.lms.entity.AssessmentContextType.SELF_STUDY).contextKey("SELF:default")
                .learningResourceId("res-r").learningResourceVersionId("rv-1")
                .status(AssessmentAttemptStatus.IN_PROGRESS).gradingStatus(AssessmentGradingStatus.NOT_SUBMITTED).build();
        existing.setId("att-old");
        when(resourceRepository.findByIdForStart("res-r")).thenReturn(Optional.of(libraryQuiz("res-r", "rv-1")));
        when(attemptRepository.findByUserIdAndLearningResourceIdAndContextKeyAndStatusAndDeletedFalse(
                "user-1", "res-r", "SELF:default", AssessmentAttemptStatus.IN_PROGRESS)).thenReturn(Optional.of(existing));
        when(questionResolver.getQuizContent("rv-1")).thenReturn(timedQuiz(1200, 900));

        var response = service.startOrResumeSelfStudy(new pl.co.lms.dto.request.StartSelfStudyAttemptRequest("res-r", "default", null, null));

        assertThat(response.attemptId()).isEqualTo("att-old");
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void startOrResumeSelfStudy_ResourceNotInLibraryOrUnpublished_Throws() {
        pl.co.lms.entity.LearningResource notLibrary = libraryQuiz("res-x", "rv-1");
        notLibrary.setInLibrary(false);
        when(resourceRepository.findByIdForStart("res-x")).thenReturn(Optional.of(notLibrary));
        when(resourceRepository.findByIdForStart("res-y")).thenReturn(Optional.of(libraryQuiz("res-y", null)));

        assertThatThrownBy(() -> service.startOrResumeSelfStudy(
                new pl.co.lms.dto.request.StartSelfStudyAttemptRequest("res-x", "default", null, null)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.startOrResumeSelfStudy(
                new pl.co.lms.dto.request.StartSelfStudyAttemptRequest("res-y", "default", null, null)))
                .isInstanceOf(ApiException.class);
        verify(attemptRepository, never()).save(any());
    }

    // ── lưu nháp tự luyện theo revision ──────────────────────────────────────────

    private AssessmentAttempt selfStudyAttempt(long revision) {
        AssessmentAttempt a = AssessmentAttempt.builder().userId("user-1").subType(pl.co.lms.entity.ResourceSubTypes.PRACTICE_READING)
                .contextType(pl.co.lms.entity.AssessmentContextType.SELF_STUDY).contextKey("SELF:untimed")
                .learningResourceId("res-r").learningResourceVersionId("rv-1").revision(revision)
                .status(AssessmentAttemptStatus.IN_PROGRESS).gradingStatus(AssessmentGradingStatus.NOT_SUBMITTED).build();
        a.setId("att-1");
        return a;
    }

    private AssessmentAnswer answerRow(String questionId, String json) {
        return AssessmentAnswer.builder().attemptId("att-1").questionId(questionId).answerJson(json)
                .gradingStatus(AssessmentAnswerGradingStatus.UNGRADED).build();
    }

    @Test
    void saveDraft_MatchingRevision_ReplacesAnswersAndStateAndBumpsRevision() {
        AssessmentAttempt a = selfStudyAttempt(3);
        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(a));
        AssessmentAnswer q1 = answerRow("q-1", "\"A\"");
        AssessmentAnswer q2 = answerRow("q-2", "\"B\"");
        when(answerRepository.findByAttemptIdAndDeletedFalse("att-1")).thenReturn(List.of(q1, q2));
        when(questionResolver.getQuizContent("rv-1")).thenReturn(new QuizContent());
        var state = new ObjectMapper().createObjectNode();
        state.putArray("flaggedQuestions").add(1).add(4);

        var response = service.saveDraft("att-1", new pl.co.lms.dto.request.SaveAttemptDraftRequest(
                3L, java.util.Map.of("q-1", "\"TRUE\""), state));

        assertThat(a.getRevision()).isEqualTo(4);
        assertThat(a.getClientState()).isEqualTo(state);
        assertThat(q1.getAnswerJson()).isEqualTo("\"TRUE\"");
        assertThat(q2.getAnswerJson()).isNull();          // câu vắng mặt trong bản nháp bị xoá đáp án
        assertThat(response.revision()).isEqualTo(4);
    }

    @Test
    void saveDraft_NullAnswers_KeepsExistingAnswers() {
        AssessmentAttempt a = selfStudyAttempt(0);
        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(a));
        AssessmentAnswer q1 = answerRow("q-1", "\"A\"");
        when(answerRepository.findByAttemptIdAndDeletedFalse("att-1")).thenReturn(List.of(q1));
        when(questionResolver.getQuizContent("rv-1")).thenReturn(new QuizContent());

        service.saveDraft("att-1", new pl.co.lms.dto.request.SaveAttemptDraftRequest(0L, null, null));

        assertThat(q1.getAnswerJson()).isEqualTo("\"A\"");
        assertThat(a.getRevision()).isEqualTo(1);
    }

    @Test
    void saveDraft_StaleRevision_Throws() {
        AssessmentAttempt a = selfStudyAttempt(3);
        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(a));

        assertThatThrownBy(() -> service.saveDraft("att-1", new pl.co.lms.dto.request.SaveAttemptDraftRequest(2L, null, null)))
                .isInstanceOf(ApiException.class).hasMessageContaining("phiên khác");
        assertThat(a.getRevision()).isEqualTo(3);
    }

    @Test
    void saveDraft_UnknownQuestionOrOversizedAnswer_Throws() {
        AssessmentAttempt a = selfStudyAttempt(0);
        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(a));
        when(answerRepository.findByAttemptIdAndDeletedFalse("att-1")).thenReturn(List.of(answerRow("q-1", null)));

        assertThatThrownBy(() -> service.saveDraft("att-1", new pl.co.lms.dto.request.SaveAttemptDraftRequest(
                0L, java.util.Map.of("other", "\"x\""), null))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.saveDraft("att-1", new pl.co.lms.dto.request.SaveAttemptDraftRequest(
                0L, java.util.Map.of("q-1", "x".repeat(120_001)), null))).isInstanceOf(ApiException.class);
        assertThat(a.getRevision()).isEqualTo(0);
    }

    @Test
    void saveDraft_AfterDeadlineOrOtherUserOrClassAttempt_Throws() {
        AssessmentAttempt expired = selfStudyAttempt(0);
        expired.setEndsAt(Instant.now().minusSeconds(5));
        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(expired));
        assertThatThrownBy(() -> service.saveDraft("att-1", new pl.co.lms.dto.request.SaveAttemptDraftRequest(0L, null, null)))
                .isInstanceOf(ApiException.class).hasMessageContaining("hết thời gian");

        AssessmentAttempt other = selfStudyAttempt(0);
        other.setUserId("someone-else");
        when(attemptRepository.findByIdForUpdate("att-2")).thenReturn(Optional.of(other));
        assertThatThrownBy(() -> service.saveDraft("att-2", new pl.co.lms.dto.request.SaveAttemptDraftRequest(0L, null, null)))
                .isInstanceOf(ApiException.class);

        AssessmentAttempt inClass = selfStudyAttempt(0);
        inClass.setContextType(pl.co.lms.entity.AssessmentContextType.CLASS_SESSION);
        when(attemptRepository.findByIdForUpdate("att-3")).thenReturn(Optional.of(inClass));
        assertThatThrownBy(() -> service.saveDraft("att-3", new pl.co.lms.dto.request.SaveAttemptDraftRequest(0L, null, null)))
                .isInstanceOf(ApiException.class).hasMessageContaining("heartbeat");
    }

    // ── nộp bài tự luyện ─────────────────────────────────────────────────────────

    private QuizContent contentOf(pl.co.lms.entity.ExerciseQuestionType type) {
        QuizContent content = new QuizContent();
        content.setQuestions(List.of(pl.co.lms.entity.json.QuizQuestion.builder().questionId("q-1").questionType(type)
                .options(List.of(
                        pl.co.lms.entity.json.QuestionContent.QuizOptionItem.builder().optionIndex(0).content("a").correct(true).build(),
                        pl.co.lms.entity.json.QuestionContent.QuizOptionItem.builder().optionIndex(1).content("b").correct(false).build()))
                .build()));
        return content;
    }

    @Test
    void submit_SelfStudyAllAutoGradable_GradesInlineWithoutSessionToken() {
        AssessmentAttempt a = selfStudyAttempt(2);
        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(a));
        when(questionResolver.getQuizContent("rv-1")).thenReturn(contentOf(pl.co.lms.entity.ExerciseQuestionType.MULTIPLE_CHOICE));
        AssessmentAnswer q1 = answerRow("q-1", null);
        when(answerRepository.findByAttemptIdAndDeletedFalse("att-1")).thenReturn(List.of(q1));

        service.submit("att-1", new SubmitAssessmentAttemptRequest(null,
                List.of(new HeartbeatAssessmentAttemptRequest.AnswerItem("q-1", "\"TRUE\"")), 2L, null));

        assertThat(a.getStatus()).isEqualTo(AssessmentAttemptStatus.SUBMITTED);
        assertThat(a.getGradingStatus()).isEqualTo(AssessmentGradingStatus.PENDING);
        assertThat(q1.getAnswerJson()).isEqualTo("\"TRUE\"");
        verify(gradingService).gradeAttempt("att-1");
        verify(gradingEventPublisher, never()).publishAttemptGrade(any());
        verify(redisLockService, never()).release(any(), any(), any());
    }

    // Có câu tự luận: chấm bất đồng bộ qua Kafka thay vì chấm ngay.
    @Test
    void submit_SelfStudyWithEssay_PublishesGradingEvent() {
        AssessmentAttempt a = selfStudyAttempt(2);
        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(a));
        when(questionResolver.getQuizContent("rv-1")).thenReturn(contentOf(pl.co.lms.entity.ExerciseQuestionType.ESSAY));
        when(answerRepository.findByAttemptIdAndDeletedFalse("att-1")).thenReturn(List.of(answerRow("q-1", null)));

        service.submit("att-1", new SubmitAssessmentAttemptRequest(null,
                List.of(new HeartbeatAssessmentAttemptRequest.AnswerItem("q-1", "{\"text\":\"hi\"}")), 2L, null));

        verify(gradingEventPublisher).publishAttemptGrade("att-1");
        verify(gradingService, never()).gradeAttempt(any());
    }
    @Test
    void submit_SelfStudyStaleRevision_Throws() {
        AssessmentAttempt a = selfStudyAttempt(2);
        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(a));

        assertThatThrownBy(() -> service.submit("att-1", new SubmitAssessmentAttemptRequest(null, List.of(), 1L, null)))
                .isInstanceOf(ApiException.class).hasMessageContaining("phiên khác");
        assertThat(a.getStatus()).isEqualTo(AssessmentAttemptStatus.IN_PROGRESS);
    }

    @Test
    void submit_ClassAttemptWithoutSessionToken_Throws() {
        AssessmentAttempt a = selfStudyAttempt(0);
        a.setContextType(pl.co.lms.entity.AssessmentContextType.CLASS_SESSION);
        when(attemptRepository.findByIdForUpdate("att-1")).thenReturn(Optional.of(a));

        assertThatThrownBy(() -> service.submit("att-1", new SubmitAssessmentAttemptRequest(" ", List.of())))
                .isInstanceOf(ApiException.class).hasMessageContaining("sessionToken");
    }
}
