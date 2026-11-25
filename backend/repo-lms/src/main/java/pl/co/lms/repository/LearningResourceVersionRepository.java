package pl.co.lms.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.LearningResourceVersion;

import java.util.List;
import java.util.Optional;

public interface LearningResourceVersionRepository extends JpaRepository<LearningResourceVersion, String> {

    @Query("""
            select v from LearningResourceVersion v join LearningResource r on r.publishedVersionId = v.id
            where r.deleted = false and r.inLibrary = true and r.type = pl.co.lms.entity.LearningResourceType.ASSESSMENT
              and v.deleted = false and v.status = pl.co.lms.entity.LearningResourceVersionStatus.PUBLISHED
            order by r.id
            """)
    List<LearningResourceVersion> findPublishedLibraryQuizzes();

    Optional<LearningResourceVersion> findByIdAndDeletedFalse(String id);

    List<LearningResourceVersion> findByResourceIdAndDeletedFalseOrderByVersionDesc(String resourceId);

    List<LearningResourceVersion> findByIdInAndDeletedFalse(List<String> ids);

    @Query("""
            select v from LearningResourceVersion v, LearningResource r
            where r.publishedVersionId = v.id and v.resourceId = r.id
              and r.type = :type and r.inLibrary = true and r.deleted = false
              and v.deleted = false and v.status = pl.co.lms.entity.LearningResourceVersionStatus.PUBLISHED
            order by r.createdAt desc, r.id asc
            """)
    Page<LearningResourceVersion> findPublishedGameContent(@Param("type") LearningResourceType type, Pageable pageable);

}
