package pl.co.lms.entity;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class AssessmentAttemptTest {

    private static AssessmentAttempt attemptEndingAt(AssessmentAttemptStatus status, Instant endsAt) {
        return AssessmentAttempt.builder().status(status).endsAt(endsAt).build();
    }

    // Quá ends_at nhưng còn trong thời gian nộp muộn thì vẫn là đang làm: heartbeat còn lưu đáp án, submit còn nhận đáp án.
    @Test
    void effectiveStatus_StillInProgress_WithinSubmitGrace() {
        Instant now = Instant.now();
        AssessmentAttempt attempt = attemptEndingAt(AssessmentAttemptStatus.IN_PROGRESS, now.minusSeconds(90));

        assertThat(attempt.effectiveStatus(now)).isEqualTo(AssessmentAttemptStatus.IN_PROGRESS);
    }

    @Test
    void effectiveStatus_TimeOut_AfterSubmitGrace() {
        Instant now = Instant.now();
        AssessmentAttempt attempt = attemptEndingAt(AssessmentAttemptStatus.IN_PROGRESS, now.minus(AssessmentAttempt.SUBMIT_GRACE).minusSeconds(1));

        assertThat(attempt.effectiveStatus(now)).isEqualTo(AssessmentAttemptStatus.TIME_OUT);
    }

    @Test
    void effectiveStatus_NoTimeLimit_StaysInProgress() {
        assertThat(attemptEndingAt(AssessmentAttemptStatus.IN_PROGRESS, null).effectiveStatus(Instant.now()))
                .isEqualTo(AssessmentAttemptStatus.IN_PROGRESS);
    }

    @Test
    void effectiveStatus_FinishedAttemptKeepsItsStatus() {
        Instant longAgo = Instant.now().minusSeconds(3600);
        assertThat(attemptEndingAt(AssessmentAttemptStatus.SUBMITTED, longAgo).effectiveStatus(Instant.now()))
                .isEqualTo(AssessmentAttemptStatus.SUBMITTED);
    }
}
