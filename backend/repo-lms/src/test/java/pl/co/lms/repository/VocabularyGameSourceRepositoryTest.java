package pl.co.lms.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.persistenceunit.PersistenceManagedTypes;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import pl.co.lms.entity.*;
import pl.co.lms.service.game.VocabularyGameDeckProvider;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;

/** Read the real game and dictionary queries against an isolated database. */
class VocabularyGameSourceRepositoryTest {
    static EntityManagerFactory factory;
    EntityManager em;
    @BeforeAll static void database() {
        var bean=new LocalContainerEntityManagerFactoryBean();
        bean.setDataSource(new DriverManagerDataSource("jdbc:h2:mem:vocabulary-game-source;MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa",""));
        bean.setManagedTypes(PersistenceManagedTypes.of(LearningResource.class.getName(),LearningResourceVersion.class.getName()));
        bean.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        bean.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto","create-drop","hibernate.physical_naming_strategy","org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
        bean.afterPropertiesSet(); factory=bean.getObject();
    }
    @BeforeEach void transaction() { em=factory.createEntityManager(); em.getTransaction().begin(); }
    @AfterEach void rollback() { em.getTransaction().rollback(); em.close(); }
    @AfterAll static void close() { factory.close(); }

    @Test void gameReadsTheSamePublishedSharedSourcesAsDictionaryAndNeverDeletedDraftOrPackageCopies() {
        source("common",LearningResourceType.VOCABULARY,true,false,false,LearningResourceVersionStatus.PUBLISHED,false);
        source("draft",LearningResourceType.VOCABULARY,true,false,false,LearningResourceVersionStatus.DRAFT,false);
        source("deleted",LearningResourceType.VOCABULARY,true,true,false,LearningResourceVersionStatus.PUBLISHED,false);
        source("deleted-version",LearningResourceType.VOCABULARY,true,false,true,LearningResourceVersionStatus.PUBLISHED,false);
        source("package-copy",LearningResourceType.VOCABULARY,false,false,false,LearningResourceVersionStatus.PUBLISHED,false);
        source("foreign-version",LearningResourceType.VOCABULARY,true,false,false,LearningResourceVersionStatus.PUBLISHED,true);
        source("grammar",LearningResourceType.GRAMMAR,true,false,false,LearningResourceVersionStatus.PUBLISHED,false);
        em.flush(); em.clear();
        var repositories=new JpaRepositoryFactory(em);
        var resources=repositories.getRepository(LearningResourceRepository.class);
        var versions=repositories.getRepository(LearningResourceVersionRepository.class);
        var deck=new VocabularyGameDeckProvider(versions,new ObjectMapper()).library(Integer.MAX_VALUE);
        assertThat(resources.findDictionaryRoadmapWords()).extracting(DictionaryRoadmapWord::id).containsExactly("common");
        assertThat(deck).singleElement().satisfies(card -> {
            assertThat(card.id()).isEqualTo("common"); assertThat(card.definition()).isEqualTo("nghĩa thông dụng");
        });
    }

    private void source(String id,LearningResourceType type,boolean library,boolean deleted,boolean versionDeleted,
                        LearningResourceVersionStatus status,boolean foreign) {
        var resource=LearningResource.builder().type(type).inLibrary(library).publishedVersionId("v-"+id)
                .subType(type == LearningResourceType.VOCABULARY ? pl.co.lms.entity.ResourceSubTypes.EN : null).build();
        resource.setId(id);
        var version=LearningResourceVersion.builder().resourceId(foreign ? "other" : id).version(1).status(status).build();
        version.setId("v-"+id);
        version.setContent("{\"word\":\""+id+"\",\"commonMeaning\":\"nghĩa thông dụng\"}");
        em.persist(resource); em.persist(version);
        // BaseEntity initializes deleted=false on creation; mark soft deletion afterwards.
        resource.setDeleted(deleted); version.setDeleted(versionDeleted);
    }
}
