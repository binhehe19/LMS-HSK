package pl.co.lms.dto.response;

import java.util.List;

public record DictionaryLessonsPageResponse(
        List<DictionaryCatalogLessonResponse> lessons,
        long totalLessons,
        long totalWords,
        int page,
        int size
) {}
