package pl.co.lms.entity.json;

/** Immutable content snapshot; edits to library resources do not affect an active game. */
public record VocabularyGameCard(String id, String term, String definition) {}
