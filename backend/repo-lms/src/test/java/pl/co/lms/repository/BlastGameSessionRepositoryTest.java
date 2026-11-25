package pl.co.lms.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.persistenceunit.PersistenceManagedTypes;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import pl.co.lms.entity.BlastGameSession;
import pl.co.lms.entity.BlastGameSource;
import java.time.Instant;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;

/** Isolated JPA/SQL contract in PostgreSQL-compatible H2; no application services or external DB. */
class BlastGameSessionRepositoryTest {
    static EntityManagerFactory factory;
    EntityManager em;
    BlastGameSessionRepository repository;
    @BeforeAll static void database() {
        var bean = new LocalContainerEntityManagerFactoryBean();
        bean.setDataSource(new DriverManagerDataSource("jdbc:h2:mem:blast;MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", ""));
        bean.setManagedTypes(PersistenceManagedTypes.of(BlastGameSession.class.getName()));
        bean.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        bean.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop", "hibernate.physical_naming_strategy",
                "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
        bean.afterPropertiesSet(); factory = bean.getObject();
    }
    @BeforeEach void transaction() {
        em = factory.createEntityManager(); em.getTransaction().begin();
        repository = new JpaRepositoryFactory(em).getRepository(BlastGameSessionRepository.class);
    }
    @AfterEach void rollback() { em.getTransaction().rollback(); em.close(); }
    @AfterAll static void close() { factory.close(); }
    @Test void jsonSnapshotRoundTripsAndQueriesRespectOwner() {
        var session = session("owner", 160, 20, "key");
        session.setCards("[{\"id\":\"c1\",\"term\":\"hello\",\"definition\":\"xin chào\"}]");
        repository.saveAndFlush(session); em.clear();
        assertThat(repository.findByIdAndUserIdAndDeletedFalse(session.getId(), "other")).isEmpty();
        assertThat(repository.lockOwned(session.getId(), "owner")).isPresent();
        assertThat(repository.findByIdAndUserIdAndDeletedFalse(session.getId(), "owner").orElseThrow().getCards()).isEqualTo(session.getCards());
    }
    @Test void leaderboardSelectsOneBestPerUserThenOrdersByScoreAndTime() {
        repository.save(session("alice", 100, 20, "key")); repository.save(session("alice", 160, 25, "key"));
        repository.save(session("alice", 160, 20, "key")); repository.save(session("bob", 160, 15, "key"));
        repository.save(session("carol", 159, 1, "key")); repository.save(session("other-deck", 999, 1, "different"));
        var deleted = repository.save(session("deleted", 999, 1, "key")); em.flush(); deleted.setDeleted(true);
        var incomplete = session("unfinished", 999, 1, "key"); incomplete.setCompletedAt(null); repository.save(incomplete);
        em.flush();
        var rows = repository.leaderboard("key");
        assertThat(rows).extracting(BlastGameSessionRepository.RankedScore::getUserId).containsExactly("bob", "alice", "carol");
        assertThat(rows.get(1).getElapsedMs()).isEqualTo(20);
        assertThat(repository.findByDatasetKeyAndUserIdAndCompletedAtIsNotNullAndDeletedFalseOrderByScoreDescElapsedMsAsc("key", "alice", PageRequest.of(0,1)))
                .singleElement().satisfies(s -> { assertThat(s.getScore()).isEqualTo(160); assertThat(s.getElapsedMs()).isEqualTo(20); });
    }
    @Test void top50LimitIsAppliedAfterPersonalBest() {
        for (int i = 0; i < 65; i++) repository.save(session("repeat", 999 - i, 20, "key"));
        for (int i = 0; i < 55; i++) repository.save(session("user" + i, 100 + i, 20, "key"));
        em.flush();
        assertThat(repository.leaderboard("key")).hasSize(50).extracting(BlastGameSessionRepository.RankedScore::getUserId).doesNotHaveDuplicates();
    }
    private BlastGameSession session(String user, int score, int elapsed, String dataset) {
        var s = new BlastGameSession(); s.setUserId(user); s.setDisplayName(user); s.setDatasetKey(dataset);
        s.setSource(BlastGameSource.DEMO); s.setTotalWords(2); s.setCards("[]"); s.setStartedAt(Instant.now()); s.setCompletedAt(Instant.now());
        s.setScore(score); s.setElapsedMs(elapsed); s.setAnswered(1); s.setMistakes(0); return s;
    }
}
