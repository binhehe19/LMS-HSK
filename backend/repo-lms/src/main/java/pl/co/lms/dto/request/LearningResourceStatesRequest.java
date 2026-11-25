package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

// Đọc hàng loạt trạng thái học của người dùng hiện tại cho một danh sách resource (VD nạp mức "đã thuộc" cho cả bộ flashcard).
public record LearningResourceStatesRequest(
        @NotEmpty @Size(max = 500) List<String> resourceIds
) {}
