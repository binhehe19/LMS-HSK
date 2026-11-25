package pl.co.lms.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import pl.co.lms.entity.PlacementConsultation;
import java.util.Optional;

public interface PlacementConsultationRepository extends JpaRepository<PlacementConsultation, String> {
    Optional<PlacementConsultation> findByUserIdAndRequestKeyAndDeletedFalse(String userId, String key);
    Page<PlacementConsultation> findByUserIdAndDeletedFalseOrderByCreatedAtDesc(String userId, Pageable page);
    Page<PlacementConsultation> findByDeletedFalseOrderByCreatedAtDesc(Pageable page);
    Page<PlacementConsultation> findByDeletedFalseAndUserIdInOrderByCreatedAtDesc(java.util.Collection<String> userIds, Pageable page);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from PlacementConsultation c where c.id = :id and c.deleted = false")
    Optional<PlacementConsultation> lockById(@Param("id") String id);
}
