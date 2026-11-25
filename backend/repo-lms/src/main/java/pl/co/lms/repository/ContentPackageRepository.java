package pl.co.lms.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageType;

import java.util.List;
import java.util.Optional;

public interface ContentPackageRepository extends JpaRepository<ContentPackage, String>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<ContentPackage> {

    Optional<ContentPackage> findByIdAndDeletedFalse(String id);

    List<ContentPackage> findByTypeAndDeletedFalseOrderByCreatedAtDesc(ContentPackageType type);

    Page<ContentPackage> findByTypeAndDeletedFalseOrderByCreatedAtDesc(ContentPackageType type, Pageable pageable);

    List<ContentPackage> findByDeletedFalseOrderByCreatedAtDesc();

    Page<ContentPackage> findByDeletedFalseOrderByCreatedAtDesc(Pageable pageable);

    List<ContentPackage> findByIdInAndDeletedFalse(List<String> ids);

    Page<ContentPackage> findByTypeAndSyllabusIdAndDeletedFalseOrderByCreatedAtDesc(ContentPackageType type, String syllabusId, Pageable pageable);

    Page<ContentPackage> findBySyllabusIdAndDeletedFalseOrderByCreatedAtDesc(String syllabusId, Pageable pageable);

    List<ContentPackage> findBySyllabusIdAndDeletedFalse(String syllabusId);

    List<ContentPackage> findBySyllabusIdInAndDeletedFalse(List<String> syllabusIds);

    // So sánh cặp cũ để hai lần chuyển đồng thời không âm thầm ghi đè nhau.
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ContentPackage p set p.syllabusId = :syllabusId, p.syllabusVersionId = :syllabusVersionId, p.updatedAt = :now "
            + "where p.id = :id and p.deleted = false "
            + "and p.syllabusId is not distinct from :previousSyllabusId "
            + "and p.syllabusVersionId is not distinct from :previousVersionId")
    int replaceSyllabus(@Param("id") String id, @Param("syllabusId") String syllabusId,
            @Param("syllabusVersionId") String syllabusVersionId, @Param("previousSyllabusId") String previousSyllabusId,
            @Param("previousVersionId") String previousVersionId, @Param("now") java.time.Instant now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ContentPackage p set p.syllabusVersionId = :versionId, p.updatedAt = :now "
            + "where p.deleted = false and p.syllabusId = :syllabusId and p.syllabusVersionId is distinct from :versionId")
    int acknowledgeSyllabusVersion(@Param("syllabusId") String syllabusId,
            @Param("versionId") String versionId, @Param("now") java.time.Instant now);
}
