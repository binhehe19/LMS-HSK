package pl.co.lms.service;

import base.co.common.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pl.co.lms.dto.response.LearningResourceResponse;
import pl.co.lms.entity.GrammarExampleType;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.entity.LearningResourceVersion;
import pl.co.lms.entity.json.GrammarEnContent;
import pl.co.lms.entity.json.GrammarZhContent;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;
import pl.co.lms.entity.json.SlideMaterialContent;
import pl.co.lms.entity.json.VocabularyEnContent;
import pl.co.lms.entity.json.AudioPracticeContent;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.LearningResourceVersionRepository;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LearningResourceServiceTest {

    @Mock
    private LearningResourceRepository resourceRepository;
    @Mock
    private LearningResourceVersionRepository versionRepository;
    @Mock
    private pl.co.lms.repository.ContentPackageVersionResourceRepository packageLinkRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private LearningResourceService service;

    @BeforeEach
    void setUp() {
        service = new LearningResourceService(resourceRepository, versionRepository, packageLinkRepository, objectMapper);
    }

    @Test
    void createResource_Success() {
        when(resourceRepository.save(any(LearningResource.class))).thenAnswer(i -> {
            LearningResource r = i.getArgument(0);
            r.setId("res-1");
            return r;
        });

        LearningResource res = service.createResource(LearningResourceType.GRAMMAR);
        assertThat(res.getId()).isEqualTo("res-1");
        assertThat(res.getType()).isEqualTo(LearningResourceType.GRAMMAR);
    }

    @Test
    void createResource_DefaultsToPackageCopyNotLibrary() {
        when(resourceRepository.save(any(LearningResource.class))).thenAnswer(i -> i.getArgument(0));

        LearningResource res = service.createResource(LearningResourceType.ASSESSMENT);
        assertThat(res.isInLibrary()).isFalse();
    }

    @Test
    void createResourceWithContent_InLibraryFlagIsPersisted() {
        when(resourceRepository.save(any(LearningResource.class))).thenAnswer(i -> {
            LearningResource r = i.getArgument(0);
            if (r.getId() == null) r.setId("res-lib");
            return r;
        });

        LearningResource res = service.createResourceWithContent(
                new pl.co.lms.dto.request.CreateLearningResourceRequest(LearningResourceType.ASSESSMENT, null, null, true, null));
        assertThat(res.isInLibrary()).isTrue();
    }

    @Test
    void listResourceResponses_LibraryOnlyUsesLibraryQuery() {
        org.springframework.data.domain.Page<LearningResource> empty = org.springframework.data.domain.Page.empty();
        when(resourceRepository.findByTypeAndInLibraryTrueAndDeletedFalseOrderByCreatedAtDesc(
                any(LearningResourceType.class), any(org.springframework.data.domain.Pageable.class))).thenReturn(empty);

        var page = service.listResourceResponses(LearningResourceType.ASSESSMENT, null, null, null, null, true, 0, 20);
        assertThat(page.getItems()).isEmpty();
    }

    @Test
    void validateGrammarEn_ValidAndInvalid() {
        GrammarEnContent valid = GrammarEnContent.builder()
                .title("Present Simple")
                .examples(List.of(
                        GrammarEnContent.GrammarEnExampleItem.builder()
                                .exampleIndex(1)
                                .exampleType(GrammarExampleType.EXAMPLE)
                                .sentenceEn("I work here.")
                                .build()
                ))
                .build();
        service.validateContent(LearningResourceType.GRAMMAR, valid);

        GrammarEnContent invalidTitle = GrammarEnContent.builder().title("").build();
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.GRAMMAR, invalidTitle))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("title cannot be blank");

        GrammarEnContent invalidMistake = GrammarEnContent.builder()
                .title("Present Perfect")
                .examples(List.of(
                        GrammarEnContent.GrammarEnExampleItem.builder()
                                .exampleIndex(1)
                                .exampleType(GrammarExampleType.COMMON_MISTAKE)
                                .incorrectSentence("I have seen him yesterday.")
                                .correctSentence("")
                                .build()
                ))
                .build();
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.GRAMMAR, invalidMistake))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("common mistake requires both");

        GrammarEnContent noSentence = GrammarEnContent.builder().title("T").examples(List.of(
                GrammarEnContent.GrammarEnExampleItem.builder().exampleType(GrammarExampleType.EXAMPLE).build())).build();
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.GRAMMAR, ResourceSubTypes.EN, noSentence))
                .isInstanceOf(ApiException.class).hasMessageContaining("requires an English sentence");
    }

    @Test
    void validateGrammarZh_ValidAndInvalid() throws Exception {
        var valid = objectMapper.readValue("""
                {"title":"越来越","hskLevel":"HSK 3.0","examples":[
                  {"exampleIndex":1,"sentenceZh":"天气越来越冷。","pinyin":"Tiānqì yuè lái yuè lěng.","translationVi":"Thời tiết ngày càng lạnh."}]}
                """, GrammarZhContent.class);
        service.validateContent(LearningResourceType.GRAMMAR, valid);

        var noSentence = objectMapper.readValue("{\"title\":\"越来越\",\"examples\":[{\"exampleIndex\":1,\"pinyin\":\"x\"}]}", GrammarZhContent.class);
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.GRAMMAR, ResourceSubTypes.ZH, noSentence))
                .isInstanceOf(ApiException.class).hasMessageContaining("requires a Chinese sentence");
    }

    @Test
    void grammarZhRichTextSurvivesValidationAndSerialization() throws Exception {
        var payload = objectMapper.readTree("""
                {"title":"越来越","explanation":"Diễn tả mức độ tăng","richText":{"explanation":"<p><strong>Diễn tả mức độ tăng</strong></p>"}}
                """);
        service.validateContent(LearningResourceType.GRAMMAR, ResourceSubTypes.ZH, payload);
        var typed = objectMapper.treeToValue(payload, GrammarZhContent.class);
        assertThat(objectMapper.valueToTree(typed).path("richText")).isEqualTo(payload.path("richText"));
    }

    @Test
    void grammarEnAndZhRejectEachOthersFields() throws Exception {
        var en = objectMapper.readTree("{\"title\":\"T\",\"examples\":[{\"exampleType\":\"EXAMPLE\",\"sentenceEn\":\"I work.\",\"sentenceZh\":\"我工作。\"}]}");
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.GRAMMAR, ResourceSubTypes.EN, en))
                .isInstanceOf(ApiException.class).hasMessageContaining("sentenceZh");

        var zhTop = objectMapper.readTree("{\"title\":\"T\",\"examples\":[{\"sentenceZh\":\"我工作。\"}],\"generalDefinition\":\"x\",\"unknownTop\":1}");
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.GRAMMAR, ResourceSubTypes.ZH, zhTop))
                .isInstanceOf(ApiException.class).hasMessageContaining("unknownTop");

        var zhEn = objectMapper.readTree("{\"title\":\"T\",\"examples\":[{\"sentenceZh\":\"我工作。\",\"sentenceEn\":\"I work.\"}]}");
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.GRAMMAR, ResourceSubTypes.ZH, zhEn))
                .isInstanceOf(ApiException.class).hasMessageContaining("sentenceEn");
    }

    @Test
    void grammarSubTypeIsInferredFromContentAndLegacyPronunciationReadsAsPinyin() throws Exception {
        assertThat(ResourceSubTypes.inferGrammar(objectMapper.readTree("{\"title\":\"T\",\"examples\":[{\"sentenceEn\":\"I work.\"}]}"))).isEqualTo(ResourceSubTypes.EN);
        assertThat(ResourceSubTypes.inferGrammar(objectMapper.readTree("{\"title\":\"T\",\"examples\":[{\"sentenceZh\":\"我\"}]}"))).isEqualTo(ResourceSubTypes.ZH);
        assertThat(ResourceSubTypes.inferGrammar(objectMapper.readTree("{\"title\":\"T\",\"hskLevel\":\"HSK 1\"}"))).isEqualTo(ResourceSubTypes.ZH);
        assertThat(ResourceSubTypes.inferGrammar(objectMapper.readTree("{\"title\":\"T\"}"))).isEqualTo(ResourceSubTypes.EN);

        var lenient = objectMapper.copy().disable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        var legacy = lenient.readValue("""
                {"title":"Grammar","examples":[{"exampleType":"EXAMPLE","sentenceZh":"我在这里工作。","pronunciation":"Wǒ zài zhèlǐ gōngzuò.","translationVi":"Tôi làm việc ở đây."}]}
                """, GrammarZhContent.class);
        assertThat(legacy.getExamples().get(0).getPinyin()).isEqualTo("Wǒ zài zhèlǐ gōngzuò.");
        var saved = objectMapper.valueToTree(legacy).path("examples").get(0);
        assertThat(saved.path("pinyin").asText()).isEqualTo("Wǒ zài zhèlǐ gōngzuò.");
        assertThat(saved.has("pronunciation")).isFalse();
        service.validateContent(LearningResourceType.GRAMMAR, legacy);
    }
    private VocabularyEnContent structuredWord() throws Exception {
        return objectMapper.readValue("""
                {"word":"sustainable","commonMeaning":"bền vững",
                 "definitions":[{"definitionIndex":0,"meaningVi":"Bền vững","definitionEn":"Able to continue","exampleEn":"We need it.","exampleVi":"Cần."}],
                 "collocations":[{"pattern":"ADJ","words":["green","stable"],"exampleEn":"Green practices.","exampleVi":"Thực hành xanh."}],
                 "thesaurus":[{"relation":"SYNONYM","partOfSpeech":"adjective","gloss":"lasting","words":["durable"],"meaningVi":"Bền"},
                              {"relation":"ANTONYM","words":["temporary"]}],
                 "commonMistakes":[{"title":"Nhầm","correct":"sustainable development","incorrect":"sustained development","explanation":"Khác nghĩa"}],
                 "examples":[{"en":"Cities must be sustainable.","vi":"Thành phố phải bền vững."}]}
                """, VocabularyEnContent.class);
    }

    @Test
    void validateVocabulary_StructuredSectionsAreAcceptedAndRoundTrip() throws Exception {
        VocabularyEnContent word = structuredWord();
        service.validateContent(LearningResourceType.VOCABULARY, word);
        VocabularyEnContent back = objectMapper.readValue(objectMapper.writeValueAsString(word), VocabularyEnContent.class);
        assertThat(back.getCommonMeaning()).isEqualTo("bền vững");
        assertThat(back.getCollocations().get(0).getWords()).containsExactly("green", "stable");
        assertThat(back.getThesaurus().get(1).getRelation()).isEqualTo(pl.co.lms.entity.VocabularyRelationType.ANTONYM);
        assertThat(back.getCommonMistakes().get(0).getIncorrect()).isEqualTo("sustained development");
        assertThat(back.getExamples().get(0).getVi()).isEqualTo("Thành phố phải bền vững.");
    }

    @Test
    void validateVocabulary_IncompleteStructuredEntriesFail() throws Exception {
        VocabularyEnContent noWords = structuredWord();
        noWords.getCollocations().get(0).setWords(List.of(" "));
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.VOCABULARY, noWords)).isInstanceOf(ApiException.class);
        VocabularyEnContent noRelation = structuredWord();
        noRelation.getThesaurus().get(0).setRelation(null);
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.VOCABULARY, noRelation)).isInstanceOf(ApiException.class);
        VocabularyEnContent noUsage = structuredWord();
        noUsage.getCommonMistakes().get(0).setCorrect(null);
        noUsage.getCommonMistakes().get(0).setIncorrect("");
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.VOCABULARY, noUsage)).isInstanceOf(ApiException.class);
        VocabularyEnContent noSentence = structuredWord();
        noSentence.getExamples().get(0).setEn("");
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.VOCABULARY, noSentence)).isInstanceOf(ApiException.class);
    }

    @Test
    void validateVocabulary_BlankWordFails() {
        VocabularyEnContent invalid = VocabularyEnContent.builder().word("").build();
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.VOCABULARY, invalid))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("word cannot be blank");
    }

    @Test
    void validateQuiz_BlankTitleFails() {
        QuizContent noTitle = QuizContent.builder()
                .title("")
                .questions(List.of(new QuizQuestion()))
                .build();
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.ASSESSMENT, noTitle))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("title cannot be blank");
    }

    @Test
    void validateQuiz_EmptyQuestionsFails() {
        QuizContent noQuestions = QuizContent.builder()
                .title("Quiz 1")
                .questions(List.of())
                .build();
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.ASSESSMENT, noQuestions))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("at least one question");
    }

    @Test
    void validateSlideMaterial_RequiresFileId() {
        SlideMaterialContent mat = SlideMaterialContent.builder().fileId("").build();
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.SLIDE, mat))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("requires a valid fileId");
    }

    @Test
    void validateAudioPractice_RequiresNonOverlappingSegmentsAndAnEnabledMode() {
        AudioPracticeContent valid = AudioPracticeContent.builder()
                .title("Market story")
                .youtubeVideoId("dQw4w9WgXcQ")
                .durationMillis(10_000L)
                .dictationEnabled(true)
                .segments(List.of(AudioPracticeContent.AudioPracticeSegment.builder()
                        .segmentNo(1).startMillis(0L).endMillis(5_000L).transcript("Hello there.").build()))
                .build();
        service.validateContent(LearningResourceType.AUDIO_PRACTICE, valid);

        AudioPracticeContent invalidYoutube = AudioPracticeContent.builder()
                .title("Market story")
                .youtubeVideoId("not-a-youtube-id")
                .durationMillis(10_000L)
                .shadowingEnabled(true)
                .segments(List.of(AudioPracticeContent.AudioPracticeSegment.builder()
                        .segmentNo(1).startMillis(0L).endMillis(5_000L).transcript("Hello there.").build()))
                .build();
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.AUDIO_PRACTICE, invalidYoutube))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("youtubeVideoId is invalid");

        AudioPracticeContent overlapping = AudioPracticeContent.builder()
                .title("Market story")
                .audioFileId("audio-1")
                .durationMillis(10_000L)
                .shadowingEnabled(true)
                .segments(List.of(
                        AudioPracticeContent.AudioPracticeSegment.builder()
                                .segmentNo(1).startMillis(0L).endMillis(5_000L).transcript("One.").build(),
                        AudioPracticeContent.AudioPracticeSegment.builder()
                                .segmentNo(2).startMillis(4_000L).endMillis(8_000L).transcript("Two.").build()))
                .build();
        assertThatThrownBy(() -> service.validateContent(LearningResourceType.AUDIO_PRACTICE, overlapping))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("cannot overlap");
    }

    // Lượt làm bài chỉ tham chiếu resource_version_id (không chụp lại đề), nên version đã publish phải bất biến.
    @Test
    void updateDraftVersion_PublishedVersionIsImmutable() {
        LearningResource resource = LearningResource.builder().type(LearningResourceType.ASSESSMENT)
                .publishedVersionId("v1").draftVersionId("v2").build();
        resource.setId("res-1");
        LearningResourceVersion published = LearningResourceVersion.builder().resourceId("res-1").version(1)
                .status(pl.co.lms.entity.LearningResourceVersionStatus.PUBLISHED).build();
        published.setId("v1");
        when(resourceRepository.findByIdAndDeletedFalse("res-1")).thenReturn(Optional.of(resource));
        when(versionRepository.findByIdAndDeletedFalse("v1")).thenReturn(Optional.of(published));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.updateDraftVersion("res-1", "v1", new Object()))
                .isInstanceOf(ApiException.class).hasMessageContaining("nháp hiện hành");
        org.mockito.Mockito.verify(versionRepository, org.mockito.Mockito.never()).save(any());
    }
    // Thông số quiz: thời gian dự kiến chỉ để hiển thị, phải trong 1–600 phút; xáo câu hỏi chỉ lưu.
    @Test
    void validateQuiz_estimatedMinutesMustBeWithinRange() {
        QuizQuestion q = QuizQuestion.builder().questionId("q1").questionType(pl.co.lms.entity.ExerciseQuestionType.ESSAY).questionText("<p>x</p>").build();
        QuizContent ok = QuizContent.builder().title("T").questions(List.of(q)).estimatedMinutes(15).shuffleQuestions(true).build();
        service.validateContent(LearningResourceType.ASSESSMENT, ok);
        for (int bad : new int[] {0, -5, 601}) {
            QuizContent invalid = QuizContent.builder().title("T").questions(List.of(q)).estimatedMinutes(bad).build();
            assertThatThrownBy(() -> service.validateContent(LearningResourceType.ASSESSMENT, invalid))
                    .isInstanceOf(ApiException.class)
                    .hasMessageContaining("1–600");
        }
    }}
