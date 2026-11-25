package pl.co.lms.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pl.co.lms.entity.StudentProfile;
import java.util.Optional;

public interface StudentProfileRepository extends JpaRepository<StudentProfile, String> {
    Optional<StudentProfile> findByUserIdAndDeletedFalse(String userId);
}
