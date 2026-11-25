package pl.co.lms.dto.response;

import pl.co.lms.entity.BlastGameSource;
import pl.co.lms.entity.json.VocabularyGameCard;
import java.util.List;

public record BlastGameSessionResponse(String id, String datasetKey, BlastGameSource source,
        List<VocabularyGameCard> cards, int durationMs) {}
