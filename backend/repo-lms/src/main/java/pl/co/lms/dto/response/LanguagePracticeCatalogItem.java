package pl.co.lms.dto.response;

/** Lesson metadata only; transcripts and accepted answers stay on the server. */
public record LanguagePracticeCatalogItem(
        String id, String title, String description, String level,
        String media, long durationMillis, int segmentCount
) {}
