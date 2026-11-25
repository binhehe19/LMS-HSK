package pl.co.lms.service.grading;

import base.co.common.notification.NotificationEvent;
import base.co.common.notification.NotificationPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import pl.co.lms.entity.AssessmentAttempt;
import base.co.common.notification.ResourceType;

import java.util.HashMap;
import java.util.Map;

// Thông báo cho học sinh (chủ attempt). Nội dung không nhắc tới AI hay điểm tạm thời: học sinh coi mọi điểm
// đều là điểm chính thức. Gửi sau commit; lỗi gửi chỉ ghi log, không làm hỏng việc chấm.
@Slf4j
@Component
@RequiredArgsConstructor
public class AssessmentGradingNotifier {

    private final NotificationPublisher notificationPublisher;

    // Bài chuyển sang GRADED lần đầu.
    public void notifyGraded(AssessmentAttempt attempt) {
        send(attempt, "ASSESSMENT_GRADED", "Bài làm đã có điểm",
                "Bài làm của bạn đã được chấm. Bạn được " + attempt.getEarnedPoints().stripTrailingZeros().toPlainString()
                        + "/" + attempt.getTotalPoints().stripTrailingZeros().toPlainString() + " điểm.",
                "assessment-graded:" + attempt.getId());
    }

    // Admin chấm lại và điểm của học sinh thay đổi.
    public void notifyRegraded(AssessmentAttempt attempt) {
        send(attempt, "ASSESSMENT_REGRADED", "Điểm bài làm đã được cập nhật",
                "Điểm bài làm của bạn đã được cập nhật: "
                        + attempt.getEarnedPoints().stripTrailingZeros().toPlainString()
                        + "/" + attempt.getTotalPoints().stripTrailingZeros().toPlainString() + " điểm.",
                "assessment-regraded:" + attempt.getId() + ":" + System.currentTimeMillis());
    }

    private void send(AssessmentAttempt attempt, String topic, String title, String message, String dedupeKey) {
        String userId = attempt.getUserId();
        if (userId == null || userId.isBlank()) return;
        Map<String, Object> payload = new HashMap<>();
        payload.put("attemptId", attempt.getId());
        payload.put("sessionId", attempt.getSessionId());
        payload.put("sessionNo", attempt.getSessionNo());
        payload.put("contentPackageVersionId", attempt.getContentPackageVersionId());
        NotificationEvent event = new NotificationEvent(
                userId, topic, title, message, ResourceType.OTHER, attempt.getId(), payload, dedupeKey);
        AfterCommit.run(() -> {
            try {
                notificationPublisher.publish(event);
            } catch (Exception e) {
                log.warn("Không gửi được thông báo chấm điểm attemptId={}: {}", attempt.getId(), e.getMessage());
            }
        });
    }
}
