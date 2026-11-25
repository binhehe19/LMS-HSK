package pl.co.lms.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import pl.co.lms.entity.BlastGameEndReason;
import java.util.List;

public record SubmitBlastGameRequest(@NotNull @Size(max = 5000) List<@NotNull @Valid BlastGameHitRequest> hits,
        @Min(0) int elapsedMs, @NotNull BlastGameEndReason reason) {}
