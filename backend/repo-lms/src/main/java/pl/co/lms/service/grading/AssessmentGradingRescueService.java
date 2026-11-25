package pl.co.lms.service.grading;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// Lưới an toàn cho việc gửi sự kiện sau commit: gửi lại bài PENDING và câu AI_PENDING nằm quá lâu.
// Mỗi lần gửi lại đẩy updated_at về now() để không gửi lại liên tục mỗi lượt chạy job.
@Service
@RequiredArgsConstructor
public class AssessmentGradingRescueService {

    private static final String RESCUE_ATTEMPTS_SQL = """
            UPDATE assessment_attempts SET updated_at = now()
            WHERE id IN (
                SELECT id FROM assessment_attempts
                WHERE grading_status = 'PENDING' AND status IN ('SUBMITTED', 'TIME_OUT') AND deleted = false
                  AND updated_at < now() - make_interval(secs => ?)
                ORDER BY updated_at
                LIMIT ?
                FOR UPDATE SKIP LOCKED)
            RETURNING id
            """;

    private static final String RESCUE_AI_SQL = """
            UPDATE assessment_answers SET updated_at = now()
            WHERE id IN (
                SELECT id FROM assessment_answers
                WHERE grading_status = 'AI_PENDING' AND deleted = false
                  AND updated_at < now() - make_interval(secs => ?)
                ORDER BY updated_at
                LIMIT ?
                FOR UPDATE SKIP LOCKED)
            RETURNING id, attempt_id
            """;

    private final JdbcTemplate jdbcTemplate;
    private final AssessmentGradingEventPublisher eventPublisher;

    @Value("${assessment.grading.rescue-pending-after-seconds:180}")
    private long pendingAfterSeconds;

    @Value("${assessment.grading.rescue-ai-after-seconds:600}")
    private long aiPendingAfterSeconds;

    @Value("${assessment.grading.batch-size:500}")
    private int batchSize;

    @Transactional
    public int rescuePendingAttempts() {
        List<String> ids = jdbcTemplate.queryForList(
                RESCUE_ATTEMPTS_SQL, String.class, (double) pendingAfterSeconds, batchSize);
        ids.forEach(eventPublisher::publishAttemptGrade);
        return ids.size();
    }

    @Transactional
    public int rescueAiPendingAnswers() {
        List<String[]> rows = jdbcTemplate.query(
                RESCUE_AI_SQL,
                (rs, i) -> new String[] {rs.getString("id"), rs.getString("attempt_id")},
                (double) aiPendingAfterSeconds, batchSize);
        rows.forEach(r -> eventPublisher.publishAnswerAiGrade(r[1], r[0]));
        return rows.size();
    }
}
