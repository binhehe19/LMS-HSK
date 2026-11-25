package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotBlank;

// Học sinh bắt đầu (hoặc tiếp tục) làm bài. Idempotent: nếu đã có attempt IN_PROGRESS cho
// (userId, learningResourceId, sessionId) thì trả lại attempt đó thay vì tạo mới.
// sessionNo chỉ để tương thích với client cũ và bị bỏ qua: số buổi luôn lấy từ buổi học thật do CMS trả về.
// classId (tuỳ chọn): lớp chứa buổi học, có thì chỉ tra buổi trong lớp đó thay vì quét mọi lớp của học sinh.
public record StartAssessmentAttemptRequest(
        @NotBlank String sessionId,
        Integer sessionNo,
        @NotBlank String contentPackageVersionId,
        @NotBlank String learningResourceId,
        String classId
) {
    public StartAssessmentAttemptRequest(String sessionId, Integer sessionNo, String contentPackageVersionId,
                                   String learningResourceId) {
        this(sessionId, sessionNo, contentPackageVersionId, learningResourceId, null);
    }
}
