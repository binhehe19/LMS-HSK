package pl.co.lms.repository;

import base.co.common.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.persistenceunit.PersistenceManagedTypes;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import pl.co.lms.dto.request.*;
import pl.co.lms.entity.*;
import pl.co.lms.service.QuadWordService;
import pl.co.lms.service.game.QuadWordCandidateProvider;
import java.util.Map;
import java.util.concurrent.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;

/** Real provider + service + JPA transactions, including concurrent requests, on PostgreSQL-compatible H2. */
class QuadWordPersistenceTest {
    static EntityManagerFactory factory;
    static ObjectMapper mapper = new ObjectMapper();
    @BeforeAll static void database() {
        var bean = new LocalContainerEntityManagerFactoryBean();
        bean.setDataSource(new DriverManagerDataSource("jdbc:h2:mem:quad;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000", "sa", ""));
        bean.setManagedTypes(PersistenceManagedTypes.of(QuadWordSession.class.getName(), LearningResource.class.getName(), LearningResourceVersion.class.getName()));
        bean.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        bean.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop", "hibernate.physical_naming_strategy",
                "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
        bean.afterPropertiesSet(); factory = bean.getObject();
    }
    @BeforeEach void seed() {
        tx(em -> {
            em.createQuery("delete from QuadWordSession").executeUpdate();
            em.createQuery("delete from LearningResourceVersion").executeUpdate();
            em.createQuery("delete from LearningResource").executeUpdate();
            seed(em, "vocab", LearningResourceType.VOCABULARY, true, LearningResourceVersionStatus.PUBLISHED, "vocab", "hotel");
            seed(em, "draft", LearningResourceType.VOCABULARY, true, LearningResourceVersionStatus.DRAFT, "draft", "draft");
            seed(em, "embedded", LearningResourceType.VOCABULARY, false, LearningResourceVersionStatus.PUBLISHED, "embedded", "embedded");
            seed(em, "foreign", LearningResourceType.VOCABULARY, true, LearningResourceVersionStatus.PUBLISHED, "other", "foreign");
            var deleted = seed(em, "deleted", LearningResourceType.VOCABULARY, true, LearningResourceVersionStatus.PUBLISHED, "deleted", "deleted");
            em.flush(); deleted.setDeleted(true);
            return null;
        });
    }
    @AfterAll static void close() { factory.close(); }

    @Test void publishedQueryFiltersDraftsEmbeddedDeletedAndWrongResourceVersions() {
        tx(em -> {
            var service = service(em);
            var vocab = service.start("owner", new StartQuadWordRequest(QuadWordSource.VOCABULARY));
            assertThat(vocab.pattern()).isEqualTo("_____"); assertThat(vocab.review()).isNull();
            assertThatThrownBy(() -> service.get("other", vocab.id())).isInstanceOf(ApiException.class);
            return null;
        });
    }
    @Test void snapshotsAndIdempotentGuessesSurviveSeparateTransactionsAndCatalogEdits() {
        String id = tx(em -> service(em).start("owner", new StartQuadWordRequest(QuadWordSource.VOCABULARY)).id());
        tx(em -> { em.find(LearningResourceVersion.class, "v-vocab").setContent("{\"word\":\"changed\"}"); return null; });
        var payload = new SubmitQuadWordGuessRequest("guess", "hotel", 0);
        tx(em -> service(em).guess("owner", id, payload));
        tx(em -> {
            var retry = service(em).guess("owner", id, payload);
            assertThat(retry.review().answer()).isEqualTo("hotel"); assertThat(retry.guesses()).hasSize(1);
            assertThat(service(em).get("owner", id)).isEqualTo(retry);
            var repository = new JpaRepositoryFactory(em).getRepository(QuadWordSessionRepository.class);
            em.find(QuadWordSession.class, id).setDeleted(true); em.flush();
            assertThat(repository.findByIdAndUserIdAndDeletedFalse(id, "owner")).isEmpty();
            return null;
        });
    }

    @Test void largeCollectionProgressSurvivesReloadAndCountsDistinctCorrectWordsOnly() {
        tx(em -> {
            for (int i = 0; i < 500; i++) {
                String term = "word" + (char) ('a' + i / 26) + (char) ('a' + i % 26);
                var version = seed(em, "set-" + i, LearningResourceType.VOCABULARY, true,
                        LearningResourceVersionStatus.PUBLISHED, "set-" + i, term);
                version.setContent("{\"word\":\"" + term + "\",\"cefrLevel\":\"B2\"}");
            }
            return null;
        });
        String id = tx(em -> {
            var collections = service(em).collections("owner");
            assertThat(collections).hasSize(6);
            assertThat(collections.stream().filter(item -> item.id().equals("B2")).findFirst().orElseThrow().total()).isEqualTo(500);
            assertThat(collections.stream().filter(item -> item.id().equals("B2")).findFirst().orElseThrow().learned()).isZero();
            return service(em).start("owner", new StartQuadWordRequest(QuadWordSource.VOCABULARY, "B2")).id();
        });
        tx(em -> {
            var row = em.find(QuadWordSession.class, id);
            try {
                var word = mapper.readValue(row.getCandidate(), pl.co.lms.entity.json.QuadWordCandidate.class);
                var wrong = service(em).guess("owner", id, new SubmitQuadWordGuessRequest("wrong", "x".repeat(word.answer().length()), 0));
                assertThat(wrong.collection().learned()).isZero();
                var result = service(em).guess("owner", id, new SubmitQuadWordGuessRequest("won", word.answer(), 1));
                assertThat(result.collection().learned()).isEqualTo(1);
                // Replay of the same result cannot increment progress.
                assertThat(service(em).guess("owner", id, new SubmitQuadWordGuessRequest("won", word.answer(), 1)).collection().learned()).isEqualTo(1);
                // Another completed session for the same word still counts once.
                var duplicate = new QuadWordSession();
                duplicate.setUserId("owner"); duplicate.setSource(QuadWordSource.VOCABULARY);
                duplicate.setStatus(QuadWordStatus.WON); duplicate.setCandidate(row.getCandidate());
                duplicate.setGuesses("[]"); duplicate.setExpiresAt(row.getExpiresAt());
                duplicate.setCollectionKey("B2"); duplicate.setCandidateResourceId(word.resourceId());
                em.persist(duplicate); em.flush();
            } catch (com.fasterxml.jackson.core.JsonProcessingException cause) { throw new RuntimeException(cause); }
            return null;
        });
        tx(em -> {
            assertThat(service(em).get("owner", id).collection().learned()).isEqualTo(1);
            assertThat(service(em).collections("owner").stream().filter(item -> item.id().equals("B2")).findFirst().orElseThrow().learned()).isEqualTo(1);
            assertThat(service(em).collections("other").stream().filter(item -> item.id().equals("B2")).findFirst().orElseThrow().learned()).isZero();
            var next = service(em).start("owner", new StartQuadWordRequest(QuadWordSource.VOCABULARY, "B2"));
            assertThat(em.find(QuadWordSession.class, next.id()).getCandidateResourceId())
                    .isNotEqualTo(em.find(QuadWordSession.class, id).getCandidateResourceId());
            return null;
        });
    }
    @Test void b1TestWordWithAnArbitraryMeaningIsPlayableAndPersistsProgress() {
        tx(em -> {
            var word = seed(em, "b1-test", LearningResourceType.VOCABULARY, true,
                    LearningResourceVersionStatus.PUBLISHED, "b1-test", "phuong");
            word.setContent("{\"word\":\"phuong\",\"cefrLevel\":\"B1\",\"definitions\":[{\"meaningVi\":\"d\"}]}");
            return null;
        });
        String id = tx(em -> {
            var b1 = service(em).collections("owner").stream().filter(item -> item.id().equals("B1")).findFirst().orElseThrow();
            assertThat(b1.total()).isEqualTo(1);
            var started = service(em).start("owner", new StartQuadWordRequest(QuadWordSource.VOCABULARY, "B1"));
            assertThat(started.pattern()).isEqualTo("______");
            assertThat(started.review()).isNull();
            assertThat(started.collection().learned()).isZero();
            return started.id();
        });
        tx(em -> {
            var won = service(em).guess("owner", id, new SubmitQuadWordGuessRequest("win-b1", "phuong", 0));
            assertThat(won.review().meaning()).isEqualTo("d");
            assertThat(won.collection().learned()).isEqualTo(1);
            return null;
        });
        tx(em -> {
            assertThat(service(em).get("owner", id).collection().learned()).isEqualTo(1);
            assertThat(service(em).get("owner", id).review().answer()).isEqualTo("phuong");
            assertThat(service(em).collections("owner").stream().filter(item -> item.id().equals("B1")).findFirst().orElseThrow().learned()).isEqualTo(1);
            return null;
        });
    }
    @Test void concurrentGuessesAreSerializedAndStaleSecondRequestDoesNotSpendATurn() throws Exception {
        String id = tx(em -> service(em).start("owner", new StartQuadWordRequest(QuadWordSource.VOCABULARY)).id());
        var executor = Executors.newFixedThreadPool(2);
        var locked = new CountDownLatch(1); var release = new CountDownLatch(1);
        try {
            var first = executor.submit(() -> tx(em -> {
                var result = service(em).guess("owner", id, new SubmitQuadWordGuessRequest("first", "hello", 0));
                locked.countDown();
                try { if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("release timeout"); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
                return result;
            }));
            assertThat(locked.await(5, TimeUnit.SECONDS)).isTrue();
            var started = new CountDownLatch(1);
            var second = executor.submit(() -> tx(em -> {
                started.countDown();
                return service(em).guess("owner", id, new SubmitQuadWordGuessRequest("second", "aaaaa", 0));
            }));
            assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
            release.countDown();
            assertThat(first.get(10, TimeUnit.SECONDS).remaining()).isEqualTo(5);
            assertThatThrownBy(() -> second.get(10, TimeUnit.SECONDS)).hasCauseInstanceOf(ApiException.class);
            assertThat(tx(em -> service(em).get("owner", id)).guesses()).hasSize(1);
        } finally { release.countDown(); executor.shutdownNow(); }
    }
    private static QuadWordService service(EntityManager em) {
        var repositories = new JpaRepositoryFactory(em);
        return new QuadWordService(repositories.getRepository(QuadWordSessionRepository.class),
                new QuadWordCandidateProvider(repositories.getRepository(LearningResourceVersionRepository.class), mapper), mapper);
    }
    private static <T> T tx(Function<EntityManager, T> action) {
        var em = factory.createEntityManager(); em.getTransaction().begin();
        try { T value = action.apply(em); em.getTransaction().commit(); return value; }
        catch (RuntimeException e) { if (em.getTransaction().isActive()) em.getTransaction().rollback(); throw e; }
        finally { em.close(); }
    }
    private LearningResourceVersion seed(EntityManager em, String id, LearningResourceType type, boolean library,
            LearningResourceVersionStatus status, String resourceId, String answer) {
        var resource = new LearningResource(); resource.setId(id); resource.setType(type); resource.setInLibrary(library);
        resource.setPublishedVersionId("v-" + id); em.persist(resource);
        var version = new LearningResourceVersion(); version.setId("v-" + id); version.setResourceId(resourceId); version.setStatus(status);
        version.setContent("{\"word\":\"" + answer + "\",\"definitions\":[{\"meaningVi\":\"khách sạn\"}]}");
        em.persist(version); return version;
    }
}
