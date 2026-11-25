package pl.co.lms.dto.request;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

// Bắt đầu (hoặc tiếp tục) một lượt tự luyện trên một bài QUIZ của Kho.
// mode: default | hard | easy (chế độ thời gian, chỉ khác thời lượng: xem QuizContent.timeLimits). variant (tuỳ chọn): phân biệt các lượt đang làm dở song song của cùng một bài (VD method của Writing).
// settings (tuỳ chọn): tuỳ chọn lúc bắt đầu, lưu nguyên vào lượt làm.
public record StartSelfStudyAttemptRequest(
        @NotBlank String learningResourceId,
        @NotBlank @Pattern(regexp = "default|hard|easy") String mode,
        @Pattern(regexp = "[a-z0-9_-]{1,40}") String variant,
        JsonNode settings
) {}
