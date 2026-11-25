package pl.co.lms.entity;

/**
 * Bối cảnh của một lượt làm bài: CLASS_SESSION = bài trong buổi học của lớp (có package, buổi, giới hạn số lần, tính tiến độ);
 * SELF_STUDY = tự luyện, không gắn lớp/buổi.
 */
public enum AssessmentContextType {
    CLASS_SESSION, SELF_STUDY
}
