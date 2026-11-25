package pl.co.lms.integration;

import pl.co.lms.dto.request.SaveStudyMaterialRequest;
import pl.co.lms.dto.request.SubmitStudyMaterialRecallRequest;
import pl.co.lms.dto.request.UpdateStudyMaterialProgressRequest;
import pl.co.lms.dto.request.UpdateStudyMaterialStateRequest;
import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.persistenceunit.PersistenceManagedTypes;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import pl.co.lms.dto.request.CreateLearningResourceRequest;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.*;
import pl.co.lms.repository.*;
import pl.co.lms.service.LearningResourceService;
import pl.co.lms.service.LearningResourceStateService;
import pl.co.lms.service.studymaterials.*;
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static pl.co.lms.service.studymaterials.StudyMaterialSpecifications.Filter;

/** Real service, JPA, locks and queries in isolated H2. Never loads application-dev or external services. */
class StudyMaterialFlowTest {
    static EntityManagerFactory factory;
    EntityManager em;
    LearningResourceRepository resources;
    LearningResourceVersionRepository versions;
    LearningResourceStateRepository states;
    StudyMaterialProgressRepository progress;
    LearningResourceService library;
    LearningResourceStateService personal;
    StudyMaterialVocabularyService vocabulary;
    StudyMaterialVocabularyUnitService unitSource;
    StudyMaterialService service;

    @BeforeAll static void database() {
        var bean = new LocalContainerEntityManagerFactoryBean();
        bean.setDataSource(new DriverManagerDataSource("jdbc:h2:mem:study-materials;MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", ""));
        bean.setManagedTypes(PersistenceManagedTypes.of(LearningResource.class.getName(), LearningResourceVersion.class.getName(), LearningResourceState.class.getName(), StudyMaterialProgress.class.getName(), ContentPackage.class.getName(), ContentPackageVersion.class.getName(), ContentPackageVersionResource.class.getName()));
        bean.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        bean.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop", "hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
        bean.afterPropertiesSet(); factory = bean.getObject();
    }
    @BeforeEach void setup() {
        em = factory.createEntityManager(); em.getTransaction().begin();
        var repositories = new JpaRepositoryFactory(em);
        resources = repositories.getRepository(LearningResourceRepository.class);
        versions = repositories.getRepository(LearningResourceVersionRepository.class);
        states = repositories.getRepository(LearningResourceStateRepository.class);
        progress = repositories.getRepository(StudyMaterialProgressRepository.class);
        var mapper = new ObjectMapper().findAndRegisterModules();
        library = new LearningResourceService(resources, versions, mock(ContentPackageVersionResourceRepository.class), mapper);
        personal = new LearningResourceStateService(states, resources);
        unitSource = org.mockito.Mockito.spy(new StudyMaterialVocabularyUnitService(repositories.getRepository(ContentPackageRepository.class), repositories.getRepository(ContentPackageVersionRepository.class), repositories.getRepository(ContentPackageVersionResourceRepository.class), resources, versions, mapper));
        vocabulary = new StudyMaterialVocabularyService(resources, versions, states, mapper, unitSource);
        service = new StudyMaterialService(library, personal, resources, versions, states, progress, repositories.getRepository(StudyMaterialFacetRepository.class), vocabulary, mapper);
    }
    @AfterEach void rollback() { em.getTransaction().rollback(); em.close(); }
    @AfterAll static void close() { factory.close(); }
    private LearningResource word(String text, String meaning) {
        var content = VocabularyEnContent.builder().word(text).commonMeaning(meaning)
                .definitions(List.of(VocabularyEnContent.VocabularyDefinitionItem.builder().meaningVi(meaning).definitionEn("A definition").build())).build();
        return library.createResourceWithContent(new CreateLearningResourceRequest(LearningResourceType.VOCABULARY, content, true, true));
    }
    private StudyMaterialContent article(String title) {
        return StudyMaterialContent.builder().category(StudyMaterialCategory.BILINGUAL).title(title).topic("Environment").band("5.0 – 6.0").source("The IELTS Space PRO")
                .paragraphs(List.of(new StudyMaterialContent.Paragraph("A sustainable future needs sustainable habits.", "Một tương lai bền vững."))).build();
    }
    private String publish(StudyMaterialContent content) {
        var created = service.create(new SaveStudyMaterialRequest(content, List.of("environment")));
        service.publish(created.resource().id(), created.draft().id());
        return created.resource().id();
    }
    @Test void authoringReusesVersionsDetectsLibraryWordsAndKeepsDraftsPrivate() {
        var word = word("sustainable", "bền vững");
        var created = service.create(new SaveStudyMaterialRequest(article("A greener future"), List.of()));
        assertThat(created.resource().publishedVersionId()).isNull();
        assertThat(service.catalog("alice", Filter.all(), 0, 9).getItems()).isEmpty();
        assertThatThrownBy(() -> service.detail("alice", created.resource().id())).isInstanceOf(ApiException.class);
        var draft = (StudyMaterialContent) created.draft().content();
        assertThat(draft.getVocabularyLinks()).extracting(StudyMaterialContent.VocabularyLink::resourceId).containsExactly(word.getId());
        service.publish(created.resource().id(), created.draft().id());
        assertThat(service.detail("alice", created.resource().id()).vocabulary()).hasSize(1);
        assertThat(service.detail("alice", created.resource().id()).highlights()).isEmpty();
    }
    @Test void highlightsOnlyTheCurrentLearnersExplicitKnownWordsAndReturnsOriginalPositions() {
        var word = word("sustainable", "bền vững"); var id = publish(article("Sustainability"));
        personal.updateVocabularyState("alice", word.getId(), false, null, VocabularyComprehensionLevel.KNOWN);
        personal.updateVocabularyState("bob", word.getId(), true, null, VocabularyComprehensionLevel.LEARNING);
        var alice = service.detail("alice", id); var bob = service.detail("bob", id);
        assertThat(alice.highlights()).hasSize(2).allMatch(match -> match.resourceId().equals(word.getId()));
        assertThat(alice.highlights()).allSatisfy(match -> assertThat(alice.content().getParagraphs().get(match.paragraphIndex()).en().substring(match.start(), match.end())).isEqualTo(match.surface()));
        assertThat(bob.highlights()).isEmpty();
        assertThat(bob.vocabulary()).singleElement().satisfies(value -> { assertThat(value.saved()).isTrue(); assertThat(value.learned()).isFalse(); });
    }
    @Test void catalogFiltersSavedStateFacetsAndHomeNeverMixOwners() {
        var id = publish(article("Môi trường xanh"));
        service.saveState("alice", id, new UpdateStudyMaterialStateRequest(true, "Ghi chú của Alice")); service.open("alice", id);
        var filter = new Filter(StudyMaterialCategory.BILINGUAL, "moi truong", "Environment", "5.0 – 6.0", List.of("The IELTS Space PRO"), "Reading", null, "free", true);
        assertThat(service.catalog("alice", filter, 0, 9).getItems()).extracting(value -> value.id()).containsExactly(id);
        assertThat(service.catalog("bob", filter, 0, 9).getItems()).isEmpty();
        assertThat(service.facets(StudyMaterialCategory.BILINGUAL).topics()).containsExactly("Environment");
        assertThat(service.home("alice").saved()).hasSize(1);
        assertThat(service.home("alice").continuing()).hasSize(1);
        assertThat(service.home("bob").continuing()).isEmpty();
        service.saveState("alice", id, new UpdateStudyMaterialStateRequest(false, null));
        assertThat(service.detail("alice", id).summary().personal().note()).isEqualTo("Ghi chú của Alice");
        assertThat(service.detail("bob", id).summary().personal().note()).isEmpty();
    }
    @Test void editingDoesNotChangePublishedContentAndRepublishingRejectsStaleProgress() {
        var id = publish(article("Original")); var before = service.detail("alice", id);
        service.saveProgress("alice", id, new UpdateStudyMaterialProgressRequest(before.summary().versionId(), 1.0, true));
        var changed = article("Edited draft"); changed.setTopic("Health");
        var edit = service.update(id, new SaveStudyMaterialRequest(changed, null));
        assertThat(service.detail("alice", id).content().getTitle()).isEqualTo("Original");
        assertThat(service.facets(StudyMaterialCategory.BILINGUAL).topics()).containsExactly("Environment");
        service.publish(id, edit.draft().id());
        assertThat(service.detail("alice", id).summary().personal().progress()).isNull();
        assertThatThrownBy(() -> service.saveProgress("alice", id, new UpdateStudyMaterialProgressRequest(before.summary().versionId(), 1.0, true)))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.getErrorCode()).isEqualTo(ErrorCode.CONFLICT));
        assertThat(service.open("alice", id).percent()).isZero();
    }
    @Test void fixedSourceFiltersSupportLegacyLabelsOtherSourcesAndIndependentBand() {
        var pro = article("PRO"); var proId = publish(pro);
        var cambridge = article("Cambridge"); cambridge.setSource("C10–C20"); var cambridgeId = publish(cambridge);
        var youpass = article("YouPass"); youpass.setSource("YouPass Collect đề thi"); var youpassId = publish(youpass);
        var other = article("Other"); other.setSource("BBC Learning"); var otherId = publish(other);
        var missing = article("Unspecified"); missing.setSource(null); var missingId = publish(missing);
        var actual = article("Actual"); actual.setSource("Actual Tests"); actual.setBand("7.0 – 8.0"); var actualId = publish(actual);
        var proFilter = new Filter(null, null, null, null, List.of("IELTS Space PRO"), null, null, null, false);
        assertThat(service.catalog("alice", proFilter, 0, 9).getItems()).extracting(value -> value.id()).containsExactly(proId);
        var combined = new Filter(null, null, null, null, List.of("C10-C20", "YouPass Collect đề thi"), null, null, null, false);
        assertThat(service.catalog("alice", combined, 0, 9).getItems()).extracting(value -> value.id()).containsExactlyInAnyOrder(cambridgeId, youpassId);
        var otherFilter = new Filter(null, null, null, null, List.of("Các nguồn khác"), null, null, null, false);
        assertThat(service.catalog("alice", otherFilter, 0, 9).getItems()).extracting(value -> value.id()).containsExactlyInAnyOrder(otherId, missingId);
        var band = new Filter(null, null, null, "7.0 – 8.0", List.of("Actual Tests"), null, null, null, false);
        assertThat(service.catalog("alice", band, 0, 9).getItems()).extracting(value -> value.id()).containsExactly(actualId);
    }
    @Test void recallIsGradedOnServerAndNeverMarksVocabularyLearned() {
        var word = word("sustainable", "<b>bền vững</b>"); var id = publish(article("A story"));
        var versionId = service.detail("alice", id).summary().versionId();
        var result = service.recall("alice", id, new SubmitStudyMaterialRecallRequest(versionId, Map.of(word.getId(), "bền vững")));
        assertThat(result.score()).isEqualTo(100); assertThat(result.progress().quizAttempts()).isEqualTo(1);
        assertThat(states.findByUserIdAndLearningResourceIdAndDeletedFalse("alice", word.getId())).isEmpty();
        assertThat(service.detail("alice", id).highlights()).isEmpty();
        assertThatThrownBy(() -> service.recall("alice", id, new SubmitStudyMaterialRecallRequest(versionId, Map.of("other", "bền vững")))).isInstanceOf(ApiException.class);
    }
    @Test void editorialMetadataAndPublicationActionsRoundTripWithoutExposingDraftMetadataToReaders() {
        var content = article("Metadata round trip");
        content.setCefrLevel("B2"); content.setAcademicWordList(true); content.setPageCount(10);
        var created = service.create(new SaveStudyMaterialRequest(content, List.of()));
        var id = created.resource().id();
        assertThat(service.managementCatalog(Filter.all(), 0, 9).getItems()).singleElement().satisfies(row -> {
            assertThat(row.draftVersionId()).isEqualTo(created.draft().id());
            assertThat(row.publishedVersionId()).isNull();
        });
        service.publish(id, created.draft().id());
        var reader = service.detail("alice", id).summary();
        assertThat(reader.cefrLevel()).isEqualTo("B2"); assertThat(reader.academicWordList()).isTrue();
        assertThat(reader.pageCount()).isEqualTo(10); assertThat(reader.updatedAt()).isNotNull();
        assertThat(reader.draftVersionId()).isNull(); assertThat(reader.publishedVersionId()).isEqualTo(created.draft().id());
        content.setCefrLevel("C1"); content.setAcademicWordList(false);
        var edited = service.update(id, new SaveStudyMaterialRequest(content, null));
        assertThat(service.detail("alice", id).summary().cefrLevel()).isEqualTo("B2");
        assertThat(service.managementCatalog(Filter.all(), 0, 9).getItems()).singleElement().satisfies(row -> {
            assertThat(row.draftVersionId()).isEqualTo(edited.draft().id());
            assertThat(row.publishedVersionId()).isEqualTo(created.draft().id());
        });
        service.publish(id, edited.draft().id());
        assertThat(service.detail("alice", id).summary().cefrLevel()).isEqualTo("C1");
        assertThat(service.detail("alice", id).summary().academicWordList()).isFalse();
    }
    @Test void videoProgressIsBoundedMonotonicAndSeparateForEachLearner() {
        var video = StudyMaterialContent.builder().category(StudyMaterialCategory.VIDEO).title("A video").videoUrl("https://example.com/video.webm").durationSeconds(30).chapters(List.of(new StudyMaterialContent.Chapter(0, "Intro"))).build();
        var id = publish(video); var version = service.detail("alice", id).summary().versionId();
        assertThat(service.saveProgress("alice", id, new UpdateStudyMaterialProgressRequest(version, 15.0, false)).percent()).isEqualTo(50);
        assertThat(service.saveProgress("alice", id, new UpdateStudyMaterialProgressRequest(version, 6.0, false)).percent()).isEqualTo(50);
        assertThatThrownBy(() -> service.saveProgress("alice", id, new UpdateStudyMaterialProgressRequest(version, 6.0, true))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.saveProgress("alice", id, new UpdateStudyMaterialProgressRequest(version, Double.NaN, false))).isInstanceOf(ApiException.class);
        assertThat(service.saveProgress("alice", id, new UpdateStudyMaterialProgressRequest(version, 30.0, true)).completed()).isTrue();
        assertThat(service.detail("bob", id).summary().personal().progress()).isNull();
        assertThat(progress.findByUserIdAndResourceIdAndDeletedFalse("alice", id)).isPresent();
    }
    @Test void softDeletedAndNonLibraryContentIsUnavailableAndExplicitLinksMustOccur() {
        var word = word("sustainable", "bền vững");
        var bad = article("No match"); bad.setParagraphs(List.of(new StudyMaterialContent.Paragraph("No matching word here.", null)));
        bad.setVocabularyLinks(List.of(new StudyMaterialContent.VocabularyLink(word.getId(), List.of())));
        assertThatThrownBy(() -> service.create(new SaveStudyMaterialRequest(bad, null))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.detail("alice", word.getId())).isInstanceOf(ApiException.class);
        var id = publish(article("Deleted")); service.delete(id); em.flush();
        assertThat(service.catalog("alice", Filter.all(), 0, 9).getItems()).isEmpty();
        assertThatThrownBy(() -> service.detail("alice", id)).isInstanceOf(ApiException.class);
    }
    @Test void detectSupportsExplicitInflectionsAndDoesNotUseUnpublishedWords() {
        var candidate = word("candidate", "ứng viên");
        library.createResourceWithContent(new CreateLearningResourceRequest(LearningResourceType.VOCABULARY, VocabularyEnContent.builder().word("secret").build(), false, true));
        var result = vocabulary.detect(List.of(new StudyMaterialContent.Paragraph("Candidates share a secret.", null)), Map.of(candidate.getId(), List.of("candidates")));
        assertThat(result).singleElement().satisfies(value -> assertThat(value.word().resourceId()).isEqualTo(candidate.getId()));
    }

    @Test void detectFindsLibraryWordsByWordKeyIncludingPhrasesAndIgnoresWordsNotInTheText() {
        var phrase = word("Take Part In", "tham gia");
        var single = word("event", "sự kiện");
        word("unrelated", "không liên quan");
        var result = vocabulary.detect(List.of(new StudyMaterialContent.Paragraph("We  take part in the EVENT.", "Chúng tôi tham gia.")), Map.of());
        assertThat(result).extracting(value -> value.word().resourceId()).containsExactlyInAnyOrder(phrase.getId(), single.getId());
    }

    private StudyMaterialContent.VocabularyUnit unit(Map<Integer, List<LearningResource>> words) {
        var pkg = ContentPackage.builder().type(ContentPackageType.VOCABULARY).build(); em.persist(pkg);
        var version = ContentPackageVersion.builder().packageId(pkg.getId()).title("Gói từ vựng").version(1).status(ContentPackageVersionStatus.PUBLISHED).sessionCount(2).build(); em.persist(version);
        pkg.setPublishedVersionId(version.getId());
        words.forEach((session, values) -> {
            for (int i = 0; i < values.size(); i++) {
                var word = values.get(i);
                em.persist(ContentPackageVersionResource.builder().contentPackageVersionId(version.getId()).learningResourceId(word.getId())
                        .learningResourceVersionId(word.getPublishedVersionId()).sessionNo(session).displayOrder(i + 1).build());
            }
        });
        em.flush();
        return new StudyMaterialContent.VocabularyUnit(version.getId(), 1);
    }
    @Test void diglotUsesOnlyTheSelectedUnitIncludingPrivateCopiesAndHighlightsUnlearnedWords() {
        var inside = word("sustainable", "bền vững của Unit 1"); inside.setInLibrary(false);
        var unused = word("absorption", "hấp thu");
        var outside = word("candidate", "ứng viên của Unit 2");
        var source = unit(Map.of(1, List.of(inside, unused), 2, List.of(outside)));
        var content = article("Diglot Unit 1"); content.setCategory(StudyMaterialCategory.DIGLOT); content.setVocabularyUnit(source);
        content.setParagraphs(List.of(new StudyMaterialContent.Paragraph("Sustainable habits help a candidate. sustainable!", null)));
        var detected = vocabulary.detect(content.getParagraphs(), Map.of(), source);
        assertThat(detected).extracting(value -> value.word().resourceId()).containsExactly(inside.getId());
        content.setVocabularyLinks(List.of());
        var id = publish(content);
        org.mockito.Mockito.clearInvocations(unitSource);
        personal.updateVocabularyState("alice", outside.getId(), true, null, VocabularyComprehensionLevel.KNOWN);
        var detail = service.detail("alice", id);
        assertThat(detail.content().getVocabularyUnit()).isEqualTo(source);
        assertThat(detail.vocabulary()).singleElement().satisfies(value -> {
            assertThat(value.resourceId()).isEqualTo(inside.getId()); assertThat(value.learned()).isFalse();
        });
        assertThat(detail.highlights()).hasSize(2).allMatch(value -> value.resourceId().equals(inside.getId()));
        assertThat(detail.content().getVocabularyIndex().highlights()).hasSize(2);
        for (int i = 0; i < 10; i++) assertThat(service.detail("learner-" + i, id).highlights()).isEqualTo(detail.highlights());
        org.mockito.Mockito.verifyNoInteractions(unitSource);
        assertThat(states.findByUserIdAndLearningResourceIdAndDeletedFalse("alice", inside.getId())).isEmpty();
        var pinnedVersion = inside.getPublishedVersionId();
        var newVersion = library.createDraftVersion(inside.getId(), VocabularyEnContent.builder().word("changed").commonMeaning("Nghĩa mới").build());
        library.publishVersion(inside.getId(), newVersion.getId());
        assertThat(service.detail("alice", id).vocabulary()).singleElement().satisfies(value -> {
            assertThat(value.versionId()).isEqualTo(pinnedVersion); assertThat(value.content().getCommonMeaning()).isEqualTo("bền vững của Unit 1");
        });
        assertThat(vocabulary.unitOptions()).singleElement().satisfies(option -> assertThat(option.units()).hasSize(2));
    }
    @Test void diglotRejectsMissingOrForeignUnitsAndNeverFallsBackToTheLibrary() {
        var word = word("sustainable", "bền vững");
        var source = unit(Map.of(1, List.of(word)));
        var content = article("Missing Unit"); content.setCategory(StudyMaterialCategory.DIGLOT);
        assertThatThrownBy(() -> service.create(new SaveStudyMaterialRequest(content, null))).isInstanceOf(ApiException.class);
        assertThat(vocabulary.forReader("alice", content).words()).isEmpty();
        content.setVocabularyUnit(new StudyMaterialContent.VocabularyUnit(source.packageVersionId(), 99));
        assertThatThrownBy(() -> service.create(new SaveStudyMaterialRequest(content, null))).isInstanceOf(ApiException.class);
        content.setVocabularyUnit(source);
        var foreign = word("future", "tương lai");
        content.setVocabularyLinks(List.of(new StudyMaterialContent.VocabularyLink(foreign.getId(), List.of())));
        assertThatThrownBy(() -> vocabulary.validateLinks(content)).isInstanceOf(ApiException.class);
        var version = em.find(ContentPackageVersion.class, source.packageVersionId()); version.setStatus(ContentPackageVersionStatus.DRAFT); em.flush();
        assertThatThrownBy(() -> vocabulary.detect(content.getParagraphs(), Map.of(), source)).isInstanceOf(ApiException.class);
        assertThat(vocabulary.unitOptions()).isEmpty();
    }
    @Test void publishingANewUnitRebuildsSharedResultsAsANewArticleVersionAndPreservesTheAuthorsDraft() {
        var first = word("sustainable", "bền vững"); var second = word("candidate", "ứng viên");
        var source = unit(Map.of(1, List.of(first), 2, List.of(second)));
        var content = article("Published Unit story"); content.setCategory(StudyMaterialCategory.DIGLOT); content.setVocabularyUnit(source);
        content.setParagraphs(List.of(new StudyMaterialContent.Paragraph("A sustainable candidate.", null)));
        var id = publish(content);
        var previous = service.detail("alice", id);
        var oldId = previous.summary().versionId();
        content.setTitle("Private unfinished draft");
        var draft = service.update(id, new SaveStudyMaterialRequest(content, null));
        var packageId = em.find(ContentPackageVersion.class, source.packageVersionId()).getPackageId();
        var nextPackage = ContentPackageVersion.builder().packageId(packageId).version(2).status(ContentPackageVersionStatus.PUBLISHED).title("New words").sessionCount(2).build(); em.persist(nextPackage);
        em.persist(ContentPackageVersionResource.builder().contentPackageVersionId(nextPackage.getId()).learningResourceId(second.getId()).learningResourceVersionId(second.getPublishedVersionId()).sessionNo(1).displayOrder(1).build());
        em.find(ContentPackage.class, packageId).setPublishedVersionId(nextPackage.getId()); em.flush();
        var refresh = new StudyMaterialVocabularyRefreshService(resources, versions, new JpaRepositoryFactory(em).getRepository(ContentPackageVersionRepository.class), library, vocabulary, new ObjectMapper().findAndRegisterModules());
        refresh.refreshPackage(packageId, nextPackage.getId());
        var updated = service.detail("alice", id);
        assertThat(updated.summary().versionId()).isNotEqualTo(oldId);
        assertThat(updated.summary().title()).isEqualTo("Published Unit story");
        assertThat(updated.vocabulary()).extracting(value -> value.resourceId()).containsExactly(second.getId());
        assertThat(updated.highlights()).singleElement().satisfies(value -> assertThat(value.surface()).isEqualTo("candidate"));
        assertThat(versions.findByIdAndDeletedFalse(oldId).orElseThrow().getContentAs(StudyMaterialContent.class, new ObjectMapper()).getVocabularyIndex().highlights()).singleElement().satisfies(value -> assertThat(value.surface()).isEqualTo("sustainable"));
        assertThat(service.managementDetail(id).draft().id()).isEqualTo(draft.draft().id());
        assertThat(((StudyMaterialContent) service.managementDetail(id).draft().content()).getTitle()).isEqualTo("Private unfinished draft");
        assertThat(((StudyMaterialContent) service.managementDetail(id).draft().content()).getVocabularyUnit().packageVersionId()).isEqualTo(nextPackage.getId());
        var currentVersion = updated.summary().versionId();
        org.mockito.Mockito.clearInvocations(unitSource);
        refresh.refreshPackage(packageId, nextPackage.getId());
        assertThat(service.detail("bob", id).summary().versionId()).isEqualTo(currentVersion);
        org.mockito.Mockito.verifyNoInteractions(unitSource);
    }
}
