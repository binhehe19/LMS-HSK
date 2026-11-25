package pl.co.lms.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record ReorderSessionResourcesRequest(
        @Min(value = 1, message = "sessionNo must be greater than or equal to 1")
        Integer sessionNo,
        @NotEmpty(message = "learningResourceIdsInOrder cannot be empty")
        List<String> learningResourceIdsInOrder
) {}
