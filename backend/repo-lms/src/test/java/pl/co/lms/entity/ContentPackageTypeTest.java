package pl.co.lms.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ContentPackageTypeTest {

    @Test
    void exercisePool_GrammarVocabularyQuiz_ReturnTheirOwnPool() {
        assertThat(ContentPackageType.GRAMMAR.exercisePool()).isEqualTo(ExercisePool.GRAMMAR);
        assertThat(ContentPackageType.VOCABULARY.exercisePool()).isEqualTo(ExercisePool.VOCABULARY);
        assertThat(ContentPackageType.ASSESSMENT.exercisePool()).isEqualTo(ExercisePool.QUICK_TEST);
    }

    @Test
    void exercisePool_SlideMaterial_ReturnNullBecauseTheyShowNoExercises() {
        assertThat(ContentPackageType.SLIDE.exercisePool()).isNull();
        assertThat(ContentPackageType.MATERIAL.exercisePool()).isNull();
    }

    @Test
    void showsToStudents_FollowsTheSectionsOfEachPackageType() {
        assertThat(ContentPackageType.VOCABULARY.showsToStudents(LearningResourceType.VOCABULARY)).isTrue();
        assertThat(ContentPackageType.VOCABULARY.showsToStudents(LearningResourceType.ASSESSMENT)).isTrue();
        assertThat(ContentPackageType.VOCABULARY.showsToStudents(LearningResourceType.GRAMMAR)).isFalse();
        assertThat(ContentPackageType.VOCABULARY.showsToStudents(LearningResourceType.SLIDE)).isFalse();

        assertThat(ContentPackageType.GRAMMAR.showsToStudents(LearningResourceType.GRAMMAR)).isTrue();
        assertThat(ContentPackageType.GRAMMAR.showsToStudents(LearningResourceType.ASSESSMENT)).isTrue();
        assertThat(ContentPackageType.GRAMMAR.showsToStudents(LearningResourceType.VOCABULARY)).isFalse();

        assertThat(ContentPackageType.ASSESSMENT.showsToStudents(LearningResourceType.ASSESSMENT)).isTrue();
        assertThat(ContentPackageType.ASSESSMENT.showsToStudents(LearningResourceType.VOCABULARY)).isFalse();

        assertThat(ContentPackageType.SLIDE.showsToStudents(LearningResourceType.SLIDE)).isTrue();
        assertThat(ContentPackageType.SLIDE.showsToStudents(LearningResourceType.ASSESSMENT)).isFalse();

        assertThat(ContentPackageType.MATERIAL.showsToStudents(LearningResourceType.MATERIAL)).isTrue();
        assertThat(ContentPackageType.MATERIAL.showsToStudents(LearningResourceType.ASSESSMENT)).isFalse();
    }
}
