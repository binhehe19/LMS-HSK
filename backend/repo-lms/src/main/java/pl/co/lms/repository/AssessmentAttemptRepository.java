package pl.co.lms.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.co.lms.entity.AssessmentAttempt;
import pl.co.lms.entity.AssessmentContextType;
import pl.co.lms.entity.AssessmentAttemptStatus;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AssessmentAttemptRepository extends JpaRepository<AssessmentAttempt, String>, JpaSpecificationExecutor<AssessmentAttempt> {

    List<AssessmentAttempt> findByUserIdAndStatusInAndDeletedFalse(String userId, Collection<AssessmentAttemptStatus> statuses);

    Optional<AssessmentAttempt> findByIdAndDeletedFalse(String id);

    // Khoá dòng attempt: submit, job đóng bài, worker chấm và admin chấm đều đi qua đây để không ghi chồng nhau.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM AssessmentAttempt a WHERE a.id = :id AND a.deleted = false")
    Optional<AssessmentAttempt> findByIdForUpdate(@Param("id") String id);

    // Tìm bài đang làm dở để resume — khớp đúng partial unique index
    // uk_assessment_attempts_active (created_by, learning_resource_id, session_id).
    Optional<AssessmentAttempt> findByUserIdAndLearningResourceIdAndSessionIdAndStatusAndDeletedFalse(
            String userId, String learningResourceId, String sessionId, AssessmentAttemptStatus status);

    // Các lượt tự luyện đã kết thúc (nộp hoặc hết giờ) của một người theo kỹ năng, mới nhất trước; dùng cho danh mục đề.
    List<AssessmentAttempt> findByUserIdAndSubTypeAndContextTypeAndStatusInAndDeletedFalseOrderByUpdatedAtDesc(
            String userId, String subType, AssessmentContextType contextType, Collection<AssessmentAttemptStatus> statuses);

    // Lượt tự luyện đã kết thúc gần nhất của một người trên một bài.
    java.util.Optional<AssessmentAttempt> findFirstByUserIdAndLearningResourceIdAndContextTypeAndStatusInAndDeletedFalseOrderByUpdatedAtDesc(
            String userId, String learningResourceId, AssessmentContextType contextType, Collection<AssessmentAttemptStatus> statuses);

    // Lượt tự luyện đang làm dở (SELF_STUDY) của một người trên một bài trong một ngăn (mode/variant); khớp partial unique index.
    Optional<AssessmentAttempt> findByUserIdAndLearningResourceIdAndContextKeyAndStatusAndDeletedFalse(
            String userId, String learningResourceId, String contextKey, AssessmentAttemptStatus status);

    // Lịch sử các lần làm một bài của học sinh trong một buổi, mới nhất trước (tối đa 100 lần gần nhất).
    List<AssessmentAttempt> findTop100ByUserIdAndLearningResourceIdAndSessionIdAndDeletedFalseOrderByCreatedAtDesc(
            String userId, String learningResourceId, String sessionId);

    long countByUserIdAndLearningResourceIdAndSessionIdAndDeletedFalse(
            String userId, String learningResourceId, String sessionId);

    // Mọi attempt đã nộp/đóng của một học sinh trong các buổi học đã cho (dùng tính tiến độ bài tập).
    List<AssessmentAttempt> findByUserIdAndSessionIdInAndStatusInAndDeletedFalse(
            String userId, Collection<String> sessionIds, Collection<AssessmentAttemptStatus> statuses);

    // Danh sách chấm bài (nhiều bộ lọc tuỳ chọn) dựng bằng Specification: xem AssessmentGradingSpecifications.
}
