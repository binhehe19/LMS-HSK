package pl.co.lms.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class TopicRequests {
    private TopicRequests() {}

    public record Create(
            @NotNull @Min(value = 1, message = "sessionNo must be greater than or equal to 1") Integer sessionNo,
            @NotBlank @Size(max = 200) String title) {}

    public record Rename(@NotBlank @Size(max = 200) String title) {}

    public record Reorder(
            @NotNull @Min(1) Integer sessionNo,
            @NotNull List<String> topicIdsInOrder) {}

    /** topicId null = bỏ khỏi chủ đề. */
    public record Assign(String topicId) {}
}
