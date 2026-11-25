package pl.co.lms.dto.request;

import jakarta.validation.constraints.*;

public record SubmitQuadWordGuessRequest(
    @NotBlank @Pattern(regexp = "[a-zA-Z0-9-]{1,64}") String requestId,
    @NotBlank @Size(max = 300) String input,
    @NotNull @Min(0) @Max(5) Integer expectedGuessCount
) {}
