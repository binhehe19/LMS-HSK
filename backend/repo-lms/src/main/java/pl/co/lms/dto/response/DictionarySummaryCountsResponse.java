package pl.co.lms.dto.response;

import java.util.Map;

public record DictionarySummaryCountsResponse(
        long total,
        Map<String, Long> byLevel,
        Map<String, Long> byTopic
) {}
