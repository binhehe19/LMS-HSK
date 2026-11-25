package pl.co.lms.integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import pl.co.lms.client.CmsClient;
import pl.co.lms.client.IdentityClient;
import pl.co.lms.client.dto.CmsClassSession;
import pl.co.lms.dto.response.AssessmentGradingListItemResponse;
import pl.co.lms.entity.AssessmentAttempt;
import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.entity.AssessmentContextType;
import pl.co.lms.entity.AssessmentGradingStatus;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.service.AssessmentAttemptQuestionResolver;
import pl.co.lms.service.AssessmentManualGradingService;
import pl.co.lms.service.AssessmentManualGradingService.ListQuery;
import pl.co.lms.service.RedisSessionLockService;
import pl.co.lms.service.grading.AssessmentGradingNotifier;
import pl.co.lms.service.grading.AssessmentGradingService;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Danh sách chấm bài chạy thật trên H2: tách bài trong lớp / tự luyện và các bộ lọc học sinh, lớp, tên bài.
 * Auth và CMS được giả lập; phần cần kiểm là điều kiện truy vấn và việc gắn tên/email vào từng dòng.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:gradinglist;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.flyway.enabled=false"})
@Import({JacksonAutoConfiguration.class, AssessmentManualGradingService.class, pl.co.lms.service.grading.QuestionAutoGrader.class})
class AssessmentGradingListFilterTest {

    @MockBean RedisSessionLockService redisLockService;
    @MockBean AssessmentGradingService gradingService;
    @MockBean AssessmentGradingNotifier notifier;
    @MockBean AssessmentAttemptQuestionResolver questionResolver;
    @MockBean IdentityClient identityClient;
    @MockBean CmsClient cmsClient;

    @Autowired TestEntityManager em;
    @Autowired AssessmentManualGradingService service;

    private String classAttempt;
    private String selfAttempt;

    @BeforeEach
    void seed() {
        // Mặc định Auth không khớp ai: từ khoá chỉ còn khớp theo tên bài, trừ test nào tự giả lập kết quả riêng.
        when(identityClient.searchUserIds(any())).thenReturn(new IdentityClient.UserSearchResult(Set.of(), false));
        LearningResource reading = LearningResource.builder().type(LearningResourceType.ASSESSMENT)
                .subType(ResourceSubTypes.PRACTICE_READING).searchTitle("ielts reading test 1").build();
        LearningResource quiz = LearningResource.builder().type(LearningResourceType.ASSESSMENT)
                .subType(ResourceSubTypes.QUIZ).searchTitle("bai tap thi hoan thanh").build();
        em.persist(reading);
        em.persist(quiz);
        classAttempt = attempt("user-class", AssessmentContextType.CLASS_SESSION, "session-1", quiz.getId());
        selfAttempt = attempt("user-self", AssessmentContextType.SELF_STUDY, null, reading.getId());
        em.flush();
    }

    private String attempt(String userId, AssessmentContextType context, String sessionId, String resourceId) {
        AssessmentAttempt a = AssessmentAttempt.builder()
                .userId(userId).contextType(context).contextKey(sessionId == null ? "SELF:default" : sessionId)
                .sessionId(sessionId).sessionNo(sessionId == null ? null : 1)
                .contentPackageId(sessionId == null ? null : "pkg").contentPackageVersionId(sessionId == null ? null : "pkgv")
                .learningResourceId(resourceId).learningResourceVersionId("version-" + userId)
                .status(AssessmentAttemptStatus.SUBMITTED).gradingStatus(AssessmentGradingStatus.MANUAL_GRADING)
                .build();
        em.persist(a);
        return a.getId();
    }

    private static ListQuery query(AssessmentContextType context, String keyword, String classId) {
        return new ListQuery(null, false, null, context, false, keyword, classId, null, null, null, 0, 20);
    }

    private static ListQuery querySessionNo(Integer sessionNo) {
        return new ListQuery(null, false, null, null, false, null, null, sessionNo, null, null, 0, 20);
    }

    private static ListQuery queryStarted(LocalDate from, LocalDate to) {
        return new ListQuery(null, false, null, null, false, null, null, null, from, to, 0, 20);
    }

    private static ListQuery queryStatus(AssessmentGradingStatus status, boolean allStatuses) {
        return new ListQuery(status, allStatuses, null, null, false, null, null, null, null, null, 0, 20);
    }

    private List<String> ids(ListQuery q) {
        return service.list(q).page().getContent().stream().map(AssessmentGradingListItemResponse::attemptId).toList();
    }

    @Test
    void contextType_SeparatesClassFromSelfStudy() {
        assertThat(ids(query(AssessmentContextType.CLASS_SESSION, null, null))).containsExactly(classAttempt);
        assertThat(ids(query(AssessmentContextType.SELF_STUDY, null, null))).containsExactly(selfAttempt);
        assertThat(ids(query(null, null, null))).containsExactlyInAnyOrder(classAttempt, selfAttempt);
    }

    @Test
    void student_FiltersByUserIdsFoundInAuth_AndReportsTruncation() {
        when(identityClient.searchUserIds("nguyen")).thenReturn(new IdentityClient.UserSearchResult(Set.of("user-self"), true));

        AssessmentManualGradingService.ListResult result = service.list(query(null, "nguyen", null));

        assertThat(result.page().getContent()).extracting(AssessmentGradingListItemResponse::attemptId).containsExactly(selfAttempt);
        assertThat(result.studentSearchTruncated()).isTrue();
    }

    @Test
    void student_NoMatchingUser_ReturnsNothing() {
        when(identityClient.searchUserIds("nobody")).thenReturn(new IdentityClient.UserSearchResult(Set.of(), false));

        assertThat(ids(query(null, "nobody", null))).isEmpty();
    }

    @Test
    void keyword_MatchesStudentOrTitle_NotBothRequired() {
        // "reading" khớp tên bài của bài tự luyện; Auth cho rằng "reading" cũng là học sinh của bài trong lớp -> cả hai bài hiện.
        when(identityClient.searchUserIds("reading")).thenReturn(new IdentityClient.UserSearchResult(Set.of("user-class"), false));

        assertThat(ids(query(null, "reading", null))).containsExactlyInAnyOrder(classAttempt, selfAttempt);
    }

    @Test
    void classId_KeepsOnlyAttemptsInSessionsOfThatClass() {
        CmsClassSession session = new CmsClassSession();
        session.setId("session-1");
        when(cmsClient.getClassSessions("class-1")).thenReturn(List.of(session));

        assertThat(ids(query(null, null, "class-1"))).containsExactly(classAttempt);
    }

    @Test
    void classId_WithoutSessions_ReturnsNothing() {
        when(cmsClient.getClassSessions("class-empty")).thenReturn(List.of());

        assertThat(ids(query(null, null, "class-empty"))).isEmpty();
    }

    @Test
    void sessionNo_KeepsOnlyAttemptsOfThatSessionNumber() {
        // Bài trong lớp được seed ở buổi số 1; bài tự luyện không có số buổi.
        assertThat(ids(querySessionNo(1))).containsExactly(classAttempt);
        assertThat(ids(querySessionNo(2))).isEmpty();
        assertThat(ids(querySessionNo(null))).containsExactlyInAnyOrder(classAttempt, selfAttempt);
    }

    @Test
    void title_MatchesNormalizedResourceTitle_IgnoringCaseAndAccents() {
        assertThat(ids(query(null, "Reading", null))).containsExactly(selfAttempt);
        assertThat(ids(query(null, "BÀI TẬP", null))).containsExactly(classAttempt);
        assertThat(ids(query(null, "speaking", null))).isEmpty();
    }

    @Test
    void status_DefaultsToManualGrading_SpecificStatusFilters_AllStatusesSkipsUnsubmitted() {
        AssessmentAttempt graded = em.find(AssessmentAttempt.class, selfAttempt);
        graded.setGradingStatus(AssessmentGradingStatus.GRADED);
        String inProgress = attempt("user-draft", AssessmentContextType.SELF_STUDY, null, graded.getLearningResourceId());
        AssessmentAttempt draft = em.find(AssessmentAttempt.class, inProgress);
        draft.setStatus(AssessmentAttemptStatus.IN_PROGRESS);
        draft.setGradingStatus(AssessmentGradingStatus.NOT_SUBMITTED);
        em.flush();

        assertThat(ids(queryStatus(null, false))).containsExactly(classAttempt);
        assertThat(ids(queryStatus(AssessmentGradingStatus.GRADED, false))).containsExactly(selfAttempt);
        // Tất cả = mọi bài đã nộp; bài đang làm dở (NOT_SUBMITTED) không nằm trong danh sách chấm.
        assertThat(ids(queryStatus(AssessmentGradingStatus.GRADED, true))).containsExactlyInAnyOrder(classAttempt, selfAttempt);
    }

    @Test
    void startedRange_IncludesBothEndDays_AndExcludesOtherDays() {
        // Bài vừa tạo có created_at = bây giờ, tức là bắt đầu làm hôm nay (giờ Việt Nam).
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));

        assertThat(ids(queryStarted(today, today))).containsExactlyInAnyOrder(classAttempt, selfAttempt);
        assertThat(ids(queryStarted(today.minusDays(3), today.plusDays(1)))).containsExactlyInAnyOrder(classAttempt, selfAttempt);
        assertThat(ids(queryStarted(today.plusDays(1), null))).isEmpty();
        assertThat(ids(queryStarted(null, today.minusDays(1)))).isEmpty();
        assertThat(ids(queryStarted(null, null))).containsExactlyInAnyOrder(classAttempt, selfAttempt);
    }

    @Test
    void rows_CarryStudentNameAndEmailFromAuth() {
        IdentityClient.UserSummary user = new IdentityClient.UserSummary();
        user.setUserId("user-self");
        user.setFullName("Nguyễn Văn A");
        user.setEmail("a@example.com");
        user.setUserCode("HS001");
        when(identityClient.lookupByIds(any())).thenReturn(Map.of("user-self", user));

        List<AssessmentGradingListItemResponse> rows = service.list(query(AssessmentContextType.SELF_STUDY, null, null)).page().getContent();

        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.studentId()).isEqualTo("user-self");
            assertThat(row.studentName()).isEqualTo("Nguyễn Văn A");
            assertThat(row.studentEmail()).isEqualTo("a@example.com");
            assertThat(row.studentCode()).isEqualTo("HS001");
        });
    }

    @Test
    void rows_WithoutAuthData_StillListedWithUserIdOnly() {
        List<AssessmentGradingListItemResponse> rows = service.list(query(AssessmentContextType.CLASS_SESSION, null, null)).page().getContent();

        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.studentId()).isEqualTo("user-class");
            assertThat(row.studentName()).isNull();
        });
    }
}
