package pl.co.lms.service.grading.ai;
import com.fasterxml.jackson.databind.JsonNode;

/** Optional provider. No provider means a saved submission with AI_UNAVAILABLE, never a fabricated score. */
public interface WritingAiGradingClient {
    JsonNode grade(JsonNode test, String essay) throws Exception;
}
