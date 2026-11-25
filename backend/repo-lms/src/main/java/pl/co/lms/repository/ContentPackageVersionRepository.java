package pl.co.lms.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pl.co.lms.entity.ContentPackageVersion;

import java.util.List;
import java.util.Optional;

public interface ContentPackageVersionRepository extends JpaRepository<ContentPackageVersion, String> {

    Optional<ContentPackageVersion> findByIdAndDeletedFalse(String id);

    List<ContentPackageVersion> findByPackageIdAndDeletedFalseOrderByVersionDesc(String packageId);
}
