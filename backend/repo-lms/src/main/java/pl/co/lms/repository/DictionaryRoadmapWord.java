package pl.co.lms.repository;

/**
 * One published dictionary word reduced to the columns the lesson roadmap needs, read straight from the search columns of
 * {@code learning_resources} (no entity, tags or version JSON). title = normalized word, wordKey = lowercased word that keeps accents.
 */
public record DictionaryRoadmapWord(String id, String versionId, String topic, String cefrLevel, String title, String wordKey) {}
