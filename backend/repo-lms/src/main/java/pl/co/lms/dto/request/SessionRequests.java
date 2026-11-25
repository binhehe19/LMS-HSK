package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class SessionRequests {
    private SessionRequests() {}

    public record Rename(@NotBlank @Size(max = 200) String title) {}
}
