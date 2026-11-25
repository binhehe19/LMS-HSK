package pl.co.lms.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MatchGameMoveRequest(@Min(0) int round, @NotBlank @Size(max = 100) String firstTileId,
        @NotBlank @Size(max = 100) String secondTileId, @Min(0) int pairTenths, @Min(0) int atTenths) {}
