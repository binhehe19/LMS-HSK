package pl.co.lms.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import pl.co.lms.entity.PlacementAttempt;
import java.util.Optional;

public interface PlacementAttemptRepository extends JpaRepository<PlacementAttempt, String> {
    Optional<PlacementAttempt> findByAssessmentAttemptIdAndDeletedFalse(String id);
    Page<PlacementAttempt> findByUserIdAndDeletedFalseOrderByCreatedAtDesc(String userId, Pageable page);
    Page<PlacementAttempt> findBySubmittedAtIsNotNullAndDeletedFalseOrderBySubmittedAtDesc(Pageable page);
    Page<PlacementAttempt> findBySubmittedAtIsNotNullAndDeletedFalseAndUserIdInOrderBySubmittedAtDesc(java.util.Collection<String> userIds, Pageable page);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from PlacementAttempt a where a.assessmentAttemptId = :id and a.deleted = false")
    Optional<PlacementAttempt> lockByAssessmentAttemptId(@Param("id") String id);
}
