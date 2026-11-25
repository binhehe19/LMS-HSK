package pl.co.lms.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures PostgreSQL partial unique indexes are created on startup.
 * Since Hibernate's ddl-auto=update does not support partial indexes (WHERE clause),
 * this runner guarantees the database has full constraints even when starting from a blank database.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseIndexInitializer implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        updateVocabularyLevelCheck();
        createPartialUniqueIndex(
                "uk_content_package_version_resources_active",
                "content_package_version_resources (content_package_version_id, session_no, display_order)");
        createPartialUniqueIndex(
                "uk_content_package_version_sessions_active",
                "content_package_version_sessions (content_package_version_id, session_no)");
        createPartialUniqueIndex(
                "uk_content_package_syllabus_mappings_active",
                "content_package_syllabus_mappings (syllabus_version_id, content_package_version_id)");
        createPartialUniqueIndex(
                "uk_assessment_answers_active",
                "assessment_answers (attempt_id, question_id)");
        // assessment_attempts có thêm điều kiện status='IN_PROGRESS' ngoài deleted=false (chỉ chặn trùng bài ĐANG làm dở:
        // làm lại/nộp lại sau khi đã SUBMITTED vẫn tạo bài mới được), nên không dùng chung helper createPartialUniqueIndex.
        // context_key = session_id (bài trong lớp) hoặc SELF:<mode>[:<variant>] (tự luyện).
        try {
            jdbcTemplate.execute("DROP INDEX IF EXISTS uk_assessment_attempts_active;");
            jdbcTemplate.execute(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uk_assessment_attempts_active_ctx ON assessment_attempts "
                            + "(user_id, learning_resource_id, context_key) "
                            + "WHERE deleted = false AND status = 'IN_PROGRESS';");
            log.info("Database partial unique index initialized: uk_assessment_attempts_active_ctx");
        } catch (Exception e) {
            log.warn("Could not initialize partial unique index uk_assessment_attempts_active_ctx (table may not exist yet): {}", e.getMessage());
        }
        // Bài trong lớp (CLASS_SESSION) bắt buộc có đủ package/version/buổi; tự luyện (SELF_STUDY) thì để trống.
        try {
            jdbcTemplate.execute(
                    "DO $$ BEGIN "
                            + "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_assessment_attempts_context') THEN "
                            + "ALTER TABLE assessment_attempts ADD CONSTRAINT ck_assessment_attempts_context CHECK ("
                            + "context_type = 'SELF_STUDY' OR (session_id IS NOT NULL AND session_no IS NOT NULL "
                            + "AND content_package_id IS NOT NULL AND content_package_version_id IS NOT NULL)); "
                            + "END IF; END $$;");
            log.info("Database check constraint initialized: ck_assessment_attempts_context");
        } catch (Exception e) {
            log.warn("Could not initialize check constraint ck_assessment_attempts_context (table may not exist yet): {}", e.getMessage());
        }        // Job đánh dấu TIME_OUT quét (status, ends_at).
        try {
            jdbcTemplate.execute(
                    "CREATE INDEX IF NOT EXISTS idx_assessment_attempts_status_ends_at ON assessment_attempts (status, ends_at) "
                            + "WHERE ends_at IS NOT NULL;");
            log.info("Database index initialized: idx_assessment_attempts_status_ends_at");
        } catch (Exception e) {
            log.warn("Could not initialize index idx_assessment_attempts_status_ends_at (table may not exist yet): {}", e.getMessage());
        }
        // Job cứu quét bài PENDING và câu AI_PENDING quá hạn.
        createGradingRescueIndex(
                "idx_assessment_attempts_grading_status_updated",
                "assessment_attempts (grading_status, updated_at) WHERE deleted = false AND grading_status IN ('PENDING')");
        createGradingRescueIndex(
                "idx_assessment_answers_grading_status_updated",
                "assessment_answers (grading_status, updated_at) WHERE deleted = false AND grading_status IN ('AI_PENDING')");
        createActiveLanguagePracticeAttemptIndex();
        createPartialUniqueIndex(
                "uk_language_practice_segment_attempts_active",
                "language_practice_segment_attempts (attempt_id, segment_no)");
        createSearchIndexes();
        createGradingRescueIndex("idx_portal_history", "assessment_attempts (user_id, created_at DESC, id DESC) WHERE deleted = false");
        createGradingRescueIndex("idx_portal_leaderboard", "assessment_attempts (submitted_at, user_id, learning_resource_id) WHERE deleted = false AND status = 'SUBMITTED'");
        createGradingRescueIndex("idx_portal_favorites", "learning_resource_states (user_id, updated_at DESC, id DESC) WHERE deleted = false AND saved = true");
        createGradingRescueIndex("idx_lr_study_catalog", "learning_resources (study_category, created_at DESC) WHERE type = 'STUDY_MATERIAL' AND in_library = true AND deleted = false");
        createGradingRescueIndex("idx_lr_study_facets", "learning_resources (study_category, topic, study_band, study_source) WHERE type = 'STUDY_MATERIAL' AND in_library = true AND deleted = false");
    }

    /**
     * Chỉ mục tìm kiếm của learning_resources (cột do ResourceSearchColumns điền). Hibernate không tạo được chỉ mục GIN trigram, chỉ mục có
     * điều kiện hay chỉ mục theo biểu thức nên tạo ở đây. Thiếu quyền tạo pg_trgm thì chỉ ghi cảnh báo: tìm kiếm vẫn chạy, chỉ chậm hơn
     * trên dữ liệu lớn. Trên production có thể tạo trước bằng tay (CONCURRENTLY), xem backend/docs/migrations/resource-search-columns.sql.
     */
    private void createSearchIndexes() {
        boolean trigram = true;
        try {
            jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
        } catch (Exception e) {
            trigram = false;
            log.warn("Could not enable extension pg_trgm (search will work but without trigram indexes): {}", e.getMessage());
        }
        String vocabularyLibrary = "WHERE type = 'VOCABULARY' AND in_library = true AND deleted = false";
        if (trigram) {
            createGradingRescueIndex("idx_lr_search_title_trgm", "learning_resources USING gin (search_title gin_trgm_ops)");
            createGradingRescueIndex("idx_lr_search_text_trgm", "learning_resources USING gin (search_text gin_trgm_ops)");
            createGradingRescueIndex("idx_lr_search_tags_trgm", "learning_resources USING gin (search_tags gin_trgm_ops)");
        }
        // Khớp đầu từ và so sánh bằng trên tiêu đề (text_pattern_ops cho LIKE 'abc%' mọi collation).
        createGradingRescueIndex("idx_lr_search_title_prefix", "learning_resources (search_title text_pattern_ops)");
        createGradingRescueIndex("idx_lr_library_type_created", "learning_resources (type, created_at DESC) WHERE in_library = true AND deleted = false");
        createGradingRescueIndex("idx_lr_word_key", "learning_resources (word_key) " + vocabularyLibrary);
        createGradingRescueIndex("idx_lr_vocab_cefr", "learning_resources (cefr_level) " + vocabularyLibrary);
        createGradingRescueIndex("idx_lr_vocab_topic", "learning_resources (lower(topic)) " + vocabularyLibrary);
        // Danh sách từ điển theo thứ tự chữ cái không từ khoá (ORDER BY search_title, id + phân trang): đi theo chỉ mục thay vì sắp xếp toàn bộ.
        createGradingRescueIndex("idx_lr_dictionary_alpha", "learning_resources (search_title, id) " + vocabularyLibrary + " AND published_version_id IS NOT NULL");
        createGradingRescueIndex("idx_lrt_resource", "learning_resource_tags (resource_id)");
        createGradingRescueIndex("idx_lrt_tag_lower", "learning_resource_tags (lower(tag), resource_id)");
    }

    private void createGradingRescueIndex(String indexName, String definition) {
        try {
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS " + indexName + " ON " + definition + ";");
            log.info("Database index initialized: {}", indexName);
        } catch (Exception e) {
            log.warn("Could not initialize index {} (table may not exist yet): {}", indexName, e.getMessage());
        }
    }

    private void createPartialUniqueIndex(String indexName, String onClause) {
        try {
            jdbcTemplate.execute(
                    "CREATE UNIQUE INDEX IF NOT EXISTS " + indexName + " ON " + onClause + " WHERE deleted = false;");
            log.info("Database partial unique index initialized: {}", indexName);
        } catch (Exception e) {
            log.warn("Could not initialize partial unique index {} (table may not exist yet): {}", indexName, e.getMessage());
        }
    }

    private void createActiveLanguagePracticeAttemptIndex() {
        try {
            jdbcTemplate.execute(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uk_language_practice_attempts_active "
                            + "ON language_practice_attempts (created_by, resource_version_id, mode) "
                            + "WHERE deleted = false AND status = 'IN_PROGRESS';");
            log.info("Database partial unique index initialized: uk_language_practice_attempts_active");
        } catch (Exception e) {
            log.warn("Could not initialize index uk_language_practice_attempts_active (table may not exist yet): {}", e.getMessage());
        }
    }

    // Hibernate update does not widen an existing PostgreSQL enum CHECK after
    // adding NEW. Preserve the original check name and allow the four UI levels.
    private void updateVocabularyLevelCheck() {
        try {
            jdbcTemplate.execute("""
                    DO $$ DECLARE item record; BEGIN
                      FOR item IN
                        SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
                        FROM pg_constraint c JOIN pg_attribute a
                          ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
                        WHERE c.conrelid = to_regclass('learning_resource_states')
                          AND c.contype = 'c' AND a.attname = 'comprehension_level'
                          AND cardinality(c.conkey) = 1
                      LOOP
                        IF item.definition LIKE '%UNKNOWN%' AND item.definition LIKE '%LEARNING%'
                           AND item.definition LIKE '%KNOWN%' AND item.definition NOT LIKE '%NEW%' THEN
                          EXECUTE format('ALTER TABLE learning_resource_states DROP CONSTRAINT %I', item.conname);
                          EXECUTE format('ALTER TABLE learning_resource_states ADD CONSTRAINT %I CHECK (comprehension_level IN (''UNKNOWN'', ''NEW'', ''LEARNING'', ''KNOWN''))', item.conname);
                        END IF;
                      END LOOP;
                    END $$;
                    """);
        } catch (Exception e) {
            log.warn("Could not update vocabulary comprehension check: {}", e.getMessage());
        }
    }
}
