package pl.co.lms.service.studymaterials;

import base.co.common.exception.ApiException;
import org.junit.jupiter.api.Test;
import pl.co.lms.entity.StudyMaterialCategory;
import pl.co.lms.entity.json.StudyMaterialContent;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class StudyMaterialValidationTest {
    private StudyMaterialContent article() { return StudyMaterialContent.builder().title("A story").category(StudyMaterialCategory.DIGLOT).paragraphs(List.of(new StudyMaterialContent.Paragraph("A short story", null))).build(); }
    @Test void acceptsPlainTextArticlesAndBothSupportedCategoryNames() {
        assertThatCode(() -> StudyMaterialValidation.validate(article())).doesNotThrowAnyException();
        assertThat(StudyMaterialCategory.parse("song-ngu")).isEqualTo(StudyMaterialCategory.BILINGUAL);
        assertThat(StudyMaterialCategory.parse("DOCUMENT")).isEqualTo(StudyMaterialCategory.DOCUMENT);
    }
    @Test void rejectsMissingNestedContentOversizedVariantsAndDuplicateLinks() {
        var value = article(); value.setParagraphs(java.util.Arrays.asList((StudyMaterialContent.Paragraph) null));
        assertThatThrownBy(() -> StudyMaterialValidation.validate(value)).isInstanceOf(ApiException.class);
        value.setParagraphs(article().getParagraphs());
        value.setVocabularyLinks(List.of(new StudyMaterialContent.VocabularyLink("word", List.of("x".repeat(201)))));
        assertThatThrownBy(() -> StudyMaterialValidation.validate(value)).isInstanceOf(ApiException.class);
        value.setVocabularyLinks(List.of(new StudyMaterialContent.VocabularyLink("word", List.of()), new StudyMaterialContent.VocabularyLink("word", List.of())));
        assertThatThrownBy(() -> StudyMaterialValidation.validate(value)).isInstanceOf(ApiException.class);
    }
    @Test void rejectsUnsafeUrlsAndOutOfOrderVideoChapters() {
        var value = article(); value.setImageUrl("javascript:alert(1)");
        assertThatThrownBy(() -> StudyMaterialValidation.validate(value)).isInstanceOf(ApiException.class);
        value.setImageUrl("//untrusted.example/cover.png");
        assertThatThrownBy(() -> StudyMaterialValidation.validate(value)).isInstanceOf(ApiException.class);
        value.setImageUrl("/images/cover.png"); value.setCategory(StudyMaterialCategory.VIDEO); value.setVideoUrl("https://example.com/lesson.webm"); value.setDurationSeconds(30);
        value.setChapters(List.of(new StudyMaterialContent.Chapter(12, "Second"), new StudyMaterialContent.Chapter(6, "First")));
        assertThatThrownBy(() -> StudyMaterialValidation.validate(value)).isInstanceOf(ApiException.class);
    }
    @Test void explicitDictionaryLevelOverridesLegacyLearnedStatus() {
        var state = new pl.co.lms.entity.LearningResourceState();
        state.setStatus(pl.co.lms.entity.FlashcardStatus.LEARNED);
        assertThat(StudyMaterialVocabularyService.isLearned(state)).isTrue();
        state.setComprehensionLevel(pl.co.lms.entity.VocabularyComprehensionLevel.LEARNING);
        assertThat(StudyMaterialVocabularyService.isLearned(state)).isFalse();
        state.setComprehensionLevel(pl.co.lms.entity.VocabularyComprehensionLevel.KNOWN);
        assertThat(StudyMaterialVocabularyService.isLearned(state)).isTrue();
    }
    @Test void validatesQuickInformationWithoutInventingMissingMetadata() {
        var value = article();
        value.setCefrLevel("B2"); value.setAcademicWordList(true); value.setPageCount(10);
        assertThatCode(() -> StudyMaterialValidation.validate(value)).doesNotThrowAnyException();
        value.setCefrLevel("B3");
        assertThatThrownBy(() -> StudyMaterialValidation.validate(value)).isInstanceOf(ApiException.class);
        value.setCefrLevel(null); value.setPageCount(0);
        assertThatThrownBy(() -> StudyMaterialValidation.validate(value)).isInstanceOf(ApiException.class);
        value.setPageCount(null); value.setAcademicWordList(null);
        assertThatCode(() -> StudyMaterialValidation.validate(value)).doesNotThrowAnyException();
    }
}
