package pl.co.lms.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import pl.co.lms.service.grading.AssessmentAttemptCloseService;

// Mỗi phút đóng các bài hết giờ quá ends_at + 3 phút mà chưa nộp và đẩy vào queue chấm.
// Mốc hết giờ hiệu lực (ends_at + AssessmentAttempt.SUBMIT_GRACE) không cần job: effectiveStatus tự tính khi gọi API.
@Slf4j
@Component
@RequiredArgsConstructor
public class AssessmentAttemptCloseJob {

    private final AssessmentAttemptCloseService closeService;

    @Scheduled(fixedDelayString = "${assessment.grading.close-interval-ms:60000}")
    public void closeExpiredAttempts() {
        try {
            int batch = closeService.batchSize();
            int closed;
            do {
                closed = closeService.closeExpiredBatch();
                if (closed > 0) {
                    log.info("Closed {} expired quiz attempt(s) as TIME_OUT", closed);
                }
            } while (closed >= batch);
        } catch (Exception e) {
            log.error("Quiz attempt close job failed", e);
        }
    }
}
