package pl.co.lms.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pl.co.lms.entity.LanguagePracticeAttempt;
import pl.co.lms.entity.LanguagePracticeAttemptStatus;
import pl.co.lms.entity.LanguagePracticeMode;

import java.util.Optional;

public interface LanguagePracticeAttemptRepository extends JpaRepository<LanguagePracticeAttempt, String> {

    Optional<LanguagePracticeAttempt> findByIdAndDeletedFalse(String id);

    Optional<LanguagePracticeAttempt> findFirstByCreatedByAndResourceVersionIdAndModeAndStatusAndDeletedFalseOrderByCreatedAtDesc(
            String userId,
            String resourceVersionId,
            LanguagePracticeMode mode,
            LanguagePracticeAttemptStatus status);

}
