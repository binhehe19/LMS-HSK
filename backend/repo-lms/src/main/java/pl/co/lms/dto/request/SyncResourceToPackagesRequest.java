package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record SyncResourceToPackagesRequest(
        @NotEmpty(message = "Chọn ít nhất một học phần để đồng bộ")
        List<String> linkIds
) {}
