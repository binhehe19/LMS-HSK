package pl.co.lms.dto.request;

import jakarta.validation.constraints.*;
import java.util.Map;

public record DictionarySkipTestRequest(
        @NotNull @Size(min = 1, max = 5) Map<@NotBlank String, @NotBlank String> versions,
        @NotNull @Size(max = 10) Map<@NotBlank @Size(max = 50) String, @NotNull @Size(max = 2000) String> answers) {}
