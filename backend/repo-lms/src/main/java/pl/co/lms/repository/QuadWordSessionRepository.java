package pl.co.lms.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.co.lms.entity.QuadWordSession;
import pl.co.lms.entity.QuadWordSource;
import java.util.Optional;

public interface QuadWordSessionRepository extends JpaRepository<QuadWordSession, String> {
    @Query("select distinct s.candidateResourceId from QuadWordSession s where s.userId = :userId and s.collectionKey = :collectionKey and s.status = pl.co.lms.entity.QuadWordStatus.WON and s.deleted = false and s.candidateResourceId is not null")
    java.util.List<String> learnedResourceIds(@Param("userId") String userId, @Param("collectionKey") String collectionKey);
    @Query("select s from QuadWordSession s where s.id = :id and s.userId = :userId and s.deleted = false and s.source = pl.co.lms.entity.QuadWordSource.VOCABULARY")
    Optional<QuadWordSession> findByIdAndUserIdAndDeletedFalse(String id, String userId);
    Optional<QuadWordSession> findFirstByUserIdAndSourceAndDeletedFalseOrderByCreatedAtDescIdDesc(String userId, QuadWordSource source);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from QuadWordSession s where s.id = :id and s.userId = :userId and s.deleted = false and s.source = pl.co.lms.entity.QuadWordSource.VOCABULARY")
    Optional<QuadWordSession> lockOwned(@Param("id") String id, @Param("userId") String userId);
}
