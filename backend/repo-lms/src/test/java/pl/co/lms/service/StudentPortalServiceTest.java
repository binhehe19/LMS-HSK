package pl.co.lms.service;

import base.co.common.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.*;
import org.springframework.orm.jpa.persistenceunit.PersistenceManagedTypes;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.support.TransactionTemplate;
import pl.co.lms.dto.request.UpdateStudentProfileRequest;
import pl.co.lms.entity.*;
import pl.co.lms.repository.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/** Isolated DB contract for ownership, publication filtering, ranking boundaries and profile persistence. */
class StudentPortalServiceTest {
    static EntityManagerFactory emf;
    static TransactionTemplate tx;
    static StudentPortalService portal;
    static LearningResourceRepository resources;
    static LearningResourceVersionRepository versions;
    static LearningResourceStateRepository states;
    static AssessmentAttemptRepository attempts;
    static StudentProfileRepository profiles;
    static ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    @BeforeAll static void setup() {
        var source = new DriverManagerDataSource(System.getProperty("portal.test.jdbc", "jdbc:h2:mem:portal;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"), "portal_test", "");
        var bean = new LocalContainerEntityManagerFactoryBean(); bean.setDataSource(source);
        bean.setManagedTypes(PersistenceManagedTypes.of(LearningResource.class.getName(), LearningResourceVersion.class.getName(),
                LearningResourceState.class.getName(), AssessmentAttempt.class.getName(), StudentProfile.class.getName()));
        bean.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        bean.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop", "hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
        bean.afterPropertiesSet(); emf = bean.getObject(); tx = new TransactionTemplate(new JpaTransactionManager(emf));
        var factory = new JpaRepositoryFactory(SharedEntityManagerCreator.createSharedEntityManager(emf));
        resources = factory.getRepository(LearningResourceRepository.class); versions = factory.getRepository(LearningResourceVersionRepository.class);
        states = factory.getRepository(LearningResourceStateRepository.class); attempts = factory.getRepository(AssessmentAttemptRepository.class);
        profiles = factory.getRepository(StudentProfileRepository.class);
        portal = new StudentPortalService(profiles, states, versions, attempts, mapper, new JdbcTemplate(source));
    }
    @AfterAll static void close() { if (emf != null) emf.close(); }
    @BeforeEach void clear() {
        tx.executeWithoutResult(status -> { states.deleteAll(); attempts.deleteAll(); profiles.deleteAll(); resources.deleteAll(); versions.deleteAll(); });
    }
    @Test void favoritesAreOwnerScopedPublishedOnlyAndPaginated() {
        tx.executeWithoutResult(status -> {
            var word = resource(LearningResourceType.VOCABULARY, "{\"word\":\"sustainable\",\"commonMeaning\":\"bền vững\"}");
            var material = resource(LearningResourceType.STUDY_MATERIAL, "{\"title\":\"City life\",\"category\":\"song-ngu\"}");
            saveState("alice", word, true); saveState("alice", material, true); saveState("bob", word, true);
            var draft = resource(LearningResourceType.VOCABULARY, "{\"word\":\"secret\"}"); draft.setPublishedVersionId(null); resources.save(draft); saveState("alice", draft, true);
            var copy = resource(LearningResourceType.VOCABULARY, "{\"word\":\"private copy\"}"); copy.setInLibrary(false); resources.save(copy); saveState("alice", copy, true);
            var deletedVersion = resource(LearningResourceType.VOCABULARY, "{\"word\":\"removed\"}");
            var version = versions.findById(deletedVersion.getPublishedVersionId()).orElseThrow(); version.setDeleted(true); versions.save(version); saveState("alice", deletedVersion, true);
            var first = portal.favorites("alice", null, "", 0, 1);
            assertThat(first.totalElements()).isEqualTo(2); assertThat(first.totalPages()).isEqualTo(2); assertThat(first.items()).hasSize(1);
            assertThat(portal.favorites("bob", null, "", 0, 12).items()).singleElement().satisfies(item -> assertThat(item.title()).isEqualTo("sustainable"));
            assertThat(portal.favorites("alice", "STUDY_MATERIAL", "city", 0, 12).items()).singleElement()
                    .satisfies(item -> assertThat(item.href()).isEqualTo("/studymaterials/song-ngu/" + material.getId()));
            portal.removeFavorite("bob", material.getId()); assertThat(portal.favorites("alice", null, "", 0, 12).totalElements()).isEqualTo(2);
            portal.removeFavorite("alice", word.getId()); assertThat(portal.favorites("alice", null, "", 0, 12).totalElements()).isEqualTo(1);
            assertThat(portal.favorites("bob", null, "", 0, 12).totalElements()).isEqualTo(1);
        });
    }
    @Test void historyKeepsOriginalTitleHidesUngradedScoresAndResumesCorrectMode() {
        tx.executeWithoutResult(status -> {
            var resource = resource(LearningResourceType.ASSESSMENT, "{\"title\":\"Đề đọc\"}");
            resource.setSearchTitle("de doc"); resources.save(resource);
            var finished = attempt("alice", resource, Instant.now()); finished.setGradingStatus(AssessmentGradingStatus.GRADED); attempts.save(finished);
            var active = attempt("alice", resource, null); active.setMode("hard"); attempts.save(active);
            attempt("bob", resource, Instant.now());
            var expired = attempt("alice", resource, null); expired.setEndsAt(Instant.now().minusSeconds(500)); attempts.save(expired);
            var history = portal.history("alice", "READING", null, "Đề đọc", 0, 12);
            assertThat(history.totalElements()).isEqualTo(3);
            assertThat(history.items()).filteredOn(row -> row.id().equals(active.getId())).singleElement().satisfies(row -> {
                assertThat(row.href()).contains("/test?attemptId=", "&time=hard"); assertThat(row.earnedPoints()).isNull();
            });
            assertThat(history.items()).filteredOn(row -> row.id().equals(finished.getId())).singleElement().satisfies(row -> {
                assertThat(row.href()).contains("/result?attemptId=" + finished.getId()); assertThat(row.earnedPoints()).isEqualByComparingTo("8");
            });
            assertThat(portal.history("alice", null, "TIME_OUT", null, 0, 12).items()).singleElement().satisfies(row -> assertThat(row.id()).isEqualTo(expired.getId()));
            assertThat(portal.history("alice", null, "IN_PROGRESS", null, 0, 12).items()).singleElement().satisfies(row -> assertThat(row.id()).isEqualTo(active.getId()));
        });
    }
    @Test void profilePersistsPerUserAndRejectsInvalidBandSteps() {
        tx.executeWithoutResult(status -> {
            assertThat(portal.profile("alice").weeklyMinutes()).isEqualTo(150);
            portal.saveProfile("alice", new UpdateStudentProfileRequest("  Alice  ", new BigDecimal("7.5"), LocalDate.of(2027, 1, 1), 300, false));
            assertThat(portal.profile("alice").publicName()).isEqualTo("Alice"); assertThat(portal.profile("alice").leaderboardVisible()).isFalse();
            assertThat(portal.profile("bob").targetBand()).isNull();
            assertThatThrownBy(() -> portal.saveProfile("bob", new UpdateStudentProfileRequest("Bob", new BigDecimal("7.3"), null, 150, true))).isInstanceOf(ApiException.class);
        });
    }
    @Test
    @org.junit.jupiter.api.condition.EnabledIfSystemProperty(named = "portal.test.jdbc", matches = "jdbc:postgresql:.*", disabledReason = "PostgreSQL CTE/time-zone contract; pass portal.test.jdbc for an isolated PostgreSQL database")
    void leaderboardCapsDailyRewardsDeduplicatesRetriesAndRespectsPrivacyAndVietnamBoundary() {
        tx.executeWithoutResult(status -> {
            LocalDate start = LocalDate.now(StudentPortalService.ZONE).with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            Instant boundary = start.atStartOfDay(StudentPortalService.ZONE).toInstant();
            var word = resource(LearningResourceType.ASSESSMENT, "{\"title\":\"Reading\"}");
            attempt("alice", word, boundary); attempt("alice", word, boundary.plusSeconds(1)); attempt("alice", word, boundary.minusSeconds(1));
            for (int i = 0; i < 7; i++) attempt("bob", resource(LearningResourceType.ASSESSMENT, "{\"title\":\"Test\"}"), boundary.plusSeconds(5));
            attempt("private", word, boundary);
            portal.saveProfile("private", new UpdateStudentProfileRequest("Hidden", null, null, 150, false));
            portal.saveProfile("bob", new UpdateStudentProfileRequest("Bob", null, null, 150, true));
            var unfinished = attempt("incomplete", word, null);
            var deleted = attempt("deleted", word, boundary); deleted.setDeleted(true); attempts.saveAndFlush(deleted);
            var board = portal.leaderboard("alice", "week");
            assertThat(board.entries()).hasSize(2); assertThat(board.entries().getFirst().displayName()).isEqualTo("Bob");
            assertThat(board.entries().getFirst().score()).isEqualTo(50); assertThat(board.me().score()).isEqualTo(10);
            assertThat(board.me().completedResources()).isEqualTo(1); assertThat(board.me().displayName()).isEqualTo("Học viên ẩn danh");
            assertThat(portal.leaderboard("private", "week").me()).isNull();
            assertThatThrownBy(() -> portal.leaderboard("alice", "invalid")).isInstanceOf(ApiException.class);
        });
    }
    @Test void pagesAndTypesAreBounded() {
        assertThatThrownBy(() -> portal.history("alice", "SQL", null, null, 0, 12)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> portal.favorites("alice", null, null, -1, 12)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> portal.history("alice", null, null, null, 0, 101)).isInstanceOf(ApiException.class);
    }
    private LearningResource resource(LearningResourceType type, String content) {
        var r = new LearningResource(); r.setType(type); r.setInLibrary(true); resources.saveAndFlush(r);
        var v = new LearningResourceVersion(); v.setResourceId(r.getId()); v.setVersion(1); v.setStatus(LearningResourceVersionStatus.PUBLISHED); v.setContent(content); versions.saveAndFlush(v);
        r.setPublishedVersionId(v.getId()); resources.saveAndFlush(r); return r;
    }
    private void saveState(String user, LearningResource resource, boolean saved) {
        var state = new LearningResourceState(); state.setUserId(user); state.setLearningResourceId(resource.getId()); state.setSaved(saved); states.saveAndFlush(state);
    }
    private AssessmentAttempt attempt(String user, LearningResource r, Instant submitted) {
        var a = new AssessmentAttempt(); a.setUserId(user); a.setLearningResourceId(r.getId()); a.setLearningResourceVersionId(r.getPublishedVersionId());
        a.setSubType(ResourceSubTypes.PRACTICE_READING); a.setContextType(AssessmentContextType.SELF_STUDY); a.setContextKey("SELF:default"); a.setMode("default");
        a.setStatus(submitted == null ? AssessmentAttemptStatus.IN_PROGRESS : AssessmentAttemptStatus.SUBMITTED); a.setGradingStatus(AssessmentGradingStatus.PENDING);
        a.setEarnedPoints(new BigDecimal("8")); a.setTotalPoints(new BigDecimal("10")); a.setSubmittedAt(submitted); return attempts.saveAndFlush(a);
    }
}
