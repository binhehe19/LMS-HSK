package pl.co.lms.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pl.co.lms.entity.LanguagePracticeSegmentAttempt;

import java.util.List;
import java.util.Optional;

public interface LanguagePracticeSegmentAttemptRepository extends JpaRepository<LanguagePracticeSegmentAttempt, String> {

    Optional<LanguagePracticeSegmentAttempt> findByAttemptIdAndSegmentNoAndDeletedFalse(String attemptId, int segmentNo);

    List<LanguagePracticeSegmentAttempt> findByAttemptIdAndDeletedFalseOrderBySegmentNoAsc(String attemptId);

    long countByAttemptIdAndCompletedAtIsNotNullAndDeletedFalse(String attemptId);
}
