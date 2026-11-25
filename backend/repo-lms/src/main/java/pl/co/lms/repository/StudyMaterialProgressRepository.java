package pl.co.lms.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.co.lms.entity.StudyMaterialProgress;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StudyMaterialProgressRepository extends JpaRepository<StudyMaterialProgress, String> {
    Optional<StudyMaterialProgress> findByUserIdAndResourceIdAndDeletedFalse(String userId, String resourceId);
    List<StudyMaterialProgress> findByUserIdAndResourceIdInAndDeletedFalse(String userId, Collection<String> resourceIds);
    @Query("""
        select p from StudyMaterialProgress p
        where p.userId = :userId and p.deleted = false
          and exists (select r.id from LearningResource r, LearningResourceVersion v
            where r.id = p.resourceId and r.deleted = false and r.inLibrary = true
              and r.type = pl.co.lms.entity.LearningResourceType.STUDY_MATERIAL
              and r.publishedVersionId = v.id and v.resourceId = r.id and v.deleted = false
              and v.status = pl.co.lms.entity.LearningResourceVersionStatus.PUBLISHED)
        order by p.lastOpenedAt desc, p.id desc
        """)
    List<StudyMaterialProgress> findRecent(@Param("userId") String userId, Pageable pageable);
}
