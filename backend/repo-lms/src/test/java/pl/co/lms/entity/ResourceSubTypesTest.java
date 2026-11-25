package pl.co.lms.entity;

import base.co.common.exception.ApiException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ResourceSubTypesTest {

    @Test
    void validatesAgainstTheSetOfTheResourceType() {
        assertThat(ResourceSubTypes.validate(LearningResourceType.ASSESSMENT, "PLACEMENT_IELTS")).isEqualTo("PLACEMENT_IELTS");
        assertThat(ResourceSubTypes.validate(LearningResourceType.VOCABULARY, "zh")).isEqualTo("ZH");
        assertThat(ResourceSubTypes.validate(LearningResourceType.VOCABULARY, " en ")).isEqualTo("EN");
        assertThat(ResourceSubTypes.validate(LearningResourceType.ASSESSMENT, null)).isNull();
        assertThat(ResourceSubTypes.validate(LearningResourceType.GRAMMAR, "  ")).isNull();
    }

    @Test
    void rejectsValuesOutsideTheSetOrOnTypesWithoutOne() {
        assertThatThrownBy(() -> ResourceSubTypes.validate(LearningResourceType.VOCABULARY, "QUIZ")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> ResourceSubTypes.validate(LearningResourceType.ASSESSMENT, "EN")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> ResourceSubTypes.validate(LearningResourceType.SLIDE, "EN")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> ResourceSubTypes.validate(LearningResourceType.ASSESSMENT, "bad value!")).isInstanceOf(ApiException.class);
    }

    @Test
    void grammarAndVocabularyTakeEnOrZh() {
        assertThat(ResourceSubTypes.validate(LearningResourceType.GRAMMAR, "zh")).isEqualTo("ZH");
        assertThat(ResourceSubTypes.validate(LearningResourceType.GRAMMAR, " en ")).isEqualTo("EN");
        assertThatThrownBy(() -> ResourceSubTypes.validate(LearningResourceType.GRAMMAR, "QUIZ")).isInstanceOf(ApiException.class);
    }

    @Test
    void englishCoversEnAndRowsWithoutASubTypeButNotZh() {
        assertThat(ResourceSubTypes.isEnglish(null)).isTrue();
        assertThat(ResourceSubTypes.isEnglish(ResourceSubTypes.EN)).isTrue();
        assertThat(ResourceSubTypes.isEnglish(ResourceSubTypes.ZH)).isFalse();
    }
    @Test
    void skillNamesAreNotSubTypesAndPracticeSkillIsDerivedFromThePrefix() {
        assertThat(ResourceSubTypes.normalize("practice_reading")).isEqualTo(ResourceSubTypes.PRACTICE_READING);
        assertThatThrownBy(() -> ResourceSubTypes.validate(LearningResourceType.ASSESSMENT, "SPEAKING")).isInstanceOf(ApiException.class);
        assertThat(ResourceSubTypes.normalize("QUIZ")).isEqualTo("QUIZ");
        assertThat(ResourceSubTypes.practiceSkillOf(ResourceSubTypes.PRACTICE_LISTENING)).isEqualTo("LISTENING");
        assertThat(ResourceSubTypes.practiceSkillOf("QUIZ")).isNull();
    }

    @Test
    void quickQuizIsAnAssessmentSubTypeButNotAPracticeSkillOrPlacement() {
        assertThat(ResourceSubTypes.validate(LearningResourceType.ASSESSMENT, "quick_quiz")).isEqualTo(ResourceSubTypes.QUICK_QUIZ);
        assertThat(ResourceSubTypes.isPractice(ResourceSubTypes.QUICK_QUIZ)).isFalse();
        assertThat(ResourceSubTypes.practiceSkillOf(ResourceSubTypes.QUICK_QUIZ)).isNull();
        assertThat(ResourceSubTypes.isPlacement(ResourceSubTypes.QUICK_QUIZ)).isFalse();
        assertThatThrownBy(() -> ResourceSubTypes.validate(LearningResourceType.VOCABULARY, "QUICK_QUIZ")).isInstanceOf(ApiException.class);
    }

    @Test
    void onlyPlacementValuesArePlacement() {
        assertThat(ResourceSubTypes.PLACEMENT).containsExactlyInAnyOrder(
                "PLACEMENT_IELTS", "PLACEMENT_PACE", "FOUNDATION_PRON", "FOUNDATION_VOCAB", "FOUNDATION_GRAMMAR");
        assertThat(ResourceSubTypes.isPlacement(ResourceSubTypes.FOUNDATION_VOCAB)).isTrue();
        assertThat(ResourceSubTypes.isPlacement(ResourceSubTypes.QUIZ)).isFalse();
        assertThat(ResourceSubTypes.isPlacement(null)).isFalse();
    }
}
