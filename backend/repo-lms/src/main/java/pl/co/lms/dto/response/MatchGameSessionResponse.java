package pl.co.lms.dto.response;

import pl.co.lms.entity.MatchGameSource;
import java.util.List;

public record MatchGameSessionResponse(String id, String datasetKey, MatchGameSource source,
        List<MatchGameCardResponse> cards, int totalRounds) {}
