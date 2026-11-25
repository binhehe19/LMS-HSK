package pl.co.lms.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import pl.co.lms.service.grading.AssessmentGradingRescueService;

// Gửi lại sự kiện chấm bị mất (server sập giữa commit và gửi Kafka, worker chết giữa chừng).
@Slf4j
@Component
@RequiredArgsConstructor
public class AssessmentGradingRescueJob {

    private final AssessmentGradingRescueService rescueService;

    @Scheduled(fixedDelayString = "${assessment.grading.rescue-interval-ms:120000}")
    public void rescueStuckGrading() {
        try {
            int attempts = rescueService.rescuePendingAttempts();
            int answers = rescueService.rescueAiPendingAnswers();
            if (attempts > 0 || answers > 0) {
                log.info("Re-published quiz grading events: attempts={}, aiAnswers={}", attempts, answers);
            }
        } catch (Exception e) {
            log.error("Quiz grading rescue job failed", e);
        }
    }
}
