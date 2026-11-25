package pl.co.lms.entity.json;

/** Internal snapshot. Never serialize this object directly in a game response. */
public record QuadWordCandidate(String resourceId, String resourceVersionId, String answer,
                                @com.fasterxml.jackson.annotation.JsonAlias("hint") String meaning,
                                QuadWordReview review) {}
