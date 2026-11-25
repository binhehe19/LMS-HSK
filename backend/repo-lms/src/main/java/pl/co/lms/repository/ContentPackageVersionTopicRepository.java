package pl.co.lms.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pl.co.lms.entity.ContentPackageVersionTopic;

import java.util.List;
import java.util.Optional;

public interface ContentPackageVersionTopicRepository extends JpaRepository<ContentPackageVersionTopic, String> {

    Optional<ContentPackageVersionTopic> findByIdAndDeletedFalse(String id);

    List<ContentPackageVersionTopic> findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscTopicOrderAsc(String contentPackageVersionId);

    List<ContentPackageVersionTopic> findByContentPackageVersionIdAndSessionNoAndDeletedFalseOrderByTopicOrderAsc(String contentPackageVersionId, int sessionNo);
}
