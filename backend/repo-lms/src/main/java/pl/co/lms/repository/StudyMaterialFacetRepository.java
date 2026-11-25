package pl.co.lms.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import pl.co.lms.entity.LearningResource;
import java.util.List;

public interface StudyMaterialFacetRepository extends Repository<LearningResource, String> {
    @Query("""
        select distinct r.topic, r.studyBand, r.studySource, r.studySkill
        from LearningResource r, LearningResourceVersion v
        where r.type = pl.co.lms.entity.LearningResourceType.STUDY_MATERIAL
          and r.deleted = false and r.inLibrary = true
          and r.publishedVersionId = v.id and v.resourceId = r.id and v.deleted = false
          and v.status = pl.co.lms.entity.LearningResourceVersionStatus.PUBLISHED
          and (cast(:category as string) is null or r.studyCategory = cast(:category as string))
        """)
    List<Object[]> facets(@Param("category") String category);
}
