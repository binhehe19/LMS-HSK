package pl.co.lms.dto.request;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;

// Cập nhật ghi chú/highlight sau khi đã nộp bài (xem lại kết quả). Không cần revision vì bài đã chốt.
public record SaveAnnotationsRequest(@NotNull JsonNode annotations) {}