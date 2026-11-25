package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotNull;
import pl.co.lms.entity.QuadWordSource;

public record StartQuadWordRequest(@NotNull QuadWordSource source,
        @jakarta.validation.constraints.Size(max = 40) String collectionId) {
    public StartQuadWordRequest(QuadWordSource source) { this(source, null); }
}
