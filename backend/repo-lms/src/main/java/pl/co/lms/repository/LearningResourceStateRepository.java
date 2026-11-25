package pl.co.lms.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.co.lms.entity.LearningResourceState;

import java.util.List;
import java.util.Optional;

public interface LearningResourceStateRepository extends JpaRepository<LearningResourceState, String> {
    interface PortalFavorite {
        String getResourceId();
        String getVersionId();
        String getType();
        Long getSavedAtEpoch();
    }

    @Query(value = """
            SELECT s.learning_resource_id AS resourceId, r.published_version_id AS versionId,
                   r.type AS type, CAST(EXTRACT(EPOCH FROM s.updated_at) * 1000 AS bigint) AS savedAtEpoch
            FROM learning_resource_states s JOIN learning_resources r ON r.id = s.learning_resource_id
            JOIN learning_resource_versions v ON v.id = r.published_version_id AND v.resource_id = r.id
            WHERE s.user_id = :user AND s.deleted = false AND s.saved = true
              AND r.deleted = false AND r.in_library = true AND v.deleted = false AND v.status = 'PUBLISHED'
              AND r.type IN ('VOCABULARY', 'STUDY_MATERIAL') AND (COALESCE(:type, '') = '' OR r.type = :type)
              AND (:keyword = '' OR POSITION(:keyword IN lower(CAST(v.content AS text))) > 0)
            ORDER BY CASE WHEN :sort = 'title' THEN r.search_title END ASC,
                     CASE WHEN :sort = 'oldest' THEN s.updated_at END ASC,
                     CASE WHEN :sort = 'newest' THEN s.updated_at END DESC, s.id DESC
            """, countQuery = """
            SELECT COUNT(*) FROM learning_resource_states s JOIN learning_resources r ON r.id = s.learning_resource_id
            JOIN learning_resource_versions v ON v.id = r.published_version_id AND v.resource_id = r.id
            WHERE s.user_id = :user AND s.deleted = false AND s.saved = true
              AND r.deleted = false AND r.in_library = true AND v.deleted = false AND v.status = 'PUBLISHED'
              AND r.type IN ('VOCABULARY', 'STUDY_MATERIAL') AND (COALESCE(:type, '') = '' OR r.type = :type)
              AND (:keyword = '' OR POSITION(:keyword IN lower(CAST(v.content AS text))) > 0)
            """, nativeQuery = true)
    org.springframework.data.domain.Page<PortalFavorite> findPortalFavorites(@Param("user") String user, @Param("type") String type,
            @Param("keyword") String keyword, @Param("sort") String sort, org.springframework.data.domain.Pageable pageable);

    @Query("""
            SELECT s FROM LearningResourceState s
            WHERE s.userId = :userId AND s.deleted = false
              AND EXISTS (SELECT 1 FROM LearningResource r WHERE r.id = s.learningResourceId
                          AND r.deleted = false AND r.inLibrary = true AND r.publishedVersionId IS NOT NULL
                          AND r.type = pl.co.lms.entity.LearningResourceType.VOCABULARY)
            """)
    List<LearningResourceState> findPublishedLibraryVocabularyStates(@Param("userId") String userId);

    Optional<LearningResourceState> findByIdAndDeletedFalse(String id);

    Optional<LearningResourceState> findByUserIdAndLearningResourceIdAndDeletedFalse(String userId, String learningResourceId);

    List<LearningResourceState> findByUserIdAndLearningResourceIdInAndDeletedFalse(String userId, List<String> learningResourceIds);

    List<LearningResourceState> findByUserIdAndSavedTrueAndDeletedFalse(String userId);

    List<LearningResourceState> findTop500ByUserIdAndReviewAtLessThanEqualAndDeletedFalseOrderByReviewAtAsc(String userId, java.time.Instant now);

    String KNOWN = LearningResourceRepository.KNOWN_STATE;
    String LEARNING = LearningResourceRepository.LEARNING_STATE;
    String STATE_SCOPE = "FROM learning_resource_states s JOIN learning_resources r ON r.id = s.learning_resource_id "
            + "WHERE s.user_id = :userId AND s.deleted = false AND " + LearningResourceRepository.PUBLISHED_VOCAB + LearningResourceRepository.SCOPE;

    /** Số từ đã nhớ / đang học / đã lưu của người dùng trong phạm vi cấp độ/chủ đề (từ chưa có dòng trạng thái là "chưa biết"). */
    @Query(value = "SELECT COUNT(CASE WHEN " + KNOWN + " THEN 1 END), COUNT(CASE WHEN " + LEARNING + " THEN 1 END), "
            + "COUNT(CASE WHEN s.saved = true THEN 1 END) " + STATE_SCOPE, nativeQuery = true)
    List<Object[]> countVocabularyStatesSummary(@Param("userId") String userId, @Param("cefrMode") int cefrMode, @Param("cefr") String cefr,
                                                @Param("topicMode") int topicMode, @Param("topicLower") String topicLower);

    /** Như trên nhưng tách theo chủ đề: [tên chủ đề ("Chưa phân loại" khi trống), đã nhớ, đang học]. */
    @Query(value = "SELECT min(COALESCE(NULLIF(r.topic, ''), 'Chưa phân loại')), COUNT(CASE WHEN " + KNOWN + " THEN 1 END), COUNT(CASE WHEN " + LEARNING + " THEN 1 END) "
            + STATE_SCOPE + " GROUP BY lower(COALESCE(NULLIF(r.topic, ''), 'Chưa phân loại'))", nativeQuery = true)
    List<Object[]> countVocabularyStatesByTopic(@Param("userId") String userId, @Param("cefrMode") int cefrMode, @Param("cefr") String cefr,
                                                @Param("topicMode") int topicMode, @Param("topicLower") String topicLower);

    /** Như trên nhưng tách theo cấp độ CEFR: [cấp độ ("Chưa phân loại" khi trống), đã nhớ, đang học]. */
    @Query(value = "SELECT COALESCE(NULLIF(r.cefr_level, ''), 'Chưa phân loại'), COUNT(CASE WHEN " + KNOWN + " THEN 1 END), COUNT(CASE WHEN " + LEARNING + " THEN 1 END) "
            + STATE_SCOPE + " GROUP BY COALESCE(NULLIF(r.cefr_level, ''), 'Chưa phân loại')", nativeQuery = true)
    List<Object[]> countVocabularyStatesByLevel(@Param("userId") String userId, @Param("cefrMode") int cefrMode, @Param("cefr") String cefr,
                                                @Param("topicMode") int topicMode, @Param("topicLower") String topicLower);

    /** Trạng thái "đang học" (NEW/LEARNING) của người dùng trong phạm vi, mới cập nhật trước: nguồn hàng đợi ôn tập. */
    @Query(value = "SELECT s.* " + STATE_SCOPE + " AND " + LEARNING + " ORDER BY s.updated_at DESC LIMIT :limit", nativeQuery = true)
    List<LearningResourceState> findLearningVocabularyStates(@Param("userId") String userId, @Param("cefrMode") int cefrMode, @Param("cefr") String cefr,
                                                             @Param("topicMode") int topicMode, @Param("topicLower") String topicLower,
                                                             @Param("limit") int limit);
}
