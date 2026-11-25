package pl.co.lms.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.persistenceunit.PersistenceManagedTypes;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import pl.co.lms.entity.*;

import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;

/** Exercises the real JPQL and derived queries with an isolated database, never the configured application DB. */
class LearningOrbitRepositoryTest {
    static EntityManagerFactory factory;
    EntityManager em;
    @BeforeAll static void database() {
        var bean = new LocalContainerEntityManagerFactoryBean();
        bean.setDataSource(new DriverManagerDataSource("jdbc:h2:mem:orbit;MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", ""));
        bean.setManagedTypes(PersistenceManagedTypes.of(LearningResource.class.getName(), LearningResourceVersion.class.getName(),
                LearningResourceState.class.getName(), AssessmentAttempt.class.getName(), AssessmentAnswer.class.getName(), LearningOrbitSpace.class.getName()));
        bean.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        bean.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop", "hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
        bean.afterPropertiesSet(); factory = bean.getObject();
    }
    @BeforeEach void begin() { em = factory.createEntityManager(); em.getTransaction().begin(); }
    @AfterEach void rollback() { em.getTransaction().rollback(); em.close(); }
    @AfterAll static void close() { factory.close(); }

    @Test void vocabularyQueryExcludesOtherUsersDraftsPackageCopiesDeletedResourcesAndNonVocabulary() {
        var source = resource(LearningResourceType.VOCABULARY, true, true); source.setSubType("EN");
        var zhWord = resource(LearningResourceType.VOCABULARY, true, true); zhWord.setSubType("ZH");
        var draft = resource(LearningResourceType.VOCABULARY, true, false);
        var copy = resource(LearningResourceType.VOCABULARY, false, true);
        var deleted = resource(LearningResourceType.VOCABULARY, true, true); deleted.setDeleted(true);
        var grammar = resource(LearningResourceType.GRAMMAR, true, true);
        for (var r : List.of(source, draft, copy, deleted, grammar)) state("owner", r);
        state("other", source);
        em.flush();
        var factory = new JpaRepositoryFactory(em);
        var states = factory.getRepository(LearningResourceStateRepository.class).findPublishedLibraryVocabularyStates("owner");
        assertThat(states).hasSize(1).allMatch(s -> s.getUserId().equals("owner") && s.getLearningResourceId().equals(source.getId()));
        assertThat(factory.getRepository(LearningResourceRepository.class).countByTypeAndSubTypeAndInLibraryTrueAndPublishedVersionIdIsNotNullAndDeletedFalse(LearningResourceType.VOCABULARY, "EN")).as("the Orbit total counts English words only").isEqualTo(1);
    }

    @Test void attemptQueryAndAnswerBatchDoNotMixOwnersOrDeletedRows() {
        var own = attempt("owner", AssessmentAttemptStatus.SUBMITTED);
        attempt("other", AssessmentAttemptStatus.SUBMITTED);
        attempt("owner", AssessmentAttemptStatus.IN_PROGRESS);
        var deleted = attempt("owner", AssessmentAttemptStatus.TIME_OUT); deleted.setDeleted(true);
        var ownAnswer = AssessmentAnswer.builder().attemptId(own.getId()).questionId("question-1").gradingStatus(AssessmentAnswerGradingStatus.AUTO_GRADED).build(); em.persist(ownAnswer);
        var removedAnswer = AssessmentAnswer.builder().attemptId(own.getId()).questionId("question-2").gradingStatus(AssessmentAnswerGradingStatus.AUTO_GRADED).build(); em.persist(removedAnswer); removedAnswer.setDeleted(true);
        em.flush();
        var factory = new JpaRepositoryFactory(em);
        var results = factory.getRepository(AssessmentAttemptRepository.class).findByUserIdAndStatusInAndDeletedFalse("owner", List.of(AssessmentAttemptStatus.SUBMITTED, AssessmentAttemptStatus.TIME_OUT));
        assertThat(results).extracting(AssessmentAttempt::getId).containsExactly(own.getId());
        assertThat(factory.getRepository(AssessmentAnswerRepository.class).findByAttemptIdInAndDeletedFalse(results.stream().map(AssessmentAttempt::getId).toList())).extracting(AssessmentAnswer::getId).containsExactly(ownAnswer.getId());
    }

    @Test void spaceAssessmentRoundTripsNullableScoresAndIsScopedByUser() {
        var value = new LearningOrbitSpace(); value.setUserId("owner"); value.setScopeLevel(3); value.setProbeLevel(null); value.setRecommendation("Practice Probe"); em.persist(value); em.flush(); em.clear();
        var repository = new JpaRepositoryFactory(em).getRepository(LearningOrbitSpaceRepository.class);
        assertThat(repository.findByUserIdAndDeletedFalse("other")).isEmpty();
        var stored = repository.findByUserIdAndDeletedFalse("owner").orElseThrow();
        assertThat(stored.getScopeLevel()).isEqualTo(3); assertThat(stored.getProbeLevel()).isNull(); assertThat(stored.getRecommendation()).isEqualTo("Practice Probe");
    }
    private LearningResource resource(LearningResourceType type, boolean library, boolean published) {
        var r = LearningResource.builder().type(type).inLibrary(library).build(); if (published) r.setPublishedVersionId("version-1"); em.persist(r); return r;
    }
    private void state(String user, LearningResource resource) { em.persist(LearningResourceState.builder().userId(user).learningResourceId(resource.getId()).comprehensionLevel(VocabularyComprehensionLevel.KNOWN).build()); }
    private AssessmentAttempt attempt(String user, AssessmentAttemptStatus status) {
        var a = AssessmentAttempt.builder().userId(user).learningResourceId("resource-1").learningResourceVersionId("version-1").contextKey("session-1").status(status).gradingStatus(AssessmentGradingStatus.NOT_SUBMITTED).build(); em.persist(a); return a;
    }
}
