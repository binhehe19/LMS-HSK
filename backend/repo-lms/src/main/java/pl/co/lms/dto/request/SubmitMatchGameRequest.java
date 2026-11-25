package pl.co.lms.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public record SubmitMatchGameRequest(@NotEmpty @Size(max = 5000) List<@NotNull @Valid MatchGameMoveRequest> moves,
        @Min(0) int elapsedTenths) {}
