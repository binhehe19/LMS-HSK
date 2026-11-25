package pl.co.lms.entity;

import java.util.EnumSet;
import java.util.Set;

/**
 * Loại học phần. Học phần lưu được mọi loại LearningResource, nhưng mỗi loại học phần chỉ "mở" cho học viên
 * một số loại resource: tab của học viên lấy theo cặp (loại học phần, loại resource), không chỉ theo loại resource.
 * Bảng này khớp SECTIONS_BY_PACKAGE_TYPE ở frontend (cụm nào hiện trên màn soạn thì học viên thấy ở tab tương ứng);
 * resource nằm ở cụm bị ẩn vẫn được giữ trong dữ liệu nhưng không hiện cho học viên.
 */
public enum ContentPackageType {
    GRAMMAR(EnumSet.of(LearningResourceType.GRAMMAR, LearningResourceType.ASSESSMENT)),
    VOCABULARY(EnumSet.of(LearningResourceType.VOCABULARY, LearningResourceType.ASSESSMENT)),
    ASSESSMENT(EnumSet.of(LearningResourceType.ASSESSMENT)),
    MATERIAL(EnumSet.of(LearningResourceType.MATERIAL)),
    SLIDE(EnumSet.of(LearningResourceType.SLIDE));

    private final Set<LearningResourceType> studentResourceTypes;

    ContentPackageType(Set<LearningResourceType> studentResourceTypes) {
        this.studentResourceTypes = studentResourceTypes;
    }

    /** Resource loại {@code type} trong học phần loại này có được hiển thị cho học viên không. */
    public boolean showsToStudents(LearningResourceType type) {
        return studentResourceTypes.contains(type);
    }

    /**
     * Nhóm bài tập (ExercisePool) mà các QUIZ resource trong học phần này được xếp vào khi trả về cho học viên:
     * học phần Ngữ pháp / Từ vựng có nhóm bài tập riêng, học phần Bài tập vào Quick Test; học phần Slide và
     * Tài liệu không hiển thị bài tập nên trả về null.
     */
    public ExercisePool exercisePool() {
        return switch (this) {
            case GRAMMAR    -> ExercisePool.GRAMMAR;
            case VOCABULARY -> ExercisePool.VOCABULARY;
            case ASSESSMENT -> ExercisePool.QUICK_TEST;
            case MATERIAL, SLIDE -> null;
        };
    }
}
