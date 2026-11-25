package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotNull;
import pl.co.lms.entity.LearningResourceType;

public record CreateLearningResourceRequest(
        @NotNull(message = "Resource type is required")
        LearningResourceType type,
        Object content,
        Boolean publishImmediately,
        /** true = tạo trong Kho; không gửi/false = bản riêng của một học phần. */
        Boolean inLibrary,
        /** Id tài nguyên Kho mà bản sao này được tạo từ đó (chỉ dùng khi inLibrary = false). */
        String sourceResourceId,
        /**
         * Loại phụ trong phạm vi {@code type} (xem ResourceSubTypes): bài đánh giá bỏ trống = QUIZ; từ vựng bỏ trống thì suy từ nội dung
         * (language zh = ZH, còn lại EN).
         */
        String subType,
        /** Tag tự do của học liệu. */
        java.util.List<String> tags,
        /** Kỹ năng bài luyện (token tự do, tùy chọn); bản sao từ Kho không gửi thì thừa hưởng của bài gốc. */
        String skill
) {
    /** Bản không có kỹ năng (các nơi tạo hiện có không cần biết đến skill). */
    public CreateLearningResourceRequest(LearningResourceType type, Object content, Boolean publishImmediately, Boolean inLibrary,
            String sourceResourceId, String subType, java.util.List<String> tags) {
        this(type, content, publishImmediately, inLibrary, sourceResourceId, subType, tags, null);
    }

    /** Bản không có nguồn Kho (tài nguyên tạo trực tiếp hoặc nhập từ catalog). */
    public CreateLearningResourceRequest(LearningResourceType type, Object content, Boolean publishImmediately, Boolean inLibrary) {
        this(type, content, publishImmediately, inLibrary, null, null, null, null);
    }

    public CreateLearningResourceRequest(LearningResourceType type, Object content, Boolean publishImmediately, Boolean inLibrary,
            String sourceResourceId) {
        this(type, content, publishImmediately, inLibrary, sourceResourceId, null, null, null);
    }
}
