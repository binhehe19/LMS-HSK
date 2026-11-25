package pl.co.lms.service.progress;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

// Công thức tiến độ bài tập, thuần tính toán (không phụ thuộc DB). Mô tả đầy đủ ở docs/homework-progress-metrics.md.
// Mọi giá trị phần trăm nằm trong [0, 100], làm tròn 2 chữ số; null nghĩa là "không có dữ liệu" (khác 0%).
public final class HomeworkProgressCalculator {

    private HomeworkProgressCalculator() {}

    // Tiến độ một cụm (Ngữ pháp, Từ vựng, Quick Test) trong một buổi.
    // percent: số hiển thị ở card/badge. exerciseFraction: chỉ phần bài tập (0..1), dùng cho "Tiến độ bài tập" của buổi.
    public record Cluster(Double percent, Double exerciseFraction, int doneUnits, int totalUnits,
                          Integer knownWords, Integer totalWords) {}

    public record Session(Cluster grammar, Cluster vocabulary, Cluster quickTest,
                          Double homeworkProgress, Double personalProgress) {
        public int totalDoneUnits() {
            return grammar.doneUnits() + vocabulary.doneUnits() + quickTest.doneUnits();
        }
    }

    // Cụm chỉ có bài tập (Ngữ pháp, Quick Test): bài đã làm / tổng bài.
    public static Cluster exerciseCluster(int totalUnits, int doneUnits) {
        Double fraction = totalUnits > 0 ? (double) doneUnits / totalUnits : null;
        return new Cluster(toPercent(fraction), fraction, doneUnits, totalUnits, null, null);
    }

    // Cụm Từ vựng = 50% từ đã thuộc (lý thuyết) + 50% bài tập. Thiếu một phần thì phần còn lại chiếm 100%.
    public static Cluster vocabularyCluster(int totalUnits, int doneUnits, int totalWords, int knownWords) {
        Double exercise = totalUnits > 0 ? (double) doneUnits / totalUnits : null;
        Double words = totalWords > 0 ? (double) knownWords / totalWords : null;
        Double combined;
        if (exercise != null && words != null) {
            combined = 0.5 * words + 0.5 * exercise;
        } else {
            combined = exercise != null ? exercise : words;
        }
        return new Cluster(toPercent(combined), exercise, doneUnits, totalUnits, knownWords, totalWords);
    }

    // P5 "Tiến độ bài tập" của buổi: trung bình phần BÀI TẬP của các cụm có bài (không tính từ đã thuộc).
    // P5b "Tiến độ cá nhân" của buổi: trung bình phần trăm hiển thị của các cụm có dữ liệu (gồm từ đã thuộc).
    public static Session session(Cluster grammar, Cluster vocabulary, Cluster quickTest) {
        List<Cluster> clusters = List.of(grammar, vocabulary, quickTest);
        Double homework = average(clusters.stream().map(Cluster::exerciseFraction).filter(Objects::nonNull)
                .map(f -> f * 100).toList());
        Double personal = average(clusters.stream().map(Cluster::percent).filter(Objects::nonNull).toList());
        return new Session(grammar, vocabulary, quickTest, homework, personal);
    }

    // Điểm % của một attempt = earned / total × 100; total = 0 thì không tính (null).
    public static Double attemptPercent(BigDecimal earned, BigDecimal total) {
        if (earned == null || total == null || total.signum() <= 0) return null;
        return earned.multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP).doubleValue();
    }

    // Trung bình cộng, bỏ qua null; không có giá trị nào thì null.
    public static Double average(Collection<Double> values) {
        double sum = 0;
        int count = 0;
        for (Double v : values) {
            if (v == null) continue;
            sum += v;
            count++;
        }
        return count == 0 ? null : round2(sum / count);
    }

    private static Double toPercent(Double fraction) {
        return fraction == null ? null : round2(fraction * 100);
    }

    private static double round2(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
