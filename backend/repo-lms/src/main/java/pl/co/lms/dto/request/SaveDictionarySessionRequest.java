package pl.co.lms.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public record SaveDictionarySessionRequest(@PositiveOrZero Long revision, boolean reset,
                                          @NotNull @Valid DictionarySessionData session) {}
