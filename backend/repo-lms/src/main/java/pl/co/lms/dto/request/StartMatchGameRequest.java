package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import pl.co.lms.entity.MatchGameSource;

public record StartMatchGameRequest(@NotNull MatchGameSource source, @Size(max = 80) String displayName) {}
