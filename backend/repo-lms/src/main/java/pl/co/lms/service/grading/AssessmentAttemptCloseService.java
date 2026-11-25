package pl.co.lms.service.grading;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// Đóng các bài hết giờ mà học sinh không nộp: IN_PROGRESS quá ends_at + closeAfterSeconds (mặc định 3 phút,
// sau cửa sổ nộp muộn 2 phút của submit) thành TIME_OUT + PENDING rồi đẩy vào queue chấm.
// UPDATE ... RETURNING chỉ trả các dòng thật sự đổi được: bài học sinh vừa nộp không còn IN_PROGRESS nên không
// bị đóng và không bị đẩy hai lần. FOR UPDATE SKIP LOCKED cho phép nhiều instance chạy job song song.
@Service
@RequiredArgsConstructor
public class AssessmentAttemptCloseService {

    private static final String CLOSE_SQL = """
            UPDATE assessment_attempts
            SET status = 'TIME_OUT', grading_status = 'PENDING', updated_at = now()
            WHERE id IN (
                SELECT id FROM assessment_attempts
                WHERE status = 'IN_PROGRESS' AND deleted = false AND ends_at IS NOT NULL
                  AND ends_at < now() - make_interval(secs => ?)
                ORDER BY ends_at
                LIMIT ?
                FOR UPDATE SKIP LOCKED)
            RETURNING id
            """;

    private final JdbcTemplate jdbcTemplate;
    private final AssessmentGradingEventPublisher eventPublisher;

    @Value("${assessment.grading.close-after-seconds:180}")
    private long closeAfterSeconds;

    @Value("${assessment.grading.batch-size:500}")
    private int batchSize;

    public int batchSize() {
        return batchSize;
    }

    // Đóng một lô; trả số bài đã đóng. Sự kiện gửi sau commit.
    @Transactional
    public int closeExpiredBatch() {
        List<String> ids = jdbcTemplate.queryForList(CLOSE_SQL, String.class, (double) closeAfterSeconds, batchSize);
        ids.forEach(eventPublisher::publishAttemptGrade);
        return ids.size();
    }
}
