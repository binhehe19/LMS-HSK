package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateResourceContentRequest(@NotNull Object content) {}
