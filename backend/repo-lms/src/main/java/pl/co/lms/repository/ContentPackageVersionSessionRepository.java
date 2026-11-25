package pl.co.lms.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pl.co.lms.entity.ContentPackageVersionSession;

import java.util.List;
import java.util.Optional;

public interface ContentPackageVersionSessionRepository extends JpaRepository<ContentPackageVersionSession, String> {

    List<ContentPackageVersionSession> findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAsc(String contentPackageVersionId);

    Optional<ContentPackageVersionSession> findByContentPackageVersionIdAndSessionNoAndDeletedFalse(String contentPackageVersionId, int sessionNo);
}
