package pl.co.lms.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import pl.co.lms.entity.DictionaryProfile;
import java.util.Optional;

public interface DictionaryProfileRepository extends JpaRepository<DictionaryProfile, String> {
    Optional<DictionaryProfile> findByUserIdAndDeletedFalse(String userId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from DictionaryProfile p where p.userId = :userId and p.deleted = false")
    Optional<DictionaryProfile> findForUpdate(@Param("userId") String userId);
}
