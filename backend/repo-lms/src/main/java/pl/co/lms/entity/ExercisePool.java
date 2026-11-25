package pl.co.lms.entity;

/**
 * Nhóm bài tập mà một QUIZ resource thuộc về trong buổi học của học viên.
 * GRAMMAR    - nhóm "Luyện tập Ngữ pháp"
 * VOCABULARY - nhóm "Luyện tập Từ vựng"
 * QUICK_TEST - nhóm "Quick Test" (mặc định cho học phần QUIZ thuần túy)
 */
public enum ExercisePool {
    GRAMMAR,
    VOCABULARY,
    QUICK_TEST
}
