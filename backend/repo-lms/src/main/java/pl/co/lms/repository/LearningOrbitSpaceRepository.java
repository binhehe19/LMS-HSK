package pl.co.lms.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pl.co.lms.entity.LearningOrbitSpace;
import java.util.Optional;

public interface LearningOrbitSpaceRepository extends JpaRepository<LearningOrbitSpace, String> {
    Optional<LearningOrbitSpace> findByUserIdAndDeletedFalse(String userId);
}
