package pl.co.lms.dto.response;

import pl.co.lms.entity.QuadWordSource;
import pl.co.lms.entity.QuadWordStatus;
import pl.co.lms.entity.json.QuadWordReview;
import java.util.List;

public record QuadWordSessionResponse(String id, QuadWordSource source, String pattern,
    int letterCount, List<QuadWordGuessResponse> guesses, int remaining, QuadWordStatus status, QuadWordReview review,
    QuadWordCollectionResponse collection) {
    public QuadWordSessionResponse(String id, QuadWordSource source, String pattern,
            int letterCount, List<QuadWordGuessResponse> guesses, int remaining, QuadWordStatus status, QuadWordReview review) {
        this(id, source, pattern, letterCount, guesses, remaining, status, review, null);
    }
}
