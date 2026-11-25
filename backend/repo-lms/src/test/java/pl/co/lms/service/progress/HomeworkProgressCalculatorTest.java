package pl.co.lms.service.progress;

import org.junit.jupiter.api.Test;
import pl.co.lms.service.progress.HomeworkProgressCalculator.Cluster;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// Kiểm tra công thức trong docs/homework-progress-metrics.md, gồm ví dụ trong tài liệu.
class HomeworkProgressCalculatorTest {

    @Test
    void exerciseCluster_DoneOverTotal() {
        Cluster c = HomeworkProgressCalculator.exerciseCluster(3, 2);
        assertThat(c.percent()).isEqualTo(66.67);
        assertThat(c.doneUnits()).isEqualTo(2);
        assertThat(c.totalUnits()).isEqualTo(3);
    }

    @Test
    void exerciseCluster_NoUnits_HasNoValueNotZero() {
        Cluster c = HomeworkProgressCalculator.exerciseCluster(0, 0);
        assertThat(c.percent()).isNull();
        assertThat(c.exerciseFraction()).isNull();
    }

    @Test
    void vocabularyCluster_HalfWordsHalfExercises() {
        // 10/20 từ đã thuộc, 2/2 bài đã làm -> 50% x 0.5 + 50% x 1 = 75%
        Cluster c = HomeworkProgressCalculator.vocabularyCluster(2, 2, 20, 10);
        assertThat(c.percent()).isEqualTo(75.0);
        assertThat(c.exerciseFraction()).isEqualTo(1.0);
        assertThat(c.knownWords()).isEqualTo(10);
        assertThat(c.totalWords()).isEqualTo(20);
    }

    @Test
    void vocabularyCluster_OnlyWords_WordsTakeAll() {
        Cluster c = HomeworkProgressCalculator.vocabularyCluster(0, 0, 20, 5);
        assertThat(c.percent()).isEqualTo(25.0);
        assertThat(c.exerciseFraction()).isNull();
    }

    @Test
    void vocabularyCluster_OnlyExercises_ExercisesTakeAll() {
        Cluster c = HomeworkProgressCalculator.vocabularyCluster(2, 1, 0, 0);
        assertThat(c.percent()).isEqualTo(50.0);
    }

    @Test
    void vocabularyCluster_NothingAtAll_HasNoValue() {
        assertThat(HomeworkProgressCalculator.vocabularyCluster(0, 0, 0, 0).percent()).isNull();
    }

    @Test
    void session_DocumentedExample() {
        // Ngữ pháp 2/3 bài; Từ vựng 10/20 từ và 2/2 bài; Quick Test 1/2 bài.
        Cluster grammar = HomeworkProgressCalculator.exerciseCluster(3, 2);
        Cluster vocabulary = HomeworkProgressCalculator.vocabularyCluster(2, 2, 20, 10);
        Cluster quick = HomeworkProgressCalculator.exerciseCluster(2, 1);

        HomeworkProgressCalculator.Session s = HomeworkProgressCalculator.session(grammar, vocabulary, quick);

        // P5 chỉ tính bài tập: (66.67 + 100 + 50) / 3
        assertThat(s.homeworkProgress()).isEqualTo(72.22);
        // P5b gồm từ đã thuộc: (66.67 + 75 + 50) / 3
        assertThat(s.personalProgress()).isEqualTo(63.89);
        assertThat(s.totalDoneUnits()).isEqualTo(5);
    }

    @Test
    void session_MissingCluster_IsDroppedAndRestShareEqually() {
        Cluster grammar = HomeworkProgressCalculator.exerciseCluster(2, 1);
        Cluster vocabulary = HomeworkProgressCalculator.vocabularyCluster(0, 0, 0, 0);
        Cluster quick = HomeworkProgressCalculator.exerciseCluster(2, 2);

        HomeworkProgressCalculator.Session s = HomeworkProgressCalculator.session(grammar, vocabulary, quick);

        assertThat(s.homeworkProgress()).isEqualTo(75.0);
        assertThat(s.personalProgress()).isEqualTo(75.0);
    }

    @Test
    void session_NothingInSession_HasNoValue() {
        Cluster none = HomeworkProgressCalculator.exerciseCluster(0, 0);
        HomeworkProgressCalculator.Session s = HomeworkProgressCalculator.session(
                none, HomeworkProgressCalculator.vocabularyCluster(0, 0, 0, 0), none);
        assertThat(s.homeworkProgress()).isNull();
        assertThat(s.personalProgress()).isNull();
    }

    @Test
    void session_VocabularyWordsCountOnlyInPersonalProgress() {
        // Chỉ thuộc từ, chưa làm bài nào: tiến độ bài tập 0%, tiến độ cá nhân > 0
        Cluster vocabulary = HomeworkProgressCalculator.vocabularyCluster(2, 0, 10, 10);
        HomeworkProgressCalculator.Session s = HomeworkProgressCalculator.session(
                HomeworkProgressCalculator.exerciseCluster(0, 0), vocabulary,
                HomeworkProgressCalculator.exerciseCluster(0, 0));
        assertThat(s.homeworkProgress()).isEqualTo(0.0);
        assertThat(s.personalProgress()).isEqualTo(50.0);
        assertThat(s.totalDoneUnits()).isEqualTo(0);
    }

    @Test
    void attemptPercent_RoundsAndIgnoresZeroTotal() {
        assertThat(HomeworkProgressCalculator.attemptPercent(new BigDecimal("10"), new BigDecimal("27"))).isEqualTo(37.04);
        assertThat(HomeworkProgressCalculator.attemptPercent(new BigDecimal("0"), new BigDecimal("0"))).isNull();
        assertThat(HomeworkProgressCalculator.attemptPercent(null, new BigDecimal("5"))).isNull();
    }

    @Test
    void average_SkipsNullsAndEmptyIsNull() {
        assertThat(HomeworkProgressCalculator.average(Arrays.asList(50.0, null, 100.0))).isEqualTo(75.0);
        assertThat(HomeworkProgressCalculator.average(List.of())).isNull();
        assertThat(HomeworkProgressCalculator.average(Arrays.asList((Double) null))).isNull();
    }
}
