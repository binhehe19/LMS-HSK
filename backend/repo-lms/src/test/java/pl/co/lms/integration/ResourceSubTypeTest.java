package pl.co.lms.integration;

import base.co.common.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import pl.co.lms.dto.request.CreateLearningResourceRequest;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.entity.json.VocabularyEnContent;
import pl.co.lms.entity.json.VocabularyZhContent;
import pl.co.lms.service.LearningResourceService;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Loại phụ (cột sub_type) của học liệu: người tạo đặt, từ vựng chưa chỉ định thì suy từ nội dung, bản sao thừa hưởng. */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:resourcesubtype;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.flyway.enabled=false"})
@Import({JacksonAutoConfiguration.class, LearningResourceService.class})
class ResourceSubTypeTest {

    @Autowired LearningResourceService resources;

    private String create(LearningResourceType type, Object content, String subType, String sourceId) {
        return resources.createResourceWithContent(new CreateLearningResourceRequest(
                type, content, false, sourceId == null, sourceId, subType, null)).getId();
    }

    private static VocabularyEnContent en() {
        return VocabularyEnContent.builder().word("w").commonMeaning("nghĩa").build();
    }

    private static VocabularyZhContent zh() {
        return VocabularyZhContent.builder().word("学").hskLevel(1).pinyins(List.of(
                VocabularyZhContent.DictionaryPinyinItem.builder().pinyin("xué").isPrimary(true).meanings(List.of(
                        VocabularyZhContent.DictionaryMeaningItem.builder().meaningVi("học").build())).build())).build();
    }

    @Test
    void assessmentDefaultsToQuizAndRejectsBareSkillNames() {
        assertThat(resources.getResource(create(LearningResourceType.ASSESSMENT, null, null, null)).getSubType()).isEqualTo(ResourceSubTypes.QUIZ);
        assertThat(resources.getResource(create(LearningResourceType.ASSESSMENT, null, "PRACTICE_READING", null)).getSubType()).isEqualTo(ResourceSubTypes.PRACTICE_READING);
        assertThrows(ApiException.class, () -> create(LearningResourceType.ASSESSMENT, null, "READING", null));
    }

    @Test
    void vocabularyKeepsTheSubTypeTheCreatorChose() {
        assertThat(resources.getResource(create(LearningResourceType.VOCABULARY, zh(), "ZH", null)).getSubType()).isEqualTo(ResourceSubTypes.ZH);
        assertThat(resources.getResource(create(LearningResourceType.VOCABULARY, en(), "EN", null)).getSubType()).isEqualTo(ResourceSubTypes.EN);
    }

    @Test
    void vocabularyWithoutSubTypeIsInferredFromTheContentShape() {
        assertThat(resources.getResource(create(LearningResourceType.VOCABULARY, zh(), null, null)).getSubType()).isEqualTo(ResourceSubTypes.ZH);
        assertThat(resources.getResource(create(LearningResourceType.VOCABULARY, en(), null, null)).getSubType()).isEqualTo(ResourceSubTypes.EN);
    }

    @Test
    void rejectsValuesOutsideTheSetOfTheType() {
        assertThrows(ApiException.class, () -> create(LearningResourceType.VOCABULARY, en(), "QUIZ", null));
        assertThrows(ApiException.class, () -> create(LearningResourceType.ASSESSMENT, null, "ZH", null));
        assertThrows(ApiException.class, () -> create(LearningResourceType.SLIDE, null, "EN", null));
    }

    @Test
    void contentMustMatchTheStructureOfTheSubType() {
        // ZH thiếu phiên âm, hoặc mang trường của EN; EN mang trường của ZH.
        assertThrows(ApiException.class, () -> create(LearningResourceType.VOCABULARY, VocabularyZhContent.builder().word("学").build(), "ZH", null));
        assertThrows(ApiException.class, () -> create(LearningResourceType.VOCABULARY, Map.of("word", "学", "definitions", List.of(), "pinyins", List.of()), "ZH", null));
        assertThrows(ApiException.class, () -> create(LearningResourceType.VOCABULARY, Map.of("word", "w", "hskLevel", 1), "EN", null));
        assertThrows(ApiException.class, () -> create(LearningResourceType.VOCABULARY, Map.of("word", "w", "pinyins", List.of()), "EN", null));
    }

    @Test
    void unknownFieldsInsideNestedItemsAreRejectedToo() {
        Map<String, Object> zhBadMeaning = Map.of("word", "学", "pinyins", List.of(Map.of("pinyin", "xué", "isPrimary", true,
                "meanings", List.of(Map.of("meaningVi", "học", "bogus", "x")))));
        assertThrows(ApiException.class, () -> create(LearningResourceType.VOCABULARY, zhBadMeaning, "ZH", null));
        Map<String, Object> enBadDefinition = Map.of("word", "w", "definitions", List.of(Map.of("meaningVi", "a", "bogus", "x")));
        assertThrows(ApiException.class, () -> create(LearningResourceType.VOCABULARY, enBadDefinition, "EN", null));
        // Tên cũ của nghĩa (meaning) vẫn được nhận như meaningVi.
        Map<String, Object> zhLegacyMeaning = Map.of("word", "学", "pinyins", List.of(Map.of("pinyin", "xué", "isPrimary", true,
                "meanings", List.of(Map.of("meaning", "học")))));
        assertThat(resources.getResource(create(LearningResourceType.VOCABULARY, zhLegacyMeaning, "ZH", null)).getSubType()).isEqualTo(ResourceSubTypes.ZH);
    }

    @Test
    void legacyLanguageKeyIsAcceptedAndDropped() {
        String id = create(LearningResourceType.VOCABULARY, Map.of("word", "w", "language", "en", "commonMeaning", "x"), "EN", null);
        assertThat(resources.getResource(id).getSubType()).isEqualTo(ResourceSubTypes.EN);
        assertThat(resources.listVersions(id).get(0).getContent()).doesNotContain("language");
    }

    @Test
    void copyInheritsTheSubTypeOfTheLibrarySource() {
        String source = create(LearningResourceType.VOCABULARY, zh(), ResourceSubTypes.ZH, null);
        String copy = create(LearningResourceType.VOCABULARY, zh(), null, source);
        assertThat(resources.getResource(copy).getSubType()).isEqualTo(ResourceSubTypes.ZH);
    }

    private static Map<String, Object> grammarEn() {
        return Map.of("title", "Present Simple", "examples", List.of(Map.of("exampleIndex", 1, "exampleType", "EXAMPLE", "sentenceEn", "I work.")));
    }

    private static Map<String, Object> grammarZh() {
        return Map.of("title", "越来越", "hskLevel", "HSK 3.0", "examples", List.of(Map.of("exampleIndex", 1, "sentenceZh", "天气越来越冷。", "pinyin", "Tiānqì yuè lái yuè lěng.")));
    }

    @Test
    void grammarKeepsTheChosenSubTypeAndInfersItWhenMissing() {
        assertThat(resources.getResource(create(LearningResourceType.GRAMMAR, grammarEn(), "EN", null)).getSubType()).isEqualTo(ResourceSubTypes.EN);
        assertThat(resources.getResource(create(LearningResourceType.GRAMMAR, grammarZh(), "ZH", null)).getSubType()).isEqualTo(ResourceSubTypes.ZH);
        assertThat(resources.getResource(create(LearningResourceType.GRAMMAR, grammarEn(), null, null)).getSubType()).isEqualTo(ResourceSubTypes.EN);
        assertThat(resources.getResource(create(LearningResourceType.GRAMMAR, grammarZh(), null, null)).getSubType()).isEqualTo(ResourceSubTypes.ZH);
    }

    @Test
    void grammarContentMustMatchTheStructureOfTheSubType() {
        assertThrows(ApiException.class, () -> create(LearningResourceType.GRAMMAR, grammarZh(), "EN", null));
        assertThrows(ApiException.class, () -> create(LearningResourceType.GRAMMAR, grammarEn(), "ZH", null));
        Map<String, Object> zhWithEnglish = Map.of("title", "T", "examples", List.of(Map.of("sentenceZh", "我", "sentenceEn", "I")));
        assertThrows(ApiException.class, () -> create(LearningResourceType.GRAMMAR, zhWithEnglish, "ZH", null));
    }

    @Test
    void grammarHskLevelIsMirroredIntoTheCefrColumnForFilteringAndLegacyPronunciationIsKeptAsPinyin() {
        String id = create(LearningResourceType.GRAMMAR, grammarZh(), "ZH", null);
        assertThat(resources.getResource(id).getCefrLevel()).isEqualTo("HSK 3.0");
        Map<String, Object> legacy = Map.of("title", "T", "examples", List.of(Map.of("sentenceZh", "我", "pronunciation", "wǒ")));
        String legacyId = create(LearningResourceType.GRAMMAR, legacy, "ZH", null);
        assertThat(resources.listVersions(legacyId).get(0).getContent()).contains("\"pinyin\":\"wǒ\"").doesNotContain("pronunciation");
    }

    @Test
    void grammarCopyInheritsTheSubTypeOfTheLibrarySource() {
        String source = create(LearningResourceType.GRAMMAR, grammarZh(), ResourceSubTypes.ZH, null);
        String copy = create(LearningResourceType.GRAMMAR, grammarZh(), null, source);
        assertThat(resources.getResource(copy).getSubType()).isEqualTo(ResourceSubTypes.ZH);
    }
    @Test
    void subTypeCannotBeChangedAfterCreation() {
        String id = create(LearningResourceType.VOCABULARY, zh(), ResourceSubTypes.ZH, null);
        assertThrows(ApiException.class, () -> resources.updateClassification(id, ResourceSubTypes.EN, null));
        resources.updateClassification(id, ResourceSubTypes.ZH, null);
        assertThat(resources.getResource(id).getSubType()).isEqualTo(ResourceSubTypes.ZH);
    }
}
