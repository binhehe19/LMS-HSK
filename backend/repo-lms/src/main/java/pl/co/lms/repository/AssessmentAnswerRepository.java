package pl.co.lms.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.co.lms.entity.AssessmentAnswer;
import pl.co.lms.entity.AssessmentAnswerGradingStatus;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AssessmentAnswerRepository extends JpaRepository<AssessmentAnswer, String> {
    List<AssessmentAnswer> findByAttemptIdInAndDeletedFalse(Collection<String> attemptIds);

    Optional<AssessmentAnswer> findByIdAndDeletedFalse(String id);

    List<AssessmentAnswer> findByAttemptIdAndDeletedFalse(String attemptId);

    // Trong các attempt đã cho, những attempt còn ít nhất một câu ở trạng thái này (VD AI_GRADED chưa duyệt).
    @Query("""
            SELECT DISTINCT x.attemptId FROM AssessmentAnswer x
            WHERE x.attemptId IN :attemptIds AND x.deleted = false AND x.gradingStatus = :status
            """)
    List<String> findAttemptIdsWithStatus(
            @Param("attemptIds") Collection<String> attemptIds, @Param("status") AssessmentAnswerGradingStatus status);
}
