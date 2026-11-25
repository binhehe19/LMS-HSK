package pl.co.lms.dto.request;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import pl.co.lms.dto.request.HeartbeatAssessmentAttemptRequest.AnswerItem;
import pl.co.lms.entity.json.QuizContent;

public final class PlacementRequests {
    private PlacementRequests() {}
    public enum Category { IELTS, FOUNDATION, PACE }
    public enum FoundationKind { PRONUNCIATION, VOCABULARY, GRAMMAR }
    public enum FoundationDifficulty { BEGINNER, INTERMEDIATE, ADVANCED }
    public record FoundationBand(@NotNull @Min(0) @Max(100) Integer minPercent,
                                 @NotBlank @Size(max=100) String label,
                                 @Size(max=1000) String recommendation) {}
    public record Foundation(@NotNull FoundationKind kind,
                             FoundationDifficulty difficulty,
                             @Size(max=10) List<@NotNull @Valid FoundationBand> bands) {}
    public enum FeedbackMethod { MENTOR, AI }
    public enum ConsultationStatus { CONTACTED, RESOLVED, CANCELLED }

    public record Section(@NotBlank @Pattern(regexp="[a-z][a-z0-9-]{0,39}") String key,
                          @NotBlank String title,
                          String description,
                          @NotNull @Valid QuizContent content) {}
    public record Test(@NotNull Category category,
                       @NotBlank String title,
                       String description,
                       @NotNull @Positive Integer durationSeconds,
                       @NotEmpty List<@NotNull @Valid Section> sections,
                       @Valid Foundation foundation,
                       String source,
                       String cover) {
        public Test(Category category, String title, String description, Integer durationSeconds, List<Section> sections) {
            this(category, title, description, durationSeconds, sections, null, null, null);
        }
        public Test(Category category, String title, String description, Integer durationSeconds, List<Section> sections, Foundation foundation) {
            this(category, title, description, durationSeconds, sections, foundation, null, null);
        }
    }
    public record Publish(@NotBlank @Size(max=26) String versionId) {}
    public record Submit(@NotNull FeedbackMethod feedbackMethod,
                         @PositiveOrZero Long revision,
                         List<@NotNull @Valid AnswerItem> answers,
                         JsonNode clientState) {}
    public record Consult(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{8,80}") String requestKey) {}
    public record HandleConsult(@NotNull ConsultationStatus status, @Size(max=2000) String internalNote) {}
}

