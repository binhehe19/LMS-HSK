package pl.co.lms.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.util.List;

// Admin lưu điểm cho một hay nhiều câu (chấm tay, duyệt điểm AI, hoặc chấm lại). sessionToken là khoá chấm
// đang giữ. earnedPoints phải <= maxPoints của câu (kiểm tra ở service).
public record SaveAssessmentManualGradingRequest(
        @NotBlank String sessionToken,
        @NotEmpty List<@Valid Item> items
) {
    public record Item(
            @NotBlank String answerId,
            @NotNull @DecimalMin("0") BigDecimal earnedPoints,
            String graderComment,
            // Điểm theo tiêu chí (Writing/Speaking): JSON mờ do frontend tính; earnedPoints là điểm đã tổng hợp.
            JsonNode rubricScores
    ) {
        public Item(String answerId, BigDecimal earnedPoints, String graderComment) {
            this(answerId, earnedPoints, graderComment, null);
        }
    }
}
