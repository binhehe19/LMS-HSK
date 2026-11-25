package pl.co.lms.service.progress;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pl.co.lms.client.CmsClient;
import pl.co.lms.client.dto.CmsMyClass;
import pl.co.lms.client.dto.CmsMySessionShared;
import pl.co.lms.dto.response.SessionHomeworkProgressResponse;
import pl.co.lms.entity.AssessmentAttempt;
import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.entity.AssessmentGradingStatus;
import pl.co.lms.repository.LearningResourceStateRepository;
import pl.co.lms.repository.AssessmentAttemptRepository;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HomeworkProgressServiceTest {

    @Mock private CmsClient cmsClient;
    @Mock private SessionUnitsProvider unitsProvider;
    @Mock private AssessmentAttemptRepository attemptRepository;
    @Mock private LearningResourceStateRepository stateRepository;

    private HomeworkProgressService service;

    @BeforeEach
    void setUp() {
        service = new HomeworkProgressService(cmsClient, unitsProvider, attemptRepository, stateRepository);
    }

    // Hai bài kiểm tra nằm trong CÙNG một học phần (cùng contentPackageVersionId) là hai bài riêng:
    // làm xong một bài thì tiến độ là 1/2, không phải 1/1.
    @Test
    void sessionProgress_CountsQuizzesInTheSamePackageSeparately() {
        CmsMyClass myClass = new CmsMyClass();
        myClass.setId("class-1");
        myClass.setSyllabusId("syl-1");
        CmsMySessionShared session = new CmsMySessionShared();
        session.setId("session-1");
        session.setSessionNo(1);
        when(cmsClient.getMyClasses(any())).thenReturn(List.of(myClass));
        when(cmsClient.getMyClassSessions("class-1")).thenReturn(List.of(session));

        when(unitsProvider.get("syl-1", 1))
                .thenReturn(new SessionUnits(List.of(), List.of(), List.of("res-A", "res-B"), List.of()));

        AssessmentAttempt attemptA = AssessmentAttempt.builder()
                .contentPackageId("pkg-1").contentPackageVersionId("ver-1")
                .learningResourceId("res-A").learningResourceVersionId("rv-A")
                .sessionId("session-1").sessionNo(1)
                .status(AssessmentAttemptStatus.SUBMITTED).gradingStatus(AssessmentGradingStatus.GRADED)
                .build();
        attemptA.setCreatedAt(Instant.now());
        when(attemptRepository.findByUserIdAndSessionIdInAndStatusInAndDeletedFalse(
                eq("user-1"), anyList(), anyCollection())).thenReturn(List.of(attemptA));

        SessionHomeworkProgressResponse progress = service.getSessionProgress("user-1", "class-1", "session-1");

        assertThat(progress.quickTest().totalUnits()).isEqualTo(2);
        assertThat(progress.quickTest().doneUnits()).isEqualTo(1);
        assertThat(progress.quickTest().percent()).isEqualTo(50.0);
    }
}
