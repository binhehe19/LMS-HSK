package pl.co.lms.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import pl.co.lms.entity.DictionarySession;
import java.util.List;
import java.util.Optional;

public interface DictionarySessionRepository extends JpaRepository<DictionarySession, String> {
    /** Study sessions of the given lessons only: the roadmap of a topic must not read every session the user ever saved. */
    List<DictionarySession> findByUserIdAndReviewFalseAndDeletedFalseAndLessonIdIn(String userId, java.util.Collection<String> lessonIds);
    Optional<DictionarySession> findByUserIdAndLessonIdAndReviewAndDeletedFalse(String userId, String lessonId, boolean review);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from DictionarySession s where s.userId = :userId and s.lessonId = :lessonId and s.review = :review and s.deleted = false")
    Optional<DictionarySession> findForUpdate(@Param("userId") String userId, @Param("lessonId") String lessonId, @Param("review") boolean review);
    List<DictionarySession> findByUserIdAndCompletedTrueAndDeletedFalseOrderByUpdatedAtDesc(String userId, Pageable pageable);
    List<DictionarySession> findByUserIdAndDeletedFalseOrderByUpdatedAtDesc(String userId, Pageable pageable);
}
