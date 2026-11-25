package pl.co.lms.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface LearningResourceRepository extends JpaRepository<LearningResource, String>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<LearningResource> {
    /**
     * Published dictionary words in the order of the /dictionary list (search_title, id: index idx_lr_dictionary_alpha), as plain columns:
     * the lesson roadmap needs no entity, tag or JSON for them.
     */
    @Query("""
            select new pl.co.lms.repository.DictionaryRoadmapWord(r.id, r.publishedVersionId, r.topic, r.cefrLevel, r.searchTitle, r.wordKey)
            from LearningResource r join LearningResourceVersion v on v.id = r.publishedVersionId
            where r.type = pl.co.lms.entity.LearningResourceType.VOCABULARY
              and r.inLibrary = true and r.deleted = false and v.deleted = false
              and r.subType = 'EN'
              and v.resourceId = r.id and v.status = pl.co.lms.entity.LearningResourceVersionStatus.PUBLISHED
            order by r.searchTitle asc, r.id asc
            """)
    List<DictionaryRoadmapWord> findDictionaryRoadmapWords();

    List<LearningResource> findByIdInAndDeletedFalse(java.util.Collection<String> ids);

    List<LearningResource> findByTypeAndSubTypeAndDeletedFalseAndIdGreaterThanOrderByIdAsc(
            LearningResourceType type, String subType, String afterId, Pageable pageable);

    List<LearningResource> findBySubTypeInAndDeletedFalseOrderByCreatedAtAsc(java.util.Collection<String> subTypes);
    Optional<LearningResource> findByIdAndSubTypeInAndDeletedFalse(String id, java.util.Collection<String> subTypes);
    /** Khóa dòng để xuất bản/lưu trữ/bắt đầu lượt Test đầu vào tuần tự trên cùng một đề. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from LearningResource r where r.id = :id and r.deleted = false and r.subType in :subTypes")
    Optional<LearningResource> lockByIdAndSubTypeIn(@Param("id") String id, @Param("subTypes") java.util.Collection<String> subTypes);
    /** Từ vựng của Kho có khoá từ (word_key, có chỉ mục) nằm trong danh sách: nền để dò từ trong văn bản mà không đọc cả Kho. */
    @Query("""
            select r from LearningResource r
            where r.wordKey in :keys and r.type = pl.co.lms.entity.LearningResourceType.VOCABULARY
              and r.inLibrary = true and r.deleted = false and r.publishedVersionId is not null
            """)
    List<LearningResource> findLibraryVocabularyByWordKeys(@Param("keys") java.util.Collection<String> keys);

    List<LearningResource> findByTypeAndStudyCategoryAndDeletedFalseOrderByCreatedAtDesc(LearningResourceType type, String studyCategory);

    @Query("""
            SELECT r.id FROM LearningResource r
            WHERE r.id IN :ids AND r.deleted = false AND r.inLibrary = true
              AND r.type = pl.co.lms.entity.LearningResourceType.VOCABULARY
              AND r.publishedVersionId IS NOT NULL
            """)
    Set<String> findExistingPublishedVocabularyIds(@Param("ids") java.util.Collection<String> ids);

    @Query("""
            SELECT r FROM LearningResource r
            WHERE r.id IN :ids AND r.deleted = false AND r.inLibrary = true
              AND r.type = pl.co.lms.entity.LearningResourceType.VOCABULARY
              AND r.publishedVersionId IS NOT NULL
            ORDER BY r.searchTitle ASC, r.id ASC
            """)
    List<LearningResource> findPublishedVocabularyByIds(@Param("ids") java.util.Collection<String> ids);

    /** Trạng thái học (bảng learning_resource_states, alias s): đã nhớ / đang học. Từ chưa có dòng trạng thái là "chưa biết". */
    String KNOWN_STATE = "(s.comprehension_level = 'KNOWN' OR (s.comprehension_level IS NULL AND s.status = 'LEARNED'))";
    String LEARNING_STATE = "(s.comprehension_level IN ('NEW', 'LEARNING') OR (s.comprehension_level IS NULL AND s.status = 'LEARNING'))";
    String STATE_OF_USER = "SELECT 1 FROM learning_resource_states s WHERE s.learning_resource_id = r.id AND s.user_id = :userId AND s.deleted = false AND ";
    /** statusMode: 0 = không lọc, 1 = đã nhớ, 2 = đang học, 3 = chưa biết (không đã nhớ cũng không đang học). */
    String STATUS = " AND (:statusMode = 0"
            + " OR (:statusMode = 1 AND EXISTS (" + STATE_OF_USER + KNOWN_STATE + "))"
            + " OR (:statusMode = 2 AND EXISTS (" + STATE_OF_USER + LEARNING_STATE + "))"
            + " OR (:statusMode = 3 AND NOT EXISTS (" + STATE_OF_USER + "(" + KNOWN_STATE + " OR " + LEARNING_STATE + "))))";

    /** Điều kiện chung của từ vựng đã xuất bản trong Kho (alias bảng là r). */
    String PUBLISHED_VOCAB = "r.deleted = false AND r.in_library = true AND r.type = 'VOCABULARY' AND r.sub_type = 'EN' AND r.published_version_id IS NOT NULL";
    /**
     * Phạm vi cấp độ/chủ đề. cefrMode/topicMode: 0 = không lọc, 1 = chưa phân loại (trống), 2 = bằng giá trị
     * (cefr chữ hoa; topic so sánh chữ thường). Cùng quy ước với searchDictionary.
     */
    String SCOPE = " AND (:cefrMode = 0 OR (:cefrMode = 1 AND (r.cefr_level IS NULL OR r.cefr_level = '')) OR (:cefrMode = 2 AND r.cefr_level = CAST(:cefr AS varchar)))"
            + " AND (:topicMode = 0 OR (:topicMode = 1 AND (r.topic IS NULL OR r.topic = '')) OR (:topicMode = 2 AND lower(r.topic) = CAST(:topicLower AS varchar)))";

    // Nhóm rỗng gom vào "Chưa phân loại" (cùng chuỗi mà bộ lọc /dictionary hiểu); chủ đề gom không phân biệt hoa thường, hiển thị theo cách viết nhỏ nhất theo thứ tự chữ.
    @Query(value = "SELECT COALESCE(NULLIF(r.cefr_level, ''), 'Chưa phân loại') AS k, count(*) AS c FROM learning_resources r WHERE "
            + PUBLISHED_VOCAB + SCOPE + " GROUP BY COALESCE(NULLIF(r.cefr_level, ''), 'Chưa phân loại')", nativeQuery = true)
    List<Object[]> countPublishedVocabularyByLevel(@Param("cefrMode") int cefrMode, @Param("cefr") String cefr,
                                                   @Param("topicMode") int topicMode, @Param("topicLower") String topicLower);

    @Query(value = "SELECT min(COALESCE(NULLIF(r.topic, ''), 'Chưa phân loại')) AS k, count(*) AS c FROM learning_resources r WHERE "
            + PUBLISHED_VOCAB + SCOPE + " GROUP BY lower(COALESCE(NULLIF(r.topic, ''), 'Chưa phân loại'))", nativeQuery = true)
    List<Object[]> countPublishedVocabularyByTopic(@Param("cefrMode") int cefrMode, @Param("cefr") String cefr,
                                                   @Param("topicMode") int topicMode, @Param("topicLower") String topicLower);

    /** Các chủ đề trong phạm vi theo thứ tự tên: [tên chủ đề ('' = chưa có), số từ]. Nền để chia bài học (mỗi chủ đề chia riêng, 5 từ một bài). */
    @Query(value = "SELECT min(COALESCE(r.topic, '')) AS k, count(*) AS c FROM learning_resources r WHERE "
            + PUBLISHED_VOCAB + SCOPE + " GROUP BY lower(COALESCE(r.topic, '')) ORDER BY lower(COALESCE(r.topic, ''))", nativeQuery = true)
    List<Object[]> countScopeByTopic(@Param("cefrMode") int cefrMode, @Param("cefr") String cefr,
                                     @Param("topicMode") int topicMode, @Param("topicLower") String topicLower);

    /** Từ trong phạm vi theo thứ tự chữ cái (cùng thứ tự với danh sách /dictionary không từ khoá), lấy một đoạn offset/limit. */
    @Query(value = "SELECT r.* FROM learning_resources r WHERE " + PUBLISHED_VOCAB + SCOPE
            + " ORDER BY r.search_title, r.id LIMIT :limit OFFSET :offset", nativeQuery = true)
    List<LearningResource> findScopeWords(@Param("cefrMode") int cefrMode, @Param("cefr") String cefr,
                                          @Param("topicMode") int topicMode, @Param("topicLower") String topicLower,
                                          @Param("offset") int offset, @Param("limit") int limit);

    /** Số từ trong phạm vi đứng trước một từ (theo search_title, id): vị trí của từ trong danh sách chữ cái. */
    @Query(value = "SELECT count(*) FROM learning_resources r WHERE " + PUBLISHED_VOCAB + SCOPE
            + " AND (r.search_title < :title OR (r.search_title = :title AND r.id < :id))", nativeQuery = true)
    long countScopeWordsBefore(@Param("cefrMode") int cefrMode, @Param("cefr") String cefr,
                               @Param("topicMode") int topicMode, @Param("topicLower") String topicLower,
                               @Param("title") String title, @Param("id") String id);

    @Query(value = """
            SELECT min(r.id), max(r.id) FROM learning_resources r
            WHERE r.deleted = false AND r.in_library = true AND r.type = 'VOCABULARY' AND r.sub_type = 'EN' AND r.published_version_id IS NOT NULL
            """, nativeQuery = true)
    List<Object[]> findPublishedVocabularyIdRange();

    // Từ nhiễu: lấy một đoạn id liên tiếp bắt đầu từ mốc ngẫu nhiên (đi theo khoá chính, không quét/sắp xếp cả bảng). Hai truy vấn riêng cho
    // "có chủ đề" / "mọi chủ đề" để không phải truyền tham số null (Postgres không suy được kiểu của `? IS NULL`).
    @Query(value = """
            SELECT r.* FROM learning_resources r
            WHERE r.deleted = false AND r.in_library = true AND r.type = 'VOCABULARY' AND r.sub_type = 'EN' AND r.published_version_id IS NOT NULL
              AND r.id <> :excludeWordId AND r.id >= :pivot
            ORDER BY r.id
            LIMIT :limit
            """, nativeQuery = true)
    List<LearningResource> findDistractorCandidates(@Param("excludeWordId") String excludeWordId, @Param("pivot") String pivot, @Param("limit") int limit);

    @Query(value = """
            SELECT r.* FROM learning_resources r
            WHERE r.deleted = false AND r.in_library = true AND r.type = 'VOCABULARY' AND r.sub_type = 'EN' AND r.published_version_id IS NOT NULL
              AND r.id <> :excludeWordId AND r.id >= :pivot AND lower(r.topic) = lower(:topic)
            ORDER BY r.id
            LIMIT :limit
            """, nativeQuery = true)
    List<LearningResource> findDistractorCandidatesByTopic(@Param("excludeWordId") String excludeWordId, @Param("topic") String topic,
                                                           @Param("pivot") String pivot, @Param("limit") int limit);

    /** Số tài nguyên đã xuất bản của Kho theo type và loại phụ (vd từ vựng EN). */
    long countByTypeAndSubTypeAndInLibraryTrueAndPublishedVersionIdIsNotNullAndDeletedFalse(LearningResourceType type, String subType);

    Optional<LearningResource> findByIdAndDeletedFalse(String id);

    List<LearningResource> findBySourceResourceIdAndDeletedFalse(String sourceResourceId);

    // Khoá dòng bài khi bắt đầu tự luyện: hai yêu cầu bắt đầu đồng thời (VD trình duyệt gọi hai lần) được xếp hàng, yêu cầu sau thấy lượt đang làm dở của yêu cầu trước.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from LearningResource r where r.id = :id and r.deleted = false")
    Optional<LearningResource> findByIdForStart(@Param("id") String id);

    List<LearningResource> findByTypeAndDeletedFalseOrderByCreatedAtDesc(LearningResourceType type);

    // Bài của Kho đã publish theo loại phụ (danh mục luyện tập).
    List<LearningResource> findByTypeAndInLibraryTrueAndSubTypeAndPublishedVersionIdIsNotNullAndDeletedFalseOrderByIdAsc(
            LearningResourceType type, String subType);

    Page<LearningResource> findByTypeAndDeletedFalseOrderByCreatedAtDesc(LearningResourceType type, Pageable pageable);

    /**
     * Trong các từ cần tìm (khoá chuẩn hoá: chữ thường, gộp khoảng trắng, giữ dấu; xem ResourceSearchColumns.wordKey) những từ đang có
     * trong Kho từ vựng, kèm id tài nguyên. Mỗi dòng: [khoá, id]; một từ có nhiều tài nguyên thì lấy id nhỏ nhất (tạo sớm nhất).
     * Dùng cột word_key (có chỉ mục) nên chạy được cả trên H2.
     */
    @Query(value = """
            SELECT r.word_key, min(r.id) FROM learning_resources r
            WHERE r.type = 'VOCABULARY' AND r.in_library = true AND r.deleted = false AND r.word_key IN (:words)
            GROUP BY r.word_key
            """, nativeQuery = true)
    List<Object[]> findLibraryResourceIdsByWord(@Param("words") java.util.Collection<String> words);

    /**
     * Từ điển: từ vựng đã xuất bản của Kho, tìm theo từ/nghĩa/collocation/tag (cột chuẩn hoá bỏ dấu), lọc cấp độ/chủ đề, phân trang ở DB.
     * pattern/prefix đã chuẩn hoá và escape (% _ \) ở service; titleOnly = từ khoá quá ngắn để dùng trigram nên chỉ khớp đầu từ.
     * cefrMode/topicMode: 0 = không lọc, 1 = chưa phân loại (trống), 2 = bằng giá trị (cefr chữ hoa; topic không phân biệt hoa thường).
     * Xếp hạng: khớp đúng tiêu đề > đầu tiêu đề > chứa trong tiêu đề > khớp ở nghĩa/tag; sau đó theo thứ tự chữ cái.
     */
    String KEYWORD_FILTER = " AND (:hasKeyword = false"
            + " OR (:titleOnly = true AND r.search_title LIKE :prefix ESCAPE '\\')"
            + " OR (:titleOnly = false AND (r.search_title LIKE :pattern ESCAPE '\\' OR r.search_text LIKE :pattern ESCAPE '\\' OR r.search_tags LIKE :pattern ESCAPE '\\')))";

    @Query(value = "SELECT r.* FROM learning_resources r WHERE " + PUBLISHED_VOCAB + SCOPE + STATUS + KEYWORD_FILTER
            + " ORDER BY CASE WHEN :hasKeyword = false THEN 0 WHEN r.search_title = :keyword THEN 0 WHEN r.search_title LIKE :prefix ESCAPE '\\' THEN 1"
            + " WHEN r.search_title LIKE :pattern ESCAPE '\\' THEN 2 ELSE 3 END, r.search_title, r.id",
            countQuery = "SELECT count(*) FROM learning_resources r WHERE " + PUBLISHED_VOCAB + SCOPE + STATUS + KEYWORD_FILTER,
            nativeQuery = true)
    Page<LearningResource> searchDictionary(@Param("cefrMode") int cefrMode, @Param("cefr") String cefr,
                                            @Param("topicMode") int topicMode, @Param("topicLower") String topicLower,
                                            @Param("statusMode") int statusMode, @Param("userId") String userId,
                                            @Param("hasKeyword") boolean hasKeyword, @Param("titleOnly") boolean titleOnly,
                                            @Param("keyword") String keyword, @Param("prefix") String prefix, @Param("pattern") String pattern,
                                            Pageable pageable);

    /**
     * Kho quản trị: tìm theo cột chuẩn hoá (tiêu đề, nội dung, tag) và lọc, không đọc JSON nên chạy được trên H2.
     * Cùng quy ước pattern/prefix/titleOnly và xếp hạng như searchDictionary, đồng hạng thì mới nhất trước.
     */
    @Query(value = """
            SELECT r.* FROM learning_resources r
            WHERE r.deleted = false
              AND (:libraryOnly = false OR r.in_library = true)
              AND (:publishedOnly = false OR r.published_version_id IS NOT NULL)
              AND (CAST(:type AS varchar) IS NULL OR r.type = CAST(:type AS varchar))
              AND (CAST(:subType AS varchar) IS NULL OR r.sub_type = CAST(:subType AS varchar))
              AND (CAST(:cefrLevel AS varchar) IS NULL OR r.cefr_level = CAST(:cefrLevel AS varchar))
              AND (CAST(:tag AS varchar) IS NULL OR EXISTS (SELECT 1 FROM learning_resource_tags t WHERE t.resource_id = r.id AND t.tag = CAST(:tag AS varchar)))
              AND (:hasKeyword = false
                   OR (:titleOnly = true AND r.search_title LIKE :prefix ESCAPE '\\')
                   OR (:titleOnly = false AND (r.search_title LIKE :pattern ESCAPE '\\' OR r.search_text LIKE :pattern ESCAPE '\\' OR r.search_tags LIKE :pattern ESCAPE '\\')))
            ORDER BY CASE WHEN :hasKeyword = false THEN 0 WHEN r.search_title = :keyword THEN 0 WHEN r.search_title LIKE :prefix ESCAPE '\\' THEN 1
                          WHEN r.search_title LIKE :pattern ESCAPE '\\' THEN 2 ELSE 3 END,
                     r.created_at DESC
            """,
            countQuery = """
            SELECT count(*) FROM learning_resources r
            WHERE r.deleted = false
              AND (:libraryOnly = false OR r.in_library = true)
              AND (:publishedOnly = false OR r.published_version_id IS NOT NULL)
              AND (CAST(:type AS varchar) IS NULL OR r.type = CAST(:type AS varchar))
              AND (CAST(:subType AS varchar) IS NULL OR r.sub_type = CAST(:subType AS varchar))
              AND (CAST(:cefrLevel AS varchar) IS NULL OR r.cefr_level = CAST(:cefrLevel AS varchar))
              AND (CAST(:tag AS varchar) IS NULL OR EXISTS (SELECT 1 FROM learning_resource_tags t WHERE t.resource_id = r.id AND t.tag = CAST(:tag AS varchar)))
              AND (:hasKeyword = false
                   OR (:titleOnly = true AND r.search_title LIKE :prefix ESCAPE '\\')
                   OR (:titleOnly = false AND (r.search_title LIKE :pattern ESCAPE '\\' OR r.search_text LIKE :pattern ESCAPE '\\' OR r.search_tags LIKE :pattern ESCAPE '\\')))
            """,
            nativeQuery = true)
    Page<LearningResource> searchByColumns(@Param("libraryOnly") boolean libraryOnly,
                                           @Param("publishedOnly") boolean publishedOnly,
                                           @Param("type") String type,
                                           @Param("subType") String subType,
                                           @Param("cefrLevel") String cefrLevel,
                                           @Param("tag") String tag,
                                           @Param("hasKeyword") boolean hasKeyword, @Param("titleOnly") boolean titleOnly,
                                           @Param("keyword") String keyword, @Param("prefix") String prefix, @Param("pattern") String pattern,
                                           Pageable pageable);



    /** Id các resource đang gắn một tag (không phân biệt hoa thường). */
    @Query(value = "SELECT DISTINCT resource_id FROM learning_resource_tags WHERE lower(tag) = lower(:tag)", nativeQuery = true)
    List<String> findResourceIdsByTag(@Param("tag") String tag);

    // ── Tag dùng chung cho mọi loại resource ──────────────────────────────────

    /** Các tag đang dùng kèm số resource, theo loại (null = mọi loại); tag dùng nhiều nhất trước. Mỗi dòng: [tag, count]. */
    @Query(value = """
            SELECT t.tag AS tag, count(*) AS cnt FROM learning_resource_tags t
            JOIN learning_resources r ON r.id = t.resource_id
            WHERE r.deleted = false
              AND (:libraryOnly = false OR r.in_library = true)
              AND (CAST(:type AS varchar) IS NULL OR r.type = CAST(:type AS varchar))
            GROUP BY t.tag ORDER BY cnt DESC, lower(t.tag)
            """, nativeQuery = true)
    List<Object[]> countTags(@Param("type") String type, @Param("libraryOnly") boolean libraryOnly);

    /** Cách viết đang được dùng nhiều nhất của một tag (không phân biệt hoa thường); rỗng nếu chưa có. */
    @Query(value = "SELECT tag FROM learning_resource_tags WHERE lower(tag) = lower(:tag) GROUP BY tag ORDER BY count(*) DESC, tag LIMIT 1", nativeQuery = true)
    Optional<String> findCanonicalTag(@Param("tag") String tag);

    // Đổi tên/gộp tag: bỏ các dòng sẽ trùng khoá (resource, tag) rồi mới đổi tên.
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            DELETE FROM learning_resource_tags t WHERE lower(t.tag) = lower(:from)
              AND (EXISTS (SELECT 1 FROM learning_resource_tags x WHERE x.resource_id = t.resource_id AND x.tag = :to AND x.tag <> t.tag)
                OR EXISTS (SELECT 1 FROM learning_resource_tags y WHERE y.resource_id = t.resource_id AND lower(y.tag) = lower(:from) AND y.tag < t.tag))
            """, nativeQuery = true)
    int deleteTagCollisions(@Param("from") String from, @Param("to") String to);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE learning_resource_tags SET tag = :to WHERE lower(tag) = lower(:from) AND tag <> :to", nativeQuery = true)
    int renameTag(@Param("from") String from, @Param("to") String to);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "DELETE FROM learning_resource_tags WHERE lower(tag) = lower(:tag)", nativeQuery = true)
    int deleteTag(@Param("tag") String tag);

    List<LearningResource> findByDeletedFalseOrderByCreatedAtDesc();

    Page<LearningResource> findByDeletedFalseOrderByCreatedAtDesc(Pageable pageable);

    Page<LearningResource> findByTypeAndInLibraryTrueAndDeletedFalseOrderByCreatedAtDesc(
            LearningResourceType type, Pageable pageable);

    Page<LearningResource> findByInLibraryTrueAndDeletedFalseOrderByCreatedAtDesc(Pageable pageable);

    // Tìm/lọc theo nội dung version đang hoạt động (published, không có thì draft).
    // pattern đã được escape % _ \ và bọc %...% ở service; type/questionType/cefrLevel null = không lọc.
    @Query(value = """
            SELECT r.* FROM learning_resources r
            LEFT JOIN learning_resource_versions v
              ON v.id = COALESCE(r.published_version_id, r.draft_version_id) AND v.deleted = false
            WHERE r.deleted = false
              AND (:libraryOnly = false OR r.in_library = true)
              AND (:publishedOnly = false OR r.published_version_id IS NOT NULL)
              AND (CAST(:type AS varchar) IS NULL OR r.type = CAST(:type AS varchar))
              AND (CAST(:subType AS varchar) IS NULL OR r.sub_type = CAST(:subType AS varchar))
              AND (CAST(:tag AS varchar) IS NULL OR EXISTS (SELECT 1 FROM learning_resource_tags t WHERE t.resource_id = r.id AND t.tag = CAST(:tag AS varchar)))
              AND (CAST(:questionType AS varchar) IS NULL OR v.content->>'questionType' = CAST(:questionType AS varchar))
              AND (CAST(:cefrLevel AS varchar) IS NULL OR r.cefr_level = CAST(:cefrLevel AS varchar))
              AND (CAST(:fileNameRegex AS varchar) IS NULL OR (coalesce(v.content->>'fileName', '') ~* CAST(:fileNameRegex AS varchar)) = :fileMatch)
              AND (:hasKeyword = false OR r.search_title LIKE :pattern ESCAPE '\\' OR r.search_text LIKE :pattern ESCAPE '\\' OR r.search_tags LIKE :pattern ESCAPE '\\')
            ORDER BY r.created_at DESC
            """,
            countQuery = """
            SELECT count(*) FROM learning_resources r
            LEFT JOIN learning_resource_versions v
              ON v.id = COALESCE(r.published_version_id, r.draft_version_id) AND v.deleted = false
            WHERE r.deleted = false
              AND (:libraryOnly = false OR r.in_library = true)
              AND (:publishedOnly = false OR r.published_version_id IS NOT NULL)
              AND (CAST(:type AS varchar) IS NULL OR r.type = CAST(:type AS varchar))
              AND (CAST(:subType AS varchar) IS NULL OR r.sub_type = CAST(:subType AS varchar))
              AND (CAST(:tag AS varchar) IS NULL OR EXISTS (SELECT 1 FROM learning_resource_tags t WHERE t.resource_id = r.id AND t.tag = CAST(:tag AS varchar)))
              AND (CAST(:questionType AS varchar) IS NULL OR v.content->>'questionType' = CAST(:questionType AS varchar))
              AND (CAST(:cefrLevel AS varchar) IS NULL OR r.cefr_level = CAST(:cefrLevel AS varchar))
              AND (CAST(:fileNameRegex AS varchar) IS NULL OR (coalesce(v.content->>'fileName', '') ~* CAST(:fileNameRegex AS varchar)) = :fileMatch)
              AND (:hasKeyword = false OR r.search_title LIKE :pattern ESCAPE '\\' OR r.search_text LIKE :pattern ESCAPE '\\' OR r.search_tags LIKE :pattern ESCAPE '\\')
            """,
            nativeQuery = true)
    Page<LearningResource> searchByKeyword(@Param("libraryOnly") boolean libraryOnly,
                                           @Param("publishedOnly") boolean publishedOnly,
                                           @Param("type") String type,
                                           @Param("questionType") String questionType,
                                           @Param("cefrLevel") String cefrLevel,
                                           @Param("fileNameRegex") String fileNameRegex,
                                           @Param("fileMatch") boolean fileMatch,
                                           @Param("pattern") String pattern,
                                           @Param("hasKeyword") boolean hasKeyword,
                                           @Param("subType") String subType,
                                           @Param("tag") String tag,
                                           Pageable pageable);

    // ---- Từ vựng tiếng Trung trong Kho, lọc trên chỉ mục từ vựng. ----

    String HANZI_DICTIONARY_FILTER = """
            from LearningResource r
            where r.type = pl.co.lms.entity.LearningResourceType.VOCABULARY and r.subType = 'ZH' and r.inLibrary = true and r.deleted = false
              and (r.publishedVersionId is not null or (:publishedOnly = false and r.draftVersionId is not null))
              and (:level = '' or r.vocabularyFacets like :level escape '\\')
              and (:single = '' or r.vocabularyFacets like :single escape '\\')
              and (:radical = '' or r.vocabularyFacets like :radical escape '\\')
              and (:wordType = '' or r.vocabularyFacets like :wordType escape '\\')
              and (:pattern = '' or r.searchTitle like :pattern escape '\\' or (:pinyinSearch = true and r.searchText like :pattern escape '\\')
                   or (:keywordRadical <> '' and r.vocabularyFacets like :keywordRadical escape '\\'))
            """;

    /**
     * Ưu tiên Hán tự khớp chính xác, sau đó theo id (từ nhập từ LMS 1.0 có id mang thứ tự cũ; từ tạo mới là ULID theo thời điểm tạo).
     * {@code publishedOnly}: học viên chỉ thấy từ đã xuất bản; Admin thấy cả bản nháp. {@code pattern}/{@code wordType}: mẫu LIKE đã thoát ký tự,
     * "" = không lọc.
     */
    @Query(value = "select r " + HANZI_DICTIONARY_FILTER
            + " order by case when :keyword <> '' and r.searchTitle = :keyword then 0 else 1 end, r.id",
            countQuery = "select count(r) " + HANZI_DICTIONARY_FILTER)
    Page<LearningResource> searchHanziDictionary(@Param("publishedOnly") boolean publishedOnly,
                                                 @Param("level") String level,
                                                 @Param("single") String single,
                                                 @Param("radical") String radical,
                                                 @Param("wordType") String wordType,
                                                 @Param("pattern") String pattern,
                                                 @Param("keyword") String keyword,
                                                 @Param("pinyinSearch") boolean pinyinSearch,
                                                 @Param("keywordRadical") String keywordRadical,
                                                 Pageable pageable);

    /** Số từ ĐÃ XUẤT BẢN theo cấp HSK: [cấp, số từ], chỉ cấp có từ. */
    /** Từ ĐÃ XUẤT BẢN có khoá từ trong danh sách (tra chữ thành phần của từ ghép qua word_key). */
    @Query("""
            select r from LearningResource r
            where r.wordKey in :keys and r.type = pl.co.lms.entity.LearningResourceType.VOCABULARY and r.subType = 'ZH'
              and r.inLibrary = true and r.deleted = false and r.publishedVersionId is not null
            order by r.id
            """)
    List<LearningResource> findPublishedHanziDictionaryByWordKeys(@Param("keys") java.util.Collection<String> keys);

}
