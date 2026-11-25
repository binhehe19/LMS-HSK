package pl.co.lms.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.co.lms.entity.ContentPackageVersionResource;

import java.util.List;
import java.util.Optional;

public interface ContentPackageVersionResourceRepository extends JpaRepository<ContentPackageVersionResource, String> {

    Optional<ContentPackageVersionResource> findByIdAndDeletedFalse(String id);

    List<ContentPackageVersionResource> findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc(String contentPackageVersionId);

    List<ContentPackageVersionResource> findByContentPackageVersionIdAndSessionNoAndDeletedFalseOrderByDisplayOrderAsc(String contentPackageVersionId, Integer sessionNo);

    boolean existsByContentPackageVersionIdAndSessionNoAndDisplayOrderAndDeletedFalse(String contentPackageVersionId, Integer sessionNo, Integer displayOrder);
    
    boolean existsByLearningResourceIdAndDeletedFalse(String learningResourceId);

    List<ContentPackageVersionResource> findByLearningResourceIdInAndDeletedFalse(java.util.Collection<String> learningResourceIds);

    long countByContentPackageVersionIdAndDeletedFalse(String contentPackageVersionId);

    @Query("SELECT COUNT(DISTINCT r.sessionNo) FROM ContentPackageVersionResource r WHERE r.contentPackageVersionId = :contentPackageVersionId AND r.deleted = false")
    long countDistinctSessionNoByContentPackageVersionIdAndDeletedFalse(@Param("contentPackageVersionId") String contentPackageVersionId);

    Optional<ContentPackageVersionResource> findByContentPackageVersionIdAndLearningResourceIdAndDeletedFalse(
            String contentPackageVersionId, String learningResourceId);
}
