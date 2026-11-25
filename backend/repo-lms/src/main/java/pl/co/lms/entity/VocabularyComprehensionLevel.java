package pl.co.lms.entity;

// Mức thuộc từ vựng của học sinh. KNOWN = "đã thuộc" (tính vào tiến độ Từ vựng, xem docs/homework-progress-metrics.md).
public enum VocabularyComprehensionLevel {
    UNKNOWN,
    NEW,
    LEARNING,
    KNOWN
}
