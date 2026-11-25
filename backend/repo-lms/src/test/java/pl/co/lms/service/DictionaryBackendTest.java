package pl.co.lms.service;

import base.co.common.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.*;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.*;
import org.springframework.orm.jpa.persistenceunit.PersistenceManagedTypes;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionTemplate;
import pl.co.lms.dto.request.*;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.VocabularyEnContent;
import pl.co.lms.repository.*;

import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;

/** Real service, transactions, repositories and an isolated database. Never connects to application DB. */
class DictionaryBackendTest {
    static EntityManagerFactory emf;
    static JpaTransactionManager tx;
    static TransactionTemplate transaction;
    static LearningResourceService catalog;
    static LearningResourceStateService states;
    static DictionaryService dictionary;
    static DictionarySessionRepository sessionRepository;
    static LearningResourceStateRepository stateRepository;
    static ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    @BeforeAll static void setup() {
        var bean = new LocalContainerEntityManagerFactoryBean();
        bean.setDataSource(new DriverManagerDataSource("jdbc:h2:mem:dictionary;MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", ""));
        bean.setManagedTypes(PersistenceManagedTypes.of(LearningResource.class.getName(),LearningResourceVersion.class.getName(),
                LearningResourceState.class.getName(),DictionaryProfile.class.getName(),DictionarySession.class.getName()));
        bean.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        bean.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto","create-drop","hibernate.physical_naming_strategy","org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
        bean.afterPropertiesSet(); emf=bean.getObject(); tx=new JpaTransactionManager(emf); transaction=new TransactionTemplate(tx);
        var factory = new JpaRepositoryFactory(SharedEntityManagerCreator.createSharedEntityManager(emf));
        var resources=factory.getRepository(LearningResourceRepository.class);
        var versions=factory.getRepository(LearningResourceVersionRepository.class);
        stateRepository=factory.getRepository(LearningResourceStateRepository.class);
        sessionRepository=factory.getRepository(DictionarySessionRepository.class);
        catalog=proxy(new LearningResourceService(resources,versions,mock(ContentPackageVersionResourceRepository.class),mapper));
        states=proxy(new LearningResourceStateService(stateRepository,resources));
        dictionary=proxy(new DictionaryService(catalog,states,resources,factory.getRepository(DictionaryProfileRepository.class),sessionRepository,mapper));
    }
    @SuppressWarnings("unchecked") private static <T> T proxy(T value) {
        var factory = new ProxyFactory(value); factory.setProxyTargetClass(true);
        factory.addAdvice(new TransactionInterceptor(tx,new AnnotationTransactionAttributeSource()));
        return (T) factory.getProxy();
    }
    @BeforeEach void clear() {
        catalog.evictRoadmapWords();
        transaction.executeWithoutResult(status -> {
            var em=SharedEntityManagerCreator.createSharedEntityManager(emf);
            for (String entity:List.of("DictionarySession","DictionaryProfile","LearningResourceState","LearningResourceVersion","LearningResource"))
                em.createQuery("delete from "+entity).executeUpdate();
        });
    }
    @AfterAll static void close() { emf.close(); }

    private void roadmapWords() { for (int i=0;i<11;i++) word("word"+String.format("%02d",i)); }
    private DictionarySessionData lessonAttempt(List<String> ids, boolean completed) {
        var probe=new LinkedHashMap<String,DictionarySessionData.Answer>();
        var assemble=new LinkedHashMap<String,DictionarySessionData.Answer>();
        var communicate=new LinkedHashMap<String,DictionarySessionData.Answer>();
        for (String id:ids) {
            probe.put(id,new DictionarySessionData.Answer("Bền vững",true,false,true));
            assemble.put(id,new DictionarySessionData.Answer(id,true,false,true));
            communicate.put(id,new DictionarySessionData.Answer("We need "+id+" solutions.",true,false,true));
        }
        return new DictionarySessionData(1,ids,"manifest",completed ? 4 : 1,0,List.of(),probe,assemble,communicate,completed,Instant.now().toString(),null,null);
    }
    @Test void roadmapEnforcesOrderForDirectReadsReviewWritesAndSkipTests() {
        roadmapWords();
        var path=dictionary.roadmap("owner","B2","Environment");
        assertThat(path).hasSize(3);
        assertThat(path).extracting(l -> l.unlocked()).containsExactly(true,false,false);
        assertThat(path).allSatisfy(l -> assertThat(l.terms()).hasSameSizeAs(l.wordIds()).doesNotContain(""));
        String second=path.get(1).id();
        assertThatThrownBy(() -> dictionary.getSession("owner",second,false,"B2","Environment")).isInstanceOf(ApiException.class).hasMessageContaining("bài trước");
        assertThatThrownBy(() -> dictionary.getSession("owner",second,true,"B2","Environment")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> dictionary.saveSession("owner",second,false,new SaveDictionarySessionRequest(null,false,lessonAttempt(path.get(1).wordIds(),true)),"B2","Environment")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> dictionary.submitSkipTest("owner",second,"B2","Environment",new DictionarySkipTestRequest(path.get(1).versions(),Map.of()))).isInstanceOf(ApiException.class);
        var first=path.getFirst();
        dictionary.saveSession("owner",first.id(),false,new SaveDictionarySessionRequest(null,false,lessonAttempt(first.wordIds(),true)),"B2","Environment");
        assertThat(dictionary.roadmap("owner","B2","Environment")).extracting(l -> l.unlocked()).containsExactly(true,true,false);
        assertThat(dictionary.roadmap("other","B2","Environment")).extracting(l -> l.unlocked()).containsExactly(true,false,false);
    }
    @Test void skipTestGradesOnServerCountsBlanksAndOnlyPassingAttemptsUnlockNextLesson() {
        roadmapWords();
        var first=dictionary.roadmap("owner",null,null).getFirst();
        var answers=new LinkedHashMap<String,String>();
        for (int i=0;i<4;i++) answers.put((i%2 == 0 ? "probe:" : "assemble:")+first.wordIds().get(i),i%2 == 0 ? "Bền vững" : first.wordIds().get(i));
        var failed=dictionary.submitSkipTest("owner",first.id(),null,null,new DictionarySkipTestRequest(first.versions(),Map.of()));
        assertThat(failed.passed()).isFalse(); assertThat(failed.mistakes()).isEqualTo(5);
        assertThat(dictionary.roadmap("owner",null,null).get(1).unlocked()).isFalse();
        var pass=dictionary.submitSkipTest("owner",first.id(),null,null,new DictionarySkipTestRequest(first.versions(),answers));
        assertThat(pass.passed()).isTrue(); assertThat(pass.percentage()).isEqualTo(80); assertThat(pass.mistakes()).isEqualTo(1);
        assertThat(dictionary.roadmap("owner",null,null).get(1).unlocked()).isTrue();
        assertThat(dictionary.roadmap("owner",null,null).getFirst().method()).isEqualTo("test");
        var saved=dictionary.getSession("owner",first.id(),false);
        dictionary.saveSession("owner",first.id(),false,new SaveDictionarySessionRequest(saved.revision(),true,lessonAttempt(first.wordIds(),false)));
        assertThat(dictionary.roadmap("owner",null,null).get(1).unlocked()).isTrue();
        assertThatThrownBy(() -> dictionary.submitSkipTest("owner",first.id(),null,null,new DictionarySkipTestRequest(Map.of("old","v-old"),answers))).isInstanceOf(ApiException.class).hasMessageContaining("thay đổi");
    }
    @Test void skipThresholdRequiresBothConditionsAndCannotRoundUp() {
        assertThat(DictionaryService.skipTestScore(4,5).passed()).isTrue();
        assertThat(DictionaryService.skipTestScore(3,5).passed()).isFalse();
        assertThat(DictionaryService.skipTestScore(20,25).passed()).isTrue();
        assertThat(DictionaryService.skipTestScore(24,30).passed()).isFalse();
        assertThat(DictionaryService.skipTestScore(799,1000).passed()).isFalse();
    }
    @Test void roadmapFollowsTheDictionaryOrderAndScopesByTheSearchColumns() {
        word("Zeta","Environment","B2"); word("alpha","Environment","B2"); word("Émile","Health","B2"); word("beta","Health","A1"); word("gamma","Health","");
        var path=dictionary.roadmap("owner",null,null);
        // Words follow search_title (accents and case ignored); topics follow their first word.
        assertThat(path).extracting(l -> l.wordIds()).containsExactly(List.of("alpha","Zeta"),List.of("beta","Émile","gamma"));
        assertThat(path).extracting(l -> l.terms()).containsExactly(List.of("alpha","zeta"),List.of("beta","émile","gamma"));
        assertThat(dictionary.roadmap("owner","A1",null)).extracting(l -> l.wordIds()).containsExactly(List.of("beta"));
        assertThat(dictionary.roadmap("owner","Chưa phân loại",null)).extracting(l -> l.wordIds()).containsExactly(List.of("gamma"));
        assertThat(dictionary.roadmap("owner","B2","Health")).extracting(l -> l.wordIds()).containsExactly(List.of("Émile"));
        assertThat(dictionary.roadmap("owner",null,"health")).isEmpty();
    }
    @Test void fabricatedKnownWordsAndEmptyCompletionCannotUnlockLessons() {
        roadmapWords();
        var lesson=dictionary.roadmap("owner",null,null).getFirst();
        var forged=new DictionarySessionData(1,lesson.wordIds(),"manifest",4,0,lesson.wordIds(),Map.of(),Map.of(),Map.of(),true,Instant.now().toString(),null,null,
                new DictionarySessionData.LessonPass("test",5,5,Instant.now().toString()));
        var saved=dictionary.saveSession("owner",lesson.id(),false,new SaveDictionarySessionRequest(null,false,forged));
        assertThat(saved.session().known()).isEmpty(); assertThat(saved.session().lessonPass()).isNull();
        assertThat(dictionary.roadmap("owner",null,null).get(1).unlocked()).isFalse();
    }

    private void resource(String id, LearningResourceType type, boolean library, boolean published, boolean deleted, boolean deletedVersion) {
        resource(id, type, library, published, deleted, deletedVersion, "Environment", "B2");
    }
    private void resource(String id, LearningResourceType type, boolean library, boolean published, boolean deleted, boolean deletedVersion, String topic, String cefr) {
        transaction.executeWithoutResult(status -> {
            var em=SharedEntityManagerCreator.createSharedEntityManager(emf);
            var r=LearningResource.builder().type(type).inLibrary(library).subType(type == LearningResourceType.VOCABULARY ? ResourceSubTypes.EN : null).build(); r.setId(id);
            var v=LearningResourceVersion.builder().resourceId(id).version(1).status(published ? LearningResourceVersionStatus.PUBLISHED : LearningResourceVersionStatus.DRAFT).build(); v.setId("v-"+id);
            v.setContentFrom(VocabularyEnContent.builder().word(id).topic(topic).cefrLevel(cefr).definitions(List.of(
                    VocabularyEnContent.VocabularyDefinitionItem.builder().meaningVi("Bền vững; có thể duy trì lâu dài").definitionEn("Able to continue").exampleEn("We need "+id+" solutions.").build())).build(),mapper);
            if (published) r.setPublishedVersionId(v.getId()); else r.setDraftVersionId(v.getId());
            // Dữ liệu nạp thẳng bằng EntityManager không đi qua service nên phải dựng cột tìm kiếm như service.
            var cols=ResourceSearchColumns.build(type,v.getContent(),List.of(),mapper);
            r.setSearchTitle(cols.title()); r.setSearchText(cols.text()); r.setSearchTags(cols.tags()); r.setWordKey(cols.wordKey()); r.setCefrLevel(cols.cefrLevel()); r.setTopic(cols.topic());
            em.persist(r); em.persist(v); r.setDeleted(deleted); v.setDeleted(deletedVersion);
        });
    }
    @Test
    void keywordFindsEnglishCompoundsAndPhrases() {
        word("ice cream", "Food", "A1");
        word("well-being", "Health", "B2");
        word("climate change", "Environment", "B2");

        assertThat(catalog.searchVocabulary(" ICE  CREAM ", null, null, 0, 20).getItems())
                .extracting(r -> r.id()).containsExactly("ice cream");
        assertThat(catalog.searchVocabulary("well-being", null, null, 0, 20).getItems())
                .extracting(r -> r.id()).containsExactly("well-being");
        assertThat(catalog.searchVocabulary("climate change", "Environment", "B2", 0, 20).getItems())
                .extracting(r -> r.id()).containsExactly("climate change");
    }

    private void word(String id) { resource(id,LearningResourceType.VOCABULARY,true,true,false,false); }
    private void word(String id, String topic, String cefr) { resource(id,LearningResourceType.VOCABULARY,true,true,false,false,topic,cefr); }
    private DictionarySessionData data(String id, boolean completed, String probe, String recall, String sentence, String start) {
        var answers=new DictionarySessionData.Answer(probe,true,false,true);
        return new DictionarySessionData(1,List.of(id),"manifest",completed ? 4 : 1,0,List.of(),Map.of(id,answers),
                Map.of(id,new DictionarySessionData.Answer(recall,true,false,true)),Map.of(id,new DictionarySessionData.Answer(sentence,true,false,true)),completed,start,null,null);
    }

    @Test void catalogExcludesDraftsCopiesOtherTypesAndDeletedVersionsAndSearchesVietnameseWithoutAccents() {
        word("sustainable");
        resource("draft",LearningResourceType.VOCABULARY,true,false,false,false);
        resource("copy",LearningResourceType.VOCABULARY,false,true,false,false);
        resource("deleted",LearningResourceType.VOCABULARY,true,true,true,false);
        resource("deleted-version",LearningResourceType.VOCABULARY,true,true,false,true);
        resource("grammar",LearningResourceType.GRAMMAR,true,true,false,false);
        assertThat(catalog.searchVocabulary("ben vung","environment","b2",0,20).getItems()).extracting(r -> r.id()).containsExactly("sustainable");
        assertThat(catalog.searchVocabulary(null,null,"B1",0,20).getItems()).isEmpty();
        assertThat(catalog.searchVocabulary(null,null,null,Integer.MAX_VALUE,Integer.MAX_VALUE).getItems()).isEmpty();
        assertThat(catalog.searchVocabulary(null,null,null,0,Integer.MAX_VALUE).getSize()).isEqualTo(200);
        assertThatThrownBy(() -> catalog.getDictionaryWord("draft")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> catalog.getDictionaryWord("copy")).isInstanceOf(ApiException.class);
    }
    @Test void profilesAreOwnedByUserAndWordWritesPreserveNotesAndRecordServerActivity() {
        word("sustainable");
        dictionary.setGoal("owner",120);
        dictionary.remember("owner","sustainable");
        dictionary.remind("owner","sustainable",Instant.now().plusSeconds(86400));
        dictionary.updateWord("owner","sustainable",new UpdateVocabularyStateRequest(true,"My note",null));
        var saved=dictionary.updateWord("owner","sustainable",new UpdateVocabularyStateRequest(null,null,VocabularyComprehensionLevel.LEARNING));
        assertThat(saved.note()).isEqualTo("My note"); assertThat(saved.saved()).isTrue(); assertThat(saved.reviewCount()).isEqualTo(1);
        var profile=dictionary.getProfile("owner");
        assertThat(profile.goal()).isEqualTo(120); assertThat(profile.recent()).containsExactly("sustainable");
        assertThat(profile.reminders()).isEmpty(); assertThat(profile.activity()).hasSize(1);
        assertThat(dictionary.getProfile("other").goal()).isEqualTo(30); assertThat(dictionary.getProfile("other").activity()).isEmpty();
        assertThatThrownBy(() -> dictionary.setGoal("owner",0)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> dictionary.remind("owner","sustainable",Instant.now().minusSeconds(60))).isInstanceOf(ApiException.class);
    }
    @Test void backendRecomputesAnswersPreservesFirstScoresAndAtomicallyCompletesLesson() {
        word("sustainable"); var start=Instant.now().toString();
        var first=dictionary.saveSession("owner","sustainable",false,new SaveDictionarySessionRequest(null,false,data("sustainable",false,"wrong","wrong","wrong",start)));
        assertThat(first.session().probe().get("sustainable").correct()).isFalse();
        var completed=dictionary.saveSession("owner","sustainable",false,new SaveDictionarySessionRequest(first.revision(),false,
                data("sustainable",true,"ben vung","sustainable","We need sustainable solutions.",start)));
        assertThat(completed.session().probe().get("sustainable").correct()).isTrue();
        assertThat(completed.session().probe().get("sustainable").firstCorrect()).isFalse();
        assertThat(completed.session().completedAt()).isNotBlank();
        var state=stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","sustainable").orElseThrow();
        assertThat(state.getComprehensionLevel()).isEqualTo(VocabularyComprehensionLevel.KNOWN); assertThat(state.getReviewCount()).isEqualTo(1);
        dictionary.saveSession("owner","sustainable",false,new SaveDictionarySessionRequest(completed.revision(),false,completed.session()));
        assertThat(stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","sustainable").orElseThrow().getReviewCount()).isEqualTo(1);
        assertThat(dictionary.getSession("other","sustainable",false).session()).isNull();
        assertThat(dictionary.getSession("owner","sustainable",true).session()).isNull();
        assertThat(dictionary.completedSessions("owner")).hasSize(1);
    }
    @Test void sessionsOfDeletedWordsAreHiddenInsteadOfFailingTheWholeList() {
        word("sustainable", "Sustainability", "B2"); word("resilient", "Resilience", "B2"); var start=Instant.now().toString();
        dictionary.saveSession("owner","sustainable",false,new SaveDictionarySessionRequest(null,false,data("sustainable",true,"ben vung","sustainable","We need sustainable solutions.",start)),null,"Sustainability");
        dictionary.saveSession("owner","resilient",false,new SaveDictionarySessionRequest(null,false,data("resilient",true,"ben vung","resilient","We need resilient solutions.",start)),null,"Resilience");
        assertThat(dictionary.completedSessions("owner")).hasSize(2);
        transaction.executeWithoutResult(status -> {
            var em=SharedEntityManagerCreator.createSharedEntityManager(emf);
            em.find(LearningResource.class,"sustainable").setDeleted(true);
        });
        catalog.evictRoadmapWords(); // the entity was changed directly, not through deleteResource
        assertThat(dictionary.completedSessions("owner")).extracting(s -> s.lessonId()).containsExactly("resilient");
        assertThat(dictionary.recentSessions("owner")).extracting(s -> s.lessonId()).containsExactly("resilient");
        assertThatThrownBy(() -> dictionary.getSession("owner","sustainable",false)).isInstanceOf(ApiException.class);
    }
    @Test void staleRevisionCannotOverwriteAnotherDeviceAndNewVersionsInvalidateSavedAnswers() {
        word("sustainable"); var start=Instant.now().toString();
        var first=dictionary.saveSession("owner","sustainable",false,new SaveDictionarySessionRequest(null,false,data("sustainable",false,"wrong","wrong","wrong",start)));
        var second=dictionary.saveSession("owner","sustainable",false,new SaveDictionarySessionRequest(first.revision(),false,data("sustainable",false,"ben vung","sustainable","A sustainable future.",start)));
        assertThatThrownBy(() -> dictionary.saveSession("owner","sustainable",false,new SaveDictionarySessionRequest(first.revision(),false,first.session())))
                .isInstanceOf(ApiException.class).hasMessageContaining("thiết bị khác");
        assertThat(dictionary.getSession("owner","sustainable",false).revision()).isEqualTo(second.revision());
        transaction.executeWithoutResult(status -> {
            var em=SharedEntityManagerCreator.createSharedEntityManager(emf);
            var version=em.find(LearningResourceVersion.class,"v-sustainable");
            var next=LearningResourceVersion.builder().resourceId("sustainable").version(2).status(LearningResourceVersionStatus.PUBLISHED).content(version.getContent()).build(); next.setId("v-next"); em.persist(next);
            em.find(LearningResource.class,"sustainable").setPublishedVersionId("v-next");
        });
        var invalidated=dictionary.getSession("owner","sustainable",false);
        assertThat(invalidated.session()).isNull(); assertThat(invalidated.revision()).isEqualTo(second.revision());
    }
    @Test void invalidLessonCannotWriteAnyStateAndResetReallyBeginsANewAttempt() {
        word("sustainable"); resource("copy",LearningResourceType.VOCABULARY,false,true,false,false);
        var start=Instant.now().toString();
        assertThatThrownBy(() -> dictionary.saveSession("owner","copy",false,new SaveDictionarySessionRequest(null,false,data("copy",true,"ben vung","copy","A copy exists.",start))))
                .isInstanceOf(ApiException.class);
        assertThat(sessionRepository.count()).isZero(); assertThat(stateRepository.count()).isZero();
        var first=dictionary.saveSession("owner","sustainable",false,new SaveDictionarySessionRequest(null,false,data("sustainable",false,"wrong","wrong","wrong",start)));
        var reset=dictionary.saveSession("owner","sustainable",false,new SaveDictionarySessionRequest(first.revision(),true,data("sustainable",false,"ben vung","sustainable","A sustainable future.",Instant.now().toString())));
        assertThat(reset.session().probe().get("sustainable").firstCorrect()).isTrue();
    }
    @Test void incompleteOrSkippedAnswersStayLearningAndWordBoundariesAreRespected() {
        word("art");
        var completed=dictionary.saveSession("owner","art",false,new SaveDictionarySessionRequest(null,false,data("art",true,"wrong","art","The cart works.",Instant.now().toString())));
        assertThat(completed.session().communicate().get("art").correct()).isFalse();
        assertThat(stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","art").orElseThrow().getComprehensionLevel()).isEqualTo(VocabularyComprehensionLevel.LEARNING);
        assertThat(DictionaryService.usesWord("art","art")).isFalse(); assertThat(DictionaryService.usesWord("art","Art helps us.")).isTrue();
    }
    @Test void newlyFamiliarLevelRoundTripsWithoutMarkingTheWordKnown() {
        word("sustainable");
        var result=dictionary.updateWord("owner","sustainable",new UpdateVocabularyStateRequest(null,null,VocabularyComprehensionLevel.NEW));
        assertThat(result.comprehensionLevel()).isEqualTo(VocabularyComprehensionLevel.NEW);
        assertThat(stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","sustainable").orElseThrow().getComprehensionLevel())
                .isEqualTo(VocabularyComprehensionLevel.NEW);
    }
    @Test void openingAFlashcardStartsLearningWithoutRatingItAndRepeatedOpeningKeepsItsSchedule() {
        word("sustainable");
        var first = dictionary.startWord("owner", "sustainable");
        assertThat(first.comprehensionLevel()).isEqualTo(VocabularyComprehensionLevel.LEARNING);
        assertThat(first.reviewCount()).isZero();
        var scheduled = stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","sustainable").orElseThrow().getReviewAt();
        dictionary.startWord("owner", "sustainable");
        assertThat(stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","sustainable").orElseThrow().getReviewAt()).isEqualTo(scheduled);
        assertThat(stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("other","sustainable")).isEmpty();
    }
    @Test void legacyInProgressLessonsAreAddedToTheMapWithoutReopeningEachLesson() {
        word("sustainable");
        dictionary.saveSession("owner","sustainable",false,new SaveDictionarySessionRequest(null,false,
                data("sustainable",false,"wrong","wrong","wrong",Instant.now().toString())));
        transaction.executeWithoutResult(status -> stateRepository.deleteAll());
        dictionary.syncLearningProgress("other");
        assertThat(stateRepository.count()).isZero();
        dictionary.syncLearningProgress("owner");
        var state = stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","sustainable").orElseThrow();
        assertThat(state.getComprehensionLevel()).isEqualTo(VocabularyComprehensionLevel.LEARNING);
        assertThat(state.getReviewCount()).isZero();
        dictionary.syncLearningProgress("owner");
        assertThat(stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","sustainable").orElseThrow().getReviewAt())
                .isEqualTo(state.getReviewAt());
    }
    @Test void legacyKnownWordsReceiveADueDateFromTheirLastReviewWithoutAnotherReviewBeingRecorded() {
        word("sustainable");
        dictionary.updateWord("owner","sustainable",new UpdateVocabularyStateRequest(true,null,VocabularyComprehensionLevel.KNOWN));
        transaction.executeWithoutResult(status -> {
            var state = stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","sustainable").orElseThrow();
            state.setReviewAt(null);
            state.setLastReviewedAt(Instant.now().minusSeconds(172800));
            stateRepository.save(state);
        });
        dictionary.syncLearningProgress("owner");
        var state = stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","sustainable").orElseThrow();
        assertThat(state.getComprehensionLevel()).isEqualTo(VocabularyComprehensionLevel.KNOWN);
        assertThat(state.getReviewAt()).isBefore(Instant.now());
        assertThat(state.getReviewCount()).isEqualTo(1);
    }
    @Test void dueVocabularyStatesListOnlyTheUsersWordsWhoseReviewDateHasPassed() {
        word("sustainable"); word("resilient");
        for (String id:List.of("sustainable","resilient")) dictionary.updateWord("owner",id,new UpdateVocabularyStateRequest(true,null,VocabularyComprehensionLevel.KNOWN));
        transaction.executeWithoutResult(status -> {
            for (var entry:Map.of("sustainable",Instant.now().minusSeconds(60),"resilient",Instant.now().plusSeconds(3600)).entrySet()) {
                var state = stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner",entry.getKey()).orElseThrow();
                state.setReviewAt(entry.getValue()); stateRepository.save(state);
            }
        });
        assertThat(states.getDueVocabularyStates("owner")).extracting(s -> s.getLearningResourceId()).containsExactly("sustainable");
        assertThat(states.getDueVocabularyStates("other")).isEmpty();
    }
    @Test void startingLessonCreatesLearningStateBeforeCompletionAndRepeatedSavesDoNotCountAsReviews() {
        word("sustainable");
        var start = Instant.now().toString();
        var data = new DictionarySessionData(1,List.of("sustainable"),"manifest",1,0,List.of(),
                Map.of(),Map.of(),Map.of(),false,start,null,null);
        var first = dictionary.saveSession("owner","sustainable",false,new SaveDictionarySessionRequest(null,false,data));
        var state = stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","sustainable").orElseThrow();
        assertThat(state.getComprehensionLevel()).isEqualTo(VocabularyComprehensionLevel.LEARNING);
        assertThat(state.getReviewCount()).isZero();
        assertThat(state.getReviewAt()).isEqualTo(state.getLastReviewedAt().plusSeconds(86400));
        dictionary.saveSession("owner","sustainable",false,new SaveDictionarySessionRequest(first.revision(),false,data));
        var again = stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","sustainable").orElseThrow();
        assertThat(again.getReviewAt()).isEqualTo(state.getReviewAt());
        assertThat(again.getReviewCount()).isZero();
        assertThat(dictionary.getProfile("other").activity()).isEmpty();
    }

    @Test void scopeDoesNotStartLearningAndBeginningReviewPreservesKnownStateAndDueDate() {
        word("sustainable");
        var scope = new DictionarySessionData(1,List.of("sustainable"),"manifest",0,0,List.of(),
                Map.of(),Map.of(),Map.of(),false,Instant.now().toString(),null,null);
        dictionary.saveSession("owner","sustainable",false,new SaveDictionarySessionRequest(null,false,scope));
        assertThat(stateRepository.count()).isZero();
        dictionary.updateWord("owner","sustainable",new UpdateVocabularyStateRequest(true,null,VocabularyComprehensionLevel.KNOWN));
        var scheduled = stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","sustainable").orElseThrow().getReviewAt();
        var review = new DictionarySessionData(1,List.of("sustainable"),"manifest",1,0,List.of(),
                Map.of(),Map.of(),Map.of(),false,Instant.now().toString(),null,null);
        dictionary.saveSession("owner","sustainable",true,new SaveDictionarySessionRequest(null,false,review));
        var state = stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","sustainable").orElseThrow();
        assertThat(state.getComprehensionLevel()).isEqualTo(VocabularyComprehensionLevel.KNOWN);
        assertThat(state.getReviewAt()).isEqualTo(scheduled);
        assertThat(state.getReviewCount()).isEqualTo(1);
    }

    @Test void successfulDueReviewsExtendIntervalsAndUnsuccessfulRecallResetsSchedule() {
        word("sustainable");
        var first = dictionary.updateWord("owner","sustainable",new UpdateVocabularyStateRequest(true,null,VocabularyComprehensionLevel.KNOWN));
        assertThat(first.reviewAt()).isEqualTo(first.lastReviewedAt().plusSeconds(86400));
        for (long days : List.of(3L,7L,14L,30L)) {
            transaction.executeWithoutResult(status -> {
                var state = stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse("owner","sustainable").orElseThrow();
                long previous = java.time.Duration.between(state.getLastReviewedAt(),state.getReviewAt()).toDays();
                state.setReviewAt(Instant.now().minusSeconds(60));
                state.setLastReviewedAt(state.getReviewAt().minusSeconds(previous * 86400));
                stateRepository.save(state);
            });
            var result = dictionary.updateWord("owner","sustainable",new UpdateVocabularyStateRequest(null,null,VocabularyComprehensionLevel.KNOWN));
            assertThat(result.reviewAt()).isEqualTo(result.lastReviewedAt().plusSeconds(days * 86400));
        }
        var failed = dictionary.updateWord("owner","sustainable",new UpdateVocabularyStateRequest(null,null,VocabularyComprehensionLevel.LEARNING));
        assertThat(failed.reviewAt()).isEqualTo(failed.lastReviewedAt().plusSeconds(86400));
        var unknown = dictionary.updateWord("owner","sustainable",new UpdateVocabularyStateRequest(null,null,VocabularyComprehensionLevel.UNKNOWN));
        assertThat(unknown.reviewAt()).isNull();
    }
    @Test void completionFailureRollsBackEveryWordAndTheSessionTogether() {
        word("sustainable"); word("climate");
        var factory = new JpaRepositoryFactory(SharedEntityManagerCreator.createSharedEntityManager(emf));
        var realStates = proxy(new LearningResourceStateService(stateRepository,factory.getRepository(LearningResourceRepository.class)));
        var failingStates = mock(LearningResourceStateService.class);
        org.mockito.Mockito.when(failingStates.updateVocabularyState(org.mockito.ArgumentMatchers.eq("owner"),org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.eq(true),org.mockito.ArgumentMatchers.isNull(),org.mockito.ArgumentMatchers.any()))
                .thenAnswer(call -> {
                    String id=call.getArgument(1);
                    if (id.equals("climate")) throw new ApiException(base.co.common.exception.ErrorCode.E235,"Temporary storage failure");
                    return realStates.updateVocabularyState("owner",id,true,null,call.getArgument(4));
                });
        var service=proxy(new DictionaryService(catalog,failingStates,factory.getRepository(LearningResourceRepository.class),
                factory.getRepository(DictionaryProfileRepository.class),sessionRepository,mapper));
        var data=new DictionarySessionData(1,List.of("sustainable","climate"),"content",4,0,List.of("sustainable","climate"),Map.of(),Map.of(),Map.of(),true,Instant.now().toString(),null,null);
        assertThatThrownBy(() -> service.saveSession("owner","sustainable",false,new SaveDictionarySessionRequest(null,false,data)))
                .isInstanceOf(ApiException.class);
        assertThat(stateRepository.count()).isZero();
        assertThat(sessionRepository.count()).isZero();
        assertThat(dictionary.getProfile("owner").activity()).isEmpty();
    }

    @Test void searchFiltersByTheUsersLearningStatusAndGuestsGetNoStatusFilter() {
        word("alpha", "Travel", "B1"); word("bravo", "Travel", "B1"); word("charlie", "Travel", "B1");
        states.updateVocabularyState("user1", "alpha", false, null, VocabularyComprehensionLevel.KNOWN);
        states.updateVocabularyState("user1", "bravo", false, null, VocabularyComprehensionLevel.LEARNING);
        java.util.function.Function<String, java.util.List<String>> ids = status ->
                catalog.searchVocabulary(null, null, null, status, "user1", 0, 20).getItems().stream().map(r -> r.id()).toList();
        assertThat(ids.apply("known")).containsExactly("alpha");
        assertThat(ids.apply("learning")).containsExactly("bravo");
        assertThat(ids.apply("unknown")).containsExactly("charlie");
        assertThat(ids.apply("")).containsExactly("alpha", "bravo", "charlie");
        assertThat(catalog.searchVocabulary(null, null, null, "known", null, 0, 20).getItems()).hasSize(3);
        assertThat(catalog.searchVocabulary(null, null, null, "known", "user1", 0, 20).getTotalElements()).isEqualTo(1);
    }

    @Test void lessonsSplitEachTopicIntoFivesInAlphabeticalOrderAndPageByLesson() {
        // Travel: 7 từ (2 bài: 5 + 2), Food: 3 từ (1 bài), một từ chưa có chủ đề (1 bài).
        for (int i = 1; i <= 7; i++) word("trip" + i, "Travel", "B1");
        for (int i = 1; i <= 3; i++) word("meal" + i, "Food", "B1");
        word("loose", "", "B1");

        var all = catalog.getDictionaryLessons(null, null, 0, 20);
        assertThat(all.totalWords()).isEqualTo(11);
        assertThat(all.totalLessons()).isEqualTo(4);
        // Thứ tự chủ đề theo tên: "" (chưa có) trước, rồi Food, rồi Travel.
        assertThat(all.lessons()).extracting(l -> l.topic()).containsExactly("", "Food", "Travel", "Travel");
        assertThat(all.lessons()).extracting(l -> l.number()).containsExactly(1, 2, 3, 4);
        assertThat(all.lessons().get(2).words()).extracting(w -> w.id()).containsExactly("trip1", "trip2", "trip3", "trip4", "trip5");
        assertThat(all.lessons().get(3).words()).extracting(w -> w.id()).containsExactly("trip6", "trip7");
        assertThat(all.lessons().get(3).id()).isEqualTo("trip6");

        // Phân trang theo bài: trang 1 (size 2) = bài 3 và 4, đánh số liên tục.
        var second = catalog.getDictionaryLessons(null, null, 1, 2);
        assertThat(second.lessons()).extracting(l -> l.number()).containsExactly(3, 4);
        assertThat(second.totalLessons()).isEqualTo(4);

        // Lọc chủ đề: bài đánh số lại từ 1 trong phạm vi.
        var travel = catalog.getDictionaryLessons("B1", "travel", 0, 20);
        assertThat(travel.totalWords()).isEqualTo(7);
        assertThat(travel.lessons()).extracting(l -> l.number()).containsExactly(1, 2);

        // Phạm vi không có từ nào: rỗng.
        assertThat(catalog.getDictionaryLessons("C2", null, 0, 20).lessons()).isEmpty();
    }

    @Test void lessonContainingAWordReturnsItsChunkAndRejectsWordsOutOfScope() {
        for (int i = 1; i <= 7; i++) word("trip" + i, "Travel", "B1");
        var lesson = catalog.getDictionaryLessonContaining("trip7", null, null);
        assertThat(lesson.id()).isEqualTo("trip6");
        assertThat(lesson.words()).extracting(w -> w.id()).containsExactly("trip6", "trip7");
        assertThat(lesson.number()).isEqualTo(2);
        assertThat(catalog.getDictionaryLessonContaining("trip3", "B1", "Travel").id()).isEqualTo("trip1");
        org.junit.jupiter.api.Assertions.assertThrows(base.co.common.exception.ApiException.class,
                () -> catalog.getDictionaryLessonContaining("trip3", "C1", null));
        org.junit.jupiter.api.Assertions.assertThrows(base.co.common.exception.ApiException.class,
                () -> catalog.getDictionaryLessonContaining("missing", null, null));
    }

    @Test void summaryCountsAndUserProgressRespectTheScope() {
        word("a1", "Travel", "B1"); word("a2", "Travel", "B2"); word("a3", "Food", "B1");
        var inB1 = catalog.getDictionarySummaryCounts("B1", null);
        assertThat(inB1.total()).isEqualTo(2);
        assertThat(inB1.byLevel()).containsOnlyKeys("B1");
        assertThat(inB1.byTopic()).containsEntry("Travel", 1L).containsEntry("Food", 1L);
        assertThat(catalog.getDictionarySummaryCounts(null, "travel").total()).isEqualTo(2);

        states.updateVocabularyState("user1", "a1", true, null, VocabularyComprehensionLevel.KNOWN);
        states.updateVocabularyState("user1", "a2", false, null, VocabularyComprehensionLevel.LEARNING);
        states.updateVocabularyState("user1", "a3", false, null, VocabularyComprehensionLevel.LEARNING);
        var whole = states.getVocabularySummary("user1", null, null, "topic");
        assertThat(whole.known()).isEqualTo(1);
        assertThat(whole.learning()).isEqualTo(2);
        assertThat(whole.groups().get("Travel").known()).isEqualTo(1);
        assertThat(whole.groups().get("Travel").learning()).isEqualTo(1);
        var inTravel = states.getVocabularySummary("user1", null, "Travel", null);
        assertThat(inTravel.known()).isEqualTo(1);
        assertThat(inTravel.learning()).isEqualTo(1);
        assertThat(states.getLearningVocabularyStates("user1", "B1", null, 50)).extracting(s -> s.getLearningResourceId()).containsExactly("a3");
    }

    @Test void distractorsSpreadAcrossUlidRangeExcludeTheWordAndNeverRepeat() {
        // Id cùng độ dài, dạng ULID: đi qua đường chọn mốc ngẫu nhiên giữa id nhỏ nhất và lớn nhất.
        for (int i = 0; i < 40; i++) word("01M3HCTGYMFYT3DWBHYY" + String.format("%03d", i));
        var seen = new java.util.HashSet<String>();
        for (int round = 0; round < 30; round++) {
            var items = catalog.getDistractors("01M3HCTGYMFYT3DWBHYY000", "Environment", 3);
            assertThat(items).hasSize(3);
            assertThat(items).extracting(d -> d.id()).doesNotContain("01M3HCTGYMFYT3DWBHYY000").doesNotHaveDuplicates();
            items.forEach(d -> seen.add(d.id()));
        }
        assertThat(seen.size()).isGreaterThan(6);
    }

    @Test void summaryCountsGroupTopicsCaseInsensitivelyAndNameUnclassifiedLikeTheFilter() {
        word("sustainable");
        var counts = catalog.getDictionarySummaryCounts(null, null);
        assertThat(counts.byLevel()).doesNotContainKey("Unclassified");
        assertThat(catalog.getDictionarySummaryCounts(null, null).byTopic().keySet()).containsExactly("Environment");
    }

    @Test void summaryCountsAndBatchWordsAndDistractorsAndUserVocabularySummaryWork() {
        word("sustainable");
        word("resilient");
        resource("draft-word", LearningResourceType.VOCABULARY, true, false, false, false);
        resource("copy-word", LearningResourceType.VOCABULARY, false, true, false, false);

        // 1. Summary counts
        var counts = catalog.getDictionarySummaryCounts(null, null);
        assertThat(counts.total()).isEqualTo(2);
        assertThat(counts.byLevel()).containsEntry("B2", 2L);
        assertThat(counts.byTopic()).containsEntry("Environment", 2L);

        // 2. Batch by IDs
        var batch = catalog.getDictionaryWordsByIds(List.of("sustainable", "resilient", "draft-word", "non-existent"));
        assertThat(batch).extracting(r -> r.id()).containsExactly("resilient", "sustainable");

        // 3. Distractors
        var distractors = catalog.getDistractors("sustainable", "Environment", 3);
        assertThat(distractors).hasSize(1);
        assertThat(distractors.get(0).id()).isEqualTo("resilient");
        assertThat(distractors.get(0).word()).isEqualTo("resilient");

        // 4. User vocabulary summary
        states.updateVocabularyState("user1", "sustainable", true, null, VocabularyComprehensionLevel.KNOWN);
        states.updateVocabularyState("user1", "resilient", false, null, VocabularyComprehensionLevel.LEARNING);
        var userSummary = states.getVocabularySummary("user1", null, null, null);
        assertThat(userSummary.known()).isEqualTo(1);
        assertThat(userSummary.learning()).isEqualTo(1);
        assertThat(userSummary.saved()).isEqualTo(1);

        // 5. Optimized Profile queries only existing words
        dictionary.remember("user1", "sustainable");
        dictionary.remember("user1", "resilient");
        var profile = dictionary.getProfile("user1");
        assertThat(profile.recent()).containsExactly("resilient", "sustainable");
    }
}
